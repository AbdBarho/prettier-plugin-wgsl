import type { Doc } from "prettier";
import { doc } from "prettier";
import type {
  ASTNode,
  Attribute,
  Parameter,
  StructMember,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  TypeExpr,
  Expr,
} from "../ast.ts";
import { assertNever } from "../ast.ts";
import { type Print, printEach, printDelimitedList } from "./helpers.ts";

const { join, line, softline, indent, group } = doc.builders;

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
  if (!node.comments) return "";
  const parts: Doc[] = [];
  for (const c of node.comments) {
    if (c.leading || c.trailing) continue;
    c.printed = true;
    if (parts.length > 0) parts.push(" ");
    parts.push(c.value);
  }
  return parts;
}

// ─── Attribute / Parameter / StructMember ─────────────────────

export function printAttribute(node: Attribute, print: Print): Doc {
  if (node.args.length === 0) {
    return ["@", node.name];
  }
  return ["@", node.name, "(", join(", ", printEach(node, "args", print)), ")"];
}

export function printParameterOrMember(node: Parameter | StructMember, print: Print): Doc {
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(join(" ", printEach(node, "attributes", print)), " ");
  }
  parts.push(node.name, ": ", print("type"));
  return parts;
}

// ─── TypeExpr / ParenExpr ─────────────────────────────────────

export function printTypeExpr(node: TypeExpr, print: Print): Doc {
  if (node.templateArgs.length === 0) return node.name;
  return [node.name, printDelimitedList("<", ">", printEach(node, "templateArgs", print))];
}

export function printParenExpr(print: Print): Doc {
  return ["(", print("expr"), ")"];
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

// Selector reaching `depth` levels down a chain through `key`, e.g. ["left", "left"]
function repeatKey(key: string, depth: number): string[] {
  return Array<string>(depth).fill(key);
}

export function printBinaryExpr(node: BinaryExpr, print: Print): Doc {
  const prec = getBinaryPrecedenceGroup(node.op);
  const isSamePrec = (e: Expr): e is BinaryExpr => e.kind === "BinaryExpr" && getBinaryPrecedenceGroup(e.op) === prec;

  if (!isSamePrec(node.left)) {
    return [print("left"), " ", node.op, " ", print("right")];
  }

  // Flatten the same-precedence left spine: spine[d] is reached by `d` steps through "left"
  const spine: BinaryExpr[] = [node];
  for (let left: Expr = node.left; isSamePrec(left); left = left.left) spine.push(left);

  const head = print(repeatKey("left", spine.length));
  const rest: Doc[] = [];
  for (let depth = spine.length - 1; depth >= 0; depth--) {
    rest.push(line, spine[depth].op, " ", print([...repeatKey("left", depth), "right"]));
  }
  return group([head, indent(rest)]);
}

export function printUnaryExpr(node: UnaryExpr, print: Print): Doc {
  return [node.op, print("operand")];
}

export function printCallExpr(node: CallExpr, print: Print): Doc {
  const parts: Doc[] = [node.callee];
  if (node.templateArgs.length > 0) {
    parts.push(printDelimitedList("<", ">", printEach(node, "templateArgs", print)));
  }
  if (node.args.length > 0) {
    parts.push(printDelimitedList("(", ")", printEach(node, "args", print)));
  } else {
    parts.push("(", printDanglingComments(node), ")");
  }
  return parts;
}

// ─── Member / Index chains ────────────────────────────────────

// Short chains (<3 segments) render flat; longer chains break before each `.`,
// keeping consecutive `[i]` indexing attached to its preceding member.
export function printMemberChain(node: MemberExpr | IndexExpr, print: Print): Doc {
  const links: (MemberExpr | IndexExpr)[] = [];
  for (let e: Expr = node; e.kind === "MemberExpr" || e.kind === "IndexExpr"; e = e.object) links.push(e);
  links.reverse(); // source order; links[i] is reached by `links.length - 1 - i` steps through "object"

  const headDoc = print(repeatKey("object", links.length));
  const segments = links.map((link, i): Doc =>
    link.kind === "MemberExpr" ? [".", link.member] : ["[", print([...repeatKey("object", links.length - 1 - i), "index"]), "]"],
  );

  if (segments.length < 3) return [headDoc, ...segments];
  const parts = links.flatMap((link, i) => (i === 0 || link.kind === "MemberExpr" ? [softline, segments[i]] : [segments[i]]));
  return group([headDoc, indent(parts)]);
}

// ─── Leaf renderer ────────────────────────────────────────────
// Handles AST kinds with no child nodes: directives, simple keyword
// statements, identifiers, literals, default selectors, comments.

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
