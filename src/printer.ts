import type { AstPath, Doc, Printer } from "prettier";
import { doc } from "prettier";
import type {
  ASTNode,
  TranslationUnit,
  FunctionDeclaration,
  StructDeclaration,
  StructMember,
  Parameter,
  Attribute,
  VarDeclaration,
  LetDeclaration,
  ConstDeclaration,
  OverrideDeclaration,
  AliasDeclaration,
  ConstAssertStatement,
  Block,
  ReturnStmt,
  IfStmt,
  ForStmt,
  WhileStmt,
  LoopStmt,
  ContinuingStmt,
  SwitchStmt,
  CaseClause,
  AssignStmt,
  IncrDecrStmt,
  ExprStmt,
  PhonyAssignStmt,
  BinaryExpr,
  UnaryExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  TypeExpr,
  Expr,
  Stmt,
  CommentNode,
  Declaration,
} from "./ast.ts";

const { join, line, softline, hardline, indent, group, ifBreak } = doc.builders;

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

// Module-level original source text, set from Prettier options
let originalText = "";

// Helper to call a child through Prettier's path traversal (enables comment injection)
function callChild(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc, field: string): Doc {
  return path.call(printFn, field as never);
}

function mapChildren(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc, field: string): Doc[] {
  return path.map(printFn, field as never);
}

export const print: Printer<ASTNode>["print"] = function printNode(
  path: AstPath<ASTNode>,
  options: object,
  printFn: (path: AstPath<ASTNode>) => Doc,
): Doc {
  const node = path.node;
  if (!node) return "";
  // Capture original text on first call
  if ("originalText" in options && typeof options.originalText === "string") {
    originalText = options.originalText;
  }
  return printASTNodeFromPath(node, path, printFn);
};

// Path-based dispatch that enables Prettier comment injection for container nodes
function printASTNodeFromPath(node: ASTNode, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  switch (node.kind) {
    case "TranslationUnit":
      return printTranslationUnitFromPath(node, path, printFn);
    case "FunctionDeclaration":
      return printFunctionDeclarationFromPath(node, path, printFn);
    case "Block":
      return printBlockFromPath(node, path, printFn);
    case "IfStmt":
      return printIfStmtFromPath(node, path, printFn);
    case "LoopStmt":
      return printLoopStmtFromPath(node, path, printFn);
    case "ContinuingStmt":
      return printContinuingStmtFromPath(node, path, printFn);
    case "WhileStmt":
      return printWhileStmtFromPath(node, path, printFn);
    case "ForStmt":
      return printForStmtFromPath(node, path, printFn);
    case "SwitchStmt":
      return printSwitchStmtFromPath(node, path, printFn);
    case "CaseClause":
      return printCaseClauseFromPath(node, path, printFn);
    case "StructDeclaration":
      return printStructDeclarationFromPath(node, path, printFn);
    default:
      return printASTNode(node);
  }
}

function printASTNode(node: ASTNode): Doc {
  switch (node.kind) {
    case "EnableDirective":
      return printEnableDirective(node);
    case "RequiresDirective":
      return printRequiresDirective(node);
    case "DiagnosticDirective":
      return printDiagnosticDirective(node);
    case "VarDeclaration":
      return printVarDeclaration(node);
    case "LetDeclaration":
      return printLetDeclaration(node);
    case "ConstDeclaration":
      return printConstDeclaration(node);
    case "OverrideDeclaration":
      return printOverrideDeclaration(node);
    case "AliasDeclaration":
      return printAliasDeclaration(node);
    case "ConstAssertStatement":
      return printConstAssert(node);
    case "ReturnStmt":
      return printReturnStmt(node);
    case "IfStmt":
      return printIfStmt(node);
    case "AssignStmt":
      return printAssignStmt(node);
    case "IncrDecrStmt":
      return printIncrDecrStmt(node);
    case "ExprStmt":
      return printExprStmt(node);
    case "BreakStmt":
      return "break;";
    case "ContinueStmt":
      return "continue;";
    case "DiscardStmt":
      return "discard;";
    case "PhonyAssignStmt":
      return printPhonyAssignStmt(node);
    case "BinaryExpr":
      return printBinaryExpr(node);
    case "UnaryExpr":
      return printUnaryExpr(node);
    case "CallExpr":
      return printCallExpr(node);
    case "MemberExpr":
      return printMemberExpr(node);
    case "IndexExpr":
      return printIndexExpr(node);
    case "IdentExpr":
      return node.name;
    case "LiteralExpr":
      return node.value;
    case "ParenExpr":
      return ["(", printASTNode(node.expr), ")"];
    case "TypeExpr":
      return printTypeExpr(node);
    case "Attribute":
      return printAttribute(node);
    case "Parameter":
      return printParameter(node);
    case "StructMember":
      return printStructMember(node);
    default:
      return "";
  }
}

