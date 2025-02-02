import { rand, randNormalClamped } from "./random";
import { generateCircleData } from "./geometry";
import { initWebGPU } from "./gpu-setup";
import {
  createRenderPipelineAndBindGroup,
  createComputePipelineAndBindGroup,
} from "./pipelines";

// total number of particles in the simulation
const PARTICLES_COUNT = 10000;

// entry point for the app
start();

async function start() {
  // get the canvas from the html
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) {
    throw new Error("canvas not found");
  }

  // initialize webgpu
  const { device, context, presentationFormat } = await initWebGPU(canvas);

  // create a buffer for passing aspect ratio to the render shader
  const renderUniformBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // create a buffer for passing delta time (dt) to the compute shader
  const paramsBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // create the render pipeline and bind group
  const { renderPipeline, renderBindGroup } = createRenderPipelineAndBindGroup(
    device,
    presentationFormat,
    renderUniformBuffer
  );

  // create the particle buffer
  // each particle has 32 bytes: color(4), radius(4), offset(8), velocity(8), mass(4), padding(4)
  const particleUnitSize = 32;
  const particleBufferSize = PARTICLES_COUNT * particleUnitSize;
  const particleArray = new ArrayBuffer(particleBufferSize);
  const particleU8 = new Uint8Array(particleArray);
  const particleF32 = new Float32Array(particleArray);

  // fill the particle data with random values
  for (let i = 0; i < PARTICLES_COUNT; i++) {
    const baseByte = i * particleUnitSize;
    const baseFloat = i * 8;

    // pick a random mass using normal distribution, then clamp
    const mass = randNormalClamped(1, 1, 0.3, 10);

    // color (4 bytes: r, g, b, a)
    particleU8[baseByte + 0] = Math.floor(rand(100, 255));
    particleU8[baseByte + 1] = Math.floor(rand(100, 255));
    particleU8[baseByte + 2] = Math.floor(rand(200, 255));
    particleU8[baseByte + 3] = 255;

    // radius (float32) = mass * 0.01
    particleF32[baseFloat + 1] = mass * 0.01;

    // position (float32x2)
    const angle = rand(0, 2 * Math.PI);
    const radius = Math.sqrt(rand(0, 1)); // sqrt to ensure uniform distribution
    particleF32[baseFloat + 2] = radius * Math.cos(angle);
    particleF32[baseFloat + 3] = radius * Math.sin(angle);

    // velocity (float32x2)
    particleF32[baseFloat + 4] = 0;
    particleF32[baseFloat + 5] = 0;

    // mass (float32)
    particleF32[baseFloat + 6] = mass;

    // padding (float32)
    particleF32[baseFloat + 7] = 0;
  }

  // create a gpu buffer for particle data
  const particleBuffer = device.createBuffer({
    size: particleBufferSize,
    usage:
      GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  // copy the array data to the gpu buffer
  device.queue.writeBuffer(particleBuffer, 0, particleArray);

  // generate circle geometry for rendering each particle
  const { vertexData, indexData, numVertices } = generateCircleData(100);

  // create a vertex buffer for the circle
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  // create an index buffer for the circle
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  // create the compute pipeline and bind group
  const { computePipeline, computeBindGroup } =
    createComputePipelineAndBindGroup(device, particleBuffer, paramsBuffer);

  // set up a render pass descriptor for drawing
  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined as unknown as GPUTextureView,
        clearValue: { r: 0.05, g: 0.05, b: 0.1, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      } as GPURenderPassColorAttachment,
    ],
  };

  // resize observer updates the canvas size
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      canvas.width = width;
      canvas.height = height;
    }
  });
  observer.observe(canvas);

  let lastFrameTime = performance.now();

  // animation loop
  function frame() {
    if (!canvas) {
      throw new Error("canvas not found");
    }

    const now = performance.now();
    // calculate delta time in seconds
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    // write delta time into the params buffer for the compute shader
    device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([dt]));

    // calculate aspect ratio and send it to the render shader
    const aspect = canvas.width / canvas.height;
    device.queue.writeBuffer(
      renderUniformBuffer,
      0,
      new Float32Array([aspect])
    );

    // create a command encoder to record gpu commands
    const commandEncoder = device.createCommandEncoder();

    // begin compute pass
    {
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);

      // use 64 threads per workgroup
      const workgroupSize = 64;
      // calculate how many workgroups we need for all particles
      const workgroupCount = Math.ceil(PARTICLES_COUNT / workgroupSize);

      computePass.dispatchWorkgroups(workgroupCount);
      computePass.end();
    }

    // begin render pass
    {
      // get the current texture from the swap chain
      renderPassDescriptor.colorAttachments[0].view = context
        .getCurrentTexture()
        .createView();

      const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
      renderPass.setBindGroup(0, renderBindGroup);
      renderPass.setPipeline(renderPipeline);

      // set circle geometry (vertex/index) and particle buffer
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.setVertexBuffer(1, particleBuffer);
      renderPass.setIndexBuffer(indexBuffer, "uint32");

      // draw all particles using instanced rendering
      renderPass.drawIndexed(numVertices, PARTICLES_COUNT, 0, 0, 0);
      renderPass.end();
    }

    // submit all recorded commands
    device.queue.submit([commandEncoder.finish()]);

    // request the next animation frame
    requestAnimationFrame(frame);
  }

  // start the animation loop
  requestAnimationFrame(frame);
}
