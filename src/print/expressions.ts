import type { AstPath, Doc } from "prettier";
import { doc } from "prettier";
import type {
  ASTNode,
  Attribute,
  Parameter,
  StructMember,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  TypeExpr,
} from "../ast.ts";
import { assertNever } from "../ast.ts";
import { callChild, mapChildren } from "./path-helpers.ts";

const { join, line, softline, indent, group, ifBreak } = doc.builders;

export function printDelimitedList(open: string, close: string, items: Doc[]): Doc {
  if (items.length === 0) return [open, close];
  return group([open, indent([softline, join([",", line], items)]), ifBreak(",", ""), softline, close]);
}

// ─── Directives ───────────────────────────────────────────────

function printEnableDirective(node: { extensions: string[] }): Doc {
  return ["enable ", join(", ", node.extensions), ";"];
}

function printRequiresDirective(node: { extensions: string[] }): Doc {
  return ["requires ", join(", ", node.extensions), ";"];
}

function printDiagnosticDirective(node: { severity: string; rule: string }): Doc {
  return ["diagnostic(", node.severity, ", ", node.rule, ");"];
}

// Render any dangling comments attached to `node`, marking them printed.
// Used for nodes (e.g. zero-arg CallExpr) that have no AST children to anchor comments.
function printDanglingComments(node: ASTNode): Doc {
  const comments = (node as { comments?: { value: string; leading?: boolean; trailing?: boolean; printed?: boolean }[] }).comments;
  if (!comments) return "";
  const parts: Doc[] = [];
  for (const c of comments) {
    if (c.leading || c.trailing) continue;
    c.printed = true;
    if (parts.length > 0) parts.push(" ");
    parts.push(c.value);
  }
  return parts;
}

// ─── Attribute / Parameter / StructMember ─────────────────────

export function printAttribute(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as Attribute;
  if (node.args.length === 0) {
    return ["@", node.name];
  }
  return ["@", node.name, "(", join(", ", mapChildren(path, printFn, "args")), ")"];
}

export function printParameter(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as Parameter;
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(join(" ", mapChildren(path, printFn, "attributes")), " ");
  }
  parts.push(node.name, ": ", callChild(path, printFn, "type"));
  return parts;
}

export function printStructMember(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as StructMember;
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(join(" ", mapChildren(path, printFn, "attributes")), " ");
  }
  parts.push(node.name, ": ", callChild(path, printFn, "type"));
  return parts;
}

// ─── TypeExpr / ParenExpr ─────────────────────────────────────

export function printTypeExpr(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as TypeExpr;
  if (node.templateArgs.length === 0) return node.name;
  return [node.name, printDelimitedList("<", ">", mapChildren(path, printFn, "templateArgs"))];
}

export function printParenExpr(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return ["(", callChild(path, printFn, "expr"), ")"];
}

// ─── Binary / Unary / Call ───────────────────────────────────

// Precedence groups for binary operators (higher = tighter binding)
function getBinaryPrecedenceGroup(op: string): number {
  switch (op) {
    case "||":
      return 1;
    case "&&":
      return 2;
    case "|":
      return 3;
    case "^":
      return 4;
    case "&":
      return 5;
    case "==":
    case "!=":
      return 6;
    case "<":
    case ">":
    case "<=":
    case ">=":
      return 7;
    case "<<":
    case ">>":
      return 8;
    case "+":
    case "-":
      return 9;
    case "*":
    case "/":
    case "%":
      return 10;
    default:
      return 0;
  }
}

export function printBinaryExpr(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as BinaryExpr;
  const prec = getBinaryPrecedenceGroup(node.op);

  const left = node.left;
  const isChain = left.kind === "BinaryExpr" && getBinaryPrecedenceGroup(left.op) === prec;
  if (!isChain) {
    return [callChild(path, printFn, "left"), " ", node.op, " ", callChild(path, printFn, "right")];
  }

  // Walk the same-precedence left spine, rendering each operand via path so
  // comments on leaves attach correctly. leafDocs[0] is the leftmost leaf.
  const leafDocs: Doc[] = [];
  const opsCollected: string[] = [];
  function walk(p: AstPath<ASTNode>): void {
    const n = p.node;
    if (n.kind === "BinaryExpr" && getBinaryPrecedenceGroup(n.op) === prec) {
      p.call(walk, "left" as never);
      opsCollected.push(n.op);
      leafDocs.push(callChild(p, printFn, "right"));
    } else {
      leafDocs.unshift(printFn(p));
    }
  }
  walk(path);

  const rest: Doc[] = [];
  for (let i = 0; i < opsCollected.length; i++) {
    rest.push(line, opsCollected[i], " ", leafDocs[i + 1]);
  }
  return group([leafDocs[0], indent(rest)]);
}

