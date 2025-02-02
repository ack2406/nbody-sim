import renderShaderCode from "./shaders/render.wgsl?raw";
import computeShaderCode from "./shaders/compute.wgsl?raw";

// creates a render pipeline and a corresponding bind group
export function createRenderPipelineAndBindGroup(
  device: GPUDevice,
  format: GPUTextureFormat,
  renderUniformBuffer: GPUBuffer
) {
  // create a pipeline for rendering
  const renderPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: renderShaderCode }),
      entryPoint: "vs",
      buffers: [
        {
          // circle vertex buffer layout
          arrayStride: 8, // 2 * float32
          attributes: [
            {
              shaderLocation: 0, // position attribute
              offset: 0,
              format: "float32x2",
            },
          ],
        },
        {
          // particle data buffer layout
          arrayStride: 32, // color, radius, offset, velocity, mass, padding
          stepMode: "instance", // one particle per instance
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
              shaderLocation: 3, // offset (x, y)
              offset: 8,
              format: "float32x2",
            },
            // velocity and mass are not used in the vertex shader, so omitted
          ],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({ code: renderShaderCode }),
      entryPoint: "fs",
      targets: [{ format }],
    },
  });

  // create a bind group for the render pipeline (includes uniform buffer)
  const renderBindGroup = device.createBindGroup({
    layout: renderPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: renderUniformBuffer },
      },
    ],
  });

  return { renderPipeline, renderBindGroup };
}

// creates a compute pipeline and a corresponding bind group
export function createComputePipelineAndBindGroup(
  device: GPUDevice,
  particleBuffer: GPUBuffer,
  paramsBuffer: GPUBuffer
) {
  // create a module for the compute shader
  const computeShaderModule = device.createShaderModule({
    code: computeShaderCode,
  });

  // create the compute pipeline
  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: computeShaderModule,
      entryPoint: "main",
    },
  });

  // create a bind group that holds the particle buffer and params buffer
  const computeBindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: particleBuffer },
      },
      {
        binding: 1,
        resource: { buffer: paramsBuffer },
      },
    ],
  });

  return { computePipeline, computeBindGroup };
}