// ─── Path-based container printers (enable Prettier comment injection) ───

function printTranslationUnitFromPath(node: TranslationUnit, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  // Use path-based traversal for declarations so comments can be attached
  const directiveDocs = mapChildren(path, printFn, "directives");
  const declDocs = mapChildren(path, printFn, "declarations");
  return buildTranslationUnitDoc(node, directiveDocs, declDocs);
}

function printFunctionDeclarationFromPath(
  node: FunctionDeclaration,
  path: AstPath<ASTNode>,
  printFn: (path: AstPath<ASTNode>) => Doc,
): Doc {
  const attrDocs = mapChildren(path, printFn, "attributes");
  const paramDocs = mapChildren(path, printFn, "params");
  const returnAttrDocs = mapChildren(path, printFn, "returnAttributes");
  const bodyDoc = callChild(path, printFn, "body");
  return buildFunctionDeclaration(node, bodyDoc, attrDocs, paramDocs, returnAttrDocs);
}

function printBlockFromPath(node: Block, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  if (node.statements.length === 0) return "{}";
  const stmtDocs = mapChildren(path, printFn, "statements");
  const stmts = node.statements.map((s, i) => ({ node: s, doc: stmtDocs[i] }));
  return ["{", indent([hardline, ...printStatementList(stmts)]), hardline, "}"];
}

function printIfStmtFromPath(node: IfStmt, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const condDoc = printASTNode(node.condition);
  const bodyDoc = callChild(path, printFn, "body");
  const parts: Doc[] = [group(["if", indent([line, condDoc]), line]), bodyDoc];

  if (node.elseClause) {
    parts.push(" else ", callChild(path, printFn, "elseClause"));
  }

  return parts;
}

function printLoopStmtFromPath(node: LoopStmt, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  if (node.continuing) {
    const continuingDoc = callChild(path, printFn, "continuing");
    const stmts = node.body.statements.map((s) => ({ node: s, doc: printASTNode(s) }));
    const bodyParts = printStatementList(stmts);
    if (stmts.length > 0) {
      bodyParts.push(hardline);
    }
    bodyParts.push(continuingDoc);
    return ["loop {", indent([hardline, ...bodyParts]), hardline, "}"];
  }
  return ["loop ", callChild(path, printFn, "body")];
}

function printWhileStmtFromPath(node: WhileStmt, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  return [group(["while", indent([line, printASTNode(node.condition)]), line]), callChild(path, printFn, "body")];
}

function printForStmtFromPath(node: ForStmt, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const init = node.init ? printStmtNoSemicolon(node.init) : "";
  const cond = node.condition ? printASTNode(node.condition) : "";
  const update = node.update ? printStmtNoSemicolon(node.update) : "";

  return [
    group(["for (", indent([softline, init, ";", line, cond, ";", line, update]), softline, ")"]),
    " ",
    callChild(path, printFn, "body"),
  ];
}

