// initializes webgpu and configures the canvas
export async function initWebGPU(canvas: HTMLCanvasElement): Promise<{
  device: GPUDevice;
  context: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;
}> {
  // check if the canvas exists
  if (!canvas) {
    throw new Error("canvas not found");
  }

  // get the webgpu context from the canvas
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("webgpu context not supported");
  }

  // request a gpu adapter
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("webgpu not supported");
  }

  // request a gpu device
  const device = await adapter.requestDevice();

  // get the preferred canvas format
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  // configure the context with the device and format
  context.configure({
    device,
    format: presentationFormat,
  });

  return { device, context, presentationFormat };
}
