import type { AstPath, Doc } from "prettier";
import { doc } from "prettier";
import type {
  ASTNode,
  Block,
  IfStmt,
  ForStmt,
  LoopStmt,
  ContinuingStmt,
  CaseClause,
  ReturnStmt,
  AssignStmt,
  IncrDecrStmt,
  VarDeclaration,
  LetDeclaration,
  ConstDeclaration,
  ExprStmt,
} from "../ast.ts";
import { assertNever } from "../ast.ts";
import { callChild, mapChildren, mapStmtEntries } from "./path-helpers.ts";
import { offsetToLine } from "./blank-line-info.ts";
import { getCurrentContext } from "./context.ts";
import { printVarDeclarationCore, printLetOrConstDeclarationCore } from "./declarations.ts";

type ForLoopSubStmt = VarDeclaration | LetDeclaration | ConstDeclaration | AssignStmt | IncrDecrStmt | ExprStmt;

const { join, line, softline, hardline, indent, group } = doc.builders;

// Returns true if the source text between two offsets contains a blank line
// A blank line is an empty line (or whitespace-only line) between two newlines
export function hasBlankLineBetween(fromEnd: number, toStart: number): boolean {
  const { lineStarts, blankLines } = getCurrentContext().blankLineInfo;
  if (lineStarts.length <= 1) return false;
  const startLine = offsetToLine(lineStarts, fromEnd);
  const endLine = offsetToLine(lineStarts, toStart);
  for (let l = startLine; l <= endLine; l++) {
    if (blankLines.has(l)) return true;
  }
  return false;
}

export function printStatementList(stmts: { node: { start: number; end: number }; doc: Doc }[]): Doc[] {
  const result: Doc[] = [];
  for (let i = 0; i < stmts.length; i++) {
    if (i > 0) {
      if (hasBlankLineBetween(stmts[i - 1].node.end, stmts[i].node.start)) {
        result.push(hardline, hardline);
      } else {
        result.push(hardline);
      }
    }
    result.push(stmts[i].doc);
  }
  return result;
}

// ─── Block / control-flow statements ──────────────────────────

export function printBlock(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as Block;
  if (node.statements.length === 0) return "{}";
  const stmts = mapStmtEntries(path, printFn, "statements");
  return ["{", indent([hardline, ...printStatementList(stmts)]), hardline, "}"];
}

export function printIfStmt(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as IfStmt;
  const condDoc = callChild(path, printFn, "condition");
  const bodyDoc = callChild(path, printFn, "body");
  const parts: Doc[] = [group(["if", indent([line, condDoc]), line]), bodyDoc];

  if (node.elseClause) {
    parts.push(" else ", callChild(path, printFn, "elseClause"));
  }

  return parts;
}

export function printLoopStmt(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as LoopStmt;
  if (node.continuing) {
    const continuingDoc = callChild(path, printFn, "continuing");
    const stmts = mapStmtEntries(path, printFn, "body", "statements");
    const bodyParts = printStatementList(stmts);
    if (stmts.length > 0) bodyParts.push(hardline);
    bodyParts.push(continuingDoc);
    return ["loop {", indent([hardline, ...bodyParts]), hardline, "}"];
  }
  return ["loop ", callChild(path, printFn, "body")];
}

export function printWhileStmt(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  return [
    group(["while", indent([line, callChild(path, printFn, "condition")]), line]),
    callChild(path, printFn, "body"),
  ];
}

export function printForStmt(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as ForStmt;
  const subStmt = (p: AstPath<ASTNode>) => printForLoopSubStmt(p, printFn);
  const init = node.init ? path.call(subStmt, "init" as never) : "";
  const cond = node.condition ? callChild(path, printFn, "condition") : "";
  const update = node.update ? path.call(subStmt, "update" as never) : "";

  return [
    group(["for (", indent([softline, init, ";", line, cond, ";", line, update]), softline, ")"]),
    " ",
    callChild(path, printFn, "body"),
  ];
}

export function printCaseClause(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as CaseClause;
  const isDefault = node.selectors.length === 1 && node.selectors[0].kind === "DefaultSelector";
  const selectorDoc = isDefault
    ? "default"
    : ["case ", join(", ", mapChildren(path, printFn, "selectors"))];
  return [selectorDoc, ": ", callChild(path, printFn, "body")];
}

export function printSwitchStmt(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const exprDoc = callChild(path, printFn, "expr");
  const clauseDocs = mapChildren(path, printFn, "clauses");
  return ["switch ", exprDoc, " {", indent([hardline, join(hardline, clauseDocs)]), hardline, "}"];
}

export function printContinuingStmt(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as ContinuingStmt;
  const stmts = mapStmtEntries(path, printFn, "body", "statements");
  if (node.breakIf) {
    stmts.push({
      node: { start: node.breakIf.start, end: node.breakIf.end },
      doc: ["break if ", callChild(path, printFn, "breakIf"), ";"],
    });
  }
  if (stmts.length === 0) return "continuing {}";
  return ["continuing {", indent([hardline, ...printStatementList(stmts)]), hardline, "}"];
}

// ─── Simple statements ────────────────────────────────────────

export function printReturnStmt(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as ReturnStmt;
  if (node.value) {
    return group(["return", indent([line, callChild(path, printFn, "value")]), ";"]);
  }
  return "return;";
}

// Print a statement without trailing semicolon (for for-loop init/update)
function printForLoopSubStmt(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as ForLoopSubStmt;
  switch (node.kind) {
    case "VarDeclaration":
      return printVarDeclarationCore(path, printFn);
    case "LetDeclaration":
      return printLetOrConstDeclarationCore(path, printFn, "let");
    case "ConstDeclaration":
      return printLetOrConstDeclarationCore(path, printFn, "const");
    case "AssignStmt":
      return printAssignStmtCore(path, printFn);
    case "IncrDecrStmt":
      return printIncrDecrStmtCore(path, printFn);
    case "ExprStmt":
      return printExprStmtCore(path, printFn);
    default:
      return assertNever(node);
  }
}

function printAssignStmtCore(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as AssignStmt;
  return group([
    callChild(path, printFn, "target"),
    " ",
    node.op,
    indent([line, callChild(path, printFn, "value")]),
  ]);
}

export function printAssignStmt(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return [printAssignStmtCore(path, printFn), ";"];
}

function printIncrDecrStmtCore(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node as IncrDecrStmt;
  return [callChild(path, printFn, "target"), node.op];
}

export function printIncrDecrStmt(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return [printIncrDecrStmtCore(path, printFn), ";"];
}

function printExprStmtCore(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return callChild(path, printFn, "expr");
}

export function printExprStmt(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return [printExprStmtCore(path, printFn), ";"];
}

export function printPhonyAssignStmt(path: AstPath<ASTNode>, printFn: (p: AstPath<ASTNode>) => Doc): Doc {
  return group(["_ =", indent([line, callChild(path, printFn, "value")]), ";"]);
}
