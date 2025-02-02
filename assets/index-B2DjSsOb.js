(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))r(e);new MutationObserver(e=>{for(const a of e)if(a.type==="childList")for(const p of a.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&r(p)}).observe(document,{childList:!0,subtree:!0});function o(e){const a={};return e.integrity&&(a.integrity=e.integrity),e.referrerPolicy&&(a.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?a.credentials="include":e.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(e){if(e.ep)return;e.ep=!0;const a=o(e);fetch(e.href,a)}})();function l(n,t){return n+Math.random()*(t-n)}function _(n,t){const o=Math.random(),r=Math.random(),e=Math.sqrt(-2*Math.log(o))*Math.cos(2*Math.PI*r);return n+e*t}function E(n,t,o,r){let e=_(n,t);return e<o&&(e=o),e>r&&(e=r),e}function F(n){const t=[],o=[];t.push(0,0);for(let r=0;r<=n;r++){const e=r/n*Math.PI*2,a=Math.cos(e),p=Math.sin(e);t.push(a,p)}for(let r=1;r<n;r++)o.push(0,r,r+1);return o.push(0,n,1),{vertexData:new Float32Array(t),indexData:new Uint32Array(o),numVertices:o.length}}async function R(n){if(!n)throw new Error("canvas not found");const t=n.getContext("webgpu");if(!t)throw new Error("webgpu context not supported");const o=await navigator.gpu.requestAdapter();if(!o)throw new Error("webgpu not supported");const r=await o.requestDevice(),e=navigator.gpu.getPreferredCanvasFormat();return t.configure({device:r,format:e}),{device:r,context:t,presentationFormat:e}}const O=`struct RenderUniforms {
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
`,z=`struct Particle {
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

  let G: f32 = 0.000001;

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

    a = a + G * particles[j].mass * r_vec * invDistCube;
  }

  // update velocity and position
  vel = vel + a * params.dt;
  pos = pos + vel * params.dt;

  // save updated data
  particles[i].offset = pos;
  particles[i].velocity = vel;
}
`;function I(n,t,o){const r=n.createRenderPipeline({layout:"auto",vertex:{module:n.createShaderModule({code:O}),entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]},{arrayStride:32,stepMode:"instance",attributes:[{shaderLocation:1,offset:0,format:"unorm8x4"},{shaderLocation:2,offset:4,format:"float32"},{shaderLocation:3,offset:8,format:"float32x2"}]}]},fragment:{module:n.createShaderModule({code:O}),entryPoint:"fs",targets:[{format:t}]}}),e=n.createBindGroup({layout:r.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}}]});return{renderPipeline:r,renderBindGroup:e}}function T(n,t,o){const r=n.createShaderModule({code:z}),e=n.createComputePipeline({layout:"auto",compute:{module:r,entryPoint:"main"}}),a=n.createBindGroup({layout:e.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:t}},{binding:1,resource:{buffer:o}}]});return{computePipeline:e,computeBindGroup:a}}const g=1e4;V();async function V(){const n=document.querySelector("canvas");if(!n)throw new Error("canvas not found");const{device:t,context:o,presentationFormat:r}=await R(n),e=t.createBuffer({size:4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),a=t.createBuffer({size:4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),{renderPipeline:p,renderBindGroup:C}=I(t,r,e),P=32,w=g*P,v=new ArrayBuffer(w),m=new Uint8Array(v),d=new Float32Array(v);for(let u=0;u<g;u++){const c=u*P,s=u*8,f=E(1,1,.3,10);m[c+0]=Math.floor(l(100,255)),m[c+1]=Math.floor(l(100,255)),m[c+2]=Math.floor(l(200,255)),m[c+3]=255,d[s+1]=f*.01;const i=l(0,2*Math.PI),y=Math.sqrt(l(0,1));d[s+2]=y*Math.cos(i),d[s+3]=y*Math.sin(i),d[s+4]=0,d[s+5]=0,d[s+6]=f,d[s+7]=0}const h=t.createBuffer({size:w,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(h,0,v);const{vertexData:B,indexData:b,numVertices:D}=F(100),U=t.createBuffer({size:B.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(U,0,B);const x=t.createBuffer({size:b.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});t.queue.writeBuffer(x,0,b);const{computePipeline:A,computeBindGroup:q}=T(t,h,a),G={colorAttachments:[{view:void 0,clearValue:{r:.05,g:.05,b:.1,a:1},loadOp:"clear",storeOp:"store"}]};new ResizeObserver(u=>{for(const c of u){const{width:s,height:f}=c.contentRect;n.width=s,n.height=f}}).observe(n);let M=performance.now();function S(){if(!n)throw new Error("canvas not found");const u=performance.now(),c=(u-M)/1e3;M=u,t.queue.writeBuffer(a,0,new Float32Array([c]));const s=n.width/n.height;t.queue.writeBuffer(e,0,new Float32Array([s]));const f=t.createCommandEncoder();{const i=f.beginComputePass();i.setPipeline(A),i.setBindGroup(0,q);const L=Math.ceil(g/64);i.dispatchWorkgroups(L),i.end()}{G.colorAttachments[0].view=o.getCurrentTexture().createView();const i=f.beginRenderPass(G);i.setBindGroup(0,C),i.setPipeline(p),i.setVertexBuffer(0,U),i.setVertexBuffer(1,h),i.setIndexBuffer(x,"uint32"),i.drawIndexed(D,g,0,0,0),i.end()}t.queue.submit([f.finish()]),requestAnimationFrame(S)}requestAnimationFrame(S)}
