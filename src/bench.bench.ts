import { bench } from "vitest";
import * as prettier from "prettier";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { tokenize } from "./tokens.ts";
import { parse } from "./parser.ts";

const source = ["boids.wgsl", "shadow.wgsl", "skybox.wgsl", "water.wgsl"]
  .map((name) => readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", name), "utf-8"))
  .join("\n");

const plugin = (await import("./index.ts")).default;

// 2s warmup for JIT stabilization, 5s measurement for sufficient samples
const opts = { warmupTime: 2000, time: 5000 } as const;

bench("lex", () => {
  tokenize(source);
}, opts);

bench("parse", () => {
  parse(source);
}, opts);

bench("format", async () => {
  await prettier.format(source, {
    parser: "wgsl",
    plugins: [plugin],
    printWidth: 120,
    tabWidth: 2,
  });
}, opts);
