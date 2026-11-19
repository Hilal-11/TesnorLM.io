"use client";

import { Brain, House, MessageCircleQuestion, NotebookPen, UserRound } from "lucide-react";
import Link from "next/link";
import { useKeyboardOpen } from "@/hooks/use-keyboard-open";
import { cn } from "@/lib/utils";
import { isActive } from "./nav";

const TABS = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/notebooks", label: "Notebooks", icon: NotebookPen },
  null, // Ask, the centre action
  { href: "/app/quizzes", label: "Quizzes", icon: Brain },
  { href: "/app/settings", label: "Profile", icon: UserRound },
] as const;

/** Under 768px: Home · Notebooks · Ask · Quizzes · Profile. Hidden while the keyboard is open. */
export function MobileTabBar({ pathname, onAsk }: { pathname: string; onAsk: () => void }) {
  const keyboardOpen = useKeyboardOpen();
  if (keyboardOpen) return null;

  return (
    <nav
      aria-label="Main tabs"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-sheet pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16 grid-cols-5 items-center px-2">
        {TABS.map((tab) =>
          tab === null ? (
            <li key="ask" className="flex justify-center">
              <button
                type="button"
                onClick={onAsk}
                className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2 interactive hover:bg-primary/85 active:scale-94"
              >
                <MessageCircleQuestion aria-hidden className="size-5.5" />
                <span className="sr-only">Ask about your sources</span>
              </button>
            </li>
          ) : (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive(pathname, tab.href) ? "page" : undefined}
                className={cn(
                  "group flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm text-small text-graphite interactive active:scale-94",
                  "aria-[current=page]:font-medium aria-[current=page]:text-ink",
                )}
              >
                <tab.icon aria-hidden className="size-5.5 group-aria-[current=page]:text-primary" />
                {tab.label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
