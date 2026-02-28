import { createToken, Lexer } from "chevrotain";
import type { TokenType, IToken, CustomPatternMatcherFunc } from "chevrotain";

// ─── Custom pattern for nested block comments ────────────────
const matchNestedBlockComment: CustomPatternMatcherFunc = (
  text: string,
  startOffset: number,
): ReturnType<CustomPatternMatcherFunc> => {
  if (text[startOffset] !== "/" || text[startOffset + 1] !== "*") return null;
  let pos = startOffset + 2;
  let depth = 1;
  while (pos < text.length && depth > 0) {
    if (text[pos] === "/" && text[pos + 1] === "*") {
      depth++;
      pos += 2;
    } else if (text[pos] === "*" && text[pos + 1] === "/") {
      depth--;
      pos += 2;
    } else {
      pos++;
    }
  }
  if (depth !== 0) return null;
  const matched = text.slice(startOffset, pos);
  return [matched];
};

// ─── Comments ─────────────────────────────────────────────────
export const BlockComment = createToken({
  name: "BlockComment",
  pattern: { exec: matchNestedBlockComment },
  group: "comments",
  line_breaks: true,
});

export const LineComment = createToken({
  name: "LineComment",
  pattern: /\/\/[^\n]*/,
  group: "comments",
});

// ─── Whitespace ───────────────────────────────────────────────
export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /[ \t\r\n]+/,
  group: Lexer.SKIPPED,
});

// ─── Keywords ─────────────────────────────────────────────────
export const Alias = createToken({ name: "Alias", pattern: /alias/ });
export const Break = createToken({ name: "Break", pattern: /break/ });
export const Case = createToken({ name: "Case", pattern: /case/ });
export const ConstAssert = createToken({ name: "ConstAssert", pattern: /const_assert/ });
export const Const = createToken({ name: "Const", pattern: /const/ });
export const Continue = createToken({ name: "Continue", pattern: /continue/ });
export const Continuing = createToken({ name: "Continuing", pattern: /continuing/ });
export const Default = createToken({ name: "Default", pattern: /default/ });
export const Diagnostic = createToken({ name: "Diagnostic", pattern: /diagnostic/ });
export const Discard = createToken({ name: "Discard", pattern: /discard/ });
export const Else = createToken({ name: "Else", pattern: /else/ });
export const Enable = createToken({ name: "Enable", pattern: /enable/ });
export const BoolLiteral = createToken({ name: "BoolLiteral", pattern: Lexer.NA });
export const False = createToken({ name: "False", pattern: /false/, categories: [BoolLiteral] });
export const True = createToken({ name: "True", pattern: /true/, categories: [BoolLiteral] });
export const Fn = createToken({ name: "Fn", pattern: /fn/ });
export const For = createToken({ name: "For", pattern: /for/ });
export const If = createToken({ name: "If", pattern: /if/ });
export const Let = createToken({ name: "Let", pattern: /let/ });
export const Loop = createToken({ name: "Loop", pattern: /loop/ });
export const Override = createToken({ name: "Override", pattern: /override/ });
export const Requires = createToken({ name: "Requires", pattern: /requires/ });
export const Return = createToken({ name: "Return", pattern: /return/ });
export const Struct = createToken({ name: "Struct", pattern: /struct/ });
export const Switch = createToken({ name: "Switch", pattern: /switch/ });
export const Var = createToken({ name: "Var", pattern: /var/ });
export const While = createToken({ name: "While", pattern: /while/ });

// ─── Identifiers & Literals ──────────────────────────────────
export const Ident = createToken({ name: "Ident", pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ });
export const Underscore = createToken({ name: "Underscore", pattern: /_(?![a-zA-Z0-9_])/ });

// Numbers — order matters: hex float before hex int, float before int
export const HexFloatLiteral = createToken({
  name: "FloatLiteral",
  pattern: /0[xX][0-9a-fA-F]*\.[0-9a-fA-F]*(?:[pP][+-]?[0-9]+)?[fh]?|0[xX][0-9a-fA-F]+[pP][+-]?[0-9]+[fh]?/,
});

export const FloatLiteral = createToken({
  name: "FloatLiteral",
  pattern:
    /[0-9]*\.[0-9]+(?:[eE][+-]?[0-9]+)?[fh]?|[0-9]+\.[0-9]*(?:[eE][+-]?[0-9]+)?[fh]?|[0-9]+[eE][+-]?[0-9]+[fh]?|[0-9]+[fh]/,
});

