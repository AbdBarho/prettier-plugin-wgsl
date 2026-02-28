import { describe, it, expect } from "vitest";
import { tokenize, TK } from "./tokens.ts";
import type { IToken } from "./tokens.ts";

function kinds(source: string): string[] {
  const { tokens, comments } = tokenize(source);
  // Merge comments back in by position for tests that check comment tokens
  const all: IToken[] = [...tokens, ...comments].sort((a, b) => a.startOffset - b.startOffset);
  return all.map((t) => t.tokenType.name);
}

function kindsNoComments(source: string): string[] {
  return tokenize(source).tokens.map((t) => t.tokenType.name);
}

function values(source: string): string[] {
  return tokenize(source).tokens.map((t) => t.image);
}

describe("lexer", () => {
  it("emits no tokens for empty input", () => {
    expect(kindsNoComments("")).toEqual([]);
  });

  it("skips whitespace", () => {
    expect(kindsNoComments("   \t\n  ")).toEqual([]);
  });

  describe("punctuation", () => {
    it("tokenizes single-char punctuation", () => {
      expect(kindsNoComments("{ } ( ) [ ] ; : , . @")).toEqual([
        "LBrace", "RBrace", "LParen", "RParen", "LBracket", "RBracket",
        "Semicolon", "Colon", "Comma", "Dot", "At",
      ]);
    });
  });

  describe("identifiers and keywords", () => {
    it("tokenizes identifiers", () => {
      const { tokens } = tokenize("foo bar_baz _x a123");
      expect(tokens.map((t) => [t.tokenType.name, t.image])).toEqual([
        ["Ident", "foo"],
        ["Ident", "bar_baz"],
        ["Ident", "_x"],
        ["Ident", "a123"],
      ]);
    });

    it("tokenizes keywords", () => {
      expect(kindsNoComments("fn var struct if else for while return")).toEqual([
        "Fn", "Var", "Struct", "If", "Else", "For", "While", "Return",
      ]);
    });

    it("tokenizes all keywords correctly", () => {
      const kwMap: Record<string, string> = {
        alias: "Alias", break: "Break", case: "Case", const: "Const",
        const_assert: "ConstAssert", continue: "Continue", continuing: "Continuing",
        default: "Default", diagnostic: "Diagnostic", discard: "Discard",
        else: "Else", enable: "Enable", fn: "Fn", for: "For", if: "If",
        let: "Let", loop: "Loop", override: "Override", requires: "Requires",
        return: "Return", struct: "Struct", switch: "Switch", var: "Var", while: "While",
      };
      for (const [kw, name] of Object.entries(kwMap)) {
        expect(kindsNoComments(kw)).toEqual([name]);
      }
    });

    it("tokenizes bool literals", () => {
      expect(kindsNoComments("true false")).toEqual(["True", "False"]);
    });

    it("tokenizes _ as Underscore", () => {
      expect(kindsNoComments("_")).toEqual(["Underscore"]);
    });

    it("tokenizes _x as Ident, not Underscore", () => {
      expect(kindsNoComments("_x")).toEqual(["Ident"]);
    });
  });

  describe("numbers", () => {
    it("tokenizes integer literals", () => {
      expect(values("0 42 100")).toEqual(["0", "42", "100"]);
      expect(kindsNoComments("42")).toEqual(["IntLiteral"]);
    });

    it("tokenizes suffixed integers", () => {
      expect(values("42u 7i")).toEqual(["42u", "7i"]);
    });

    it("tokenizes hex literals", () => {
      expect(values("0xFF 0x1A2B")).toEqual(["0xFF", "0x1A2B"]);
      expect(kindsNoComments("0xFF")).toEqual(["IntLiteral"]);
    });

    it("tokenizes float literals", () => {
      expect(values("3.14 0.5 .5")).toEqual(["3.14", "0.5", ".5"]);
      expect(kindsNoComments("3.14")).toEqual(["FloatLiteral"]);
    });

    it("tokenizes float with exponent", () => {
      expect(values("1e10 2.5e-3 1E+2")).toEqual(["1e10", "2.5e-3", "1E+2"]);
    });

    it("tokenizes suffixed floats", () => {
      expect(values("3.14f 0.5h")).toEqual(["3.14f", "0.5h"]);
    });

    it("tokenizes hex floats", () => {
      expect(values("0x1.0p10")).toEqual(["0x1.0p10"]);
      expect(kindsNoComments("0x1.0p10")).toEqual(["FloatLiteral"]);
    });
  });

  describe("operators", () => {
    it("tokenizes single-char operators", () => {
      expect(kindsNoComments("+ - * / % & | ^ ~ !")).toEqual([
        "Plus", "Minus", "Star", "Slash", "Percent",
        "Amp", "Pipe", "Caret", "Tilde", "Bang",
      ]);
    });

    it("tokenizes multi-char operators", () => {
      expect(kindsNoComments("-> == != <= >= && || ++ --")).toEqual([
        "Arrow", "EqualEqual", "BangEqual", "LessEqual", "GreaterEqual",
        "AmpAmp", "PipePipe", "PlusPlus", "MinusMinus",
      ]);
    });

    it("tokenizes compound assignment operators", () => {
      expect(kindsNoComments("+= -= *= /= %= &= |= ^= <<= >>=")).toEqual([
        "PlusEqual", "MinusEqual", "StarEqual", "SlashEqual", "PercentEqual",
        "AmpEqual", "PipeEqual", "CaretEqual", "ShiftLeftEqual", "ShiftRightEqual",
      ]);
    });

    it("tokenizes shift operators", () => {
      expect(kindsNoComments("<< >>")).toEqual(["ShiftLeft", "ShiftRight"]);
    });

    it("tokenizes angle brackets", () => {
      expect(kindsNoComments("< >")).toEqual(["LessThan", "GreaterThan"]);
    });

    it("tokenizes = as Equal", () => {
      expect(kindsNoComments("=")).toEqual(["Equal"]);
    });
  });

  describe("comments", () => {
    it("tokenizes line comments", () => {
      const { tokens, comments } = tokenize("// hello\nfoo");
      expect(comments[0].tokenType.name).toBe("LineComment");
      expect(comments[0].image).toBe("// hello");
      expect(tokens[0].tokenType.name).toBe("Ident");
    });

    it("tokenizes block comments", () => {
      const { tokens, comments } = tokenize("/* block */ foo");
      expect(comments[0].tokenType.name).toBe("BlockComment");
      expect(comments[0].image).toBe("/* block */");
      expect(tokens[0].tokenType.name).toBe("Ident");
    });

    it("handles nested block comments", () => {
      const { tokens, comments } = tokenize("/* outer /* inner */ still outer */ foo");
      expect(comments[0].tokenType.name).toBe("BlockComment");
      expect(comments[0].image).toBe("/* outer /* inner */ still outer */");
      expect(tokens[0].tokenType.name).toBe("Ident");
    });
  });

  describe("position tracking", () => {
    it("tracks start and end positions", () => {
      const { tokens } = tokenize("fn foo");
      expect(tokens[0]).toMatchObject({ tokenType: { name: "Fn" }, startOffset: 0 });
      expect(tokens[0].startOffset + tokens[0].image.length).toBe(2);
      expect(tokens[1]).toMatchObject({ tokenType: { name: "Ident" }, image: "foo", startOffset: 3 });
    });
  });

  describe("realistic WGSL snippets", () => {
    it("tokenizes a function signature", () => {
      const { tokens } = tokenize("@vertex fn main() -> @builtin(position) vec4f {");
      const k = tokens.map((t) => t.tokenType.name);
      expect(k).toEqual([
        "At", "Ident", "Fn", "Ident", "LParen", "RParen", "Arrow",
        "At", "Ident", "LParen", "Ident", "RParen", "Ident", "LBrace",
      ]);
    });

    it("tokenizes a var declaration with template args", () => {
      const { tokens } = tokenize("var<uniform> model: mat4x4<f32>;");
      const v = tokens.map((t) => t.image);
      expect(v).toEqual([
        "var", "<", "uniform", ">", "model", ":", "mat4x4", "<", "f32", ">", ";",
      ]);
    });
  });
});
