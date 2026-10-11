import type { AstPath, Doc, Printer } from "prettier";
import type { ASTNode, CommentNode } from "./ast.ts";
import { assertNever, visitorKeys } from "./ast.ts";
import {
  printLeafNode,
  printAttribute,
  printParameterOrMember,
  printBinaryExpr,
  printUnaryExpr,
  printCallExpr,
  printMemberChain,
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

// Statements in a for-loop header are printed without `;`
function semicolon(path: AstPath<ASTNode>): string {
  return path.parent?.kind === "ForStmt" ? "" : ";";
}

export const print: Printer<ASTNode>["print"] = (path, options, print) => {
  const node = path.node;
  const text = options.originalText;
  switch (node.kind) {
    case "TranslationUnit":      return printTranslationUnit(node, print, text);
    case "FunctionDeclaration":  return printFunctionDeclaration(node, print);
    case "Block":                return printBlock(node, print, text);
    case "IfStmt":               return printIfStmt(node, print);
    case "LoopStmt":             return printLoopStmt(node, print, text);
    case "ContinuingStmt":       return printContinuingStmt(node, print, text);
    case "WhileStmt":            return printWhileStmt(print);
    case "ForStmt":              return printForStmt(node, print);
    case "SwitchStmt":           return printSwitchStmt(node, print);
    case "CaseClause":           return printCaseClause(node, print);
    case "StructDeclaration":    return printStructDeclaration(node, print);
    case "BinaryExpr":           return printBinaryExpr(node, print);
    case "UnaryExpr":            return printUnaryExpr(node, print);
    case "CallExpr":             return printCallExpr(node, print);
    case "MemberExpr":
    case "IndexExpr":            return printMemberChain(node, print);
    case "ParenExpr":            return printParenExpr(print);
    case "TypeExpr":             return printTypeExpr(node, print);
    case "Attribute":            return printAttribute(node, print);
    case "Parameter":
    case "StructMember":         return printParameterOrMember(node, print);
    case "ReturnStmt":           return printReturnStmt(node, print);
    case "AssignStmt":           return printAssignStmt(node, print, semicolon(path));
    case "IncrDecrStmt":         return printIncrDecrStmt(node, print, semicolon(path));
    case "ExprStmt":             return printExprStmt(print, semicolon(path));
    case "PhonyAssignStmt":      return printPhonyAssignStmt(print);
    case "VarDeclaration":       return printVarDeclaration(node, print, semicolon(path));
    case "LetDeclaration":       return printLetOrConstDeclaration(node, print, "let", semicolon(path));
    case "ConstDeclaration":     return printLetOrConstDeclaration(node, print, "const", semicolon(path));
    case "OverrideDeclaration":  return printOverrideDeclaration(node, print);
    case "AliasDeclaration":     return printAliasDeclaration(node, print);
    case "ConstAssertStatement": return printConstAssert(print);
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
    case "BlockComment":         return printLeafNode(node);
    default:
      return assertNever(node);
  }
};

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

export function getVisitorKeys(node: ASTNode): string[] {
  return visitorKeys[node.kind];
}
