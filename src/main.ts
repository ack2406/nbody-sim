import renderShaderCode from "./shaders/render.wgsl?raw";
import computeShaderCode from "./shaders/compute.wgsl?raw";

const PARTICLES_COUNT = 3;

// random float in [min, max)
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function generateCircleData(segments: number) {
  const vertexData: number[] = [];
  const indexData: number[] = [];

  // circle center
  vertexData.push(0, 0);

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    vertexData.push(x, y);
  }

  for (let i = 1; i < segments; i++) {
    indexData.push(0, i, i + 1);
  }
  indexData.push(0, segments, 1);

  return {
    vertexData: new Float32Array(vertexData),
    indexData: new Uint32Array(indexData),
    numVertices: indexData.length,
  };
}

// init WebGPU
const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
if (!canvas) throw new Error("Canvas not found");

const context = canvas.getContext("webgpu")!;
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("WebGPU not supported");
const device = await adapter.requestDevice();

const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({
  device,
  format: presentationFormat,
});

// render uniform for aspect = canvas.width / canvas.height
const renderUniformBuffer = device.createBuffer({
  size: 4,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const renderPipeline = device.createRenderPipeline({
  layout: "auto",
  vertex: {
    module: device.createShaderModule({ code: renderShaderCode }),
    entryPoint: "vs",
    buffers: [
      {
        // circle geometry buffer
        arrayStride: 8, // = 2 * sizeof(float32)
        attributes: [
          {
            shaderLocation: 0, // position
            offset: 0,
            format: "float32x2",
          },
        ],
      },
      {
        arrayStride: 32, // 4 color + 4 radius + 8 offset + 8 velocity + 4 mass + 4 padding
        stepMode: "instance",
        attributes: [
          {
            shaderLocation: 1, // color
            offset: 0,
            format: "unorm8x4",
          },
          {
            shaderLocation: 2, // radius
            offset: 4,
            format: "float32",
          },
          {
            shaderLocation: 3, // offset
            offset: 8,
            format: "float32x2",
          },
          // velocity and mass are not used in this shader
        ],
      },
    ],
  },
  fragment: {
    module: device.createShaderModule({ code: renderShaderCode }),
    entryPoint: "fs",
    targets: [{ format: presentationFormat }],
  },
});

const renderBindGroup = device.createBindGroup({
  layout: renderPipeline.getBindGroupLayout(0),
  entries: [
    {
      binding: 0,
      resource: { buffer: renderUniformBuffer },
    },
  ],
});

const particleUnitSize = 32; // bytes per particle
const particleBufferSize = PARTICLES_COUNT * particleUnitSize;
const particleArray = new ArrayBuffer(particleBufferSize);
const particleU8 = new Uint8Array(particleArray);
const particleF32 = new Float32Array(particleArray);

for (let i = 0; i < PARTICLES_COUNT; i++) {
  const baseByte = i * particleUnitSize;
  const baseFloat = i * 8;

  const mass = rand(0.5, 5);

  // color (4 bytes)
  particleU8[baseByte + 0] = Math.floor(rand(100, 255)); // R
  particleU8[baseByte + 1] = Math.floor(rand(100, 255)); // G
  particleU8[baseByte + 2] = Math.floor(rand(200, 255)); // B
  particleU8[baseByte + 3] = 255; // A

  // radius (1 byte)
  particleF32[baseFloat + 1] = mass * 0.01;

  // offset (2 bytes)
  particleF32[baseFloat + 2] = rand(-1, 1);
  particleF32[baseFloat + 3] = rand(-1, 1);

  // velocity (2 bytes)
  particleF32[baseFloat + 4] = rand(0, 0);
  particleF32[baseFloat + 5] = rand(0, 0);

  // mass (1 byte)
  particleF32[baseFloat + 6] = mass;

  // padding (1 byte)
  particleF32[baseFloat + 7] = 0;
}

const particleBuffer = device.createBuffer({
  size: particleBufferSize,
  usage:
    GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(particleBuffer, 0, particleArray);

// particle geometry
const { vertexData, indexData, numVertices } = generateCircleData(100);
const vertexBuffer = device.createBuffer({
  size: vertexData.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(vertexBuffer, 0, vertexData);

const indexBuffer = device.createBuffer({
  size: indexData.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});
device.queue.writeBuffer(indexBuffer, 0, indexData);

// delta time
const paramsBuffer = device.createBuffer({
  size: 4,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const computeShaderModule = device.createShaderModule({
  code: computeShaderCode,
});
const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: {
    module: computeShaderModule,
    entryPoint: "main",
  },
});
const computeBindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: particleBuffer } },
    { binding: 1, resource: { buffer: paramsBuffer } },
  ],
});

const renderPassDescriptor = {
  colorAttachments: [
    {
      view: undefined as unknown as GPUTextureView,
      clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
      loadOp: "clear",
      storeOp: "store",
    } as GPURenderPassColorAttachment,
  ],
};

let lastFrameTime = performance.now();
function frame() {
  const now = performance.now();
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  // update delta time
  device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([dt]));

  // update aspect ratio
  const aspect = canvas.width / canvas.height;
  device.queue.writeBuffer(renderUniformBuffer, 0, new Float32Array([aspect]));

  const commandEncoder = device.createCommandEncoder();

  // update particles positions and velocities
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(computePipeline);
  computePass.setBindGroup(0, computeBindGroup);
  const workgroupCount = Math.ceil(PARTICLES_COUNT / 64);
  computePass.dispatchWorkgroups(workgroupCount);
  computePass.end();

  // render particles
  renderPassDescriptor.colorAttachments[0].view = context
    .getCurrentTexture()
    .createView();
  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.setBindGroup(0, renderBindGroup);
  renderPass.setPipeline(renderPipeline);
  renderPass.setVertexBuffer(0, vertexBuffer);
  renderPass.setVertexBuffer(1, particleBuffer);
  renderPass.setIndexBuffer(indexBuffer, "uint32");
  renderPass.drawIndexed(numVertices, PARTICLES_COUNT, 0, 0, 0);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}

// resize canvas
const observer = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    canvas.width = width;
    canvas.height = height;
  }
});
observer.observe(canvas);

requestAnimationFrame(frame);
