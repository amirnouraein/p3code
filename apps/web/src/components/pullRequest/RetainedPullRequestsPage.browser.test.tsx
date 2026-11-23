import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useLocation,
  useSearch,
} from "@tanstack/react-router";
import { createContext, use, useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { act, render } from "../../../test/render";
import { RetainedPullRequestsPage } from "./RetainedPullRequestsPage";

// A context above the page, like the sidebar's, re-renders it while hidden and off its route.
const PathContext = createContext("");

vi.mock(import("./PullRequestsPage"), () => ({
  PullRequestsPage: () => {
    use(PathContext);
    const search = useSearch({ from: "/_chat/pull-requests" });
    const [clicks, setClicks] = useState(0);
    return (
      <button type="button" onClick={() => setClicks(clicks + 1)}>
        {`${search.q} ${clicks}`}
      </button>
    );
  },
}));

it("keeps the pull requests page's state while another route shows", async () => {
  const root = createRootRoute();
  const layout = createRoute({
    getParentRoute: () => root,
    id: "_chat",
    component: () => (
      <PathContext value={useLocation({ select: (location) => location.pathname })}>
        <Outlet />
        <RetainedPullRequestsPage />
      </PathContext>
    ),
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/thread"] }),
    routeTree: root.addChildren([
      layout.addChildren([
        createRoute({
          getParentRoute: () => layout,
          path: "thread",
          component: () => <p>thread</p>,
        }),
        createRoute({
          getParentRoute: () => layout,
          path: "pull-requests",
          validateSearch: (raw: Record<string, unknown>) => ({ q: String(raw.q) }),
        }),
      ]),
    ]),
  });
  await using screen = await render(<RouterProvider router={router} />, { router: false });
  await expect.element(screen.getByText("thread")).toBeInTheDocument();
  expect(screen.container.querySelector("button")).toBeNull();

  await act(() => router.navigate({ href: "/pull-requests?q=first" }));
  await userEvent.click(screen.getByRole("button", { name: "first 0" }));
  await expect.element(screen.getByRole("button", { name: "first 1" })).toBeVisible();

  await act(() => router.navigate({ href: "/thread" }));
  await expect.element(screen.getByText("thread")).toBeInTheDocument();
  await expect.element(screen.getByText("first 1")).not.toBeVisible();

  await act(() => router.navigate({ href: "/pull-requests?q=second" }));
  await expect.element(screen.getByRole("button", { name: "second 1" })).toBeVisible();
});
