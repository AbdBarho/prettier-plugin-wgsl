import type { Doc, Printer } from "prettier";
import { doc, util } from "prettier";
import type { ASTNode } from "../ast.ts";

const { join, line, softline, hardline, indent, group, ifBreak } = doc.builders;

export type Print = Parameters<Printer<ASTNode>["print"]>[2];

// Prints each node of an array-valued field of `node`; `prefix` is the selector from the current node to `node`
export function printEach<K extends string>(node: { [P in K]: ASTNode[] }, key: K, print: Print, prefix: string[] = []): Doc[] {
  return node[key].map((_, i) => print([...prefix, key, i]));
}

export function printDelimitedList(open: string, close: string, items: Doc[]): Doc {
  if (items.length === 0) return [open, close];
  return group([open, indent([softline, join([",", line], items)]), ifBreak(",", ""), softline, close]);
}

// Joins statements with hardlines, keeping a single blank line wherever the source had one
// (or wherever `forceBlankLine` asks for one)
export function printStatementList<N extends { end: number }>(
  nodes: N[],
  docs: Doc[],
  text: string,
  forceBlankLine?: (prev: N, curr: N) => boolean,
): Doc[] {
  const result: Doc[] = [];
  for (let i = 0; i < docs.length; i++) {
    if (i > 0) {
      result.push(hardline);
      if (forceBlankLine?.(nodes[i - 1], nodes[i]) || util.isNextLineEmpty(text, nodes[i - 1].end)) result.push(hardline);
    }
    result.push(docs[i]);
  }
  return result;
}
