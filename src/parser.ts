import { EmbeddedActionsParser } from "chevrotain";
import type { IToken } from "chevrotain";
import { tokenize, TK, allTokens } from "./tokens.ts";
import { disambiguateTemplates } from "./template-disambiguator.ts";
import type {
  TranslationUnit, EnableDirective, RequiresDirective, DiagnosticDirective,
  FunctionDeclaration, StructDeclaration, StructMember, Parameter, Attribute,
  VarDeclaration, LetDeclaration, ConstDeclaration, OverrideDeclaration,
  AliasDeclaration, ConstAssertStatement,
  Block, ReturnStmt, IfStmt, ForStmt, WhileStmt, LoopStmt, ContinuingStmt,
  SwitchStmt, CaseClause, DefaultSelector,
  AssignStmt, IncrDecrStmt, ExprStmt, BreakStmt, ContinueStmt, DiscardStmt,
  PhonyAssignStmt,
  BinaryExpr, UnaryExpr, CallExpr, MemberExpr, IndexExpr,
  IdentExpr, LiteralExpr, ParenExpr,
  TypeExpr, Expr, Stmt, CommentNode,
} from "./ast.ts";

// Helper: get end offset from token
function tEnd(t: IToken): number {
  return t.startOffset + t.image.length;
}

class WGSLParser extends EmbeddedActionsParser {
  constructor() {
    super(allTokens, { maxLookahead: 3 });
    this.performSelfAnalysis();
  }

  // ─── Top-level ────────────────────────────────────────────────

  public translationUnit = this.RULE("translationUnit", (): TranslationUnit => {
    const directives: TranslationUnit["directives"] = [];
    const declarations: TranslationUnit["declarations"] = [];

    this.MANY(() => {
      this.OR([
        { ALT: () => { directives.push(this.SUBRULE(this.enableDirective)); } },
        { ALT: () => { directives.push(this.SUBRULE(this.requiresDirective)); } },
        { ALT: () => { directives.push(this.SUBRULE(this.diagnosticDirective)); } },
      ]);
    });

    this.MANY2(() => {
      declarations.push(this.SUBRULE(this.declaration));
    });

    const start = directives.length > 0 ? directives[0].start
      : declarations.length > 0 ? declarations[0].start : 0;
    const end = declarations.length > 0 ? declarations[declarations.length - 1].end
      : directives.length > 0 ? directives[directives.length - 1].end : 0;

    return { kind: "TranslationUnit", directives, declarations, start, end };
  });

