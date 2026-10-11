import type { Doc } from "prettier";
import { doc } from "prettier";
import type {
  Block,
  IfStmt,
  ForStmt,
  LoopStmt,
  ContinuingStmt,
  SwitchStmt,
  CaseClause,
  ReturnStmt,
  AssignStmt,
  IncrDecrStmt,
} from "../ast.ts";
import { type Print, printEach, printStatementList } from "./helpers.ts";

const { join, line, softline, hardline, indent, group } = doc.builders;

// ─── Block / control-flow statements ──────────────────────────

export function printBlock(node: Block, print: Print, text: string): Doc {
  if (node.statements.length === 0) return "{}";
  const stmts = printStatementList(node.statements, printEach(node, "statements", print), text);
  return ["{", indent([hardline, ...stmts]), hardline, "}"];
}

export function printIfStmt(node: IfStmt, print: Print): Doc {
  const parts: Doc[] = [group(["if", indent([line, print("condition")]), line]), print("body")];
  if (node.elseClause) parts.push(" else ", print("elseClause"));
  return parts;
}

export function printLoopStmt(node: LoopStmt, print: Print, text: string): Doc {
  if (!node.continuing) return ["loop ", print("body")];
  const { statements } = node.body;
  const docs = printEach(node.body, "statements", print, ["body"]);
  const bodyParts = printStatementList(statements, docs, text);
  if (statements.length > 0) bodyParts.push(hardline);
  bodyParts.push(print("continuing"));
  return ["loop {", indent([hardline, ...bodyParts]), hardline, "}"];
}

export function printWhileStmt(print: Print): Doc {
  return [group(["while", indent([line, print("condition")]), line]), print("body")];
}

export function printForStmt(node: ForStmt, print: Print): Doc {
  const init = node.init ? print("init") : "";
  const cond = node.condition ? print("condition") : "";
  const update = node.update ? print("update") : "";
  return [group(["for (", indent([softline, init, ";", line, cond, ";", line, update]), softline, ")"]), " ", print("body")];
}

export function printCaseClause(node: CaseClause, print: Print): Doc {
  const isDefault = node.selectors.length === 1 && node.selectors[0].kind === "DefaultSelector";
  const selectorDoc = isDefault ? "default" : ["case ", join(", ", printEach(node, "selectors", print))];
  return [selectorDoc, ": ", print("body")];
}

export function printSwitchStmt(node: SwitchStmt, print: Print): Doc {
  const clauseDocs = printEach(node, "clauses", print);
  return ["switch ", print("expr"), " {", indent([hardline, join(hardline, clauseDocs)]), hardline, "}"];
}

export function printContinuingStmt(node: ContinuingStmt, print: Print, text: string): Doc {
  const nodes: { end: number }[] = [...node.body.statements];
  const docs = printEach(node.body, "statements", print, ["body"]);
  if (node.breakIf) {
    nodes.push(node.breakIf);
    docs.push(["break if ", print("breakIf"), ";"]);
  }
  if (docs.length === 0) return "continuing {}";
  return ["continuing {", indent([hardline, ...printStatementList(nodes, docs, text)]), hardline, "}"];
}

// ─── Simple statements ────────────────────────────────────────
// `semi` is empty when the statement sits in a for-loop header

export function printReturnStmt(node: ReturnStmt, print: Print): Doc {
  if (!node.value) return "return;";
  return group(["return", indent([line, print("value")]), ";"]);
}

export function printAssignStmt(node: AssignStmt, print: Print, semi: string): Doc {
  return [group([print("target"), " ", node.op, indent([line, print("value")])]), semi];
}

export function printIncrDecrStmt(node: IncrDecrStmt, print: Print, semi: string): Doc {
  return [print("target"), node.op, semi];
}

export function printExprStmt(print: Print, semi: string): Doc {
  return [print("expr"), semi];
}

export function printPhonyAssignStmt(print: Print): Doc {
  return group(["_ =", indent([line, print("value")]), ";"]);
}
