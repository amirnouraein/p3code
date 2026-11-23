import type { EnvironmentId } from "@t3tools/contracts";
import { resolvePathLinkTarget } from "@t3tools/shared/fileLinks";
import { maskMarkdownFrontmatter } from "@t3tools/shared/markdownFrontmatter";
import { useGT } from "gt-react";
import { ChevronDownIcon, ChevronUpIcon, MessageSquarePlusIcon, XIcon } from "lucide-react";
import {
  Fragment,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { MarkdownExtensions } from "../../markdown/wordsHast";
import ChatMarkdown from "../ChatMarkdown";
import { RenderErrorBoundary } from "../RenderErrorBoundary";
import { Button } from "../ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/input-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "~/lib/utils";
import {
  markdownPreviewBlockForLine,
  markdownPreviewCommentRange,
  markdownPreviewBlock,
  type MarkdownPreviewBlock,
} from "./pullRequestMarkdownPreview.logic";

const PREVIEW_EXTENSIONS: MarkdownExtensions = { wrapBlock: markdownPreviewBlock };
const FIND_HIGHLIGHT = "t3-markdown-find";
const FIND_ACTIVE_HIGHLIGHT = "t3-markdown-find-active";

/** Case-insensitive matches of `query` in the text under `root`. */
// ponytail: matches within one text node, so a match across `a **b**` is missed; join a block's text nodes if that matters.
function findRanges(root: HTMLElement, query: string): Range[] {
  const needle = query.toLocaleLowerCase();
  if (needle.length === 0) return [];
  const ranges: Range[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = (node.nodeValue ?? "").toLocaleLowerCase();
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
      const range = root.ownerDocument.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + needle.length);
      ranges.push(range);
    }
  }
  return ranges;
}

interface FindState {
  readonly query: string;
  readonly active: number;
  /** Bumped by each find shortcut, so an open bar refocuses its input. */
  readonly focus: number;
}

export interface MarkdownPreviewAnnotation {
  readonly key: string;
  readonly side: "additions" | "deletions";
  readonly line: number;
  readonly content: ReactNode;
}

interface MarkdownPreviewProps {
  readonly contents: Promise<string>;
  readonly path: string;
  readonly cwd: string;
  readonly environmentId: EnvironmentId;
  readonly repository: string;
  readonly annotations: ReadonlyArray<MarkdownPreviewAnnotation>;
  /** Absent when this viewer cannot start a comment here. */
  readonly inDiff?: ((line: number) => boolean) | undefined;
  readonly onComment: (range: { readonly start: number; readonly end: number }) => void;
}

export function PullRequestMarkdownPreview(props: MarkdownPreviewProps) {
  const gt = useGT();
  return (
    <RenderErrorBoundary
      resetKeys={[props.contents]}
      fallback={
        <p className="px-6 py-5 text-xs text-muted-foreground">
          {gt("The preview could not be loaded.")}
        </p>
      }
    >
      <Suspense
        fallback={
          <p className="px-6 py-5 text-xs text-muted-foreground">{gt("Loading preview...")}</p>
        }
      >
        <MarkdownPreviewBody {...props} />
      </Suspense>
    </RenderErrorBoundary>
  );
}

interface MountedBlock extends MarkdownPreviewBlock {
  readonly slot: HTMLElement;
}