function printStructDeclarationFromPath(node: StructDeclaration, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  if (node.members.length === 0) {
    return ["struct ", node.name, " {}"];
  }
  const memberDocs = mapChildren(path, printFn, "members");
  return ["struct ", node.name, " {", indent([hardline, join([",", hardline], memberDocs)]), ",", hardline, "}"];
}

function printCaseClauseFromPath(node: CaseClause, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const isDefault = node.selectors.length === 1 && node.selectors[0].kind === "DefaultSelector";
  const selectorDoc = isDefault
    ? "default"
    : [
        "case ",
        join(
          ", ",
          node.selectors.map((s) => printASTNode(s)),
        ),
      ];
  return [selectorDoc, ": ", callChild(path, printFn, "body")];
}

function printSwitchStmtFromPath(node: SwitchStmt, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const clauseDocs = mapChildren(path, printFn, "clauses");
  return ["switch ", printASTNode(node.expr), " {", indent([hardline, join(hardline, clauseDocs)]), hardline, "}"];
}

function printContinuingStmtFromPath(node: ContinuingStmt, path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const stmts: { node: { start: number; end: number }; doc: Doc }[] = node.body.statements.map((s) => ({ node: s, doc: printASTNode(s) }));
  if (node.breakIf) {
    stmts.push({
      node: { start: node.breakIf.start, end: node.breakIf.end },
      doc: ["break if ", printASTNode(node.breakIf), ";"],
    });
  }
  if (stmts.length === 0) {
    return "continuing {}";
  }
  return ["continuing {", indent([hardline, ...printStatementList(stmts)]), hardline, "}"];
}

// ─── Shared builders (used by both path-based and legacy printers) ───

function buildTranslationUnitDoc(node: TranslationUnit, directiveDocs: Doc[], declDocs: Doc[]): Doc {
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
        if (needsBlankLineBetween(prev, curr)) {
          result.push(hardline, hardline);
        } else if (hasBlankLineBetween(prev.end, curr.start)) {
          result.push(hardline, hardline);
        } else {
          result.push(hardline);
        }
      }
    }
    result.push(allItems[i]);
  }
  result.push(hardline);
  return result;
}

function buildFunctionDeclaration(
  node: FunctionDeclaration,
  bodyDoc: Doc,
  attrDocs?: Doc[],
  paramDocs?: Doc[],
  returnAttrDocs?: Doc[],
): Doc {
  const parts: Doc[] = [];

  const resolvedAttrDocs = attrDocs ?? node.attributes.map((a) => printASTNode(a));
  const resolvedParamDocs = paramDocs ?? node.params.map((p) => printASTNode(p));
  const resolvedReturnAttrDocs = returnAttrDocs ?? node.returnAttributes.map((a) => printASTNode(a));

  const { entryAttrs, otherAttrs } = printFunctionAttributes(node.attributes);

  // Partition the rendered attribute docs to match the entry/other split
  const entryAttrDocs: Doc[] = [];
  const otherAttrDocs: Doc[] = [];
  for (let i = 0; i < node.attributes.length; i++) {
    if (ENTRY_POINT_ATTRS.has(node.attributes[i].name)) {
      entryAttrDocs.push(resolvedAttrDocs[i]);
    } else {
      otherAttrDocs.push(resolvedAttrDocs[i]);
    }
  }

  if (entryAttrs.length > 0) {
    parts.push(join(" ", entryAttrDocs));
    if (otherAttrs.length > 0) {
      parts.push(" ", join(" ", otherAttrDocs));
    }
    parts.push(hardline);
  } else if (otherAttrs.length > 0) {
    parts.push(join(" ", otherAttrDocs), hardline);
  }

  parts.push("fn ", node.name);

  if (resolvedParamDocs.length === 0) {
    parts.push("()");
  } else {
    parts.push(printDelimitedList("(", ")", resolvedParamDocs));
  }

  if (node.returnType) {
    parts.push(" -> ");
    if (resolvedReturnAttrDocs.length > 0) {
      parts.push(join(" ", resolvedReturnAttrDocs), " ");
    }
    parts.push(printASTNode(node.returnType));
  }

  parts.push(" ", bodyDoc);
  return parts;
}

