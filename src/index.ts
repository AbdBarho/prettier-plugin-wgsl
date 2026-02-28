import type { Plugin, AstPath, Doc } from "prettier";
import { parse } from "./parser.ts";
import { print, getCommentChildNodes, printComment, canAttachComment } from "./printer.ts";

const languages = [
  {
    name: "WGSL",
    parsers: ["wgsl"],
    extensions: [".wgsl"],
    vscodeLanguageIds: ["wgsl"],
  },
];

const parsers = {
  wgsl: {
    parse(text: string) {
      return parse(text);
    },
    astFormat: "wgsl-ast",
    locStart(node: { start: number }) {
      return node.start;
    },
    locEnd(node: { end: number }) {
      return node.end;
    },
  },
};

const printers = {
  "wgsl-ast": {
    print,
    canAttachComment,
    printComment,
    getCommentChildNodes,
  },
};

const plugin: Plugin = { languages, parsers, printers };
export default plugin;
export { languages, parsers, printers };
