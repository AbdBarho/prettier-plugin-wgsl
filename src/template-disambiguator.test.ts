import { describe, it, expect } from "vitest";
import { tokenize } from "./tokens.ts";
import { disambiguateTemplates } from "./template-disambiguator.ts";

function kindsAfterDisambig(source: string): string[] {
  const { tokens } = tokenize(source);
  return disambiguateTemplates(tokens).map((t) => t.tokenType.name);
}

describe("template disambiguator", () => {
  it("converts vec3<f32> angle brackets to template delimiters", () => {
    const kinds = kindsAfterDisambig("vec3<f32>");
    expect(kinds).toEqual([
      "Ident", "TemplateArgsOpen", "Ident", "TemplateArgsClose",
    ]);
  });

  it("leaves comparison operators unchanged", () => {
    const kinds = kindsAfterDisambig("a < b");
    expect(kinds).toContain("LessThan");
    expect(kinds).not.toContain("TemplateArgsOpen");
  });

  it("handles nested templates: array<vec3<f32>, 4>", () => {
    const kinds = kindsAfterDisambig("array<vec3<f32>, 4>");
    expect(kinds).toEqual([
      "Ident", "TemplateArgsOpen", "Ident", "TemplateArgsOpen", "Ident",
      "TemplateArgsClose", "Comma", "DecIntLiteral", "TemplateArgsClose",
    ]);
  });

  it("aborts on && (not a template)", () => {
    const kinds = kindsAfterDisambig("a < b && c > d");
    expect(kinds).not.toContain("TemplateArgsOpen");
    expect(kinds).toContain("LessThan");
    expect(kinds).toContain("GreaterThan");
  });

  it("aborts on || (not a template)", () => {
    const kinds = kindsAfterDisambig("a < b || c > d");
    expect(kinds).not.toContain("TemplateArgsOpen");
  });

  it("handles var<uniform>", () => {
    const kinds = kindsAfterDisambig("var<uniform>");
    expect(kinds).toEqual([
      "Var", "TemplateArgsOpen", "Ident", "TemplateArgsClose",
    ]);
  });

  it("handles mat4x4<f32> after colon", () => {
    const kinds = kindsAfterDisambig("x: mat4x4<f32>");
    expect(kinds).toContain("TemplateArgsOpen");
    expect(kinds).toContain("TemplateArgsClose");
  });

  it("does not treat < after non-ident as template", () => {
    const kinds = kindsAfterDisambig("1 < 2");
    expect(kinds).not.toContain("TemplateArgsOpen");
  });

  it("aborts on semicolon before >", () => {
    const kinds = kindsAfterDisambig("a < b;");
    expect(kinds).not.toContain("TemplateArgsOpen");
  });
});