function MarkdownPreviewBody(props: MarkdownPreviewProps) {
  const gt = useGT();
  const text = use(props.contents);
  const [blocks, setBlocks] = useState<ReadonlyArray<MountedBlock> | null>(null);
  const [find, setFind] = useState<FindState | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const markdownRef = useRef<HTMLDivElement | null>(null);
  const bindRoot = (node: HTMLDivElement | null) => {
    markdownRef.current = node;
    if (node === null) return;
    const found = [...node.querySelectorAll<HTMLElement>("[data-source-start]")].flatMap(
      (element) => {
        const slot = element.querySelector<HTMLElement>(":scope > [data-preview-slot]");
        return slot === null
          ? []
          : [
              {
                start: Number(element.dataset.sourceStart),
                end: Number(element.dataset.sourceEnd),
                slot,
              },
            ];
      },
    );
    setBlocks((current) =>
      current !== null &&
      current.length === found.length &&
      current.every((block, index) => block.slot === found[index]?.slot)
        ? current
        : found,
    );
  };

  const leading: ReactNode[] = [];
  const byBlock = new Map<MountedBlock, ReactNode[]>();
  // Annotations wait for the blocks, so a composer never mounts twice and loses its text.
  for (const annotation of blocks === null ? [] : props.annotations) {
    const block =
      annotation.side === "additions"
        ? markdownPreviewBlockForLine(blocks ?? [], annotation.line)
        : null;
    const content = <Fragment key={annotation.key}>{annotation.content}</Fragment>;
    if (block === null) leading.push(content);
    else byBlock.set(block, [...(byBlock.get(block) ?? []), content]);
  }
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- paints CSS Highlight ranges over the rendered DOM for the find query and clears them on close
  useEffect(() => {
    const root = markdownRef.current;
    if (find === null || root === null || typeof Highlight === "undefined") return;
    const ranges = findRanges(root, find.query);
    setMatchCount(ranges.length);
    if (ranges.length === 0) return;
    const active = ranges[((find.active % ranges.length) + ranges.length) % ranges.length]!;
    CSS.highlights.set(FIND_HIGHLIGHT, new Highlight(...ranges));
    CSS.highlights.set(FIND_ACTIVE_HIGHLIGHT, new Highlight(active));
    active.startContainer.parentElement?.scrollIntoView({ block: "nearest" });
    return () => {
      CSS.highlights.delete(FIND_HIGHLIGHT);
      CSS.highlights.delete(FIND_ACTIVE_HIGHLIGHT);
    };
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- new text remounts the rendered DOM, whose old ranges would be detached.
  }, [find, text]);
  const openFind = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key.toLowerCase() !== "f" || !(event.metaKey || event.ctrlKey)) return;
    if (event.altKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    setFind((current) => ({
      query: current?.query ?? "",
      active: current?.active ?? 0,
      focus: (current?.focus ?? 0) + 1,
    }));
  };
  const stepFind = (by: number) =>
    setFind((current) => current && { ...current, active: current.active + by });
  const closeFind = () => {
    setFind(null);
    previewRef.current?.focus();
  };
  const onFindKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      stepFind(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeFind();
    }
  };
  const findCount =
    find === null || find.query.length === 0
      ? ""
      : matchCount === 0
        ? "0/0"
        : `${(((find.active % matchCount) + matchCount) % matchCount) + 1}/${matchCount}`;

  const lastSeparator = props.path.lastIndexOf("/");
  const directory = lastSeparator === -1 ? "" : props.path.slice(0, lastSeparator);

  return (
    // Focusable so a click into the text takes Cmd+F here; the desktop app has no find-in-page.
    <div
      ref={previewRef}
      tabIndex={-1}
      data-owns-find=""
      onKeyDown={openFind}
      className="font-sans outline-none"
    >
      {find === null ? null : (
        <div className="sticky top-2 z-20 flex justify-end px-3">
          <InputGroup
            variant="popover"
            size="lg"
            role="search"
            aria-label={gt("Find in page")}
            className="w-[min(22rem,100%)]"
          >
            <InputGroupInput
              key={find.focus}
              autoFocus
              onFocus={(event) => event.currentTarget.select()}
              type="search"
              size="sm"
              value={find.query}
              aria-label={gt("Find in page")}
              placeholder={gt("Find in page")}
              maxLength={200}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setFind({ ...find, query: event.target.value, active: 0 })}
              onKeyDown={onFindKeyDown}
            />
            <InputGroupAddon align="inline-end" inset="pill">
              <span
                aria-live="polite"
                className={cn(
                  "min-w-10 text-center text-xs tabular-nums",
                  findCount === "0/0" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {findCount}
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={gt("Previous match")}
                disabled={matchCount === 0 || find.query.length === 0}
                onClick={() => stepFind(-1)}
              >
                <ChevronUpIcon />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={gt("Next match")}
                disabled={matchCount === 0 || find.query.length === 0}
                onClick={() => stepFind(1)}
              >
                <ChevronDownIcon />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={gt("Close find")}
                onClick={closeFind}
              >
                <XIcon />
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </div>
      )}
      {leading.length > 0 ? <div className="px-3">{leading}</div> : null}
      <div key={text} ref={bindRoot}>
        <ChatMarkdown
          text={maskMarkdownFrontmatter(text)}
          cwd={props.cwd}
          imageBaseDir={directory === "" ? props.cwd : resolvePathLinkTarget(directory, props.cwd)}
          environmentId={props.environmentId}
          sourceControlMedia
          sourceControlMediaRepository={props.repository}
          extensions={PREVIEW_EXTENSIONS}
          className="mx-auto max-w-4xl py-5 pr-6 pl-12 [&>:first-child>:first-child]:mt-0 [&>:last-child>:first-child]:mb-0"
        />
      </div>
      {(blocks ?? []).map((block) => {
        const range = props.inDiff ? markdownPreviewCommentRange(block, props.inDiff) : null;
        return createPortal(
          <>
            {range === null ? null : (
              <span className="absolute top-0 -left-9 opacity-0 transition-opacity group-hover/md-block:opacity-100 has-focus-visible:opacity-100">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        size="icon-xs"
                        variant="outline"
                        aria-label={gt("Comment on this block")}
                        onClick={() => props.onComment(range)}
                      />
                    }
                  >
                    <MessageSquarePlusIcon />
                  </TooltipTrigger>
                  <TooltipPopup side="left">{gt("Comment on this block")}</TooltipPopup>
                </Tooltip>
              </span>
            )}
            {byBlock.get(block)}
          </>,
          block.slot,
          `${block.start}:${block.end}`,
        );
      })}
    </div>
  );
}
