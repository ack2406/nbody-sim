struct Particle {
  _color: f32, // not used
  radius: f32,
  offset: vec2<f32>,
  velocity: vec2<f32>,
  mass: f32,
  _padding: f32,
};

@group(0) @binding(0)
var<storage, read_write> particles: array<Particle>;

struct Params {
  dt: f32,
  g: f32,
};

@group(0) @binding(1)
var<uniform> params: Params; // time step

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let i = id.x;
  if (i >= arrayLength(&particles)) {
    return;
  }

  // get particle data
  var pos = particles[i].offset;
  var vel = particles[i].velocity;
  let myMass = particles[i].mass;
  let myRadius = particles[i].radius;

  // softening factor to prevent singularities
  let softening: f32 = 0.1;

  // calculate acceleration
  var a: vec2<f32> = vec2<f32>(0.0, 0.0);
  for (var j: u32 = 0u; j < arrayLength(&particles); j = j + 1u) {
    if (j == i) {
      continue;
    }
    let r_vec = particles[j].offset - pos;
    
    let distSq = dot(r_vec, r_vec) + softening * softening;

    let invDist = 1.0 / sqrt(distSq);
    let invDistCube = invDist * invDist * invDist;

    a = a + params.g * particles[j].mass * r_vec * invDistCube / 1000000;
  }

  // update velocity and position
  vel = vel + a * params.dt;
  pos = pos + vel * params.dt;

  // save updated data
  particles[i].offset = pos;
  particles[i].velocity = vel;
}
