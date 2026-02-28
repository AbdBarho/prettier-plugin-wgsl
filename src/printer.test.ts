import { describe, it, expect } from "vitest";
import * as prettier from "prettier";

async function fmt(input: string): Promise<string> {
  const result = await prettier.format(input, {
    parser: "wgsl",
    plugins: [(await import("./index.ts")).default],
    printWidth: 80,
    tabWidth: 2,
  });
  return result;
}

async function assertIdempotent(input: string): Promise<void> {
  const first = await fmt(input);
  const second = await fmt(first);
  expect(second).toBe(first);
}

describe("printer", () => {
  describe("empty file", () => {
    it("formats empty input to empty string", async () => {
      const result = await fmt("");
      expect(result).toBe("");
    });

    it("formats whitespace-only to empty", async () => {
      const result = await fmt("   \n\n  ");
      expect(result).toBe("");
    });
  });

  describe("directives", () => {
    it("formats enable directive", async () => {
      const result = await fmt("enable  f16 ;");
      expect(result).toBe("enable f16;\n");
    });

    it("formats enable with multiple extensions", async () => {
      const result = await fmt("enable f16,dual_source_blending;");
      expect(result).toBe("enable f16, dual_source_blending;\n");
    });

    it("formats diagnostic directive", async () => {
      const result = await fmt("diagnostic( off , derivative_uniformity ) ;");
      expect(result).toBe("diagnostic(off, derivative_uniformity);\n");
    });

    it("formats requires directive", async () => {
      const result = await fmt("requires readonly_and_readwrite_storage_textures;");
      expect(result).toBe("requires readonly_and_readwrite_storage_textures;\n");
    });
  });

  describe("const/var/override/alias declarations", () => {
    it("formats const declaration", async () => {
      const result = await fmt("const PI:f32=3.14;");
      expect(result).toBe("const PI: f32 = 3.14;\n");
    });

    it("formats const without type", async () => {
      const result = await fmt("const  x  =  42 ;");
      expect(result).toBe("const x = 42;\n");
    });

    it("formats var with qualifier", async () => {
      const result = await fmt("var<uniform> model:mat4x4<f32>;");
      expect(result).toBe("var<uniform> model: mat4x4<f32>;\n");
    });

    it("formats var with initializer", async () => {
      const result = await fmt("var<private> x:f32=0.0;");
      expect(result).toBe("var<private> x: f32 = 0.0;\n");
    });

    it("formats override declaration", async () => {
      const result = await fmt("override blockSize:u32=64;");
      expect(result).toBe("override blockSize: u32 = 64;\n");
    });

    it("formats alias declaration", async () => {
      const result = await fmt("alias float4=vec4f;");
      expect(result).toBe("alias float4 = vec4f;\n");
    });

    it("formats var with binding attributes", async () => {
      const result = await fmt("@group(0)@binding(1)var<uniform> u:f32;");
      expect(result).toBe("@group(0) @binding(1) var<uniform> u: f32;\n");
    });

    it("formats let with explicit type", async () => {
      const result = await fmt("fn f(){let x:f32=42;}");
      expect(result).toBe("fn f() {\n  let x: f32 = 42;\n}\n");
    });

    it("formats override without initializer", async () => {
      const result = await fmt("override x:u32;");
      expect(result).toBe("override x: u32;\n");
    });

    it("formats override with attribute", async () => {
      const result = await fmt("@id(0) override x:u32=1;");
      expect(result).toBe("@id(0) override x: u32 = 1;\n");
    });

    it("formats var without qualifier", async () => {
      const result = await fmt("fn f(){var x:f32;}");
      expect(result).toBe("fn f() {\n  var x: f32;\n}\n");
    });

    it("formats var without type", async () => {
      const result = await fmt("fn f(){var x=1;}");
      expect(result).toBe("fn f() {\n  var x = 1;\n}\n");
    });

    it("formats var<storage, read_write> with atomic type", async () => {
      const result = await fmt(
        "@group(0) @binding(4) var<storage,read_write> globalMaxHits:atomic<u32>;"
      );
      expect(result).toBe(
        "@group(0) @binding(4) var<storage, read_write> globalMaxHits: atomic<u32>;\n"
      );
    });

    it("formats const with float suffix", async () => {
      const result = await fmt("const pi=radians(180f);");
      expect(result).toBe("const pi = radians(180f);\n");
    });
  });

  describe("struct declarations", () => {
    it("formats empty struct", async () => {
      const result = await fmt("struct Empty{}");
      expect(result).toBe("struct Empty {}\n");
    });

    it("formats struct with members without attributes", async () => {
      const result = await fmt("struct S{x:f32,y:u32}");
      expect(result).toBe("struct S {\n  x: f32,\n  y: u32,\n}\n");
    });

    it("formats struct with members and trailing commas", async () => {
      const result = await fmt(
        "struct Vertex{@location(0) position:vec3f,@location(1) color:vec4f}"
      );
      expect(result).toBe(
        "struct Vertex {\n  @location(0) position: vec3f,\n  @location(1) color: vec4f,\n}\n"
      );
    });

    it("formats atomic struct members", async () => {
      const result = await fmt(
        "struct Pixel{r:atomic<u32>,g:atomic<u32>,b:atomic<u32>,hits:atomic<u32>,}"
      );
      expect(result).toBe(
        "struct Pixel {\n  r: atomic<u32>,\n  g: atomic<u32>,\n  b: atomic<u32>,\n  hits: atomic<u32>,\n}\n"
      );
    });

    it("formats fixed-size array struct members", async () => {
      const result = await fmt(
        "struct S{indices:array<u32,20>,weights:array<f32,20>,}"
      );
      expect(result).toBe(
        "struct S {\n  indices: array<u32, 20>,\n  weights: array<f32, 20>,\n}\n"
      );
    });
  });

  describe("function declarations", () => {
    it("formats simple function", async () => {
      const result = await fmt("fn main(){}");
      expect(result).toBe("fn main() {}\n");
    });

    it("formats function with params and return type", async () => {
      const result = await fmt("fn add(a:f32,b:f32)->f32{return a+b;}");
      expect(result).toBe("fn add(a: f32, b: f32) -> f32 {\n  return a + b;\n}\n");
    });

    it("formats vertex function with attributes on separate line", async () => {
      const result = await fmt("@vertex fn main()->@builtin(position) vec4f{return vec4f(0.0);}");
      expect(result).toBe(
        "@vertex\nfn main() -> @builtin(position) vec4f {\n  return vec4f(0.0);\n}\n"
      );
    });

    it("formats compute function", async () => {
      const result = await fmt("@compute @workgroup_size(8,8,1) fn main(){}");
      expect(result).toBe("@compute @workgroup_size(8, 8, 1)\nfn main() {}\n");
    });
  });

  describe("expressions", () => {
    it("formats binary expression with spacing", async () => {
      const result = await fmt("const x=a+b*c;");
      expect(result).toBe("const x = a + b * c;\n");
    });

    it("formats unary expression", async () => {
      const result = await fmt("const x=-y;");
      expect(result).toBe("const x = -y;\n");
    });

    it("formats function call", async () => {
      const result = await fmt("const x=min(a,b);");
      expect(result).toBe("const x = min(a, b);\n");
    });

    it("formats member access", async () => {
      const result = await fmt("const x=v.x;");
      expect(result).toBe("const x = v.x;\n");
    });

    it("formats index access", async () => {
      const result = await fmt("const x=arr[0];");
      expect(result).toBe("const x = arr[0];\n");
    });

    it("formats type constructor", async () => {
      const result = await fmt("const v=vec3f(1.0,2.0,3.0);");
      expect(result).toBe("const v = vec3f(1.0, 2.0, 3.0);\n");
    });

    it("formats parenthesized expression", async () => {
      const result = await fmt("const x=(a+b)*c;");
      expect(result).toBe("const x = (a + b) * c;\n");
    });

    it("formats call with template args", async () => {
      const result = await fmt("const x=array<f32,4>(1.0,2.0,3.0,4.0);");
      expect(result).toBe("const x = array<f32, 4>(1.0, 2.0, 3.0, 4.0);\n");
    });

    it("formats bitcast builtin", async () => {
      const result = await fmt("fn f(){var seed:u32=bitcast<u32>(expr);}");
      expect(result).toBe("fn f() {\n  var seed: u32 = bitcast<u32>(expr);\n}\n");
    });

    it("formats select with three args", async () => {
      const result = await fmt("fn f(){let x=select(a,b,cond);}");
      expect(result).toBe("fn f() {\n  let x = select(a, b, cond);\n}\n");
    });

    it("formats arrayLength with address-of arg", async () => {
      const result = await fmt("fn f(){let n=arrayLength(&buf);}");
      expect(result).toBe("fn f() {\n  let n = arrayLength(&buf);\n}\n");
    });

    it("formats hex literal in function call", async () => {
      const result = await fmt("fn f(){let x=f32(0xFFFFFFFF);}");
      expect(result).toBe("fn f() {\n  let x = f32(0xFFFFFFFF);\n}\n");
    });

    it("formats integer scalar in typed vec constructor", async () => {
      const result = await fmt("fn f(){let v=vec2<f32>(0);}");
      expect(result).toBe("fn f() {\n  let v = vec2<f32>(0);\n}\n");
    });

    it("formats chained pure index access", async () => {
      const result = await fmt("fn f(){let x=m[1][0];}");
      expect(result).toBe("fn f() {\n  let x = m[1][0];\n}\n");
    });
  });

  describe("statements", () => {
    it("formats if/else", async () => {
      const result = await fmt("fn f(){if x{return;}else{discard;}}");
      expect(result).toBe("fn f() {\n  if x {\n    return;\n  } else {\n    discard;\n  }\n}\n");
    });

    it("formats for loop", async () => {
      const result = await fmt("fn f(){for(var i:i32=0;i<10;i++){}}");
      expect(result).toBe("fn f() {\n  for (var i: i32 = 0; i < 10; i++) {}\n}\n");
    });

    it("formats while loop", async () => {
      const result = await fmt("fn f(){while x>0{x--;}}");
      expect(result).toBe("fn f() {\n  while x > 0 {\n    x--;\n  }\n}\n");
    });

    it("formats assignment", async () => {
      const result = await fmt("fn f(){x=1;}");
      expect(result).toBe("fn f() {\n  x = 1;\n}\n");
    });

    it("formats compound assignment", async () => {
      const result = await fmt("fn f(){x+=1;}");
      expect(result).toBe("fn f() {\n  x += 1;\n}\n");
    });

    it("formats increment/decrement", async () => {
      const result = await fmt("fn f(){i++;j--;}");
      expect(result).toBe("fn f() {\n  i++;\n  j--;\n}\n");
    });

    it("formats switch statement", async () => {
      const result = await fmt("fn f(){switch x{case 1:{break;}default:{break;}}}");
      expect(result).toBe(
        "fn f() {\n  switch x {\n    case 1: {\n      break;\n    }\n    default: {\n      break;\n    }\n  }\n}\n"
      );
    });

    it("formats loop with continuing", async () => {
      const result = await fmt("fn f(){loop{x++;continuing{break if x>10;}}}");
      expect(result).toBe(
        "fn f() {\n  loop {\n    x++;\n    continuing {\n      break if x > 10;\n    }\n  }\n}\n"
      );
    });

    it("formats phony assignment", async () => {
      const result = await fmt("fn f(){_=compute();}");
      expect(result).toBe("fn f() {\n  _ = compute();\n}\n");
    });

    it("formats let declaration", async () => {
      const result = await fmt("fn f(){let x=42;}");
      expect(result).toBe("fn f() {\n  let x = 42;\n}\n");
    });

    it("formats if/else if/else chain", async () => {
      const result = await fmt("fn f(){if a{x=1;}else if b{x=2;}else{x=3;}}");
      expect(result).toBe(
        "fn f() {\n  if a {\n    x = 1;\n  } else if b {\n    x = 2;\n  } else {\n    x = 3;\n  }\n}\n"
      );
    });

    it("formats for loop with all empty parts", async () => {
      const result = await fmt("fn f(){for(;;){break;}}");
      expect(result).toBe("fn f() {\n  for (; ; ) {\n    break;\n  }\n}\n");
    });

    it("formats loop without continuing", async () => {
      const result = await fmt("fn f(){loop{x++;if x>10{break;}}}");
      expect(result).toBe(
        "fn f() {\n  loop {\n    x++;\n    if x > 10 {\n      break;\n    }\n  }\n}\n"
      );
    });

    it("formats continuing without break if", async () => {
      const result = await fmt("fn f(){loop{x++;continuing{y++;}}}");
      expect(result).toBe(
        "fn f() {\n  loop {\n    x++;\n    continuing {\n      y++;\n    }\n  }\n}\n"
      );
    });

    it("formats empty continuing block", async () => {
      const result = await fmt("fn f(){loop{x++;continuing{}}}");
      expect(result).toBe(
        "fn f() {\n  loop {\n    x++;\n    continuing {}\n  }\n}\n"
      );
    });

    it("formats switch with multiple case selectors", async () => {
      const result = await fmt("fn f(){switch x{case 1,2,3:{break;}default:{break;}}}");
      expect(result).toBe(
        "fn f() {\n  switch x {\n    case 1, 2, 3: {\n      break;\n    }\n    default: {\n      break;\n    }\n  }\n}\n"
      );
    });

    it("formats expression statement", async () => {
      const result = await fmt("fn f(){doSomething();}");
      expect(result).toBe("fn f() {\n  doSomething();\n}\n");
    });

    it("formats ptr parameter type with deref read", async () => {
      const result = await fmt("fn f(state:ptr<function,u32>){let x=*state;}");
      expect(result).toBe(
        "fn f(state: ptr<function, u32>) {\n  let x = *state;\n}\n"
      );
    });

    it("formats assignment to dereferenced pointer", async () => {
      const result = await fmt("fn f(p:ptr<function,u32>){*p=42u;}");
      expect(result).toBe(
        "fn f(p: ptr<function, u32>) {\n  *p = 42u;\n}\n"
      );
    });

    it("formats atomicAdd with address-of chained index+member", async () => {
      const result = await fmt("fn f(){atomicAdd(&data[idx].r,1u);}");
      expect(result).toBe(
        "fn f() {\n  atomicAdd(&data[idx].r, 1u);\n}\n"
      );
    });

    it("formats compound xor-assign with shift RHS", async () => {
      const result = await fmt("fn f(){x^=x<<13u;}");
      expect(result).toBe("fn f() {\n  x ^= x << 13u;\n}\n");
    });

    it("formats modulo operator", async () => {
      const result = await fmt("fn f(){let x=(thet+f)%t;}");
      expect(result).toBe("fn f() {\n  let x = (thet + f) % t;\n}\n");
    });

    it("formats bare block as standalone scope", async () => {
      const result = await fmt("fn f(){let a=1;{let b=2;}let c=3;}");
      expect(result).toBe(
        "fn f() {\n  let a = 1;\n  {\n    let b = 2;\n  }\n  let c = 3;\n}\n"
      );
    });

    it("formats continue inside if inside for loop", async () => {
      const result = await fmt(
        "fn f(){for(var i=0u;i<10u;i++){if i<5u{continue;}}}"
      );
      expect(result).toBe(
        "fn f() {\n  for (var i = 0u; i < 10u; i++) {\n    if i < 5u {\n      continue;\n    }\n  }\n}\n"
      );
    });
  });

  describe("blank lines between declarations", () => {
    it("groups same-kind simple declarations without blank line", async () => {
      const result = await fmt("const A=1;const B=2;");
      expect(result).toBe("const A = 1;\nconst B = 2;\n");
    });

    it("adds blank line between different-kind declarations", async () => {
      const result = await fmt("const A=1;var<private> B:f32;");
      expect(result).toBe("const A = 1;\n\nvar<private> B: f32;\n");
    });

    it("adds blank line between struct and function", async () => {
      const result = await fmt("struct S{x:f32,}fn f(){}");
      expect(result).toBe("struct S {\n  x: f32,\n}\n\nfn f() {}\n");
    });
  });

  describe("binary expression wrapping", () => {
    it("keeps short binary expression flat", async () => {
      const result = await fmt("const x = a + b + c;");
      expect(result).toBe("const x = a + b + c;\n");
    });

    it("wraps long chain of same-precedence binary ops", async () => {
      // The const declaration wraps at `=`, then the binary chain fits on one line
      const result = await fmt(
        "const x = alpha + bravo + charlie + delta + echo + foxtrot + golf + hotel + india;"
      );
      expect(result).toBe(
        "const x =\n  alpha + bravo + charlie + delta + echo + foxtrot + golf + hotel + india;\n"
      );
    });

    it("does not flatten across different precedence levels", async () => {
      // a + b * c should not flatten the * into the + chain
      const result = await fmt("const x = a + b * c;");
      expect(result).toBe("const x = a + b * c;\n");
    });

    it("wraps long multiplicative chain", async () => {
      const result = await fmt(
        "const x = alpha * bravo * charlie * delta * echo * foxtrot * golf * hotel * india;"
      );
      expect(result).toBe(
        "const x =\n  alpha * bravo * charlie * delta * echo * foxtrot * golf * hotel * india;\n"
      );
    });

    it("wraps very long binary chain at operators", async () => {
      // This chain is long enough that even after declaration wrapping, the binary chain wraps too
      const result = await fmt(
        "fn f() { let x = alpha_long + bravo_long + charlie_long + delta_long + echo_long + foxtrot_long + golf_long; }"
      );
      expect(result).toContain("+ bravo_long\n");
    });

    it("is idempotent for wrapped binary expressions", async () => {
      await assertIdempotent(
        "const x = alpha + bravo + charlie + delta + echo + foxtrot + golf + hotel + india;"
      );
    });

    it("wraps long logical chain", async () => {
      const result = await fmt(
        "fn f() { if alpha_condition && bravo_condition && charlie_condition && delta_condition { return; } }"
      );
      expect(result).toContain("&&");
      // Should wrap - verify idempotency
      await assertIdempotent(
        "fn f() { if alpha_condition && bravo_condition && charlie_condition && delta_condition { return; } }"
      );
    });
  });

  describe("blank line preservation in blocks", () => {
    it("preserves single blank line between statements", async () => {
      const input = `fn f() {
  let x = 1;

  let y = 2;
}
`;
      const result = await fmt(input);
      expect(result).toBe(input);
    });

    it("collapses multiple blank lines to one", async () => {
      const input = `fn f() {
  let x = 1;



  let y = 2;
}
`;
      const result = await fmt(input);
      expect(result).toBe(`fn f() {
  let x = 1;

  let y = 2;
}
`);
    });

    it("does not add blank lines where none existed", async () => {
      const input = `fn f() {
  let x = 1;
  let y = 2;
}
`;
      const result = await fmt(input);
      expect(result).toBe(input);
    });

    it("is idempotent for blank line preservation", async () => {
      await assertIdempotent(`fn f() {
  let x = 1;

  let y = 2;
  let z = 3;
}
`);
    });
  });

  describe("assignment and declaration RHS wrapping", () => {
    it("keeps short assignment flat", async () => {
      const result = await fmt("fn f() { x = 1; }");
      expect(result).toBe("fn f() {\n  x = 1;\n}\n");
    });

    it("wraps long assignment RHS", async () => {
      const result = await fmt(
        "fn f() { some_variable = very_long_function_call(argument_one, argument_two, argument_three); }"
      );
      expect(result).toContain("=\n");
      await assertIdempotent(
        "fn f() { some_variable = very_long_function_call(argument_one, argument_two, argument_three); }"
      );
    });

    it("keeps short const declaration flat", async () => {
      const result = await fmt("const x = 42;");
      expect(result).toBe("const x = 42;\n");
    });

    it("wraps long const declaration RHS", async () => {
      const result = await fmt(
        "const some_long_constant_name: f32 = very_long_function_call(argument_one, argument_two);"
      );
      expect(result).toContain("=\n");
      await assertIdempotent(
        "const some_long_constant_name: f32 = very_long_function_call(argument_one, argument_two);"
      );
    });

    it("wraps long let declaration RHS", async () => {
      const result = await fmt(
        "fn f() { let some_long_variable_name: f32 = very_long_function_call(argument_one, argument_two); }"
      );
      expect(result).toContain("=\n");
      await assertIdempotent(
        "fn f() { let some_long_variable_name: f32 = very_long_function_call(argument_one, argument_two); }"
      );
    });

    it("wraps long return value", async () => {
      const result = await fmt(
        "fn f() -> f32 { return very_long_function_name_here(argument_one_long, argument_two_long, argument_three_long); }"
      );
      expect(result).toContain("return\n");
      await assertIdempotent(
        "fn f() -> f32 { return very_long_function_name_here(argument_one_long, argument_two_long, argument_three_long); }"
      );
    });

    it("keeps short return flat", async () => {
      const result = await fmt("fn f() -> f32 { return 42; }");
      expect(result).toBe("fn f() -> f32 {\n  return 42;\n}\n");
    });

    it("wraps long phony assignment", async () => {
      const result = await fmt(
        "fn f() { _ = very_long_function_name_here(argument_one_long, argument_two_long, argument_three_long); }"
      );
      expect(result).toContain("_ =\n");
      await assertIdempotent(
        "fn f() { _ = very_long_function_name_here(argument_one_long, argument_two_long, argument_three_long); }"
      );
    });
  });

  describe("control flow condition wrapping", () => {
    it("keeps short if condition inline", async () => {
      const result = await fmt("fn f() { if x > 0 { return; } }");
      expect(result).toBe("fn f() {\n  if x > 0 {\n    return;\n  }\n}\n");
    });

    it("wraps long if condition", async () => {
      const result = await fmt(
        "fn f() { if some_very_long_condition_variable && another_very_long_condition_variable { return; } }"
      );
      // Condition should wrap with indent
      const result2 = await fmt(result);
      expect(result2).toBe(result); // idempotent
    });

    it("keeps short while condition inline", async () => {
      const result = await fmt("fn f() { while x > 0 { x--; } }");
      expect(result).toBe("fn f() {\n  while x > 0 {\n    x--;\n  }\n}\n");
    });

    it("wraps long for header", async () => {
      const result = await fmt(
        "fn f() { for (var some_index: i32 = 0; some_index < some_very_long_limit; some_index++) {} }"
      );
      const result2 = await fmt(result);
      expect(result2).toBe(result); // idempotent
    });
  });

  describe("comments inside function bodies", () => {
    it("preserves line comment before statement in function", async () => {
      const input = `fn f() {
  // do something
  let x = 1;
}
`;
      const result = await fmt(input);
      expect(result).toBe(input);
    });

    it("preserves line comment after statement in function", async () => {
      const input = `fn f() {
  let x = 1;
  // done
}
`;
      const result = await fmt(input);
      expect(result).toBe(input);
    });

    it("preserves comment between statements in function", async () => {
      const input = `fn f() {
  let x = 1;
  // compute y
  let y = 2;
}
`;
      const result = await fmt(input);
      expect(result).toBe(input);
    });

    it("is idempotent for comments in function bodies", async () => {
      await assertIdempotent(`fn f() {
  // first
  let x = 1;
  // second
  let y = 2;
}
`);
    });
  });

  describe("large switch", () => {
    it("formats 30-case switch with u-suffixed selectors", async () => {
      const cases = Array.from(
        { length: 30 },
        (_, i) => `case ${i}u:{return fn_${i}(v,m,r);}`
      ).join("");
      const input = `fn f(v:vec2<f32>,idx:u32,m:mat3x3<f32>,r:ptr<function,u32>)->vec2<f32>{switch idx{${cases}default:{return vec2<f32>(0);}}}`;
      const result = await fmt(input);
      expect(result).toMatchSnapshot();
      await assertIdempotent(input);
    });
  });

  describe("idempotency", () => {
    it("is idempotent for simple function", async () => {
      await assertIdempotent("@vertex fn main() -> @builtin(position) vec4f { return vec4f(0.0); }");
    });

    it("is idempotent for struct", async () => {
      await assertIdempotent("struct V { @location(0) pos: vec3f, @location(1) col: vec4f, }");
    });

    it("is idempotent for directives", async () => {
      await assertIdempotent("enable f16;");
    });

    it("is idempotent for complex function", async () => {
      await assertIdempotent(`
        fn compute(x: f32, y: f32) -> f32 {
          var result: f32 = 0.0;
          for (var i: i32 = 0; i < 10; i++) {
            result += x * y;
          }
          return result;
        }
      `);
    });
  });
});
