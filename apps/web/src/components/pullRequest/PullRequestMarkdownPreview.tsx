import type { EnvironmentId } from "@t3tools/contracts";
import { resolvePathLinkTarget } from "@t3tools/shared/fileLinks";
import { maskMarkdownFrontmatter } from "@t3tools/shared/markdownFrontmatter";
import { useGT } from "gt-react";
import { MessageSquarePlusIcon } from "lucide-react";
import { Fragment, Suspense, use, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PluggableList } from "unified";

import ChatMarkdown from "../ChatMarkdown";
import { RenderErrorBoundary } from "../RenderErrorBoundary";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  markdownPreviewBlockForLine,
  markdownPreviewCommentRange,
  rehypeMarkdownPreviewBlocks,
  type MarkdownPreviewBlock,
} from "./pullRequestMarkdownPreview.logic";

const PREVIEW_REHYPE_PLUGINS: PluggableList = [rehypeMarkdownPreviewBlocks];

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
  const bindRoot = (node: HTMLDivElement | null) => {
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
  const lastSeparator = props.path.lastIndexOf("/");
  const directory = lastSeparator === -1 ? "" : props.path.slice(0, lastSeparator);

  return (
    <div className="font-sans">
      {leading.length > 0 ? <div className="px-3">{leading}</div> : null}
      <div key={text} ref={bindRoot}>
        <ChatMarkdown
          text={maskMarkdownFrontmatter(text)}
          cwd={props.cwd}
          imageBaseDir={directory === "" ? props.cwd : resolvePathLinkTarget(directory, props.cwd)}
          environmentId={props.environmentId}
          sourceControlMedia
          sourceControlMediaRepository={props.repository}
          extraRehypePlugins={PREVIEW_REHYPE_PLUGINS}
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
