// `|` marks the cursor position.
import { describe, it, expect } from "vitest";
import { fmt, fmtWithCursor } from "./test-helpers.ts";

async function fmtc(input: string, printWidth: number = 80): Promise<string> {
  return fmtWithCursor(input, printWidth);
}

describe("formatWithCursor", () => {
  it("keeps the cursor on an identifier when whitespace is collapsed", async () => {
    const result = await fmtc(`fn main(){let  |x   =  1;let y=2;}`);
    expect(result).toBe(`fn main() {\n  let |x = 1;\n  let y = 2;\n}\n`);
  });

  it("keeps the cursor inside an identifier", async () => {
    const result = await fmtc(`fn main(){let fo|o=1;}`);
    expect(result).toBe(`fn main() {\n  let fo|o = 1;\n}\n`);
  });

  it("keeps the cursor at the start of the file", async () => {
    const result = await fmtc(`|fn main(){}`);
    expect(result).toBe(`|fn main() {}\n`);
  });

  it("keeps the cursor at the end of the file", async () => {
    const result = await fmtc(`fn main(){}|`);
    expect(result).toBe(`fn main() {}|\n`);
  });

  it("tracks the cursor when indentation is added", async () => {
    const result = await fmtc(`fn main(){\nlet x=1;\n|return;\n}`);
    expect(result).toBe(`fn main() {\n  let x = 1;\n  |return;\n}\n`);
  });

  it("tracks the cursor across a line that gets broken", async () => {
    const result = await fmtc(
      `fn main(){let value=some_function(argument_one,argument_two,|argument_three,argument_four);}`,
      40,
    );
    expect(result).toBe(
      `fn main() {\n` +
        `  let value =\n` +
        `    some_function(\n` +
        `      argument_one,\n` +
        `      argument_two,\n` +
        `      |argument_three,\n` +
        `      argument_four,\n` +
        `    );\n` +
        `}\n`,
    );
  });

  it("tracks the cursor inside a struct member", async () => {
    const result = await fmtc(`struct S{@location(0) col|or:vec4f,}`);
    expect(result).toBe(`struct S {\n  @location(0) col|or: vec4f,\n}\n`);
  });

  it("tracks the cursor inside a comment", async () => {
    const result = await fmtc(`fn main(){// a com|ment\nlet x=1;}`);
    expect(result).toBe(`fn main() {\n  // a com|ment\n  let x = 1;\n}\n`);
  });

  it("produces the same output as format() for the same input", async () => {
    const input = `@group(0)@binding(0)var<uniform> mvp:mat4x4<f32>;\nfn main(){let x=mvp*vec4f(1.0);}`;
    const withCursor = await fmtc(`@group(0)@binding(0)var<uniform> m|vp:mat4x4<f32>;\nfn main(){let x=mvp*vec4f(1.0);}`);
    expect(withCursor.replace("|", "")).toBe(await fmt(input, 80));
  });
});
