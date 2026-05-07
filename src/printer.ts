import type { AstPath, Doc, Printer } from "prettier";
import type { ASTNode, CommentNode } from "./ast.ts";
import { assertNever, children } from "./ast.ts";
import { getOrBuildContext, withContext } from "./print/context.ts";
import {
  printLeafNode,
  printAttribute,
  printParameter,
  printStructMember,
  printBinaryExpr,
  printUnaryExpr,
  printCallExpr,
  printMemberExpr,
  printIndexExpr,
  printParenExpr,
  printTypeExpr,
} from "./print/expressions.ts";
import {
  printBlock,
  printIfStmt,
  printLoopStmt,
  printContinuingStmt,
  printWhileStmt,
  printForStmt,
  printSwitchStmt,
  printCaseClause,
  printReturnStmt,
  printAssignStmt,
  printIncrDecrStmt,
  printExprStmt,
  printPhonyAssignStmt,
} from "./print/statements.ts";
import {
  printTranslationUnit,
  printFunctionDeclaration,
  printStructDeclaration,
  printVarDeclaration,
  printLetOrConstDeclaration,
  printOverrideDeclaration,
  printAliasDeclaration,
  printConstAssert,
} from "./print/declarations.ts";

export const print: Printer<ASTNode>["print"] = function printPrettierEntry(
  path: AstPath<ASTNode>,
  options: object,
  printFn: (path: AstPath<ASTNode>) => Doc,
): Doc {
  const node = path.node;
  if (!node) return "";
  return withContext(getOrBuildContext(options), () => printNode(path, printFn));
};

function printNode(path: AstPath<ASTNode>, printFn: (path: AstPath<ASTNode>) => Doc): Doc {
  const node = path.node;
  switch (node.kind) {
    case "TranslationUnit":      return printTranslationUnit(path, printFn);
    case "FunctionDeclaration":  return printFunctionDeclaration(path, printFn);
    case "Block":                return printBlock(path, printFn);
    case "IfStmt":               return printIfStmt(path, printFn);
    case "LoopStmt":             return printLoopStmt(path, printFn);
    case "ContinuingStmt":       return printContinuingStmt(path, printFn);
    case "WhileStmt":            return printWhileStmt(path, printFn);
    case "ForStmt":              return printForStmt(path, printFn);
    case "SwitchStmt":           return printSwitchStmt(path, printFn);
    case "CaseClause":           return printCaseClause(path, printFn);
    case "StructDeclaration":    return printStructDeclaration(path, printFn);
    case "BinaryExpr":           return printBinaryExpr(path, printFn);
    case "UnaryExpr":            return printUnaryExpr(path, printFn);
    case "CallExpr":             return printCallExpr(path, printFn);
    case "MemberExpr":           return printMemberExpr(path, printFn);
    case "IndexExpr":            return printIndexExpr(path, printFn);
    case "ParenExpr":            return printParenExpr(path, printFn);
    case "TypeExpr":             return printTypeExpr(path, printFn);
    case "Attribute":            return printAttribute(path, printFn);
    case "Parameter":            return printParameter(path, printFn);
    case "StructMember":         return printStructMember(path, printFn);
    case "ReturnStmt":           return printReturnStmt(path, printFn);
    case "AssignStmt":           return printAssignStmt(path, printFn);
    case "IncrDecrStmt":         return printIncrDecrStmt(path, printFn);
    case "ExprStmt":             return printExprStmt(path, printFn);
    case "PhonyAssignStmt":      return printPhonyAssignStmt(path, printFn);
    case "VarDeclaration":       return printVarDeclaration(path, printFn);
    case "LetDeclaration":       return printLetOrConstDeclaration(path, printFn, "let");
    case "ConstDeclaration":     return printLetOrConstDeclaration(path, printFn, "const");
    case "OverrideDeclaration":  return printOverrideDeclaration(path, printFn);
    case "AliasDeclaration":     return printAliasDeclaration(path, printFn);
    case "ConstAssertStatement": return printConstAssert(path, printFn);
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
      return printLeafNode(node);
    default:
      return assertNever(node);
  }
}

// ─── Prettier comment API ─────────────────────────────────────

// Whitelist of nodes that can host leading/trailing comments. Nodes excluded
// here defer comment attachment to their children, which is what we want for
// container expressions (BinaryExpr, MemberExpr, etc.) whose printed output
// has no obvious anchor for a leading/trailing comment slot. Attribute and
// TypeExpr ARE attachable so that comments between sibling attributes or
// between a return-type attribute and the type itself land on a real anchor.
export function canAttachComment(node: ASTNode): boolean {
  if (node == null || typeof node !== "object" || !("kind" in node)) return false;
  switch (node.kind) {
    case "TranslationUnit":
    case "EnableDirective":
    case "RequiresDirective":
    case "DiagnosticDirective":
    case "FunctionDeclaration":
    case "StructDeclaration":
    case "StructMember":
    case "VarDeclaration":
    case "LetDeclaration":
    case "ConstDeclaration":
    case "OverrideDeclaration":
    case "AliasDeclaration":
    case "ConstAssertStatement":
    case "ReturnStmt":
    case "IfStmt":
    case "ForStmt":
    case "WhileStmt":
    case "LoopStmt":
    case "ContinuingStmt":
    case "SwitchStmt":
    case "CaseClause":
    case "AssignStmt":
    case "IncrDecrStmt":
    case "ExprStmt":
    case "BreakStmt":
    case "ContinueStmt":
    case "DiscardStmt":
    case "PhonyAssignStmt":
    case "Block":
    case "Parameter":
    case "Attribute":
    case "TypeExpr":
    case "IdentExpr":
    case "LiteralExpr":
    case "CallExpr":
      return true;
    case "BinaryExpr":
    case "UnaryExpr":
    case "MemberExpr":
    case "IndexExpr":
    case "ParenExpr":
    case "DefaultSelector":
    case "LineComment":
    case "BlockComment":
      return false;
    default:
      return assertNever(node);
  }
}

export function printComment(commentPath: AstPath<CommentNode>): Doc {
  const node = commentPath.node;
  return node.value;
}

export function getCommentChildNodes(node: ASTNode): ASTNode[] {
  if (node == null || typeof node !== "object" || !("kind" in node)) return [];
  return children(node);
}