function printEnableDirective(node: { extensions: string[] }): Doc {
  return ["enable ", join(", ", node.extensions), ";"];
}

function printRequiresDirective(node: { extensions: string[] }): Doc {
  return ["requires ", join(", ", node.extensions), ";"];
}

function printDiagnosticDirective(node: { severity: string; rule: string }): Doc {
  return ["diagnostic(", node.severity, ", ", node.rule, ");"];
}

function printAttribute(node: Attribute): Doc {
  if (node.args.length === 0) {
    return ["@", node.name];
  }
  return [
    "@",
    node.name,
    "(",
    join(
      ", ",
      node.args.map((a) => printASTNode(a)),
    ),
    ")",
  ];
}

function printAttributes(attrs: Attribute[]): Doc {
  if (attrs.length === 0) return "";
  return [
    join(
      " ",
      attrs.map((a) => printASTNode(a)),
    ),
    " ",
  ];
}

function printFunctionAttributes(attrs: Attribute[]): { entryAttrs: Attribute[]; otherAttrs: Attribute[] } {
  const entryAttrs: Attribute[] = [];
  const otherAttrs: Attribute[] = [];
  for (const a of attrs) {
    if (ENTRY_POINT_ATTRS.has(a.name)) {
      entryAttrs.push(a);
    } else {
      otherAttrs.push(a);
    }
  }
  return { entryAttrs, otherAttrs };
}

function printParameter(node: Parameter): Doc {
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(
      join(
        " ",
        node.attributes.map((a) => printASTNode(a)),
      ),
      " ",
    );
  }
  parts.push(node.name, ": ", printASTNode(node.type));
  return parts;
}

function printStructMember(node: StructMember): Doc {
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(
      join(
        " ",
        node.attributes.map((a) => printASTNode(a)),
      ),
      " ",
    );
  }
  parts.push(node.name, ": ", printASTNode(node.type));
  return parts;
}

function printVarDeclaration(node: VarDeclaration): Doc {
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(printAttributes(node.attributes));
  }
  parts.push("var");
  if (node.qualifier) {
    parts.push("<", node.qualifier, ">");
  }
  parts.push(" ", node.name);
  if (node.type) {
    parts.push(": ", printASTNode(node.type));
  }
  if (node.initializer) {
    parts.push(" =");
    return group([...parts, indent([line, printASTNode(node.initializer)]), ";"]);
  }
  parts.push(";");
  return parts;
}

function printLetDeclaration(node: LetDeclaration): Doc {
  const parts: Doc[] = [];
  parts.push("let ", node.name);
  if (node.type) {
    parts.push(": ", printASTNode(node.type));
  }
  parts.push(" =");
  return group([...parts, indent([line, printASTNode(node.initializer)]), ";"]);
}

function printConstDeclaration(node: ConstDeclaration): Doc {
  const parts: Doc[] = [];
  parts.push("const ", node.name);
  if (node.type) {
    parts.push(": ", printASTNode(node.type));
  }
  parts.push(" =");
  return group([...parts, indent([line, printASTNode(node.initializer)]), ";"]);
}

function printOverrideDeclaration(node: OverrideDeclaration): Doc {
  const parts: Doc[] = [];
  if (node.attributes.length > 0) {
    parts.push(printAttributes(node.attributes));
  }
  parts.push("override ", node.name);
  if (node.type) {
    parts.push(": ", printASTNode(node.type));
  }
  if (node.initializer) {
    parts.push(" =");
    return group([...parts, indent([line, printASTNode(node.initializer)]), ";"]);
  }
  parts.push(";");
  return parts;
}

