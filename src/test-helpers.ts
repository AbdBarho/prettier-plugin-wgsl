import * as prettier from "prettier";
import { expect } from "vitest";
import plugin from "./index.ts";

export async function fmt(input: string, printWidth: number): Promise<string> {
  const result = await prettier.format(input, {
    parser: "wgsl",
    plugins: [plugin],
    printWidth,
    tabWidth: 2,
  });
  return result;
}

/** Formats `input`, moving its `|` cursor marker to the offset Prettier reports back. */
export async function fmtWithCursor(input: string, printWidth: number): Promise<string> {
  const cursorOffset = input.indexOf("|");
  if (cursorOffset === -1) throw new Error("input must contain a `|` cursor marker");
  if (input.indexOf("|", cursorOffset + 1) !== -1) throw new Error("input must contain exactly one `|` cursor marker");

  const { formatted, cursorOffset: outputOffset } = await prettier.formatWithCursor(
    input.slice(0, cursorOffset) + input.slice(cursorOffset + 1),
    { parser: "wgsl", plugins: [plugin], printWidth, tabWidth: 2, cursorOffset },
  );
  return formatted.slice(0, outputOffset) + "|" + formatted.slice(outputOffset);
}

export async function assertIdempotent(input: string, printWidth: number): Promise<void> {
  const first = await fmt(input, printWidth);
  const second = await fmt(first, printWidth);
  expect(second, `Idempotency failed at printWidth=${printWidth}`).toBe(first);
}

const IDEMPOTENCY_WIDTHS = [20, 40, 80, 120, 200] as const;

export async function assertIdempotentAtAllWidths(input: string): Promise<void> {
  for (const w of IDEMPOTENCY_WIDTHS) {
    await assertIdempotent(input, w);
  }
}
