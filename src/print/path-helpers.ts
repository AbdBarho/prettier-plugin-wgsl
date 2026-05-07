import type { AstPath, Doc } from "prettier";
import type { ASTNode } from "../ast.ts";

export function callChild(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc, field: string): Doc {
  return path.call(printFn, field as never);
}

export function mapChildren(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc, field: string): Doc[] {
  return path.map(printFn, field as never);
}

// Map a statement list to {node, doc} entries for `printStatementList`,
// which preserves source blank lines between consecutive statements.
export function mapStmtEntries(
  path: AstPath<ASTNode>,
  printFn: (path: AstPath<ASTNode>) => Doc,
  field: string,
  subField?: string,
): { node: { start: number; end: number }; doc: Doc }[] {
  const builder = (p: AstPath<ASTNode>) => ({ node: p.node, doc: printFn(p) });
  return subField === undefined
    ? path.map(builder, field as never)
    : path.map(builder, field as never, subField as never);
}
