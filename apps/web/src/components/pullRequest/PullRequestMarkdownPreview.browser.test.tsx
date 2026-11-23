import { EnvironmentId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { PullRequestMarkdownPreview } from "./PullRequestMarkdownPreview";

it.each([
  ["plain", "# Title\n\nFirst paragraph.\n\nSecond paragraph.\n"],
  [
    "with HTML, a code span heading and a reference link",
    '<p align="center"><img src="logo.png"></p>\n\n## The `run` command\n\nSee [docs][d].\n\nSecond paragraph.\n\n[d]: https://x.dev\n',
  ],
  ["with CRLF line endings", "# Title\r\n\r\nFirst paragraph.\r\n\r\nSecond paragraph.\r\n"],
])("comments on a rendered block and shows its thread under it, %s", async (_, text) => {
  const onComment = vi.fn();
  const line = text.split("\n").findIndex((row) => row.startsWith("Second")) + 1;
  await using screen = await render(
    <PullRequestMarkdownPreview
      contents={Promise.resolve(text)}
      path="docs/readme.md"
      cwd="/repo"
      environmentId={EnvironmentId.make("local")}
      repository="acme/app"
      annotations={[{ key: `additions:${line}`, side: "additions", line, content: "thread here" }]}
      inDiff={() => true}
      onComment={onComment}
    />,
  );
  await expect.element(screen.getByText("Second paragraph.")).toBeInTheDocument();
  const block = screen.getByText("Second paragraph.").element().closest("[data-source-start]");
  await vi.waitFor(() => expect(block?.textContent).toContain("thread here"));
  expect(block?.textContent).not.toContain("First paragraph");
  const button = block?.querySelector<HTMLElement>("button[aria-label='Comment on this block']");
  await userEvent.click(button!);
  expect(onComment).toHaveBeenCalledWith({ start: line, end: line });
});

it("finds text in the rendered file with Cmd+F", async () => {
  await using screen = await render(
    <PullRequestMarkdownPreview
      contents={Promise.resolve("# Title\n\nFirst paragraph.\n\nSecond paragraph.\n")}
      path="docs/readme.md"
      cwd="/repo"
      environmentId={EnvironmentId.make("local")}
      repository="acme/app"
      annotations={[]}
      onComment={() => {}}
    />,
  );
  await userEvent.click(screen.getByText("Second paragraph."));
  await userEvent.keyboard("{Meta>}f{/Meta}");
  const input = screen.getByRole("searchbox", { name: "Find in page" });
  await expect.element(input).toHaveFocus();
  await userEvent.type(input, "PARAGRAPH");
  await expect.element(screen.getByText("1/2")).toBeInTheDocument();
  expect(CSS.highlights.get("t3-markdown-find")?.size).toBe(2);
  await userEvent.keyboard("{Enter}");
  await expect.element(screen.getByText("2/2")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await expect.element(input).not.toBeInTheDocument();
  expect(CSS.highlights.has("t3-markdown-find")).toBe(false);
});
