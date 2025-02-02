struct RenderUniforms {
  aspect: f32,
};

@group(0) @binding(0)
var<uniform> renderUniforms: RenderUniforms; // aspect ratio

// particle data
struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) radius: f32,
  @location(3) offset: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex
fn vs(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  // scale position by radius and add offset
  let pos = input.position * vec2<f32>(input.radius, input.radius) + input.offset;

  // rescale position to aspect ratio
  output.position = vec4<f32>(pos.x / renderUniforms.aspect, pos.y, 0.0, 1.0);
  output.color = input.color;

  return output;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.color;
}