function printAliasDeclaration(node: AliasDeclaration): Doc {
  return ["alias ", node.name, " = ", printASTNode(node.type), ";"];
}

function printConstAssert(node: ConstAssertStatement): Doc {
  return ["const_assert ", printASTNode(node.expr), ";"];
}

function printDelimitedList(open: string, close: string, items: Doc[]): Doc {
  if (items.length === 0) return [open, close];
  return group([open, indent([softline, join([",", line], items)]), ifBreak(",", ""), softline, close]);
}

function printTypeExpr(node: TypeExpr): Doc {
  if (node.templateArgs.length === 0) return node.name;
  return [
    node.name,
    printDelimitedList(
      "<",
      ">",
      node.templateArgs.map((a) => printASTNode(a)),
    ),
  ];
}

// ─── Statements ─────────────────────────────────────────────

// Returns true if the source text between two offsets contains a blank line
// A blank line is an empty line (or whitespace-only line) between two newlines
function hasBlankLineBetween(fromEnd: number, toStart: number): boolean {
  if (!originalText) return false;
  const between = originalText.slice(fromEnd, toStart);
  // Split into lines and check if any line (between first and last) is empty/whitespace-only
  const lines = between.split("\n");
  // We need 3+ parts (2+ newlines) AND at least one blank line between content
  if (lines.length < 3) return false;
  // Check if any middle line is empty or whitespace-only
  for (let i = 1; i < lines.length - 1; i++) {
    if (lines[i].trim() === "") return true;
  }
  return false;
}

