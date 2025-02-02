(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))e(t);new MutationObserver(t=>{for(const a of t)if(a.type==="childList")for(const c of a.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&e(c)}).observe(document,{childList:!0,subtree:!0});function r(t){const a={};return t.integrity&&(a.integrity=t.integrity),t.referrerPolicy&&(a.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?a.credentials="include":t.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function e(t){if(t.ep)return;t.ep=!0;const a=r(t);fetch(t.href,a)}})();function m(n,o){return n+Math.random()*(o-n)}function V(n,o){const r=Math.random(),e=Math.random(),t=Math.sqrt(-2*Math.log(r))*Math.cos(2*Math.PI*e);return n+t*o}function _(n,o,r,e){let t=V(n,o);return t<r&&(t=r),t>e&&(t=e),t}function N(n){const o=[],r=[];o.push(0,0);for(let e=0;e<=n;e++){const t=e/n*Math.PI*2,a=Math.cos(t),c=Math.sin(t);o.push(a,c)}for(let e=1;e<n;e++)r.push(0,e,e+1);return r.push(0,n,1),{vertexData:new Float32Array(o),indexData:new Uint32Array(r),numVertices:r.length}}async function R(n){if(!n)throw new Error("canvas not found");const o=n.getContext("webgpu");if(!o)throw new Error("webgpu context not supported");const r=await navigator.gpu.requestAdapter();if(!r)throw new Error("webgpu not supported");const e=await r.requestDevice(),t=navigator.gpu.getPreferredCanvasFormat();return o.configure({device:e,format:t}),{device:e,context:o,presentationFormat:t}}const q=`struct RenderUniforms {
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
`,j=`struct Particle {
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
`;function Y(n,o,r){const e=n.createRenderPipeline({layout:"auto",vertex:{module:n.createShaderModule({code:q}),entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]},{arrayStride:32,stepMode:"instance",attributes:[{shaderLocation:1,offset:0,format:"unorm8x4"},{shaderLocation:2,offset:4,format:"float32"},{shaderLocation:3,offset:8,format:"float32x2"}]}]},fragment:{module:n.createShaderModule({code:q}),entryPoint:"fs",targets:[{format:o}]}}),t=n.createBindGroup({layout:e.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:r}}]});return{renderPipeline:e,renderBindGroup:t}}function T(n,o,r){const e=n.createShaderModule({code:j}),t=n.createComputePipeline({layout:"auto",compute:{module:e,entryPoint:"main"}}),a=n.createBindGroup({layout:t.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:o}},{binding:1,resource:{buffer:r}}]});return{computePipeline:t,computeBindGroup:a}}let v=null;X();function X(){const n=document.getElementById("restartButton"),o=document.getElementById("particleCount"),r=document.getElementById("gParam");F(Number(o.value),Number(r.value)),n.addEventListener("click",()=>{v!==null&&cancelAnimationFrame(v);const e=Number(o.value),t=Number(r.value);F(e,t)})}async function F(n,o){const r=document.querySelector("canvas");if(!r)throw new Error("canvas not found");const{device:e,context:t,presentationFormat:a}=await R(r),c=e.createBuffer({size:4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),B=e.createBuffer({size:8,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),{renderPipeline:I,renderBindGroup:E}=Y(e,a,c),w=32,P=n*w,h=new ArrayBuffer(P),g=new Uint8Array(h),d=new Float32Array(h);for(let u=0;u<n;u++){const f=u*w,s=u*8,l=_(1,1,.3,10);g[f+0]=Math.floor(m(100,255)),g[f+1]=Math.floor(m(100,255)),g[f+2]=Math.floor(m(200,255)),g[f+3]=255,d[s+1]=l*.01;const p=m(0,2*Math.PI),i=Math.sqrt(m(0,1));d[s+2]=i*Math.cos(p),d[s+3]=i*Math.sin(p),d[s+4]=0,d[s+5]=0,d[s+6]=l,d[s+7]=0}const y=e.createBuffer({size:P,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(y,0,h);const{vertexData:b,indexData:U,numVertices:A}=N(100),x=e.createBuffer({size:b.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(x,0,b);const M=e.createBuffer({size:U.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(M,0,U);const{computePipeline:C,computeBindGroup:L}=T(e,y,B),G={colorAttachments:[{view:void 0,clearValue:{r:.1,g:.1,b:.15,a:1},loadOp:"clear",storeOp:"store"}]};new ResizeObserver(u=>{for(const f of u){const{width:s,height:l}=f.contentRect;r.width=s,r.height=l}}).observe(r);let D=performance.now(),S=o;function O(){if(!r)throw new Error("canvas not found");const u=performance.now(),f=(u-D)/1e3;D=u;const s=document.getElementById("gParam");S=Number(s.value),e.queue.writeBuffer(B,0,new Float32Array([f,S]));const l=r.width/r.height;e.queue.writeBuffer(c,0,new Float32Array([l]));const p=e.createCommandEncoder();{const i=p.beginComputePass();i.setPipeline(C),i.setBindGroup(0,L);const z=Math.ceil(n/64);i.dispatchWorkgroups(z),i.end()}{G.colorAttachments[0].view=t.getCurrentTexture().createView();const i=p.beginRenderPass(G);i.setBindGroup(0,E),i.setPipeline(I),i.setVertexBuffer(0,x),i.setVertexBuffer(1,y),i.setIndexBuffer(M,"uint32"),i.drawIndexed(A,n,0,0,0),i.end()}e.queue.submit([p.finish()]),v=requestAnimationFrame(O)}v=requestAnimationFrame(O)}
