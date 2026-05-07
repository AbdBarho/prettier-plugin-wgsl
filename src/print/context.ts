import { type BlankLineInfo, buildBlankLineInfo } from "./blank-line-info.ts";

export interface PrintContext {
  blankLineInfo: BlankLineInfo;
}

// One context per active Prettier `options` object. The WeakMap entry is freed
// automatically when Prettier finishes the format and releases its options.
const contextByOptions = new WeakMap<object, PrintContext>();

export function getOrBuildContext(options: object): PrintContext {
  let cached = contextByOptions.get(options);
  if (cached) return cached;
  const text = "originalText" in options && typeof options.originalText === "string" ? options.originalText : "";
  cached = { blankLineInfo: buildBlankLineInfo(text) };
  contextByOptions.set(options, cached);
  return cached;
}

// `currentContext` is null whenever no print session is active. Helpers that
// read it (e.g. `hasBlankLineBetween`) call `getCurrentContext`, which throws
// rather than silently returning empty info — this surfaces accidental use
// of print helpers outside `print` immediately.
let currentContext: PrintContext | null = null;

export function getCurrentContext(): PrintContext {
  if (currentContext === null) {
    throw new Error("getCurrentContext called outside withContext");
  }
  return currentContext;
}

export function withContext<T>(ctx: PrintContext, run: () => T): T {
  const previous = currentContext;
  currentContext = ctx;
  try {
    return run();
  } finally {
    currentContext = previous;
  }
}
