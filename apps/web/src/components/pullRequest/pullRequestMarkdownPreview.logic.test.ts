import { describe, expect, it } from "vite-plus/test";

import {
  markdownPreviewBlockForLine,
  markdownPreviewCommentRange,
} from "./pullRequestMarkdownPreview.logic";

describe("markdownPreviewBlockForLine", () => {
  const blocks = [
    { start: 3, end: 4 },
    { start: 6, end: 10 },
  ];

  it.each([
    [1, null],
    [3, blocks[0]],
    [5, blocks[0]],
    [10, blocks[1]],
    [40, blocks[1]],
  ])("places line %i", (line, block) => {
    expect(markdownPreviewBlockForLine(blocks, line)).toBe(block);
  });
});

describe("markdownPreviewCommentRange", () => {
  const changed = (lines: ReadonlyArray<number>) => (line: number) => lines.includes(line);

  it.each([
    ["the whole block when it is all in the diff", [1, 2, 3, 4, 5], { start: 2, end: 4 }],
    ["the last run of diff lines", [2, 4], { start: 4, end: 4 }],
    ["a run that ends before the block does", [2, 3], { start: 2, end: 3 }],
    ["nothing when no line is in the diff", [1, 5], null],
  ])("anchors to %s", (_name, lines, range) => {
    expect(markdownPreviewCommentRange({ start: 2, end: 4 }, changed(lines))).toEqual(range);
  });
});
