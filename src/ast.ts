// AST node types for WGSL — interfaces only (erasable syntax)

export interface BaseNode {
  start: number;
  end: number;
  leadingComments?: CommentNode[];
  trailingComments?: CommentNode[];
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
