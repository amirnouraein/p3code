import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { create } from "zustand";

export interface BackgroundScriptRun {
  readonly status: "running" | "stopping" | "succeeded" | "failed";
  readonly terminalId: string;
}

interface BackgroundScriptRunState {
  readonly runs: Readonly<Record<string, BackgroundScriptRun>>;
}

export const useBackgroundScriptRunStore = create<BackgroundScriptRunState>(() => ({ runs: {} }));

export function backgroundScriptRunKey(threadRef: ScopedThreadRef, scriptId: string): string {
  return `${scopedThreadKey(threadRef)}\u0000${scriptId}`;
}

export function readBackgroundScriptRun(key: string): BackgroundScriptRun | undefined {
  return useBackgroundScriptRunStore.getState().runs[key];
}

/** `expectTerminalId` drops writes from a run that a newer run already replaced. */
export function setBackgroundScriptRun(
  key: string,
  run: BackgroundScriptRun | null,
  expectTerminalId?: string,
): void {
  useBackgroundScriptRunStore.setState((state) => {
    const current = state.runs[key];
    if (expectTerminalId !== undefined && current?.terminalId !== expectTerminalId) return state;
    if (run === null) {
      if (!current) return state;
      const { [key]: _removed, ...rest } = state.runs;
      return { runs: rest };
    }
    return { runs: { ...state.runs, [key]: run } };
  });
}
