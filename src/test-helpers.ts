import * as prettier from "prettier";
import { expect } from "vitest";

export async function fmt(input: string, printWidth: number): Promise<string> {
  const result = await prettier.format(input, {
    parser: "wgsl",
    plugins: [(await import("./index.ts")).default],
    printWidth,
    tabWidth: 2,
  });
  return result;
}

export async function assertIdempotent(input: string, printWidth: number): Promise<void> {
  const first = await fmt(input, printWidth);
  const second = await fmt(first, printWidth);
  expect(second).toBe(first);
}

const IDEMPOTENCY_WIDTHS = [40, 80, 120] as const;

export async function assertIdempotentAtAllWidths(input: string): Promise<void> {
  for (const w of IDEMPOTENCY_WIDTHS) {
    await assertIdempotent(input, w);
  }
}