export const HexIntLiteral = createToken({
  name: "IntLiteral",
  pattern: /0[xX][0-9a-fA-F]+[ui]?/,
});

export const IntLiteral = createToken({
  name: "IntLiteral",
  pattern: /[0-9]+[ui]?/,
});

// ─── Multi-char operators (longer first) ──────────────────────
export const ShiftLeftEqual = createToken({ name: "ShiftLeftEqual", pattern: /<<=/ });
export const ShiftRightEqual = createToken({ name: "ShiftRightEqual", pattern: />>=/ });
export const ShiftLeft = createToken({ name: "ShiftLeft", pattern: /<</ });
export const ShiftRight = createToken({ name: "ShiftRight", pattern: />>/ });
export const Arrow = createToken({ name: "Arrow", pattern: /->/ });
export const PlusPlus = createToken({ name: "PlusPlus", pattern: /\+\+/ });
export const MinusMinus = createToken({ name: "MinusMinus", pattern: /--/ });
export const PlusEqual = createToken({ name: "PlusEqual", pattern: /\+=/ });
export const MinusEqual = createToken({ name: "MinusEqual", pattern: /-=/ });
export const StarEqual = createToken({ name: "StarEqual", pattern: /\*=/ });
export const SlashEqual = createToken({ name: "SlashEqual", pattern: /\/=/ });
export const PercentEqual = createToken({ name: "PercentEqual", pattern: /%=/ });
export const AmpAmp = createToken({ name: "AmpAmp", pattern: /&&/ });
export const AmpEqual = createToken({ name: "AmpEqual", pattern: /&=/ });
export const PipePipe = createToken({ name: "PipePipe", pattern: /\|\|/ });
export const PipeEqual = createToken({ name: "PipeEqual", pattern: /\|=/ });
export const CaretEqual = createToken({ name: "CaretEqual", pattern: /\^=/ });
export const EqualEqual = createToken({ name: "EqualEqual", pattern: /==/ });
export const BangEqual = createToken({ name: "BangEqual", pattern: /!=/ });
export const LessEqual = createToken({ name: "LessEqual", pattern: /<=/ });
export const GreaterEqual = createToken({ name: "GreaterEqual", pattern: />=/ });

// ─── Single-char operators ────────────────────────────────────
export const Plus = createToken({ name: "Plus", pattern: /\+/ });
export const Minus = createToken({ name: "Minus", pattern: /-/ });
export const Star = createToken({ name: "Star", pattern: /\*/ });
export const Slash = createToken({ name: "Slash", pattern: /\// });
export const Percent = createToken({ name: "Percent", pattern: /%/ });
export const Amp = createToken({ name: "Amp", pattern: /&/ });
export const Pipe = createToken({ name: "Pipe", pattern: /\|/ });
export const Caret = createToken({ name: "Caret", pattern: /\^/ });
export const Tilde = createToken({ name: "Tilde", pattern: /~/ });
export const Bang = createToken({ name: "Bang", pattern: /!/ });
export const Equal = createToken({ name: "Equal", pattern: /=/ });
export const LessThan = createToken({ name: "LessThan", pattern: /</ });
export const GreaterThan = createToken({ name: "GreaterThan", pattern: />/ });

// ─── Punctuation ──────────────────────────────────────────────
export const LBrace = createToken({ name: "LBrace", pattern: /\{/ });
export const RBrace = createToken({ name: "RBrace", pattern: /\}/ });
export const LParen = createToken({ name: "LParen", pattern: /\(/ });
export const RParen = createToken({ name: "RParen", pattern: /\)/ });
export const LBracket = createToken({ name: "LBracket", pattern: /\[/ });
export const RBracket = createToken({ name: "RBracket", pattern: /\]/ });
export const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });
export const Colon = createToken({ name: "Colon", pattern: /:/ });
export const Comma = createToken({ name: "Comma", pattern: /,/ });
export const Dot = createToken({ name: "Dot", pattern: /\./ });
export const At = createToken({ name: "At", pattern: /@/ });

// ─── Template delimiters (virtual tokens set by disambiguator) ─
export const TemplateArgsOpen = createToken({ name: "TemplateArgsOpen", pattern: Lexer.NA });
export const TemplateArgsClose = createToken({ name: "TemplateArgsClose", pattern: Lexer.NA });