export function printUnaryExpr(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as UnaryExpr;
  return [node.op, callChild(path, printFn, "operand")];
}

export function printCallExpr(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as CallExpr;
  const parts: Doc[] = [node.callee];
  if (node.templateArgs.length > 0) {
    parts.push(printDelimitedList("<", ">", mapChildren(path, printFn, "templateArgs")));
  }
  if (node.args.length > 0) {
    parts.push(printDelimitedList("(", ")", mapChildren(path, printFn, "args")));
  } else {
    parts.push("(", printDanglingComments(node), ")");
  }
  return parts;
}

// ─── Member / Index chains ────────────────────────────────────

type ChainPart = { type: "member"; name: string } | { type: "index" };

// Render a member/index access chain. `indexDocs` holds the rendered index
// expressions in source order, consumed positionally as the parts iterate.
// Short chains (<3 segments) render flat; longer chains break with softlines
// and are grouped so consecutive `[i]` indexing sticks to its preceding member.
function formatMemberChainDoc(headDoc: Doc, chainParts: ChainPart[], indexDocs: Doc[]): Doc {
  if (chainParts.length < 3) {
    const parts: Doc[] = [headDoc];
    let idx = 0;
    for (const part of chainParts) {
      if (part.type === "member") parts.push(".", part.name);
      else parts.push("[", indexDocs[idx++], "]");
    }
    return parts;
  }

  const chainDocs: Doc[] = [];
  let idx = 0;
  for (const part of chainParts) {
    if (part.type === "member") chainDocs.push([".", part.name]);
    else chainDocs.push(["[", indexDocs[idx++], "]"]);
  }

  const groupedDocs: Doc[][] = [];
  for (const d of chainDocs) {
    const isIndexEntry = Array.isArray(d) && d[0] === "[";
    if (isIndexEntry && groupedDocs.length > 0) {
      groupedDocs[groupedDocs.length - 1].push(d);
    } else {
      groupedDocs.push([d]);
    }
  }

  const indentedParts: Doc[] = [];
  for (const g of groupedDocs) indentedParts.push(softline, ...g);
  return group([headDoc, indent(indentedParts)]);
}

function printMemberOrIndexChain(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  let headDoc: Doc = "";
  const chainParts: ChainPart[] = [];
  const indexDocs: Doc[] = [];
  function walk(p: AstPath<ASTNode>): void {
    const n = p.node;
    if (n.kind === "MemberExpr") {
      p.call(walk, "object" as never);
      chainParts.push({ type: "member", name: n.member });
    } else if (n.kind === "IndexExpr") {
      p.call(walk, "object" as never);
      indexDocs.push(callChild(p, printFn, "index"));
      chainParts.push({ type: "index" });
    } else {
      headDoc = printFn(p);
    }
  }
  walk(path);
  return formatMemberChainDoc(headDoc, chainParts, indexDocs);
}

export function printMemberExpr(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return printMemberOrIndexChain(path, printFn);
}

export function printIndexExpr(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return printMemberOrIndexChain(path, printFn);
}

// ─── Leaf renderer ────────────────────────────────────────────
// Handles AST kinds with no path-attachable children: directives, simple
// keyword statements, identifiers, literals, default selectors, comments.

type LeafNode = Extract<
  ASTNode,
  {
    kind:
      | "EnableDirective"
      | "RequiresDirective"
      | "DiagnosticDirective"
      | "BreakStmt"
      | "ContinueStmt"
      | "DiscardStmt"
      | "IdentExpr"
      | "LiteralExpr"
      | "DefaultSelector"
      | "LineComment"
      | "BlockComment";
  }
>;

export function printLeafNode(node: LeafNode): Doc {
  switch (node.kind) {
    case "EnableDirective":
      return printEnableDirective(node);
    case "RequiresDirective":
      return printRequiresDirective(node);
    case "DiagnosticDirective":
      return printDiagnosticDirective(node);
    case "BreakStmt":
      return "break;";
    case "ContinueStmt":
      return "continue;";
    case "DiscardStmt":
      return "discard;";
    case "IdentExpr":
      return node.name;
    case "LiteralExpr":
      return node.value;
    case "DefaultSelector":
      return "default";
    case "LineComment":
    case "BlockComment":
      return node.value;
    default:
      return assertNever(node);
  }
}
