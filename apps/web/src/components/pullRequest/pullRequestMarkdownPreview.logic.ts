import type { Element, ElementContent } from "hast";

export interface MarkdownPreviewBlock {
  readonly start: number;
  readonly end: number;
}

const MARKDOWN_PREVIEW_BLOCK_CLASS = "group/md-block relative";

/** A block that names its source lines and ends in a slot review comments are portaled into. */
export function markdownPreviewBlock(
  children: ElementContent[],
  lines: MarkdownPreviewBlock,
): Element {
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: MARKDOWN_PREVIEW_BLOCK_CLASS.split(" "),
      dataSourceStart: lines.start,
      dataSourceEnd: lines.end,
    },
    children: [
      ...children,
      { type: "element", tagName: "div", properties: { dataPreviewSlot: "" }, children: [] },
    ],
  };
}

/** The block a source line renders in: the last one starting at or before it. */
export function markdownPreviewBlockForLine<T extends MarkdownPreviewBlock>(
  blocks: ReadonlyArray<T>,
  line: number,
): T | null {
  let found: T | null = null;
  for (const block of blocks) {
    if (block.start > line) break;
    found = block;
  }
  return found;
}

/**
 * The lines a comment on a block anchors to: the block's last run of lines the diff shows,
 * since a review comment can only sit on a line in the diff.
 */
export function markdownPreviewCommentRange(
  block: MarkdownPreviewBlock,
  inDiff: (line: number) => boolean,
): { readonly start: number; readonly end: number } | null {
  let end = block.end;
  while (end >= block.start && !inDiff(end)) end -= 1;
  if (end < block.start) return null;
  let start = end;
  while (start > block.start && inDiff(start - 1)) start -= 1;
  return { start, end };
}
