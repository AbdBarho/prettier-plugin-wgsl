import { test } from "vitest";
import * as prettier from "prettier";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { tokenize } from "./tokens.ts";
import { parse } from "./parser.ts";
import plugin from "./index.ts";

const srcDir = dirname(fileURLToPath(import.meta.url));
const source = ["boids.wgsl", "shadow.wgsl", "skybox.wgsl", "water.wgsl"]
  .map((name) => readFileSync(resolve(srcDir, "fixtures", name), "utf-8"))
  .join("\n")
  .repeat(10);

console.log(`Num chars: ${source.length}, num lines ${source.split("\n").length}`);

const runOptions = { warmupTime: 500, time: 5000 };
// `npm run bench:baseline` records baselines; `npm run bench` compares against them when present
const writeBaseline = process.env.npm_lifecycle_event === "bench:baseline";

const benchmarks: [string, () => unknown][] = [
  ["lex", () => tokenize(source)],
  ["parse", () => parse(source)],
  ["format", () => prettier.format(source, { parser: "wgsl", plugins: [plugin], printWidth: 120, tabWidth: 2 })],
];

for (const [name, fn] of benchmarks) {
  test(name, async ({ bench }) => {
    const baseline = resolve(srcDir, "..", "bench", `${name}.json`);
    if (writeBaseline) {
      await bench(name, { writeResult: baseline }, fn).run(runOptions);
    } else if (existsSync(baseline)) {
      await bench.compare(bench(name, fn), bench.from(`${name} (baseline)`, baseline), runOptions);
    } else {
      await bench(name, fn).run(runOptions);
    }
  });
}
