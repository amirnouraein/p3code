import type { Element, ElementContent, Root } from "hast";

export interface MarkdownPreviewBlock {
  readonly start: number;
  readonly end: number;
}

const MARKDOWN_PREVIEW_BLOCK_CLASS = "group/md-block relative";

/**
 * Wraps each top-level block in an element that names its source lines and ends in an empty
 * slot, so review comments can be portaled under the block they are anchored to.
 */
export function rehypeMarkdownPreviewBlocks() {
  return (tree: Root) => {
    tree.children = tree.children.map((node) => {
      if (node.type !== "element" || !node.position) return node;
      const { start, end } = node.position;
      const slot: Element = {
        type: "element",
        tagName: "div",
        properties: { dataPreviewSlot: "" },
        children: [],
      };
      return {
        type: "element",
        tagName: "div",
        properties: {
          className: MARKDOWN_PREVIEW_BLOCK_CLASS.split(" "),
          dataSourceStart: start.line,
          dataSourceEnd: end.line,
        },
        children: [node, slot] satisfies ElementContent[],
      } satisfies Element;
    });
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
