import { describe, it, expect } from "vitest";
import { parse } from "./parser.ts";

describe("parser", () => {
  describe("empty file", () => {
    it("parses empty input", () => {
      const ast = parse("");
      expect(ast.kind).toBe("TranslationUnit");
      expect(ast.directives).toEqual([]);
      expect(ast.declarations).toEqual([]);
    });
  });

  describe("directives", () => {
    it("parses enable directive", () => {
      const ast = parse("enable f16;");
      expect(ast.directives).toHaveLength(1);
      expect(ast.directives[0]).toMatchObject({
        kind: "EnableDirective",
        extensions: ["f16"],
      });
    });

    it("parses enable with multiple extensions", () => {
      const ast = parse("enable f16, dual_source_blending;");
      expect(ast.directives[0]).toMatchObject({
        kind: "EnableDirective",
        extensions: ["f16", "dual_source_blending"],
      });
    });

    it("parses requires directive", () => {
      const ast = parse("requires readonly_and_readwrite_storage_textures;");
      expect(ast.directives[0]).toMatchObject({
        kind: "RequiresDirective",
        extensions: ["readonly_and_readwrite_storage_textures"],
      });
    });

    it("parses diagnostic directive", () => {
      const ast = parse("diagnostic(off, derivative_uniformity);");
      expect(ast.directives[0]).toMatchObject({
        kind: "DiagnosticDirective",
        severity: "off",
        rule: "derivative_uniformity",
      });
    });
  });

  describe("declarations", () => {
    it("parses const declaration", () => {
      const ast = parse("const PI: f32 = 3.14;");
      expect(ast.declarations[0]).toMatchObject({
        kind: "ConstDeclaration",
        name: "PI",
        type: { kind: "TypeExpr", name: "f32" },
        initializer: { kind: "LiteralExpr", value: "3.14" },
      });
    });

    it("parses const without type annotation", () => {
      const ast = parse("const x = 42;");
      expect(ast.declarations[0]).toMatchObject({
        kind: "ConstDeclaration",
        name: "x",
        type: null,
      });
    });

    it("parses hex integer literals", () => {
      const ast = parse("const x = 0xFFFFFFFF;");
      expect(ast.declarations[0]).toMatchObject({
        kind: "ConstDeclaration",
        name: "x",
        initializer: { kind: "LiteralExpr", value: "0xFFFFFFFF", literalType: "int" },
      });
    });

    it("parses hex integer literals in function calls", () => {
      const ast = parse("fn f() { let x = f32(0xFFFFFFFF); }");
      const body = (ast.declarations[0] as any).body;
      const callExpr = body.statements[0].initializer;
      expect(callExpr).toMatchObject({
        kind: "CallExpr",
        callee: "f32",
        args: [{ kind: "LiteralExpr", value: "0xFFFFFFFF", literalType: "int" }],
      });
    });

    it("parses var declaration with qualifier", () => {
      const ast = parse("var<uniform> model: mat4x4<f32>;");
      const decl = ast.declarations[0];
      expect(decl).toMatchObject({
        kind: "VarDeclaration",
        qualifier: "uniform",
        name: "model",
        type: { kind: "TypeExpr", name: "mat4x4", templateArgs: [{ name: "f32" }] },
      });
    });

    it("parses var with storage qualifier and access mode", () => {
      const ast = parse("var<storage, read_write> data: array<f32>;");
      expect(ast.declarations[0]).toMatchObject({
        kind: "VarDeclaration",
        qualifier: "storage, read_write",
        name: "data",
      });
    });

    it("parses var with initializer", () => {
      const ast = parse("var<private> x: f32 = 0.0;");
      expect(ast.declarations[0]).toMatchObject({
        kind: "VarDeclaration",
        qualifier: "private",
        name: "x",
        initializer: { kind: "LiteralExpr", value: "0.0" },
      });
    });

    it("parses override declaration", () => {
      const ast = parse("override blockSize: u32 = 64;");
      expect(ast.declarations[0]).toMatchObject({
        kind: "OverrideDeclaration",
        name: "blockSize",
        initializer: { kind: "LiteralExpr", value: "64" },
      });
    });

    it("parses alias declaration", () => {
      const ast = parse("alias float4 = vec4f;");
      expect(ast.declarations[0]).toMatchObject({
        kind: "AliasDeclaration",
        name: "float4",
        type: { kind: "TypeExpr", name: "vec4f" },
      });
    });

    it("parses const_assert", () => {
      const ast = parse("const_assert true;");
      expect(ast.declarations[0]).toMatchObject({
        kind: "ConstAssertStatement",
        expr: { kind: "LiteralExpr", value: "true" },
      });
    });
  });

  describe("attributes", () => {
    it("parses simple attribute", () => {
      const ast = parse("@vertex fn main() {}");
      const fn = ast.declarations[0];
      expect(fn.kind).toBe("FunctionDeclaration");
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.attributes).toHaveLength(1);
        expect(fn.attributes[0]).toMatchObject({ name: "vertex", args: [] });
      }
    });

    it("parses attribute with args", () => {
      const ast = parse("@workgroup_size(8, 8, 1) fn main() {}");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.attributes[0]).toMatchObject({ name: "workgroup_size" });
        expect(fn.attributes[0].args).toHaveLength(3);
      }
    });

    it("parses binding attributes on var", () => {
      const ast = parse("@group(0) @binding(1) var<uniform> u: f32;");
      const v = ast.declarations[0];
      if (v.kind === "VarDeclaration") {
        expect(v.attributes).toHaveLength(2);
        expect(v.attributes[0]).toMatchObject({ name: "group" });
        expect(v.attributes[1]).toMatchObject({ name: "binding" });
      }
    });
  });

  describe("struct declarations", () => {
    it("parses empty struct", () => {
      const ast = parse("struct Empty {}");
      expect(ast.declarations[0]).toMatchObject({
        kind: "StructDeclaration",
        name: "Empty",
        members: [],
      });
    });

    it("parses struct with members", () => {
      const ast = parse(`struct Vertex {
        @location(0) position: vec3f,
        @location(1) color: vec4f,
      }`);
      const s = ast.declarations[0];
      if (s.kind === "StructDeclaration") {
        expect(s.members).toHaveLength(2);
        expect(s.members[0]).toMatchObject({
          name: "position",
          type: { name: "vec3f" },
        });
        expect(s.members[0].attributes[0]).toMatchObject({ name: "location" });
      }
    });
  });

  describe("function declarations", () => {
    it("parses simple function", () => {
      const ast = parse("fn main() {}");
      const fn = ast.declarations[0];
      expect(fn).toMatchObject({
        kind: "FunctionDeclaration",
        name: "main",
        params: [],
        returnType: null,
      });
    });

    it("parses function with return type", () => {
      const ast = parse("fn add(a: f32, b: f32) -> f32 { return a + b; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.params).toHaveLength(2);
        expect(fn.returnType).toMatchObject({ name: "f32" });
      }
    });

    it("parses function with return attributes", () => {
      const ast = parse("@vertex fn main() -> @builtin(position) vec4f { return vec4f(0.0); }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.returnAttributes).toHaveLength(1);
        expect(fn.returnAttributes[0]).toMatchObject({ name: "builtin" });
        expect(fn.returnType).toMatchObject({ name: "vec4f" });
      }
    });
  });

  describe("expressions", () => {
    it("parses identifier expression", () => {
      const ast = parse("const x = y;");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({ kind: "IdentExpr", name: "y" });
      }
    });

    it("parses binary expression", () => {
      const ast = parse("const x = a + b;");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({
          kind: "BinaryExpr",
          op: "+",
          left: { kind: "IdentExpr", name: "a" },
          right: { kind: "IdentExpr", name: "b" },
        });
      }
    });

    it("respects operator precedence", () => {
      const ast = parse("const x = a + b * c;");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        // Should be a + (b * c)
        expect(decl.initializer).toMatchObject({
          kind: "BinaryExpr",
          op: "+",
          right: { kind: "BinaryExpr", op: "*" },
        });
      }
    });

    it("parses unary expressions", () => {
      const ast = parse("const x = -y;");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({
          kind: "UnaryExpr",
          op: "-",
          operand: { kind: "IdentExpr", name: "y" },
        });
      }
    });

    it("parses function calls", () => {
      const ast = parse("const x = min(a, b);");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({
          kind: "CallExpr",
          callee: "min",
          args: [
            { kind: "IdentExpr", name: "a" },
            { kind: "IdentExpr", name: "b" },
          ],
        });
      }
    });

    it("parses type constructor calls", () => {
      const ast = parse("const v = vec3f(1.0, 2.0, 3.0);");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({
          kind: "CallExpr",
          callee: "vec3f",
          args: [
            { value: "1.0" },
            { value: "2.0" },
            { value: "3.0" },
          ],
        });
      }
    });

    it("parses member access", () => {
      const ast = parse("const x = v.x;");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({
          kind: "MemberExpr",
          object: { kind: "IdentExpr", name: "v" },
          member: "x",
        });
      }
    });

    it("parses index access", () => {
      const ast = parse("const x = arr[0];");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({
          kind: "IndexExpr",
          object: { kind: "IdentExpr", name: "arr" },
          index: { kind: "LiteralExpr", value: "0" },
        });
      }
    });

    it("parses parenthesized expression", () => {
      const ast = parse("const x = (a + b) * c;");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({
          kind: "BinaryExpr",
          op: "*",
          left: { kind: "ParenExpr" },
        });
      }
    });

    it("parses address-of and deref", () => {
      const ast = parse("const p = &v;");
      const decl = ast.declarations[0];
      if (decl.kind === "ConstDeclaration") {
        expect(decl.initializer).toMatchObject({ kind: "UnaryExpr", op: "&" });
      }
    });
  });

  describe("statements", () => {
    it("parses return statement", () => {
      const ast = parse("fn f() { return; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({ kind: "ReturnStmt", value: null });
      }
    });

    it("parses return with value", () => {
      const ast = parse("fn f() -> f32 { return 1.0; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({
          kind: "ReturnStmt",
          value: { kind: "LiteralExpr" },
        });
      }
    });

    it("parses if/else", () => {
      const ast = parse("fn f() { if x { return; } else { discard; } }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        const ifStmt = fn.body.statements[0];
        expect(ifStmt).toMatchObject({
          kind: "IfStmt",
          condition: { kind: "IdentExpr", name: "x" },
        });
        if (ifStmt.kind === "IfStmt") {
          expect(ifStmt.elseClause).toMatchObject({ kind: "Block" });
        }
      }
    });

    it("parses if/else if/else chain", () => {
      const ast = parse("fn f() { if a {} else if b {} else {} }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        const ifStmt = fn.body.statements[0];
        if (ifStmt.kind === "IfStmt") {
          expect(ifStmt.elseClause?.kind).toBe("IfStmt");
        }
      }
    });

    it("parses for loop", () => {
      const ast = parse("fn f() { for (var i: i32 = 0; i < 10; i++) {} }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        const forStmt = fn.body.statements[0];
        expect(forStmt).toMatchObject({ kind: "ForStmt" });
        if (forStmt.kind === "ForStmt") {
          expect(forStmt.init).toMatchObject({ kind: "VarDeclaration" });
          expect(forStmt.condition).toMatchObject({ kind: "BinaryExpr", op: "<" });
          expect(forStmt.update).toMatchObject({ kind: "IncrDecrStmt", op: "++" });
        }
      }
    });

    it("parses while loop", () => {
      const ast = parse("fn f() { while x > 0 { x--; } }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({ kind: "WhileStmt" });
      }
    });

    it("parses loop with continuing and break if", () => {
      const ast = parse("fn f() { loop { x++; continuing { break if x > 10; } } }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        const loopStmt = fn.body.statements[0];
        expect(loopStmt).toMatchObject({ kind: "LoopStmt" });
        if (loopStmt.kind === "LoopStmt") {
          expect(loopStmt.continuing).toMatchObject({
            kind: "ContinuingStmt",
            breakIf: { kind: "BinaryExpr", op: ">" },
          });
        }
      }
    });

    it("parses switch statement", () => {
      const ast = parse(`fn f() {
        switch x {
          case 1: { break; }
          case 2, 3: { break; }
          default: { break; }
        }
      }`);
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        const sw = fn.body.statements[0];
        expect(sw).toMatchObject({ kind: "SwitchStmt" });
        if (sw.kind === "SwitchStmt") {
          expect(sw.clauses).toHaveLength(3);
          expect(sw.clauses[1].selectors).toHaveLength(2);
          expect(sw.clauses[2].selectors[0]).toMatchObject({ kind: "DefaultSelector" });
        }
      }
    });

    it("parses assignment", () => {
      const ast = parse("fn f() { x = 1; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({
          kind: "AssignStmt",
          op: "=",
          target: { kind: "IdentExpr", name: "x" },
        });
      }
    });

    it("parses compound assignment", () => {
      const ast = parse("fn f() { x += 1; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({ kind: "AssignStmt", op: "+=" });
      }
    });

    it("parses increment/decrement", () => {
      const ast = parse("fn f() { i++; j--; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({ kind: "IncrDecrStmt", op: "++" });
        expect(fn.body.statements[1]).toMatchObject({ kind: "IncrDecrStmt", op: "--" });
      }
    });

    it("parses break and continue", () => {
      const ast = parse("fn f() { break; continue; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({ kind: "BreakStmt" });
        expect(fn.body.statements[1]).toMatchObject({ kind: "ContinueStmt" });
      }
    });

    it("parses discard", () => {
      const ast = parse("fn f() { discard; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({ kind: "DiscardStmt" });
      }
    });

    it("parses phony assignment", () => {
      const ast = parse("fn f() { _ = compute(); }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({ kind: "PhonyAssignStmt" });
      }
    });

    it("parses let declaration in function body", () => {
      const ast = parse("fn f() { let x = 42; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({ kind: "LetDeclaration", name: "x" });
      }
    });

    it("parses expression statement (function call)", () => {
      const ast = parse("fn f() { doSomething(); }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({
          kind: "ExprStmt",
          expr: { kind: "CallExpr", callee: "doSomething" },
        });
      }
    });

    it("parses complex LHS assignment", () => {
      const ast = parse("fn f() { a.b[i] += 1; }");
      const fn = ast.declarations[0];
      if (fn.kind === "FunctionDeclaration") {
        expect(fn.body.statements[0]).toMatchObject({
          kind: "AssignStmt",
          op: "+=",
          target: {
            kind: "IndexExpr",
            object: { kind: "MemberExpr" },
          },
        });
      }
    });
  });

  describe("comments", () => {
    it("collects comments from source", () => {
      const ast = parse("// hello\nconst x = 1;");
      expect(ast.leadingComments).toHaveLength(1);
      expect(ast.leadingComments![0]).toMatchObject({
        kind: "LineComment",
        value: "// hello",
      });
    });

    it("collects block comments", () => {
      const ast = parse("/* block */ const x = 1;");
      expect(ast.leadingComments).toHaveLength(1);
      expect(ast.leadingComments![0]).toMatchObject({
        kind: "BlockComment",
        value: "/* block */",
      });
    });
  });
});
