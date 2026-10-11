import type { Doc } from "prettier";
import { doc } from "prettier";
import type {
  TranslationUnit,
  FunctionDeclaration,
  StructDeclaration,
  VarDeclaration,
  LetDeclaration,
  ConstDeclaration,
  OverrideDeclaration,
  AliasDeclaration,
  Declaration,
} from "../ast.ts";
import { type Print, printEach, printDelimitedList, printStatementList } from "./helpers.ts";

const { join, line, hardline, indent, group } = doc.builders;

// Entry-point attribute names that go on their own line before fn
const ENTRY_POINT_ATTRS = new Set(["vertex", "fragment", "compute"]);

// Declaration kinds that are "simple" one-liners and can be grouped without blank lines
const SIMPLE_DECL_KINDS = new Set([
  "VarDeclaration",
  "LetDeclaration",
  "ConstDeclaration",
  "OverrideDeclaration",
  "AliasDeclaration",
  "ConstAssertStatement",
]);

function needsBlankLineBetween(prev: Declaration, curr: Declaration): boolean {
  return !(SIMPLE_DECL_KINDS.has(prev.kind) && prev.kind === curr.kind);
}

// ─── Translation unit ─────────────────────────────────────────

export function printTranslationUnit(node: TranslationUnit, print: Print, text: string): Doc {
  const directiveDocs = printEach(node, "directives", print);
  const declDocs = printEach(node, "declarations", print);
  if (directiveDocs.length === 0 && declDocs.length === 0) return "";

  const result: Doc[] = [join(hardline, directiveDocs)];
  if (directiveDocs.length > 0 && declDocs.length > 0) result.push(hardline, hardline);
  result.push(...printStatementList(node.declarations, declDocs, text, needsBlankLineBetween), hardline);
  return result;
}

// ─── Function / Struct ────────────────────────────────────────

export function printFunctionDeclaration(node: FunctionDeclaration, print: Print): Doc {
  const attrDocs = printEach(node, "attributes", print);
  const parts: Doc[] = [];

  const entryAttrDocs: Doc[] = [];
  const otherAttrDocs: Doc[] = [];
  for (let i = 0; i < node.attributes.length; i++) {
    if (ENTRY_POINT_ATTRS.has(node.attributes[i].name)) entryAttrDocs.push(attrDocs[i]);
    else otherAttrDocs.push(attrDocs[i]);
  }

  if (entryAttrDocs.length > 0) {
    parts.push(join(" ", entryAttrDocs));
    if (otherAttrDocs.length > 0) parts.push(" ", join(" ", otherAttrDocs));
    parts.push(hardline);
  } else if (otherAttrDocs.length > 0) {
    parts.push(join(" ", otherAttrDocs), hardline);
  }

  parts.push("fn ", node.name, printDelimitedList("(", ")", printEach(node, "params", print)));

  if (node.returnType) {
    parts.push(" -> ");
    const returnAttrDocs = printEach(node, "returnAttributes", print);
    if (returnAttrDocs.length > 0) parts.push(join(" ", returnAttrDocs), " ");
    parts.push(print("returnType"));
  }

  parts.push(" ", print("body"));
  return parts;
}

export function printStructDeclaration(node: StructDeclaration, print: Print): Doc {
  if (node.members.length === 0) {
    return ["struct ", node.name, " {}"];
  }
  const memberDocs = printEach(node, "members", print);
  return ["struct ", node.name, " {", indent([hardline, join([",", hardline], memberDocs)]), ",", hardline, "}"];
}

// ─── Variable / let / const / override / alias / const_assert ───

// `semi` is empty when the declaration sits in a for-loop header
export function printVarDeclaration(node: VarDeclaration, print: Print, semi: string): Doc {
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(join(" ", printEach(node, "attributes", print)), " ");
  }
  parts.push("var");
  if (node.qualifier) parts.push("<", node.qualifier, ">");
  parts.push(" ", node.name);
  if (node.type) parts.push(": ", print("type"));
  if (node.initializer) {
    return [group([...parts, " =", indent([line, print("initializer")])]), semi];
  }
  return [...parts, semi];
}

export function printLetOrConstDeclaration(
  node: LetDeclaration | ConstDeclaration,
  print: Print,
  keyword: "let" | "const",
  semi: string,
): Doc {
  const parts: Doc[] = [keyword, " ", node.name];
  if (node.type) parts.push(": ", print("type"));
  return [group([...parts, " =", indent([line, print("initializer")])]), semi];
}

export function printOverrideDeclaration(node: OverrideDeclaration, print: Print): Doc {
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(join(" ", printEach(node, "attributes", print)), " ");
  }
  parts.push("override ", node.name);
  if (node.type) parts.push(": ", print("type"));
  if (node.initializer) {
    return group([...parts, " =", indent([line, print("initializer")]), ";"]);
  }
  return [...parts, ";"];
}

export function printAliasDeclaration(node: AliasDeclaration, print: Print): Doc {
  return ["alias ", node.name, " = ", print("type"), ";"];
}

export function printConstAssert(print: Print): Doc {
  return ["const_assert ", print("expr"), ";"];
}