// ─── Set up longer_alt relationships for keywords ─────────────
// All keywords must have Ident as longer_alt so "fnFoo" is Ident not Fn+Ident
const keywordTokens = [
  Alias,
  Break,
  Case,
  ConstAssert,
  Const,
  Continue,
  Continuing,
  Default,
  Diagnostic,
  Discard,
  Else,
  Enable,
  False,
  True,
  Fn,
  For,
  If,
  Let,
  Loop,
  Override,
  Requires,
  Return,
  Struct,
  Switch,
  Var,
  While,
];
for (const kw of keywordTokens) {
  (kw as { LONGER_ALT?: TokenType }).LONGER_ALT = Ident;
}

// ConstAssert must be longer_alt for Const (const_assert starts with "const")
Const.LONGER_ALT = ConstAssert;
// Continuing must be longer_alt for Continue
Continue.LONGER_ALT = Continuing;

// ─── Token ordering for lexer ─────────────────────────────────
// Order matters: longer patterns first, keywords before Ident
const allTokens: TokenType[] = [
  // Whitespace & comments first
  WhiteSpace,
  BlockComment,
  LineComment,

  // Multi-char operators (longest first)
  ShiftLeftEqual,
  ShiftRightEqual,
  ShiftLeft,
  ShiftRight,
  Arrow,
  PlusPlus,
  PlusEqual,
  MinusMinus,
  MinusEqual,
  StarEqual,
  SlashEqual,
  PercentEqual,
  AmpAmp,
  AmpEqual,
  PipePipe,
  PipeEqual,
  CaretEqual,
  EqualEqual,
  BangEqual,
  LessEqual,
  GreaterEqual,

  // Single-char operators
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Amp,
  Pipe,
  Caret,
  Tilde,
  Bang,
  Equal,
  LessThan,
  GreaterThan,

  // Literals (hex float must come before hex int, float before int)
  // Must come before Dot so ".5" is FloatLiteral not Dot+IntLiteral
  HexFloatLiteral,
  FloatLiteral,
  HexIntLiteral,
  IntLiteral,

  // Punctuation
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Semicolon,
  Colon,
  Comma,
  Dot,
  At,

  // Underscore (before Ident, more specific pattern)
  Underscore,

  // Keywords (before Ident, but with longer_alt = Ident)
  ConstAssert,
  Continuing,
  ...keywordTokens.filter((t) => t !== ConstAssert && t !== Continuing),

  // Identifier (catch-all for ident-like tokens)
  Ident,

  // Category tokens (not produced by lexer, used for parser grouping)
  BoolLiteral,

  // Virtual tokens (set by disambiguator, not produced by lexer)
  TemplateArgsOpen,
  TemplateArgsClose,
];

export { allTokens };

const WGSLLexer = new Lexer(allTokens);

// ─── TK: backward-compatible token kind constants ─────────────
// Maps old TK string values to Chevrotain TokenType objects
export const TK = {
  Ident,
  IntLiteral,
  FloatLiteral,
  BoolLiteral,
  Alias,
  Break,
  Case,
  Const,
  ConstAssert,
  Continue,
  Continuing,
  Default,
  Diagnostic,
  Discard,
  Else,
  Enable,
  Fn,
  For,
  If,
  Let,
  Loop,
  Override,
  Requires,
  Return,
  Struct,
  Switch,
  Var,
  While,
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Semicolon,
  Colon,
  Comma,
  Dot,
  At,
  Underscore,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Amp,
  Pipe,
  Caret,
  Tilde,
  Bang,
  Equal,
  EqualEqual,
  BangEqual,
  LessThan,
  GreaterThan,
  LessEqual,
  GreaterEqual,
  AmpAmp,
  PipePipe,
  ShiftLeft,
  ShiftRight,
  Arrow,
  PlusEqual,
  MinusEqual,
  StarEqual,
  SlashEqual,
  PercentEqual,
  AmpEqual,
  PipeEqual,
  CaretEqual,
  ShiftLeftEqual,
  ShiftRightEqual,
  PlusPlus,
  MinusMinus,
  TemplateArgsOpen,
  TemplateArgsClose,
  LineComment,
  BlockComment,
} as const;

// ─── Tokenize helper ──────────────────────────────────────────
export interface TokenizeResult {
  tokens: IToken[];
  comments: IToken[];
}

export function tokenize(source: string): TokenizeResult {
  const result = WGSLLexer.tokenize(source);
  return {
    tokens: result.tokens,
    comments: result.groups["comments"] ?? [],
  };
}

export type { IToken, TokenType };
