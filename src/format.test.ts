import { describe, it, expect } from "vitest";
import * as prettier from "prettier";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function fixture(name: string): string {
  return readFileSync(resolve(__dirname, "fixtures", name), "utf-8");
}

async function fmt(input: string, printWidth: number = 120): Promise<string> {
  const result = await prettier.format(input, {
    parser: "wgsl",
    plugins: [(await import("./index.ts")).default],
    printWidth,
    tabWidth: 2,
  });
  return result;
}

async function assertIdempotent(input: string, printWidth: number = 120): Promise<void> {
  const first = await fmt(input, printWidth);
  const second = await fmt(first, printWidth);
  expect(second).toBe(first);
}

const IDEMPOTENCY_WIDTHS = [40, 80, 120] as const;

async function assertIdempotentAtAllWidths(input: string): Promise<void> {
  for (const w of IDEMPOTENCY_WIDTHS) {
    await assertIdempotent(input, w);
  }
}

describe("end-to-end formatting", () => {
  it("formats a complete vertex shader", async () => {
    const input = `
struct VertexOutput{@builtin(position) position:vec4f,@location(0) color:vec4f,}

@group(0)@binding(0)var<uniform> mvp:mat4x4<f32>;

@vertex
fn vs_main(@location(0) position:vec3f,@location(1) color:vec4f)->VertexOutput{
var output:VertexOutput;
output.position=mvp*vec4f(position,1.0);
output.color=color;
return output;
}
    `;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats a compute shader", async () => {
    const input = `
@group(0)@binding(0)var<storage,read_write> data:array<f32>;

@compute@workgroup_size(64)
fn main(@builtin(global_invocation_id) id:vec3u){
let i=id.x;
data[i]=data[i]*2.0;
}
    `;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats a fragment shader with if/else", async () => {
    const input = `
@fragment
fn fs_main(@location(0) color:vec4f)->@location(0) vec4f{
if color.a<0.1{discard;}
return color;
}
    `;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats nested expressions correctly", async () => {
    const input = `const x=(a+b)*(c-d)/e;`;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats multiple directives before declarations", async () => {
    const input = `enable f16;diagnostic(off,derivative_uniformity);const X=1;`;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats all compound assignment operators", async () => {
    const ops = ["+=", "-=", "*=", "/=", "%=", "&=", "|=", "^="];
    for (const op of ops) {
      const input = `fn f(){x${op}1;}`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot(`compound assignment ${op}`);
    }
  });

  it("formats deeply nested member/index access", async () => {
    const input = `fn f(){a.b[i].c[j].d=1;}`;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats const_assert", async () => {
    const result = await fmt("const_assert true;");
    expect(result).toMatchSnapshot();
  });

  it("handles override with attributes", async () => {
    const result = await fmt("@id(0) override blockSize:u32=64;");
    expect(result).toMatchSnapshot();
  });

  it("formats switch with multiple case selectors", async () => {
    const input = `fn f(){switch x{case 1,2,3:{break;}default:{break;}}}`;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats empty struct", async () => {
    const result = await fmt("struct Empty{}");
    expect(result).toMatchSnapshot();
  });

  it("preserves boolean literals", async () => {
    const result = await fmt("const a=true;const b=false;");
    expect(result).toMatchSnapshot();
  });

  it("formats address-of and dereference", async () => {
    const result = await fmt("fn f(){let p=&v;let x=*p;}");
    expect(result).toMatchSnapshot();
  });

  it("formats parenthesized expressions", async () => {
    const result = await fmt("const x=(a+b);");
    expect(result).toMatchSnapshot();
  });

  it("idempotency - full shader", async () => {
    const shader = `
enable f16;

struct Uniforms {
  @size(64) modelMatrix: mat4x4<f32>,
  @size(64) viewMatrix: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs(@location(0) pos: vec3f) -> @builtin(position) vec4f {
  return uniforms.viewMatrix * uniforms.modelMatrix * vec4f(pos, 1.0);
}
    `;
    await assertIdempotentAtAllWidths(shader);
  });

  it("formats a particle simulation compute shader", async () => {
    const input = `
struct Particle{pos:vec3<f32>,vel:vec3<f32>,life:f32,}
struct SimParams{deltaTime:f32,gravity:vec3<f32>,maxSpeed:f32,}
@group(0)@binding(0)var<uniform> params:SimParams;
@group(0)@binding(1)var<storage,read> particlesIn:array<Particle>;
@group(0)@binding(2)var<storage,read_write> particlesOut:array<Particle>;
@compute@workgroup_size(64)
fn simulate(@builtin(global_invocation_id) gid:vec3u){
let idx=gid.x;
var p=particlesIn[idx];
if p.life<=0.0{return;}
p.vel=p.vel+params.gravity*params.deltaTime;
let speed=length(p.vel);
if speed>params.maxSpeed{p.vel=normalize(p.vel)*params.maxSpeed;}
p.pos=p.pos+p.vel*params.deltaTime;
p.life=p.life-params.deltaTime;
particlesOut[idx]=p;
}
`;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats a vertex + fragment shader with textures", async () => {
    const input = `
struct VertexInput{@location(0) position:vec3<f32>,@location(1) normal:vec3<f32>,@location(2) uv:vec2<f32>,}
struct VertexOutput{@builtin(position) clipPos:vec4<f32>,@location(0) worldNormal:vec3<f32>,@location(1) texCoord:vec2<f32>,}
struct Uniforms{model:mat4x4<f32>,viewProj:mat4x4<f32>,lightDir:vec3<f32>,ambient:f32,}
@group(0)@binding(0)var<uniform> u:Uniforms;
@group(0)@binding(1)var texSampler:sampler;
@group(0)@binding(2)var texAlbedo:texture_2d<f32>;
@vertex
fn vs(input:VertexInput)->VertexOutput{
var out:VertexOutput;
let worldPos=u.model*vec4f(input.position,1.0);
out.clipPos=u.viewProj*worldPos;
out.worldNormal=normalize((u.model*vec4f(input.normal,0.0)).xyz);
out.texCoord=input.uv;
return out;
}
@fragment
fn fs(v:VertexOutput)->@location(0) vec4f{
let albedo=textureSample(texAlbedo,texSampler,v.texCoord);
let nDotL=max(dot(v.worldNormal,u.lightDir),0.0);
let diffuse=albedo*nDotL;
let ambient=albedo*u.ambient;
return diffuse+ambient;
}
`;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  it("formats a mandelbrot shader with directives, switch, and loop/continuing", async () => {
    const input = `
enable f16;
diagnostic(off,derivative_uniformity);
const MAX_ITER:u32=100;
const ESCAPE_RADIUS:f32=4.0;
struct FragInput{@builtin(position) pos:vec4<f32>,}
@group(0)@binding(0)var<uniform> zoom:f32;
@group(0)@binding(1)var<uniform> center:vec2<f32>;
@group(0)@binding(2)var<uniform> colorMode:u32;
fn mandelbrot(c:vec2<f32>)->u32{
var z=vec2<f32>(0.0,0.0);
var i:u32=0;
loop{
if i>=MAX_ITER{break;}
let zNew=vec2f(z.x*z.x-z.y*z.y+c.x,2.0*z.x*z.y+c.y);
z=zNew;
if dot(z,z)>ESCAPE_RADIUS{break;}
continuing{i=i+1;}
}
return i;
}
fn colorize(iter:u32)->vec4f{
if iter==MAX_ITER{return vec4f(0.0,0.0,0.0,1.0);}
let t=f32(iter)/f32(MAX_ITER);
switch colorMode{
case 0:{return vec4f(t,t,t,1.0);}
case 1:{return vec4f(t,0.5*t,0.0,1.0);}
case 2,3:{return vec4f(0.0,t,1.0-t,1.0);}
default:{return vec4f(1.0,0.0,1.0,1.0);}
}
}
@fragment
fn fs_main(input:FragInput)->@location(0) vec4f{
let uv=(input.pos.xy/vec2f(800.0,600.0))*2.0-vec2f(1.0);
let c=center+uv*zoom;
let iter=mandelbrot(c);
return colorize(iter);
}
`;
    const result = await fmt(input);
    expect(result).toMatchSnapshot();
    await assertIdempotentAtAllWidths(input);
  });

  describe("real-world shaders (from gfx-rs/wgpu, Apache-2.0/MIT)", () => {
    // Source: https://github.com/gfx-rs/wgpu/blob/trunk/examples/features/src/shadow/shader.wgsl
    it("formats shadow mapping shader", async () => {
      const input = fixture("shadow.wgsl");
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
    });

    // Source: https://github.com/gfx-rs/wgpu/blob/trunk/examples/features/src/boids/compute.wgsl
    it("formats boids compute shader", async () => {
      const input = fixture("boids.wgsl");
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
    });

    // Source: https://github.com/gfx-rs/wgpu/blob/trunk/examples/features/src/skybox/shader.wgsl
    it("formats skybox shader", async () => {
      const input = fixture("skybox.wgsl");
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
    });

    // Source: https://github.com/gfx-rs/wgpu/blob/trunk/examples/features/src/water/water.wgsl
    it("formats water shader", async () => {
      const input = fixture("water.wgsl");
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
    });
  });

  describe("advanced WGSL features", () => {
    it("formats xor_shift function with ptr, deref, xor-assign, shift, hex", async () => {
      const input = `
fn xor_shift(state:ptr<function,u32>)->f32{
var x=*state;
x^=x<<13u;
x^=x>>17u;
x^=x<<5u;
*state=x;
return f32(x)/f32(0xFFFFFFFF);
}`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
      await assertIdempotentAtAllWidths(input);
    });

    it("formats atomic struct and atomic builtins", async () => {
      const input = `
struct Pixel{r:atomic<u32>,g:atomic<u32>,b:atomic<u32>,hits:atomic<u32>,}
@group(0)@binding(1)var<storage,read_write> data:array<Pixel>;
@group(0)@binding(4)var<storage,read_write> globalMaxHits:atomic<u32>;
fn f(flatIdx:u32,c:vec3<u32>,threadMaxHits:u32){
atomicAdd(&data[flatIdx].r,c.r);
atomicAdd(&data[flatIdx].g,c.g);
atomicAdd(&data[flatIdx].b,c.b);
let hits=atomicAdd(&data[flatIdx].hits,1u)+1u;
atomicMax(&globalMaxHits,threadMaxHits);
}`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
    });

    it("formats numeric literals with suffixes", async () => {
      const input = `
const pi=radians(180f);
const tau=radians(360f);
fn f(){
var threadMaxHits=300u;
let numIters=u32(uniforms.num_iters);
for(var i=0u;i<numIters;i++){
if i<20u{continue;}
}
}`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
    });

    it("formats builtins: bitcast, select, arrayLength, typed vec constructor", async () => {
      const input = `
fn f(buf:ptr<function,u32>){
var seed:u32=bitcast<u32>((p.x+idx)*0.345234);
let x=select(v.x,v.x*2.0,v.x<0.0);
let n=arrayLength(&ifsFunctions);
let v=vec2<f32>(0);
}`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
    });

    it("formats long additive chain idempotently", async () => {
      const input = `
fn f(workgroup_id:vec3<u32>,num_workgroups_vec:vec3<u32>){
let workgroup_index=workgroup_id.x+workgroup_id.y*num_workgroups_vec.x+workgroup_id.z*num_workgroups_vec.x*num_workgroups_vec.y;
}`;
      await assertIdempotentAtAllWidths(input);
      await assertIdempotentAtAllWidths(input);
    });

    it("collapses multiple blank lines between top-level decls", async () => {
      const input = `const pi = radians(180f);


const tau = radians(360f);



const workgroup_size: u32 = 128;
`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
    });

    it("formats compute shader excerpt with bare block, nested for, continue, atomicAdd, bitcast", async () => {
      const input = `
@compute@workgroup_size(128)
fn computeMain(
@builtin(num_workgroups) num_workgroups_vec:vec3<u32>,
@builtin(workgroup_id) workgroup_id:vec3<u32>,
@builtin(global_invocation_id) global_id:vec3<u32>,
@builtin(local_invocation_index) local_invocation_index:u32,
){
let idx=f32(global_id.x);
var p:vec2<f32>;
{
let percent=idx/f32(1024);
let angle=fract(percent+0.5)*6.28*25;
p=vec2<f32>(sin(angle),cos(angle))*(0.2+1.8*sin(percent*3.14));
}
var seed:u32=bitcast<u32>((p.x+idx)*0.345234);
for(var i=0u;i<100u;i++){
let funcIdx=u32(floor(xor_shift(&seed)*f32(4)));
if i<20u{continue;}
for(var j=0u;j<4u;j++){
let flatIdx:u32=0u;
atomicAdd(&data[flatIdx].r,1u);
}
}
}`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotentAtAllWidths(input);
      await assertIdempotentAtAllWidths(input);
    });
  });

  describe("comments", () => {
    it("preserves line comments", async () => {
      const input = `// This is a shader\nconst x = 1;`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
    });

    it("preserves block comments", async () => {
      const input = `/* Block comment */\nconst x = 1;`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
    });
  });
});
