/**
 * Precomputed blank-line info for preserving intentional blank lines in output.
 *
 * Instead of a per-character offset→line lookup (Uint32Array of text.length),
 * we store only the starting offset of each line. To find which line a given
 * source offset falls on, we binary-search `lineStarts` — O(log L) per query
 * where L = number of lines, vs O(1) before but with O(N) memory where N = chars.
 *
 * `blankLines` is the set of 1-based line numbers whose content is whitespace-only.
 */
export interface BlankLineInfo {
  lineStarts: number[];
  blankLines: Set<number>;
}

/**
 * Scan source text once to build blank-line metadata.
 *
 * Walks every character looking for '\n'. For each line boundary, checks whether
 * the line was blank by scanning its characters directly (no substring allocation).
 * Whitespace characters: space (32), tab (9), carriage return (13).
 *
 * Result: `lineStarts[i]` is the character offset where (1-based) line `i+1` begins.
 */
export function buildBlankLineInfo(text: string): BlankLineInfo {
  const lineStarts: number[] = [0]; // lineStarts[0] = 0 → line 1 starts at offset 0
  const blankLines = new Set<number>();
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      const lineNum = lineStarts.length; // the line that just ended (1-based)
      // Check if the line is blank: scan from its start to '\n', looking for non-whitespace
      let blank = true;
      for (let j = lineStarts[lineNum - 1]; j < i; j++) {
        const c = text.charCodeAt(j);
        if (c !== 32 && c !== 9 && c !== 13) {
          blank = false;
          break;
        }
      }
      if (blank) blankLines.add(lineNum);
      lineStarts.push(i + 1); // next line starts after the '\n'
    }
  }
  return { lineStarts, blankLines };
}

/**
 * Binary-search `lineStarts` to find the 1-based line number for a character offset.
 *
 * `lineStarts` is sorted ascending (each entry is where a new line begins).
 * We find the rightmost entry ≤ offset — that entry's index + 1 is the line number.
 */
export function offsetToLine(lineStarts: number[], offset: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1; // 1-based
}
