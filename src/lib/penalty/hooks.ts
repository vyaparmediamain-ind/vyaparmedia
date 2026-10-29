import type { ViolationCategory } from "./types";

export type ProgressivePenaltyHandler = (
  userId: string,
  category: ViolationCategory,
  reason: string,
  dealId?: string
) => Promise<unknown>;

let progressivePenaltyHandler: ProgressivePenaltyHandler | null = null;

export function registerProgressivePenaltyHandler(handler: ProgressivePenaltyHandler): void {
  progressivePenaltyHandler = handler;
}

export function getProgressivePenaltyHandler(): ProgressivePenaltyHandler | null {
  return progressivePenaltyHandler;
}