function printStatementList(stmts: { node: { start: number; end: number }; doc: Doc }[]): Doc[] {
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

function printBlock(node: Block): Doc {
  if (node.statements.length === 0) return "{}";

  const stmts = node.statements.map((s) => ({ node: s, doc: printASTNode(s) }));

  return ["{", indent([hardline, ...printStatementList(stmts)]), hardline, "}"];
}

function printReturnStmt(node: ReturnStmt): Doc {
  if (node.value) {
    return group(["return", indent([line, printASTNode(node.value)]), ";"]);
  }
  return "return;";
}

function printIfStmt(node: IfStmt): Doc {
  const condDoc = printASTNode(node.condition);
  const bodyDoc = printBlock(node.body);
  const parts: Doc[] = [group(["if", indent([line, condDoc]), line]), bodyDoc];

  if (node.elseClause) {
    if (node.elseClause.kind === "IfStmt") {
      parts.push(" else ", printIfStmt(node.elseClause));
    } else {
      parts.push(" else ", printBlock(node.elseClause));
    }
  }

  return parts;
}

type DocWithContents = doc.builders.Group | doc.builders.Indent | doc.builders.Label | doc.builders.LineSuffix;

function isDocWithContents(d: Doc): d is DocWithContents {
  return typeof d === "object" && d !== null && !Array.isArray(d) && "contents" in d;
}

function stripTrailingSemicolon(d: Doc): Doc {
  if (Array.isArray(d)) {
    const last = d[d.length - 1];
    if (last === ";") {
      return d.slice(0, -1);
    }
    // Recursively strip from last element
    const stripped = stripTrailingSemicolon(last);
    if (stripped !== last) {
      return [...d.slice(0, -1), stripped];
    }
  }
  if (typeof d === "string" && d.endsWith(";")) {
    return d.slice(0, -1);
  }
  // Handle Prettier doc commands (group, indent, etc.) that have contents
  if (isDocWithContents(d)) {
    const stripped = stripTrailingSemicolon(d.contents);
    if (stripped !== d.contents) {
      return { ...d, contents: stripped };
    }
  }
  return d;
}

function printStmtNoSemicolon(stmt: Stmt): Doc {
  // Print a statement but strip the trailing semicolon (for for-loop init/update)
  return stripTrailingSemicolon(printASTNode(stmt));
}

function printAssignStmt(node: AssignStmt): Doc {
  return group([printASTNode(node.target), " ", node.op, indent([line, printASTNode(node.value)]), ";"]);
}

function printIncrDecrStmt(node: IncrDecrStmt): Doc {
  return [printASTNode(node.target), node.op, ";"];
}

function printExprStmt(node: ExprStmt): Doc {
  return [printASTNode(node.expr), ";"];
}

function printPhonyAssignStmt(node: PhonyAssignStmt): Doc {
  return group(["_ =", indent([line, printASTNode(node.value)]), ";"]);
}

// ─── Expressions ──────────────────────────────────────────────

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

// Flatten a left-recursive chain of same-precedence binary ops into parts and ops
function flattenBinaryChain(node: BinaryExpr): { parts: Expr[]; ops: string[] } {
  const prec = getBinaryPrecedenceGroup(node.op);
  const parts: Expr[] = [];
  const ops: string[] = [];

  function collect(n: Expr): void {
    if (n.kind === "BinaryExpr" && getBinaryPrecedenceGroup(n.op) === prec) {
      collect(n.left);
      ops.push(n.op);
      parts.push(n.right);
    } else {
      parts.unshift(n);
    }
  }

  // Start: walk the left spine, push right children
  collect(node);
  return { parts, ops };
}

function printBinaryExpr(node: BinaryExpr): Doc {
  const { parts, ops } = flattenBinaryChain(node);

  // For chains of fewer than 3 operands, keep flat
  if (parts.length < 3) {
    return [printASTNode(node.left), " ", node.op, " ", printASTNode(node.right)];
  }

  // Build: first operand, then each [op, operand] pair wrapped for breaking
  const first = printASTNode(parts[0]);
  const rest: Doc[] = [];
  for (let i = 0; i < ops.length; i++) {
    rest.push(line, ops[i], " ", printASTNode(parts[i + 1]));
  }

  return group([first, indent(rest)]);
}

function printUnaryExpr(node: UnaryExpr): Doc {
  // No space between operator and operand for prefix unary
  return [node.op, printASTNode(node.operand)];
}

function printCallExpr(node: CallExpr): Doc {
  const parts: Doc[] = [node.callee];
  if (node.templateArgs.length > 0) {
    parts.push(
      printDelimitedList(
        "<",
        ">",
        node.templateArgs.map((a) => printASTNode(a)),
      ),
    );
  }
  parts.push(
    printDelimitedList(
      "(",
      ")",
      node.args.map((a) => printASTNode(a)),
    ),
  );
  return parts;
}

type ChainPart = { type: "member"; name: string } | { type: "index"; index: Expr };

function flattenMemberChain(node: MemberExpr | IndexExpr): { head: Expr; chain: ChainPart[] } {
  const chain: ChainPart[] = [];
  let current: Expr = node;

  while (current.kind === "MemberExpr" || current.kind === "IndexExpr") {
    if (current.kind === "MemberExpr") {
      chain.push({ type: "member", name: current.member });
      current = current.object;
    } else {
      chain.push({ type: "index", index: current.index });
      current = current.object;
    }
  }

  chain.reverse();
  return { head: current, chain };
}

function printMemberOrIndexChain(node: MemberExpr | IndexExpr): Doc {
  const { head, chain } = flattenMemberChain(node);
  const headDoc = printASTNode(head);

  if (chain.length < 3) {
    // Short chain: print flat
    const parts: Doc[] = [headDoc];
    for (const part of chain) {
      if (part.type === "member") {
        parts.push(".", part.name);
      } else {
        parts.push("[", printASTNode(part.index), "]");
      }
    }
    return parts;
  }

  // Long chain: wrap at . boundaries
  const chainDocs: Doc[] = [];
  for (const part of chain) {
    if (part.type === "member") {
      chainDocs.push([".", part.name]);
    } else {
      // Index access stays attached to previous part
      chainDocs.push(["[", printASTNode(part.index), "]"]);
    }
  }

  // Group consecutive index accesses with the preceding member access
  const groupedDocs: Doc[][] = [];
  for (const doc of chainDocs) {
    if (Array.isArray(doc) && Array.isArray(doc[0]) === false && doc[0] === "[") {
      // Index access — attach to previous group
      if (groupedDocs.length > 0) {
        groupedDocs[groupedDocs.length - 1].push(doc);
      } else {
        groupedDocs.push([doc]);
      }
    } else {
      groupedDocs.push([doc]);
    }
  }

  const indentedParts: Doc[] = [];
  for (const g of groupedDocs) {
    indentedParts.push(softline, ...g);
  }

  return group([headDoc, indent(indentedParts)]);
}

function printMemberExpr(node: MemberExpr): Doc {
  return printMemberOrIndexChain(node);
}

function printIndexExpr(node: IndexExpr): Doc {
  return printMemberOrIndexChain(node);
}

// ─── Prettier comment API ─────────────────────────────────────

export function canAttachComment(node: ASTNode): boolean {
  return node != null && typeof node === "object" && "kind" in node;
}

export function printComment(commentPath: AstPath<CommentNode>): Doc {
  const node = commentPath.node;
  return node.value;
}

export function getCommentChildNodes(node: ASTNode): ASTNode[] {
  if (!node || typeof node !== "object" || !("kind" in node)) return [];

  switch (node.kind) {
    case "TranslationUnit":
      return [...node.directives, ...node.declarations];
    case "FunctionDeclaration":
      return [...node.attributes, ...node.params, ...(node.returnType ? [node.returnType] : []), ...node.returnAttributes, node.body];
    case "StructDeclaration":
      return node.members;
    case "StructMember":
      return [...node.attributes, node.type];
    case "Block":
      return node.statements;
    case "IfStmt":
      return [node.condition, node.body, ...(node.elseClause ? [node.elseClause] : [])];
    case "ForStmt":
      return [
        ...(node.init ? [node.init] : []),
        ...(node.condition ? [node.condition] : []),
        ...(node.update ? [node.update] : []),
        node.body,
      ];
    case "WhileStmt":
      return [node.condition, node.body];
    case "LoopStmt":
      return [node.body, ...(node.continuing ? [node.continuing] : [])];
    case "ContinuingStmt":
      return [node.body, ...(node.breakIf ? [node.breakIf] : [])];
    case "SwitchStmt":
      return [node.expr, ...node.clauses];
    case "CaseClause":
      return [...node.selectors, node.body];
    case "ReturnStmt":
      return node.value ? [node.value] : [];
    case "AssignStmt":
      return [node.target, node.value];
    case "IncrDecrStmt":
      return [node.target];
    case "ExprStmt":
      return [node.expr];
    case "PhonyAssignStmt":
      return [node.value];
    case "BinaryExpr":
      return [node.left, node.right];
    case "UnaryExpr":
      return [node.operand];
    case "CallExpr":
      return [...node.templateArgs, ...node.args];
    case "MemberExpr":
      return [node.object];
    case "IndexExpr":
      return [node.object, node.index];
    case "ParenExpr":
      return [node.expr];
    case "VarDeclaration":
      return [...node.attributes, ...(node.type ? [node.type] : []), ...(node.initializer ? [node.initializer] : [])];
    case "LetDeclaration":
      return [...(node.type ? [node.type] : []), node.initializer];
    case "ConstDeclaration":
      return [...(node.type ? [node.type] : []), node.initializer];
    case "OverrideDeclaration":
      return [...node.attributes, ...(node.type ? [node.type] : []), ...(node.initializer ? [node.initializer] : [])];
    case "AliasDeclaration":
      return [node.type];
    case "ConstAssertStatement":
      return [node.expr];
    case "Attribute":
      return node.args;
    case "Parameter":
      return [...node.attributes, node.type];
    default:
      return [];
  }
}
