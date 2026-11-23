import { useMatches } from "@tanstack/react-router";
import { Activity, lazy, Suspense, useState } from "react";

// Lazy like the route component it replaces, so the page stays out of the layout's chunk.
const PullRequestsPage = lazy(() =>
  import("./PullRequestsPage").then((module) => ({ default: module.PullRequestsPage })),
);

/** Once opened, the page stays mounted but hidden while other views show, so a review survives a detour. */
export function RetainedPullRequestsPage() {
  const shown = useMatches({
    select: (matches) => matches.some((match) => match.routeId === "/_chat/pull-requests"),
  });
  const [opened, setOpened] = useState(shown);
  if (shown && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Activity mode={shown ? "visible" : "hidden"}>
      <Suspense>
        <PullRequestsPage />
      </Suspense>
    </Activity>
  );
}
