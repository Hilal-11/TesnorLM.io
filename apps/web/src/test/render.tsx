import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Renders inside the app-level providers and returns a user-event instance. */
export function renderUI(
  ui: ReactElement,
  { fakeTimers = false, ...options }: RenderOptions & { fakeTimers?: boolean } = {},
) {
  const user = userEvent.setup(fakeTimers ? { advanceTimers: vi.advanceTimersByTime } : {});
  return {
    user,
    ...render(<TooltipProvider>{ui}</TooltipProvider>, options),
  };
}
