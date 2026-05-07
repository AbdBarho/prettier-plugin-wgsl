import type { AstPath, Doc } from "prettier";
import { doc } from "prettier";
import type {
  ASTNode,
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
import { callChild, mapChildren } from "./path-helpers.ts";
import { printDelimitedList } from "./expressions.ts";
import { hasBlankLineBetween } from "./statements.ts";

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
  if (SIMPLE_DECL_KINDS.has(prev.kind) && prev.kind === curr.kind) {
    return false;
  }
  return true;
}

// ─── Translation unit ─────────────────────────────────────────

export function printTranslationUnit(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as TranslationUnit;
  const directiveDocs = mapChildren(path, printFn, "directives");
  const declDocs = mapChildren(path, printFn, "declarations");

  const allItems = [...directiveDocs, ...declDocs];
  if (allItems.length === 0) return "";

  const result: Doc[] = [];
  const directiveCount = node.directives.length;
  for (let i = 0; i < allItems.length; i++) {
    if (i > 0) {
      if (i === directiveCount && directiveCount > 0) {
        result.push(hardline, hardline);
      } else if (i < directiveCount) {
        result.push(hardline);
      } else {
        const di = i - directiveCount;
        const prev = node.declarations[di - 1];
        const curr = node.declarations[di];
        if (needsBlankLineBetween(prev, curr)) result.push(hardline, hardline);
        else if (hasBlankLineBetween(prev.end, curr.start)) result.push(hardline, hardline);
        else result.push(hardline);
      }
    }
    result.push(allItems[i]);
  }
  result.push(hardline);
  return result;
}

// ─── Function / Struct ────────────────────────────────────────

export function printFunctionDeclaration(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as FunctionDeclaration;
  const attrDocs = mapChildren(path, printFn, "attributes");
  const paramDocs = mapChildren(path, printFn, "params");
  const bodyDoc = callChild(path, printFn, "body");

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

  parts.push("fn ", node.name);

  if (paramDocs.length === 0) parts.push("()");
  else parts.push(printDelimitedList("(", ")", paramDocs));

  if (node.returnType) {
    parts.push(" -> ");
    const returnAttrDocs = mapChildren(path, printFn, "returnAttributes");
    if (returnAttrDocs.length > 0) parts.push(join(" ", returnAttrDocs), " ");
    parts.push(callChild(path, printFn, "returnType"));
  }

  parts.push(" ", bodyDoc);
  return parts;
}

export function printStructDeclaration(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as StructDeclaration;
  if (node.members.length === 0) {
    return ["struct ", node.name, " {}"];
  }
  const memberDocs = mapChildren(path, printFn, "members");
  return ["struct ", node.name, " {", indent([hardline, join([",", hardline], memberDocs)]), ",", hardline, "}"];
}

// ─── Variable / let / const / override / alias / const_assert ───

// Renders a var/let/const declaration without a trailing semicolon. Used by
// for-loop init/update; the public wrappers append `;` for statement form.
export function printVarDeclarationCore(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as VarDeclaration;
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(join(" ", mapChildren(path, printFn, "attributes")), " ");
  }
  parts.push("var");
  if (node.qualifier) parts.push("<", node.qualifier, ">");
  parts.push(" ", node.name);
  if (node.type) parts.push(": ", callChild(path, printFn, "type"));
  if (node.initializer) {
    parts.push(" =");
    return group([...parts, indent([line, callChild(path, printFn, "initializer")])]);
  }
  return parts;
}

export function printVarDeclaration(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return [printVarDeclarationCore(path, printFn), ";"];
}

export function printLetOrConstDeclarationCore(
  path: AstPath<ASTNode>,
  printFn: (p: AstPath<ASTNode>) => Doc,
  keyword: "let" | "const",
): Doc {
  const node = path.node as LetDeclaration | ConstDeclaration;
  const parts: Doc[] = [keyword, " ", node.name];
  if (node.type) parts.push(": ", callChild(path, printFn, "type"));
  parts.push(" =");
  return group([...parts, indent([line, callChild(path, printFn, "initializer")])]);
}

export function printLetOrConstDeclaration(
  path: AstPath<ASTNode>,
  printFn: (p: AstPath<ASTNode>) => Doc,
  keyword: "let" | "const",
): Doc {
  return [printLetOrConstDeclarationCore(path, printFn, keyword), ";"];
}

export function printOverrideDeclaration(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as OverrideDeclaration;
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(join(" ", mapChildren(path, printFn, "attributes")), " ");
  }
  parts.push("override ", node.name);
  if (node.type) parts.push(": ", callChild(path, printFn, "type"));
  if (node.initializer) {
    parts.push(" =");
    return group([...parts, indent([line, callChild(path, printFn, "initializer")]), ";"]);
  }
  parts.push(";");
  return parts;
}

export function printAliasDeclaration(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as AliasDeclaration;
  return ["alias ", node.name, " = ", callChild(path, printFn, "type"), ";"];
}

export function printConstAssert(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return ["const_assert ", callChild(path, printFn, "expr"), ";"];
}
