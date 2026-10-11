import { describe, it, expect } from "vitest";
import type { ASTNode, IdentExpr } from "./ast.ts";
import { visitorKeys } from "./ast.ts";

const ident = (name: string): IdentExpr => ({ kind: "IdentExpr", name, start: 0, end: name.length });

const samples: ASTNode[] = [
  { kind: "TranslationUnit", directives: [], declarations: [], start: 0, end: 0 },
  { kind: "EnableDirective", extensions: ["f16"], start: 0, end: 0 },
  { kind: "RequiresDirective", extensions: ["readonly_and_readwrite_storage_textures"], start: 0, end: 0 },
  { kind: "DiagnosticDirective", severity: "off", rule: "x", start: 0, end: 0 },
  {
    kind: "FunctionDeclaration",
    attributes: [],
    name: "f",
    params: [],
    returnType: null,
    returnAttributes: [],
    body: { kind: "Block", statements: [], start: 0, end: 0 },
    start: 0,
    end: 0,
  },
  { kind: "StructDeclaration", name: "S", members: [], start: 0, end: 0 },
  {
    kind: "StructMember",
    attributes: [],
    name: "x",
    type: { kind: "TypeExpr", name: "i32", templateArgs: [], start: 0, end: 0 },
    start: 0,
    end: 0,
  },
  {
    kind: "VarDeclaration",
    attributes: [],
    qualifier: null,
    name: "x",
    type: null,
    initializer: null,
    start: 0,
    end: 0,
  },
  { kind: "LetDeclaration", name: "x", type: null, initializer: ident("y"), start: 0, end: 0 },
  { kind: "ConstDeclaration", name: "x", type: null, initializer: ident("y"), start: 0, end: 0 },
  {
    kind: "OverrideDeclaration",
    attributes: [],
    name: "x",
    type: null,
    initializer: null,
    start: 0,
    end: 0,
  },
  {
    kind: "AliasDeclaration",
    name: "x",
    type: { kind: "TypeExpr", name: "i32", templateArgs: [], start: 0, end: 0 },
    start: 0,
    end: 0,
  },
  { kind: "ConstAssertStatement", expr: ident("x"), start: 0, end: 0 },
  { kind: "Attribute", name: "a", args: [], start: 0, end: 0 },
  {
    kind: "Parameter",
    attributes: [],
    name: "p",
    type: { kind: "TypeExpr", name: "i32", templateArgs: [], start: 0, end: 0 },
    start: 0,
    end: 0,
  },
  { kind: "TypeExpr", name: "i32", templateArgs: [], start: 0, end: 0 },
  { kind: "Block", statements: [], start: 0, end: 0 },
  { kind: "ReturnStmt", value: null, start: 0, end: 0 },
  {
    kind: "IfStmt",
    condition: ident("c"),
    body: { kind: "Block", statements: [], start: 0, end: 0 },
    elseClause: null,
    start: 0,
    end: 0,
  },
  {
    kind: "ForStmt",
    init: null,
    condition: null,
    update: null,
    body: { kind: "Block", statements: [], start: 0, end: 0 },
    start: 0,
    end: 0,
  },
  {
    kind: "WhileStmt",
    condition: ident("c"),
    body: { kind: "Block", statements: [], start: 0, end: 0 },
    start: 0,
    end: 0,
  },
  {
    kind: "LoopStmt",
    body: { kind: "Block", statements: [], start: 0, end: 0 },
    continuing: null,
    start: 0,
    end: 0,
  },
  {
    kind: "ContinuingStmt",
    body: { kind: "Block", statements: [], start: 0, end: 0 },
    breakIf: null,
    start: 0,
    end: 0,
  },
  { kind: "SwitchStmt", expr: ident("x"), clauses: [], start: 0, end: 0 },
  {
    kind: "CaseClause",
    selectors: [{ kind: "DefaultSelector", start: 0, end: 0 }],
    body: { kind: "Block", statements: [], start: 0, end: 0 },
    start: 0,
    end: 0,
  },
  { kind: "DefaultSelector", start: 0, end: 0 },
  { kind: "AssignStmt", target: ident("x"), op: "=", value: ident("y"), start: 0, end: 0 },
  { kind: "IncrDecrStmt", target: ident("x"), op: "++", start: 0, end: 0 },
  { kind: "ExprStmt", expr: ident("x"), start: 0, end: 0 },
  { kind: "BreakStmt", start: 0, end: 0 },
  { kind: "ContinueStmt", start: 0, end: 0 },
  { kind: "DiscardStmt", start: 0, end: 0 },
  { kind: "PhonyAssignStmt", value: ident("x"), start: 0, end: 0 },
  { kind: "BinaryExpr", op: "+", left: ident("a"), right: ident("b"), start: 0, end: 0 },
  { kind: "UnaryExpr", op: "-", operand: ident("a"), start: 0, end: 0 },
  { kind: "CallExpr", callee: "f", templateArgs: [], args: [], start: 0, end: 0 },
  { kind: "MemberExpr", object: ident("o"), member: "m", start: 0, end: 0 },
  { kind: "IndexExpr", object: ident("o"), index: ident("i"), start: 0, end: 0 },
  { kind: "IdentExpr", name: "x", start: 0, end: 0 },
  { kind: "LiteralExpr", value: "1", literalType: "int", start: 0, end: 0 },
  { kind: "ParenExpr", expr: ident("x"), start: 0, end: 0 },
  { kind: "LineComment", value: "//", start: 0, end: 0 },
  { kind: "BlockComment", value: "/**/", start: 0, end: 0 },
];

const isNode = (v: unknown): boolean => typeof v === "object" && v !== null && "kind" in v;

describe("ast.visitorKeys", () => {
  it("lists the child fields of an if statement", () => {
    expect(visitorKeys.IfStmt).toEqual(["condition", "body", "elseClause"]);
  });

  it("lists no fields for leaves", () => {
    expect(visitorKeys.IdentExpr).toEqual([]);
    expect(visitorKeys.BreakStmt).toEqual([]);
  });

  it("covers every node-valued field of every node kind", () => {
    for (const node of samples) {
      const nodeFields = Object.entries(node)
        .filter(([key, v]) => key !== "comments" && (isNode(v) || (Array.isArray(v) && v.every(isNode))))
        .map(([key]) => key);
      expect(visitorKeys[node.kind], node.kind).toEqual(expect.arrayContaining(nodeFields));
    }
  });
});
