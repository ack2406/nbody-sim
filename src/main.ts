import { rand, randNormalClamped } from "./random";
import { generateCircleData } from "./geometry";
import { initWebGPU } from "./gpuSetup";
import {
  createRenderPipelineAndBindGroup,
  createComputePipelineAndBindGroup,
} from "./pipelines";

// global variable for current animation frame id
let animationFrameId: number | null = null;

// start simulation on page load
initUI();

function initUI() {
  const restartButton = document.getElementById(
    "restartButton"
  ) as HTMLButtonElement;
  const particleInput = document.getElementById(
    "particleCount"
  ) as HTMLInputElement;
  const gInput = document.getElementById("gParam") as HTMLInputElement;

  // start simulation with initial values from inputs
  startSimulation(Number(particleInput.value), Number(gInput.value));

  // restart simulation on button click
  restartButton.addEventListener("click", () => {
    // cancel current animation loop if running
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    // read new particle count and g value from inputs
    const newCount = Number(particleInput.value);
    const newG = Number(gInput.value);
    startSimulation(newCount, newG);
  });
}

async function startSimulation(PARTICLES_COUNT: number, initialG: number) {
  // get the canvas element
  const canvas = document.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) throw new Error("canvas not found");

  // initialize webgpu: device, context, and preferred format
  const { device, context, presentationFormat } = await initWebGPU(canvas);

  // create a buffer for render uniform (aspect ratio)
  const renderUniformBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // create a buffer for compute parameters (dt and g)
  // we need 8 bytes (2 x float32)
  const paramsBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // create render pipeline and bind group
  const { renderPipeline, renderBindGroup } = createRenderPipelineAndBindGroup(
    device,
    presentationFormat,
    renderUniformBuffer
  );

  // create particle data buffer
  const particleUnitSize = 32; // bytes per particle
  const particleBufferSize = PARTICLES_COUNT * particleUnitSize;
  const particleArray = new ArrayBuffer(particleBufferSize);
  const particleU8 = new Uint8Array(particleArray);
  const particleF32 = new Float32Array(particleArray);

  // fill particle data with random values
  for (let i = 0; i < PARTICLES_COUNT; i++) {
    const baseByte = i * particleUnitSize;
    const baseFloat = i * 8;
    const mass = randNormalClamped(1, 1, 0.3, 10);

    // color (r, g, b, a)
    particleU8[baseByte + 0] = Math.floor(rand(100, 255));
    particleU8[baseByte + 1] = Math.floor(rand(100, 255));
    particleU8[baseByte + 2] = Math.floor(rand(200, 255));
    particleU8[baseByte + 3] = 255;

    // radius: mass * 0.01
    particleF32[baseFloat + 1] = mass * 0.01;

    // position (x, y)
    const angle = rand(0, 2 * Math.PI);
    const radius = Math.sqrt(rand(0, 1)); // sqrt to ensure uniform distribution
    particleF32[baseFloat + 2] = radius * Math.cos(angle);
    particleF32[baseFloat + 3] = radius * Math.sin(angle);

    // velocity (x, y) - initially 0
    particleF32[baseFloat + 4] = 0;
    particleF32[baseFloat + 5] = 0;

    // mass
    particleF32[baseFloat + 6] = mass;

    // padding
    particleF32[baseFloat + 7] = 0;
  }

  // create a gpu buffer for particles and write data into it
  const particleBuffer = device.createBuffer({
    size: particleBufferSize,
    usage:
      GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(particleBuffer, 0, particleArray);

  // generate circle geometry for particles
  const { vertexData, indexData, numVertices } = generateCircleData(100);

  // create a vertex buffer for circle geometry
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  // create an index buffer for circle geometry
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  // create compute pipeline and bind group
  const { computePipeline, computeBindGroup } =
    createComputePipelineAndBindGroup(device, particleBuffer, paramsBuffer);

  // setup render pass descriptor
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

  // observe canvas resize events
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      canvas.width = width;
      canvas.height = height;
    }
  });
  observer.observe(canvas);

  let lastFrameTime = performance.now();
  let g = initialG;

  // animation loop
  function frame() {
    if (!canvas) {
      throw new Error("canvas not found");
    }
    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000; // dt in seconds
    lastFrameTime = now;

    // update g value from the ui input (in case user zmieni wartość)
    const gInput = document.getElementById("gParam") as HTMLInputElement;
    g = Number(gInput.value);

    // update compute uniform buffer (dt and g)
    device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([dt, g]));

    // update render uniform (aspect ratio)
    const aspect = canvas.width / canvas.height;
    device.queue.writeBuffer(
      renderUniformBuffer,
      0,
      new Float32Array([aspect])
    );

    // create a command encoder to record gpu commands
    const commandEncoder = device.createCommandEncoder();

    // compute pass: update particle velocities and positions
    {
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      const workgroupSize = 64;
      const workgroupCount = Math.ceil(PARTICLES_COUNT / workgroupSize);
      computePass.dispatchWorkgroups(workgroupCount);
      computePass.end();
    }

    // render pass: draw particles
    {
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
    }

    // submit all recorded commands
    device.queue.submit([commandEncoder.finish()]);

    // request the next animation frame
    animationFrameId = requestAnimationFrame(frame);
  }

  // start animation loop
  animationFrameId = requestAnimationFrame(frame);
}
