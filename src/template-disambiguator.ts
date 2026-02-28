import type { IToken, TokenType } from "chevrotain";
import { TK } from "./tokens.ts";

/**
 * Re-type a token: update both `tokenType` and `tokenTypeIdx` so
 * Chevrotain's parser can match it correctly.
 */
function retype(token: IToken, newType: TokenType, image: string): IToken {
  return {
    ...token,
    tokenType: newType,
    tokenTypeIdx: (newType as { tokenTypeIdx?: number }).tokenTypeIdx ?? token.tokenTypeIdx,
    image,
  };
}

/**
 * Post-process token stream to convert LessThan/GreaterThan into
 * TemplateArgsOpen/TemplateArgsClose when they delimit type parameters.
 *
 * Algorithm from WGSL spec: When `<` follows an identifier, scan forward
 * tracking ()/[] depth. If a matching `>` is found at depth 0 before
 * hitting `;`, `{`, `=`, `&&`, `||`, mark both as template delimiters.
 */
export function disambiguateTemplates(tokens: IToken[]): IToken[] {
  const result = tokens.map((t) => ({ ...t }));
  const len = result.length;

  for (let i = 0; i < len; i++) {
    if (result[i].tokenType !== TK.LessThan) continue;

    if (i === 0) continue;
    const prev = result[i - 1];
    if (prev.tokenType !== TK.Ident && prev.tokenType !== TK.Var) continue;

    tryMarkTemplate(result, i);
  }

  return result;
}

function tryMarkTemplate(tokens: IToken[], openIdx: number): boolean {
  let depth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  const openStack: number[] = [];

  for (let i = openIdx; i < tokens.length; i++) {
    const tt = tokens[i].tokenType;

    if (tt === TK.LParen) {
      parenDepth++;
      continue;
    }
    if (tt === TK.RParen) {
      parenDepth--;
      if (parenDepth < 0) return false;
      continue;
    }
    if (tt === TK.LBracket) {
      bracketDepth++;
      continue;
    }
    if (tt === TK.RBracket) {
      bracketDepth--;
      if (bracketDepth < 0) return false;
      continue;
    }

    if (parenDepth > 0 || bracketDepth > 0) continue;

    if (tt === TK.LessThan) {
      if (i > openIdx) {
        const prev = tokens[i - 1];
        if (prev.tokenType !== TK.Ident && prev.tokenType !== TK.Var) {
          return false;
        }
      }
      openStack.push(i);
      depth++;
    } else if (tt === TK.GreaterThan) {
      if (depth <= 0) return false;
      depth--;
      const matchingOpen = openStack.pop()!;
      tokens[matchingOpen] = retype(tokens[matchingOpen], TK.TemplateArgsOpen, "<");
      tokens[i] = retype(tokens[i], TK.TemplateArgsClose, ">");
      if (depth === 0) return true;
    } else if (tt === TK.ShiftRight) {
      if (depth < 2) return false;
      depth--;
      const matchingOpen1 = openStack.pop()!;
      tokens[matchingOpen1] = retype(tokens[matchingOpen1], TK.TemplateArgsOpen, "<");
      depth--;
      const matchingOpen2 = openStack.pop()!;
      tokens[matchingOpen2] = retype(tokens[matchingOpen2], TK.TemplateArgsOpen, "<");
      const mid = tokens[i].startOffset + 1;
      const close1 = retype(tokens[i], TK.TemplateArgsClose, ">");
      close1.endOffset = mid - 1;
      const close2 = retype(tokens[i], TK.TemplateArgsClose, ">");
      close2.startOffset = mid;
      close2.endOffset = mid;
      tokens[i] = close1;
      tokens.splice(i + 1, 0, close2);
      if (depth === 0) return true;
    } else if (tt === TK.Semicolon || tt === TK.LBrace || tt === TK.Equal || tt === TK.AmpAmp || tt === TK.PipePipe) {
      return false;
    }
  }

  return false;
}
