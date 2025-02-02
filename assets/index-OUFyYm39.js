(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))t(e);new MutationObserver(e=>{for(const i of e)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&t(s)}).observe(document,{childList:!0,subtree:!0});function a(e){const i={};return e.integrity&&(i.integrity=e.integrity),e.referrerPolicy&&(i.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?i.credentials="include":e.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function t(e){if(e.ep)return;e.ep=!0;const i=a(e);fetch(e.href,i)}})();const g=`struct RenderUniforms {
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
`,L=`struct Particle {
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
  let softening: f32 = 0.05;

  let G: f32 = 0.001;

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
`,l=3;function c(n,o){return n+Math.random()*(o-n)}function _(n){const o=[],a=[];o.push(0,0);for(let t=0;t<=n;t++){const e=t/n*Math.PI*2,i=Math.cos(e),s=Math.sin(e);o.push(i,s)}for(let t=1;t<n;t++)a.push(0,t,t+1);return a.push(0,n,1),{vertexData:new Float32Array(o),indexData:new Uint32Array(a),numVertices:a.length}}const f=document.querySelector("canvas");if(!f)throw new Error("Canvas not found");const y=f.getContext("webgpu"),P=await navigator.gpu.requestAdapter();if(!P)throw new Error("WebGPU not supported");const r=await P.requestDevice(),B=navigator.gpu.getPreferredCanvasFormat();y.configure({device:r,format:B});const U=r.createBuffer({size:4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),b=r.createRenderPipeline({layout:"auto",vertex:{module:r.createShaderModule({code:g}),entryPoint:"vs",buffers:[{arrayStride:8,attributes:[{shaderLocation:0,offset:0,format:"float32x2"}]},{arrayStride:32,stepMode:"instance",attributes:[{shaderLocation:1,offset:0,format:"unorm8x4"},{shaderLocation:2,offset:4,format:"float32"},{shaderLocation:3,offset:8,format:"float32x2"}]}]},fragment:{module:r.createShaderModule({code:g}),entryPoint:"fs",targets:[{format:B}]}}),q=r.createBindGroup({layout:b.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:U}}]}),w=32,x=l*w,p=new ArrayBuffer(x),d=new Uint8Array(p),u=new Float32Array(p);for(let n=0;n<l;n++){const o=n*w,a=n*8,t=c(.5,5);d[o+0]=Math.floor(c(100,255)),d[o+1]=Math.floor(c(100,255)),d[o+2]=Math.floor(c(200,255)),d[o+3]=255,u[a+1]=t*.01,u[a+2]=c(-1,1),u[a+3]=c(-1,1),u[a+4]=c(0,0),u[a+5]=c(0,0),u[a+6]=t,u[a+7]=0}const m=r.createBuffer({size:x,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});r.queue.writeBuffer(m,0,p);const{vertexData:G,indexData:O,numVertices:F}=_(100),D=r.createBuffer({size:G.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});r.queue.writeBuffer(D,0,G);const S=r.createBuffer({size:O.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});r.queue.writeBuffer(S,0,O);const C=r.createBuffer({size:4,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),V=r.createShaderModule({code:L}),M=r.createComputePipeline({layout:"auto",compute:{module:V,entryPoint:"main"}}),R=r.createBindGroup({layout:M.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:m}},{binding:1,resource:{buffer:C}}]}),v={colorAttachments:[{view:void 0,clearValue:{r:.1,g:.1,b:.15,a:1},loadOp:"clear",storeOp:"store"}]};let h=performance.now();function A(){const n=performance.now(),o=(n-h)/1e3;h=n,r.queue.writeBuffer(C,0,new Float32Array([o]));const a=f.width/f.height;r.queue.writeBuffer(U,0,new Float32Array([a]));const t=r.createCommandEncoder(),e=t.beginComputePass();e.setPipeline(M),e.setBindGroup(0,R);const i=Math.ceil(l/64);e.dispatchWorkgroups(i),e.end(),v.colorAttachments[0].view=y.getCurrentTexture().createView();const s=t.beginRenderPass(v);s.setBindGroup(0,q),s.setPipeline(b),s.setVertexBuffer(0,D),s.setVertexBuffer(1,m),s.setIndexBuffer(S,"uint32"),s.drawIndexed(F,l,0,0,0),s.end(),r.queue.submit([t.finish()]),requestAnimationFrame(A)}const E=new ResizeObserver(n=>{for(const o of n){const{width:a,height:t}=o.contentRect;f.width=a,f.height=t}});E.observe(f);requestAnimationFrame(A);
