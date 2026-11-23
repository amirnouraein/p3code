# P3 Code: a fork of T3 Code

This repository is **P3 Code**, a personal fork of [T3 Code](https://github.com/pingdotgg/t3code). Everything in [AGENTS.md](AGENTS.md) still applies; this file covers what is different about the fork.

## Branches and remotes

| Remote     | Repository                       | Role                                           |
| ---------- | -------------------------------- | ---------------------------------------------- |
| `origin`   | `github.com/amirnouraein/p3code` | The fork. Push here.                           |
| `upstream` | `github.com/pingdotgg/t3code`    | Upstream T3 Code. Read and merge from it only. |

- **`p3code` is the fork's working branch.** Commit and push to `origin p3code`. Never push to `main`, and don't open pull requests unless asked.
- **The fork syncs by merging, not rebasing.** Upstream's `main` is merged into `p3code` (`Merge branch 'main' into p3code`). Resolve conflicts so that **both** upstream's change and the fork's change survive. Don't drop a fork feature to take upstream's side.
- `apps/server/src/provider/agentContextBudget.json` holds measured values. After a merge, set it to what `AgentContextBudget.test.ts` measures instead of picking one side's numbers.

## What the fork adds over upstream

The list below is every fork commit not in upstream, as of 2026-11-23. Each entry names the files where the change lives, so a merge can check them first.

### Project scripts

- **Background project scripts** (`6d9e94ea16`)
  - **Behaviour:** a script can be set to "Run in the background without a terminal". Its button shows a spinner while it runs (click to stop it), a check on success, and a cross on failure. A failure toast has "Show output", which opens the hidden terminal.
  - **Server:** adds the `terminal.runCommand` RPC. It reuses the setup script runner's completion sentinel, so exit codes are accurate in every shell.
  - **Nushell:** the wrapper uses the shell's starting directory instead of `T3CODE_WORKTREE_PATH`, so it also works outside worktrees.
  - **Removed:** the `.agents/skills` directory. Don't bring it back in a merge.

### Pull request list

- **Several authors and projects in PR filters** (`274ee6acd8`, fix `462352a110`)
  - **Behaviour:** the Author and Project filters are checkbox lists, and a PR matches if it fits any picked author.
  - **Search:** list filters carry `authors`. GitHub searches them with repeated `author:` qualifiers. Other hosts narrow to a single author, or leave the check to the server's row filter.
  - **Compatibility:** old saved views and links with a single `author` or project still load.
  - **Base UI rule:** the Project group label must sit inside a `MenuGroup`, or Base UI throws error #31 and takes the page down.
  - **Files:** `PullRequestListFilters.tsx`, `pullRequestListPreferences.ts`, `pullRequestSavedViews.ts`, `pullRequestProjectAssignment.logic.ts`, `apps/server/src/pullRequest/PullRequestService.ts`.
- **The Pull Requests page keeps its state while a thread is open** (`b5ce2a0c1f`)
  - **Behaviour:** once opened, the page stays mounted but hidden under React `<Activity>`, so the open review, its tab and its scroll position survive opening a thread.
  - **Rendering:** the route `/_chat/pull-requests` has no `component`. The `_chat` layout renders `RetainedPullRequestsPage` instead.
  - **Bundle:** it lazy-loads `PullRequestsPage`, so the page stays out of the layout's bundle.
  - **Merge trap:** if a merge puts `component: PullRequestsPage` back on the route, the page mounts twice.

### Pull request Code tab: Markdown preview

- **Rendered Markdown with review comments** (`cf2986cfbb`, fix `61a6a21cfe`)
  - **Behaviour:** a header toggle on `.md` files renders the file instead of its diff rows. Threads and pending comments show under the block they point to. Hovering a block offers a comment, anchored to the block's last run of changed lines.
  - **Lenient splitting:** the preview cuts the file into blocks with `splitMarkdownBlocks(text, lenient = true)`. Lenient mode does the following:
    - keeps raw HTML blocks together when they run past blank lines;
    - normalises CRLF line endings and a leading BOM without moving line numbers;
    - gives every block the file's link definitions, so reference links resolve.
  - **Streaming chat:** the strict, non-lenient mode is unchanged.
  - **Files:**
    - `PullRequestMarkdownPreview.tsx`
    - `pullRequestMarkdownPreview.logic.ts`
    - `PullRequestCodeTab.tsx`
    - `apps/web/src/components/chat/markdownStreamBlocks.ts`
    - `apps/web/src/markdown/wordsHast.ts`
- **Cmd+F in rendered Markdown** (`60a0575648`, fix `69edc82e6f`)
  - **Behaviour:** clicking into the preview focuses it, and Cmd+F opens a find bar. Matches are highlighted with the CSS Custom Highlight API (`::highlight(t3-markdown-find)` in `index.css`). Enter and Shift+Enter step through matches; Escape closes the bar.
  - **Why the window listener:** the Pierre diff viewer has its own capture-phase Cmd+F search, which only searches diff rows. So the preview claims Cmd+F with a window capture `keydown` listener.
  - **Chat find:** `chat.find` in `ChatView.tsx` skips targets inside `[data-owns-find]`.
  - **Bar placement:** the find bar is portaled to the parent of the nearest scroller. `position: sticky` can't escape the diff viewer's clipping layers.
  - **Why it matters on desktop:** the desktop app has no find-in-page for its main window, so this is the only way to search a rendered file there.

### Pull request Code tab: Ask

- **Ask about selected lines** (`ef3830d146`, `d7112007f5`)
  - **Behaviour:** Ask answers inline. The answer is a dismissible card under the selected lines, instead of the lines being sent to a chat.
  - **Server:** a `pullRequests.ask` RPC runs the review guide model on:
    - the selected lines;
    - the PR's title and description;
    - the whole file as the PR leaves it, when it can be read.
  - **Providers:** adapters without app text generation report Ask as unsupported.
  - **Files:**
    - `PullRequestReviewGuideService.ts`
    - `TextGeneration.ts`
    - `textGenerationPrompts.ts`
    - `packages/contracts/src/pullRequest.ts`
    - `PullRequestReviewAnnotation.tsx`
    - `PullRequestCodeTab.tsx`
    - `docs/user/source-control.md`

## Keeping this file current

When you add a fork feature, add it here: one entry with the commit hash, what it does, and where it lives. When upstream ships something that replaces a fork feature, remove the entry along with the fork code.
