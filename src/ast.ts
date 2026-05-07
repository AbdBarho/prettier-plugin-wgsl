// AST node types for WGSL — interfaces only (erasable syntax)

export interface BaseNode {
  start: number;
  end: number;
}

// ─── Top-level ────────────────────────────────────────────────

export interface TranslationUnit extends BaseNode {
  kind: "TranslationUnit";
  directives: Directive[];
  declarations: Declaration[];
  comments?: CommentNode[];
}

// ─── Directives ───────────────────────────────────────────────

export interface EnableDirective extends BaseNode {
  kind: "EnableDirective";
  extensions: string[];
}

export interface RequiresDirective extends BaseNode {
  kind: "RequiresDirective";
  extensions: string[];
}

export interface DiagnosticDirective extends BaseNode {
  kind: "DiagnosticDirective";
  severity: string;
  rule: string;
}

export type Directive = EnableDirective | RequiresDirective | DiagnosticDirective;

// ─── Declarations ─────────────────────────────────────────────

export interface FunctionDeclaration extends BaseNode {
  kind: "FunctionDeclaration";
  attributes: Attribute[];
  name: string;
  params: Parameter[];
  returnType: TypeExpr | null;
  returnAttributes: Attribute[];
  body: Block;
}

export interface StructDeclaration extends BaseNode {
  kind: "StructDeclaration";
  name: string;
  members: StructMember[];
}

export interface StructMember extends BaseNode {
  kind: "StructMember";
  attributes: Attribute[];
  name: string;
  type: TypeExpr;
}

export interface VarDeclaration extends BaseNode {
  kind: "VarDeclaration";
  attributes: Attribute[];
  qualifier: string | null; // "uniform", "storage", "private", etc.
  name: string;
  type: TypeExpr | null;
  initializer: Expr | null;
}

export interface LetDeclaration extends BaseNode {
  kind: "LetDeclaration";
  name: string;
  type: TypeExpr | null;
  initializer: Expr;
}

export interface ConstDeclaration extends BaseNode {
  kind: "ConstDeclaration";
  name: string;
  type: TypeExpr | null;
  initializer: Expr;
}

export interface OverrideDeclaration extends BaseNode {
  kind: "OverrideDeclaration";
  attributes: Attribute[];
  name: string;
  type: TypeExpr | null;
  initializer: Expr | null;
}

export interface AliasDeclaration extends BaseNode {
  kind: "AliasDeclaration";
  name: string;
  type: TypeExpr;
}

export interface ConstAssertStatement extends BaseNode {
  kind: "ConstAssertStatement";
  expr: Expr;
}

export type Declaration =
  | FunctionDeclaration
  | StructDeclaration
  | VarDeclaration
  | LetDeclaration
  | ConstDeclaration
  | OverrideDeclaration
  | AliasDeclaration
  | ConstAssertStatement;

// ─── Attributes ───────────────────────────────────────────────

export interface Attribute extends BaseNode {
  kind: "Attribute";
  name: string;
  args: Expr[];
}

// ─── Parameters ───────────────────────────────────────────────

export interface Parameter extends BaseNode {
  kind: "Parameter";
  attributes: Attribute[];
  name: string;
  type: TypeExpr;
}

// ─── Types ────────────────────────────────────────────────────

export interface TypeExpr extends BaseNode {
  kind: "TypeExpr";
  name: string;
  templateArgs: (TypeExpr | Expr)[];
}

// ─── Statements ───────────────────────────────────────────────

export interface Block extends BaseNode {
  kind: "Block";
  statements: Stmt[];
}

export interface ReturnStmt extends BaseNode {
  kind: "ReturnStmt";
  value: Expr | null;
}

export interface IfStmt extends BaseNode {
  kind: "IfStmt";
  condition: Expr;
  body: Block;
  elseClause: IfStmt | Block | null;
}

export interface ForStmt extends BaseNode {
  kind: "ForStmt";
  init: Stmt | null;
  condition: Expr | null;
  update: Stmt | null;
  body: Block;
}

export interface WhileStmt extends BaseNode {
  kind: "WhileStmt";
  condition: Expr;
  body: Block;
}

export interface LoopStmt extends BaseNode {
  kind: "LoopStmt";
  body: Block;
  continuing: ContinuingStmt | null;
}

export interface ContinuingStmt extends BaseNode {
  kind: "ContinuingStmt";
  body: Block;
  breakIf: Expr | null;
}

export interface SwitchStmt extends BaseNode {
  kind: "SwitchStmt";
  expr: Expr;
  clauses: CaseClause[];
}

export interface CaseClause extends BaseNode {
  kind: "CaseClause";
  selectors: (Expr | DefaultSelector)[];
  body: Block;
}

export interface DefaultSelector extends BaseNode {
  kind: "DefaultSelector";
}