  private enableDirective = this.RULE("enableDirective", (): EnableDirective => {
    const kw = this.CONSUME(TK.Enable);
    const extensions: string[] = [];
    extensions.push(this.CONSUME(TK.Ident).image);
    this.MANY(() => {
      this.CONSUME(TK.Comma);
      extensions.push(this.CONSUME2(TK.Ident).image);
    });
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "EnableDirective", extensions, start: kw.startOffset, end: tEnd(semi) };
  });

  private requiresDirective = this.RULE("requiresDirective", (): RequiresDirective => {
    const kw = this.CONSUME(TK.Requires);
    const extensions: string[] = [];
    extensions.push(this.CONSUME(TK.Ident).image);
    this.MANY(() => {
      this.CONSUME(TK.Comma);
      extensions.push(this.CONSUME2(TK.Ident).image);
    });
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "RequiresDirective", extensions, start: kw.startOffset, end: tEnd(semi) };
  });

  private diagnosticDirective = this.RULE("diagnosticDirective", (): DiagnosticDirective => {
    const kw = this.CONSUME(TK.Diagnostic);
    this.CONSUME(TK.LParen);
    const severity = this.CONSUME(TK.Ident).image;
    this.CONSUME(TK.Comma);
    let rule = this.CONSUME2(TK.Ident).image;
    this.OPTION(() => {
      this.CONSUME(TK.Dot);
      rule += "." + this.CONSUME3(TK.Ident).image;
    });
    this.CONSUME(TK.RParen);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "DiagnosticDirective", severity, rule, start: kw.startOffset, end: tEnd(semi) };
  });

  // ─── Declarations ─────────────────────────────────────────────

  private declaration = this.RULE("declaration", (): TranslationUnit["declarations"][number] => {
    const attrs = this.SUBRULE(this.attributes);
    return this.OR([
      { ALT: () => this.SUBRULE(this.functionDeclaration, { ARGS: [attrs] }) },
      { ALT: () => this.SUBRULE(this.structDeclaration) },
      { ALT: () => this.SUBRULE(this.varDeclaration, { ARGS: [attrs] }) },
      { ALT: () => this.SUBRULE(this.letDeclaration) },
      { ALT: () => this.SUBRULE(this.constDeclaration) },
      { ALT: () => this.SUBRULE(this.overrideDeclaration, { ARGS: [attrs] }) },
      { ALT: () => this.SUBRULE(this.aliasDeclaration) },
      { ALT: () => this.SUBRULE(this.constAssert) },
    ]);
  });

  private attributes = this.RULE("attributes", (): Attribute[] => {
    const attrs: Attribute[] = [];
    this.MANY(() => {
      attrs.push(this.SUBRULE(this.attribute));
    });
    return attrs;
  });

  private attribute = this.RULE("attribute", (): Attribute => {
    const at = this.CONSUME(TK.At);
    const name = this.SUBRULE(this.attributeName);
    const args: Expr[] = [];
    this.OPTION(() => {
      this.CONSUME(TK.LParen);
      this.OPTION2(() => {
        args.push(this.SUBRULE(this.expression));
        this.MANY(() => {
          this.CONSUME(TK.Comma);
          this.OPTION3(() => {
            args.push(this.SUBRULE2(this.expression));
          });
        });
      });
      this.CONSUME(TK.RParen);
    });
    // Re-compute end from last consumed token
    const end = args.length > 0 || this.LA(0).image === ")"
      ? tEnd(this.LA(0)) : at.startOffset + 1 + name.length;
    return { kind: "Attribute", name, args, start: at.startOffset, end };
  });

  private attributeName = this.RULE("attributeName", (): string => {
    return this.OR([
      { ALT: () => this.CONSUME(TK.Ident).image },
      { ALT: () => this.CONSUME(TK.Diagnostic).image },
      { ALT: () => this.CONSUME(TK.Const).image },
    ]);
  });

  private functionDeclaration = this.RULE("functionDeclaration", (attrs?: Attribute[]): FunctionDeclaration => {
    attrs = attrs ?? [];
    const fnKw = this.CONSUME(TK.Fn);
    const start = attrs.length > 0 ? attrs[0].start : fnKw.startOffset;
    const name = this.CONSUME(TK.Ident).image;
    this.CONSUME(TK.LParen);
    const params = this.SUBRULE(this.paramList);
    this.CONSUME(TK.RParen);

    let returnType: TypeExpr | null = null;
    const returnAttributes: Attribute[] = [];
    this.OPTION(() => {
      this.CONSUME(TK.Arrow);
      const retAttrs = this.SUBRULE(this.attributes);
      if (Array.isArray(retAttrs)) returnAttributes.push(...retAttrs);
      returnType = this.SUBRULE(this.typeExpr);
    });

    const body = this.SUBRULE(this.block);
    return {
      kind: "FunctionDeclaration", attributes: attrs, name, params,
      returnType, returnAttributes, body, start, end: body.end,
    };
  });

  private paramList = this.RULE("paramList", (): Parameter[] => {
    const params: Parameter[] = [];
    this.OPTION(() => {
      params.push(this.SUBRULE(this.param));
      this.MANY(() => {
        this.CONSUME(TK.Comma);
        // Handle trailing comma
        this.OPTION2(() => {
          params.push(this.SUBRULE2(this.param));
        });
      });
    });
    return params;
  });

  private param = this.RULE("param", (): Parameter => {
    const attrs = this.SUBRULE(this.attributes);
    const nameToken = this.CONSUME(TK.Ident);
    const start = attrs.length > 0 ? attrs[0].start : nameToken.startOffset;
    this.CONSUME(TK.Colon);
    const type = this.SUBRULE(this.typeExpr);
    return { kind: "Parameter", attributes: attrs, name: nameToken.image, type, start, end: type.end };
  });

  private structDeclaration = this.RULE("structDeclaration", (): StructDeclaration => {
    const kw = this.CONSUME(TK.Struct);
    const name = this.CONSUME(TK.Ident).image;
    this.CONSUME(TK.LBrace);
    const members: StructMember[] = [];
    this.MANY(() => {
      members.push(this.SUBRULE(this.structMember));
      this.OPTION(() => { this.CONSUME(TK.Comma); });
    });
    const rb = this.CONSUME(TK.RBrace);
    this.OPTION2(() => { this.CONSUME(TK.Semicolon); });  // optional trailing ;
    return { kind: "StructDeclaration", name, members, start: kw.startOffset, end: tEnd(rb) };
  });

  private structMember = this.RULE("structMember", (): StructMember => {
    const attrs = this.SUBRULE(this.attributes);
    const nameToken = this.CONSUME(TK.Ident);
    const start = attrs.length > 0 ? attrs[0].start : nameToken.startOffset;
    this.CONSUME(TK.Colon);
    const type = this.SUBRULE(this.typeExpr);
    return { kind: "StructMember", attributes: attrs, name: nameToken.image, type, start, end: type.end };
  });

  private varDeclaration = this.RULE("varDeclaration", (attrs?: Attribute[]): VarDeclaration => {
    attrs = attrs ?? [];
    const kw = this.CONSUME(TK.Var);
    const start = attrs.length > 0 ? attrs[0].start : kw.startOffset;
    let qualifier: string | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.TemplateArgsOpen);
      qualifier = this.CONSUME(TK.Ident).image;
      this.OPTION2(() => {
        this.CONSUME(TK.Comma);
        qualifier += ", " + this.CONSUME2(TK.Ident).image;
      });
      this.CONSUME(TK.TemplateArgsClose);
    });
    const name = this.CONSUME3(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION3(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    let initializer: Expr | null = null;
    this.OPTION4(() => {
      this.CONSUME(TK.Equal);
      initializer = this.SUBRULE(this.expression);
    });
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "VarDeclaration", attributes: attrs, qualifier, name, type, initializer, start, end: tEnd(semi) };
  });

  private letDeclaration = this.RULE("letDeclaration", (): LetDeclaration => {
    const kw = this.CONSUME(TK.Let);
    const name = this.CONSUME(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    this.CONSUME(TK.Equal);
    const initializer = this.SUBRULE(this.expression);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "LetDeclaration", name, type, initializer, start: kw.startOffset, end: tEnd(semi) };
  });

  private constDeclaration = this.RULE("constDeclaration", (): ConstDeclaration => {
    const kw = this.CONSUME(TK.Const);
    const name = this.CONSUME(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    this.CONSUME(TK.Equal);
    const initializer = this.SUBRULE(this.expression);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "ConstDeclaration", name, type, initializer, start: kw.startOffset, end: tEnd(semi) };
  });

  private overrideDeclaration = this.RULE("overrideDeclaration", (attrs?: Attribute[]): OverrideDeclaration => {
    attrs = attrs ?? [];
    const kw = this.CONSUME(TK.Override);
    const start = attrs.length > 0 ? attrs[0].start : kw.startOffset;
    const name = this.CONSUME(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    let initializer: Expr | null = null;
    this.OPTION2(() => {
      this.CONSUME(TK.Equal);
      initializer = this.SUBRULE(this.expression);
    });
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "OverrideDeclaration", attributes: attrs, name, type, initializer, start, end: tEnd(semi) };
  });

  private aliasDeclaration = this.RULE("aliasDeclaration", (): AliasDeclaration => {
    const kw = this.CONSUME(TK.Alias);
    const name = this.CONSUME(TK.Ident).image;
    this.CONSUME(TK.Equal);
    const type = this.SUBRULE(this.typeExpr);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "AliasDeclaration", name, type, start: kw.startOffset, end: tEnd(semi) };
  });

  private constAssert = this.RULE("constAssert", (): ConstAssertStatement => {
    const kw = this.CONSUME(TK.ConstAssert);
    const expr = this.SUBRULE(this.expression);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "ConstAssertStatement", expr, start: kw.startOffset, end: tEnd(semi) };
  });

  // ─── Types ────────────────────────────────────────────────────

  private typeExpr = this.RULE("typeExpr", (): TypeExpr => {
    const nameToken = this.CONSUME(TK.Ident);
    const templateArgs: (TypeExpr | Expr)[] = [];
    this.OPTION(() => {
      this.CONSUME(TK.TemplateArgsOpen);
      this.OPTION2(() => {
        templateArgs.push(this.SUBRULE(this.templateArg));
        this.MANY(() => {
          this.CONSUME(TK.Comma);
          this.OPTION3(() => {
            templateArgs.push(this.SUBRULE2(this.templateArg));
          });
        });
      });
      this.CONSUME(TK.TemplateArgsClose);
    });
    const end = templateArgs.length > 0
      ? tEnd(this.LA(0)) // end of TemplateArgsClose
      : tEnd(nameToken);
    return { kind: "TypeExpr", name: nameToken.image, templateArgs, start: nameToken.startOffset, end };
  });

  private templateArg = this.RULE("templateArg", (): TypeExpr | Expr => {
    // If it's an ident followed by TemplateArgsOpen/Comma/TemplateArgsClose, parse as type
    return this.OR([
      {
        GATE: () => {
          const la1 = this.LA(1);
          const la2 = this.LA(2);
          return la1.tokenType === TK.Ident && (
            la2.tokenType === TK.TemplateArgsOpen ||
            la2.tokenType === TK.Comma ||
            la2.tokenType === TK.TemplateArgsClose
          );
        },
        ALT: () => this.SUBRULE(this.typeExpr),
      },
      { ALT: () => this.SUBRULE(this.expression) },
    ]);
  });

  // ─── Statements ───────────────────────────────────────────────

  private block = this.RULE("block", (): Block => {
    const lb = this.CONSUME(TK.LBrace);
    const statements: Stmt[] = [];
    this.MANY(() => {
      statements.push(this.SUBRULE(this.statement));
    });
    const rb = this.CONSUME(TK.RBrace);
    return { kind: "Block", statements, start: lb.startOffset, end: tEnd(rb) };
  });

  private statement = this.RULE("statement", (): Stmt => {
    return this.OR([
      { ALT: () => this.SUBRULE(this.returnStmt) },
      { ALT: () => this.SUBRULE(this.ifStmt) },
      { ALT: () => this.SUBRULE(this.forStmt) },
      { ALT: () => this.SUBRULE(this.whileStmt) },
      { ALT: () => this.SUBRULE(this.loopStmt) },
      { ALT: () => this.SUBRULE(this.switchStmt) },
      { ALT: () => this.SUBRULE(this.breakStmt) },
      { ALT: () => this.SUBRULE(this.continueStmt) },
      { ALT: () => this.SUBRULE(this.discardStmt) },
      { ALT: () => this.SUBRULE(this.block) },
      { ALT: () => this.SUBRULE(this.varStmtDecl) },
      { ALT: () => this.SUBRULE(this.letStmtDecl) },
      { ALT: () => this.SUBRULE(this.constStmtDecl) },
      { ALT: () => this.SUBRULE(this.constAssertStmt) },
      { ALT: () => this.SUBRULE(this.phonyAssignment) },
      { ALT: () => this.SUBRULE(this.exprOrAssignStmt) },
    ]);
  });

  private returnStmt = this.RULE("returnStmt", (): ReturnStmt => {
    const kw = this.CONSUME(TK.Return);
    let value: Expr | null = null;
    this.OPTION(() => {
      value = this.SUBRULE(this.expression);
    });
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "ReturnStmt", value, start: kw.startOffset, end: tEnd(semi) };
  });

  private ifStmt = this.RULE("ifStmt", (): IfStmt => {
    const kw = this.CONSUME(TK.If);
    const condition = this.SUBRULE(this.expression);
    const body = this.SUBRULE(this.block);
    let elseClause: IfStmt | Block | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.Else);
      elseClause = this.OR([
        { ALT: () => this.SUBRULE(this.ifStmt) },
        { ALT: () => this.SUBRULE2(this.block) },
      ]);
    });
    const ec = elseClause as IfStmt | Block | null;
    const end = ec ? ec.end : body.end;
    return { kind: "IfStmt", condition, body, elseClause, start: kw.startOffset, end };
  });

  private forStmt = this.RULE("forStmt", (): ForStmt => {
    const kw = this.CONSUME(TK.For);
    this.CONSUME(TK.LParen);
    let init: Stmt | null = null;
    this.OPTION(() => {
      init = this.SUBRULE(this.forInit);
    });
    this.CONSUME(TK.Semicolon);
    let condition: Expr | null = null;
    this.OPTION2(() => {
      condition = this.SUBRULE(this.expression);
    });
    this.CONSUME2(TK.Semicolon);
    let update: Stmt | null = null;
    this.OPTION3(() => {
      update = this.SUBRULE(this.forUpdate);
    });
    this.CONSUME(TK.RParen);
    const body = this.SUBRULE(this.block);
    return { kind: "ForStmt", init, condition, update, body, start: kw.startOffset, end: body.end };
  });

  private forInit = this.RULE("forInit", (): Stmt => {
    return this.OR([
      { ALT: () => this.SUBRULE(this.varDeclNoSemicolon) },
      { ALT: () => this.SUBRULE(this.letDeclNoSemicolon) },
      { ALT: () => this.SUBRULE(this.constDeclNoSemicolon) },
      { ALT: () => this.SUBRULE(this.exprOrAssignStmtNoSemicolon) },
    ]);
  });

  private forUpdate = this.RULE("forUpdate", (): Stmt => {
    return this.SUBRULE(this.exprOrAssignStmtNoSemicolon);
  });

  private varDeclNoSemicolon = this.RULE("varDeclNoSemicolon", (): VarDeclaration => {
    const kw = this.CONSUME(TK.Var);
    let qualifier: string | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.TemplateArgsOpen);
      qualifier = this.CONSUME(TK.Ident).image;
      this.OPTION2(() => {
        this.CONSUME(TK.Comma);
        qualifier += ", " + this.CONSUME2(TK.Ident).image;
      });
      this.CONSUME(TK.TemplateArgsClose);
    });
    const name = this.CONSUME3(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION3(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    let initializer: Expr | null = null;
    this.OPTION4(() => {
      this.CONSUME(TK.Equal);
      initializer = this.SUBRULE(this.expression);
    });
    const ini = initializer as Expr | null;
    const ty = type as TypeExpr | null;
    const end = ini ? ini.end : ty ? ty.end : kw.startOffset + name.length;
    return { kind: "VarDeclaration", attributes: [], qualifier, name, type, initializer, start: kw.startOffset, end };
  });

  private letDeclNoSemicolon = this.RULE("letDeclNoSemicolon", (): LetDeclaration => {
    const kw = this.CONSUME(TK.Let);
    const name = this.CONSUME(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    this.CONSUME(TK.Equal);
    const initializer = this.SUBRULE(this.expression);
    return { kind: "LetDeclaration", name, type, initializer, start: kw.startOffset, end: initializer.end };
  });

  private constDeclNoSemicolon = this.RULE("constDeclNoSemicolon", (): ConstDeclaration => {
    const kw = this.CONSUME(TK.Const);
    const name = this.CONSUME(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    this.CONSUME(TK.Equal);
    const initializer = this.SUBRULE(this.expression);
    return { kind: "ConstDeclaration", name, type, initializer, start: kw.startOffset, end: initializer.end };
  });

  private whileStmt = this.RULE("whileStmt", (): WhileStmt => {
    const kw = this.CONSUME(TK.While);
    const condition = this.SUBRULE(this.expression);
    const body = this.SUBRULE(this.block);
    return { kind: "WhileStmt", condition, body, start: kw.startOffset, end: body.end };
  });

  private loopStmt = this.RULE("loopStmt", (): LoopStmt => {
    const kw = this.CONSUME(TK.Loop);
    this.CONSUME(TK.LBrace);
    const statements: Stmt[] = [];
    let continuing: ContinuingStmt | null = null;
    this.MANY(() => {
      this.OR([
        {
          GATE: () => this.LA(1).tokenType === TK.Continuing,
          ALT: () => { continuing = this.SUBRULE(this.continuingStmt); },
        },
        { ALT: () => { statements.push(this.SUBRULE(this.statement)); } },
      ]);
    });
    const rb = this.CONSUME(TK.RBrace);
    const bodyEnd = tEnd(rb);
    const body: Block = { kind: "Block", statements, start: kw.startOffset, end: bodyEnd };
    return { kind: "LoopStmt", body, continuing, start: kw.startOffset, end: bodyEnd };
  });

  private continuingStmt = this.RULE("continuingStmt", (): ContinuingStmt => {
    const kw = this.CONSUME(TK.Continuing);
    this.CONSUME(TK.LBrace);
    const statements: Stmt[] = [];
    let breakIf: Expr | null = null;
    this.MANY(() => {
      this.OR([
        {
          GATE: () => this.LA(1).tokenType === TK.Break && this.LA(2).tokenType === TK.If,
          ALT: () => {
            this.CONSUME(TK.Break);
            this.CONSUME(TK.If);
            breakIf = this.SUBRULE(this.expression);
            this.CONSUME(TK.Semicolon);
          },
        },
        { ALT: () => { statements.push(this.SUBRULE(this.statement)); } },
      ]);
    });
    const rb = this.CONSUME(TK.RBrace);
    const body: Block = { kind: "Block", statements, start: kw.startOffset, end: tEnd(rb) };
    return { kind: "ContinuingStmt", body, breakIf, start: kw.startOffset, end: tEnd(rb) };
  });

  private switchStmt = this.RULE("switchStmt", (): SwitchStmt => {
    const kw = this.CONSUME(TK.Switch);
    const expr = this.SUBRULE(this.expression);
    this.CONSUME(TK.LBrace);
    const clauses: CaseClause[] = [];
    this.MANY(() => {
      clauses.push(this.SUBRULE(this.caseClause));
    });
    const rb = this.CONSUME(TK.RBrace);
    return { kind: "SwitchStmt", expr, clauses, start: kw.startOffset, end: tEnd(rb) };
  });

  private caseClause = this.RULE("caseClause", (): CaseClause => {
    const selectors: (Expr | DefaultSelector)[] = [];
    let start = this.LA(1).startOffset;

    this.OR([
      {
        ALT: () => {
          const caseKw = this.CONSUME(TK.Case);
          start = caseKw.startOffset;
          selectors.push(this.SUBRULE(this.caseSelector));
          this.MANY(() => {
            this.CONSUME(TK.Comma);
            // Don't parse selector if next is : or {
            this.OPTION(() => {
              selectors.push(this.SUBRULE2(this.caseSelector));
            });
          });
        },
      },
      {
        ALT: () => {
          const defKw = this.CONSUME(TK.Default);
          start = defKw.startOffset;
          selectors.push({ kind: "DefaultSelector", start: defKw.startOffset, end: tEnd(defKw) });
        },
      },
    ]);

    this.OPTION2(() => { this.CONSUME(TK.Colon); });
    const body = this.SUBRULE(this.block);
    return { kind: "CaseClause", selectors, body, start, end: body.end };
  });

  private caseSelector = this.RULE("caseSelector", (): Expr | DefaultSelector => {
    return this.OR([
      {
        ALT: () => {
          const defKw = this.CONSUME(TK.Default);
          return { kind: "DefaultSelector" as const, start: defKw.startOffset, end: tEnd(defKw) };
        },
      },
      { ALT: () => this.SUBRULE(this.expression) },
    ]);
  });

  private breakStmt = this.RULE("breakStmt", (): BreakStmt => {
    const kw = this.CONSUME(TK.Break);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "BreakStmt", start: kw.startOffset, end: tEnd(semi) };
  });

  private continueStmt = this.RULE("continueStmt", (): ContinueStmt => {
    const kw = this.CONSUME(TK.Continue);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "ContinueStmt", start: kw.startOffset, end: tEnd(semi) };
  });

  private discardStmt = this.RULE("discardStmt", (): DiscardStmt => {
    const kw = this.CONSUME(TK.Discard);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "DiscardStmt", start: kw.startOffset, end: tEnd(semi) };
  });

  private phonyAssignment = this.RULE("phonyAssignment", (): PhonyAssignStmt => {
    const us = this.CONSUME(TK.Underscore);
    this.CONSUME(TK.Equal);
    const value = this.SUBRULE(this.expression);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "PhonyAssignStmt", value, start: us.startOffset, end: tEnd(semi) };
  });

  // Local var/let/const in statement context (with semicolons)
  private varStmtDecl = this.RULE("varStmtDecl", (): VarDeclaration => {
    const kw = this.CONSUME(TK.Var);
    let qualifier: string | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.TemplateArgsOpen);
      qualifier = this.CONSUME(TK.Ident).image;
      this.OPTION2(() => {
        this.CONSUME(TK.Comma);
        qualifier += ", " + this.CONSUME2(TK.Ident).image;
      });
      this.CONSUME(TK.TemplateArgsClose);
    });
    const name = this.CONSUME3(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION3(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    let initializer: Expr | null = null;
    this.OPTION4(() => {
      this.CONSUME(TK.Equal);
      initializer = this.SUBRULE(this.expression);
    });
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "VarDeclaration", attributes: [], qualifier, name, type, initializer, start: kw.startOffset, end: tEnd(semi) };
  });

  private letStmtDecl = this.RULE("letStmtDecl", (): LetDeclaration => {
    const kw = this.CONSUME(TK.Let);
    const name = this.CONSUME(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    this.CONSUME(TK.Equal);
    const initializer = this.SUBRULE(this.expression);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "LetDeclaration", name, type, initializer, start: kw.startOffset, end: tEnd(semi) };
  });

  private constStmtDecl = this.RULE("constStmtDecl", (): ConstDeclaration => {
    const kw = this.CONSUME(TK.Const);
    const name = this.CONSUME(TK.Ident).image;
    let type: TypeExpr | null = null;
    this.OPTION(() => {
      this.CONSUME(TK.Colon);
      type = this.SUBRULE(this.typeExpr);
    });
    this.CONSUME(TK.Equal);
    const initializer = this.SUBRULE(this.expression);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "ConstDeclaration", name, type, initializer, start: kw.startOffset, end: tEnd(semi) };
  });

  private constAssertStmt = this.RULE("constAssertStmt", (): ConstAssertStatement => {
    const kw = this.CONSUME(TK.ConstAssert);
    const expr = this.SUBRULE(this.expression);
    const semi = this.CONSUME(TK.Semicolon);
    return { kind: "ConstAssertStatement", expr, start: kw.startOffset, end: tEnd(semi) };
  });

  private exprOrAssignStmt = this.RULE("exprOrAssignStmt", (): Stmt => {
    const stmt = this.SUBRULE(this.exprOrAssignStmtNoSemicolon);
    const semi = this.CONSUME(TK.Semicolon);
    return this.ACTION(() => {
      return { ...stmt, end: tEnd(semi) };
    }) ?? stmt;
  });

  private assignOp = this.RULE("assignOp", (): IToken => {
    return this.OR([
      { ALT: () => this.CONSUME(TK.Equal) },
      { ALT: () => this.CONSUME(TK.PlusEqual) },
      { ALT: () => this.CONSUME(TK.MinusEqual) },
      { ALT: () => this.CONSUME(TK.StarEqual) },
      { ALT: () => this.CONSUME(TK.SlashEqual) },
      { ALT: () => this.CONSUME(TK.PercentEqual) },
      { ALT: () => this.CONSUME(TK.AmpEqual) },
      { ALT: () => this.CONSUME(TK.PipeEqual) },
      { ALT: () => this.CONSUME(TK.CaretEqual) },
      { ALT: () => this.CONSUME(TK.ShiftLeftEqual) },
      { ALT: () => this.CONSUME(TK.ShiftRightEqual) },
    ]);
  });

  private exprOrAssignStmtNoSemicolon = this.RULE("exprOrAssignStmtNoSemicolon", (): Stmt => {
    const expr = this.SUBRULE(this.expression);

    return this.OR([
      {
        ALT: () => {
          const op = this.SUBRULE(this.assignOp);
          const val = this.SUBRULE2(this.expression);
          return this.ACTION(() => ({
            kind: "AssignStmt" as const, target: expr, op: op.image, value: val, start: expr.start, end: val.end,
          })) ?? { kind: "AssignStmt" as const, target: expr, op: "=", value: val, start: 0, end: 0 };
        },
      },
      {
        ALT: () => {
          const op = this.CONSUME(TK.PlusPlus);
          return this.ACTION(() => ({
            kind: "IncrDecrStmt" as const, target: expr, op: "++" as const, start: expr.start, end: tEnd(op),
          })) ?? { kind: "IncrDecrStmt" as const, target: expr, op: "++" as const, start: 0, end: 0 };
        },
      },
      {
        ALT: () => {
          const op = this.CONSUME(TK.MinusMinus);
          return this.ACTION(() => ({
            kind: "IncrDecrStmt" as const, target: expr, op: "--" as const, start: expr.start, end: tEnd(op),
          })) ?? { kind: "IncrDecrStmt" as const, target: expr, op: "--" as const, start: 0, end: 0 };
        },
      },
      {
        ALT: () => this.ACTION(() => ({
          kind: "ExprStmt" as const, expr, start: expr.start, end: expr.end,
        })) ?? { kind: "ExprStmt" as const, expr, start: 0, end: 0 },
      },
    ]);
  });

  // ─── Expressions (precedence climbing) ────────────────────────

  private expression = this.RULE("expression", (): Expr => {
    return this.SUBRULE(this.logicalOrExpr);
  });

  private logicalOrExpr = this.RULE("logicalOrExpr", (): Expr => {
    let left = this.SUBRULE(this.logicalAndExpr);
    this.MANY(() => {
      const op = this.CONSUME(TK.PipePipe);
      const right = this.SUBRULE2(this.logicalAndExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private logicalAndExpr = this.RULE("logicalAndExpr", (): Expr => {
    let left = this.SUBRULE(this.bitwiseOrExpr);
    this.MANY(() => {
      const op = this.CONSUME(TK.AmpAmp);
      const right = this.SUBRULE2(this.bitwiseOrExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private bitwiseOrExpr = this.RULE("bitwiseOrExpr", (): Expr => {
    let left = this.SUBRULE(this.bitwiseXorExpr);
    this.MANY(() => {
      const op = this.CONSUME(TK.Pipe);
      const right = this.SUBRULE2(this.bitwiseXorExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private bitwiseXorExpr = this.RULE("bitwiseXorExpr", (): Expr => {
    let left = this.SUBRULE(this.bitwiseAndExpr);
    this.MANY(() => {
      const op = this.CONSUME(TK.Caret);
      const right = this.SUBRULE2(this.bitwiseAndExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private bitwiseAndExpr = this.RULE("bitwiseAndExpr", (): Expr => {
    let left = this.SUBRULE(this.equalityExpr);
    this.MANY(() => {
      const op = this.CONSUME(TK.Amp);
      const right = this.SUBRULE2(this.equalityExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private equalityExpr = this.RULE("equalityExpr", (): Expr => {
    let left = this.SUBRULE(this.relationalExpr);
    this.MANY(() => {
      const op = this.OR([
        { ALT: () => this.CONSUME(TK.EqualEqual) },
        { ALT: () => this.CONSUME(TK.BangEqual) },
      ]);
      const right = this.SUBRULE2(this.relationalExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private relationalExpr = this.RULE("relationalExpr", (): Expr => {
    let left = this.SUBRULE(this.shiftExpr);
    this.MANY(() => {
      const op = this.OR([
        { ALT: () => this.CONSUME(TK.LessThan) },
        { ALT: () => this.CONSUME(TK.GreaterThan) },
        { ALT: () => this.CONSUME(TK.LessEqual) },
        { ALT: () => this.CONSUME(TK.GreaterEqual) },
      ]);
      const right = this.SUBRULE2(this.shiftExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private shiftExpr = this.RULE("shiftExpr", (): Expr => {
    let left = this.SUBRULE(this.additiveExpr);
    this.MANY(() => {
      const op = this.OR([
        { ALT: () => this.CONSUME(TK.ShiftLeft) },
        { ALT: () => this.CONSUME(TK.ShiftRight) },
      ]);
      const right = this.SUBRULE2(this.additiveExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private additiveExpr = this.RULE("additiveExpr", (): Expr => {
    let left = this.SUBRULE(this.multiplicativeExpr);
    this.MANY(() => {
      const op = this.OR([
        { ALT: () => this.CONSUME(TK.Plus) },
        { ALT: () => this.CONSUME(TK.Minus) },
      ]);
      const right = this.SUBRULE2(this.multiplicativeExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private multiplicativeExpr = this.RULE("multiplicativeExpr", (): Expr => {
    let left = this.SUBRULE(this.unaryExpr);
    this.MANY(() => {
      const op = this.OR([
        { ALT: () => this.CONSUME(TK.Star) },
        { ALT: () => this.CONSUME(TK.Slash) },
        { ALT: () => this.CONSUME(TK.Percent) },
      ]);
      const right = this.SUBRULE2(this.unaryExpr);
      left = { kind: "BinaryExpr", op: op.image, left, right, start: left.start, end: right.end };
    });
    return left;
  });

  private unaryExpr = this.RULE("unaryExpr", (): Expr => {
    return this.OR([
      {
        ALT: () => {
          const op = this.OR2([
            { ALT: () => this.CONSUME(TK.Minus) },
            { ALT: () => this.CONSUME(TK.Bang) },
            { ALT: () => this.CONSUME(TK.Tilde) },
            { ALT: () => this.CONSUME(TK.Amp) },
            { ALT: () => this.CONSUME(TK.Star) },
          ]);
          const operand = this.SUBRULE(this.unaryExpr);
          return { kind: "UnaryExpr" as const, op: op.image, operand, start: op.startOffset, end: operand.end };
        },
      },
      { ALT: () => this.SUBRULE(this.postfixExpr) },
    ]);
  });

  private postfixExpr = this.RULE("postfixExpr", (): Expr => {
    let expr = this.SUBRULE(this.primaryExpr);
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(TK.Dot);
            const member = this.CONSUME(TK.Ident);
            expr = { kind: "MemberExpr", object: expr, member: member.image, start: expr.start, end: tEnd(member) };
          },
        },
        {
          ALT: () => {
            this.CONSUME(TK.LBracket);
            const index = this.SUBRULE(this.expression);
            const rb = this.CONSUME(TK.RBracket);
            expr = { kind: "IndexExpr", object: expr, index, start: expr.start, end: tEnd(rb) };
          },
        },
      ]);
    });
    return expr;
  });

  private primaryExpr = this.RULE("primaryExpr", (): Expr => {
    return this.OR([
      // Parenthesized expression
      {
        ALT: () => {
          const lp = this.CONSUME(TK.LParen);
          const expr = this.SUBRULE(this.expression);
          const rp = this.CONSUME(TK.RParen);
          return { kind: "ParenExpr" as const, expr, start: lp.startOffset, end: tEnd(rp) };
        },
      },
      // Integer literal
      {
        ALT: () => {
          const t = this.CONSUME(TK.IntLiteral);
          return { kind: "LiteralExpr" as const, value: t.image, literalType: "int" as const, start: t.startOffset, end: tEnd(t) };
        },
      },
      // Float literal
      {
        ALT: () => {
          const t = this.CONSUME(TK.FloatLiteral);
          return { kind: "LiteralExpr" as const, value: t.image, literalType: "float" as const, start: t.startOffset, end: tEnd(t) };
        },
      },
      // Bool literal
      {
        ALT: () => {
          const t = this.CONSUME(TK.BoolLiteral);
          return { kind: "LiteralExpr" as const, value: t.image, literalType: "bool" as const, start: t.startOffset, end: tEnd(t) };
        },
      },
      // Identifier, possibly followed by template args and/or function call
      {
        ALT: () => {
          const nameToken = this.CONSUME(TK.Ident);
          const name = nameToken.image;
          const templateArgs: (TypeExpr | Expr)[] = [];

          this.OPTION(() => {
            this.CONSUME(TK.TemplateArgsOpen);
            this.OPTION2(() => {
              templateArgs.push(this.SUBRULE2(this.templateArg));
              this.MANY(() => {
                this.CONSUME(TK.Comma);
                this.OPTION3(() => {
                  templateArgs.push(this.SUBRULE3(this.templateArg));
                });
              });
            });
            this.CONSUME(TK.TemplateArgsClose);
          });

          // Check for function call
          let callExpr: CallExpr | null = null;
          this.OPTION4(() => {
            this.CONSUME2(TK.LParen);
            const args: Expr[] = [];
            this.OPTION5(() => {
              args.push(this.SUBRULE4(this.expression));
              this.MANY2(() => {
                this.CONSUME2(TK.Comma);
                this.OPTION6(() => {
                  args.push(this.SUBRULE5(this.expression));
                });
              });
            });
            const rp = this.CONSUME2(TK.RParen);
            callExpr = { kind: "CallExpr", callee: name, templateArgs, args, start: nameToken.startOffset, end: tEnd(rp) };
          });

          if (callExpr) return callExpr;

          if (templateArgs.length > 0) {
            // ident<args> without call — treat as CallExpr with no args for consistency
            return { kind: "CallExpr" as const, callee: name, templateArgs, args: [], start: nameToken.startOffset, end: tEnd(this.LA(0)) };
          }

          return { kind: "IdentExpr" as const, name, start: nameToken.startOffset, end: tEnd(nameToken) };
        },
      },
    ]);
  });
}

// ─── Singleton parser instance ──────────────────────────────────
const parserInstance = new WGSLParser();

export function parse(source: string): TranslationUnit {
  const { tokens, comments } = tokenize(source);
  const disambiguated = disambiguateTemplates(tokens);

  parserInstance.input = disambiguated;
  const ast = parserInstance.translationUnit();

  if (parserInstance.errors.length > 0) {
    const err = parserInstance.errors[0];
    throw new Error(err.message);
  }

  // Attach comments both as leadingComments (for legacy printer) and as
  // a `comments` array on the root node (for Prettier's comment handling API)
  const commentNodes: CommentNode[] = comments.map((c) => ({
    kind: c.tokenType.name === "LineComment" ? "LineComment" as const : "BlockComment" as const,
    value: c.image,
    start: c.startOffset,
    end: c.startOffset + c.image.length,
  }));

  if (commentNodes.length > 0) {
    ast.leadingComments = commentNodes;
  }

  // Prettier reads `comments` from the root AST node
  ast.comments = commentNodes;

  return ast;
}