export interface AssignStmt extends BaseNode {
  kind: "AssignStmt";
  target: Expr;
  op: string; // "=", "+=", "-=", etc.
  value: Expr;
}

export interface IncrDecrStmt extends BaseNode {
  kind: "IncrDecrStmt";
  target: Expr;
  op: "++" | "--";
}

export interface ExprStmt extends BaseNode {
  kind: "ExprStmt";
  expr: Expr;
}

export interface BreakStmt extends BaseNode {
  kind: "BreakStmt";
}

export interface ContinueStmt extends BaseNode {
  kind: "ContinueStmt";
}

export interface DiscardStmt extends BaseNode {
  kind: "DiscardStmt";
}

export interface PhonyAssignStmt extends BaseNode {
  kind: "PhonyAssignStmt";
  value: Expr;
}

export type Stmt =
  | Block
  | ReturnStmt
  | IfStmt
  | ForStmt
  | WhileStmt
  | LoopStmt
  | SwitchStmt
  | AssignStmt
  | IncrDecrStmt
  | ExprStmt
  | BreakStmt
  | ContinueStmt
  | DiscardStmt
  | VarDeclaration
  | LetDeclaration
  | ConstDeclaration
  | ConstAssertStatement
  | PhonyAssignStmt;

// ─── Expressions ──────────────────────────────────────────────

export interface BinaryExpr extends BaseNode {
  kind: "BinaryExpr";
  op: string;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr extends BaseNode {
  kind: "UnaryExpr";
  op: string;
  operand: Expr;
}

export interface CallExpr extends BaseNode {
  kind: "CallExpr";
  callee: string;
  templateArgs: (TypeExpr | Expr)[];
  args: Expr[];
}

export interface MemberExpr extends BaseNode {
  kind: "MemberExpr";
  object: Expr;
  member: string;
}

export interface IndexExpr extends BaseNode {
  kind: "IndexExpr";
  object: Expr;
  index: Expr;
}

export interface IdentExpr extends BaseNode {
  kind: "IdentExpr";
  name: string;
}

export interface LiteralExpr extends BaseNode {
  kind: "LiteralExpr";
  value: string;
  literalType: "int" | "float" | "bool";
}

export interface ParenExpr extends BaseNode {
  kind: "ParenExpr";
  expr: Expr;
}

export type Expr = BinaryExpr | UnaryExpr | CallExpr | MemberExpr | IndexExpr | IdentExpr | LiteralExpr | ParenExpr;

// ─── Comments ─────────────────────────────────────────────────

export interface LineComment extends BaseNode {
  kind: "LineComment";
  value: string;
}

export interface BlockComment extends BaseNode {
  kind: "BlockComment";
  value: string;
}

export type CommentNode = LineComment | BlockComment;

// Union of all AST nodes
export type ASTNode =
  | TranslationUnit
  | Directive
  | Declaration
  | Attribute
  | Parameter
  | TypeExpr
  | Block
  | Stmt
  | Expr
  | CaseClause
  | DefaultSelector
  | ContinuingStmt
  | StructMember
  | CommentNode;

export function assertNever(node: never): never {
  throw new Error(`Unhandled AST node kind: ${(node as { kind?: string }).kind ?? "<unknown>"}`);
}

// Order matters: Prettier's comment attachment uses positional proximity to a
// child node to decide which side a comment lands on.
export function children(node: ASTNode): ASTNode[] {
  switch (node.kind) {
    case "TranslationUnit":
      return [...node.directives, ...node.declarations];
    case "FunctionDeclaration":
      return [
        ...node.attributes,
        ...node.params,
        ...node.returnAttributes,
        ...(node.returnType ? [node.returnType] : []),
        node.body,
      ];
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
      return [
        ...node.attributes,
        ...(node.type ? [node.type] : []),
        ...(node.initializer ? [node.initializer] : []),
      ];
    case "LetDeclaration":
      return [...(node.type ? [node.type] : []), node.initializer];
    case "ConstDeclaration":
      return [...(node.type ? [node.type] : []), node.initializer];
    case "OverrideDeclaration":
      return [
        ...node.attributes,
        ...(node.type ? [node.type] : []),
        ...(node.initializer ? [node.initializer] : []),
      ];
    case "AliasDeclaration":
      return [node.type];
    case "ConstAssertStatement":
      return [node.expr];
    case "Attribute":
      return node.args;
    case "Parameter":
      return [...node.attributes, node.type];
    case "TypeExpr":
      return node.templateArgs;
    case "EnableDirective":
    case "RequiresDirective":
    case "DiagnosticDirective":
    case "BreakStmt":
    case "ContinueStmt":
    case "DiscardStmt":
    case "IdentExpr":
    case "LiteralExpr":
    case "DefaultSelector":
    case "LineComment":
    case "BlockComment":
      return [];
    default:
      return assertNever(node);
  }
}
