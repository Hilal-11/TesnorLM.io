"use client";

import { useState, type ReactNode } from "react";
import { PortalContainerProvider } from "@/components/ui/portal-container";
import { cn } from "@/lib/utils";

/** A family's section: name, one-line usage note, then its demos. */
export function ShowcaseSection({
  id,
  title,
  usage,
  children,
}: {
  id: string;
  title: string;
  usage: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      data-shot={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-8 flex-col gap-6"
    >
      <header className="flex flex-col gap-2">
        <h2 id={`${id}-title`} className="text-h2">
          {title}
        </h2>
        <p className="measure text-body text-graphite">{usage}</p>
      </header>
      <ThemeColumns>{children}</ThemeColumns>
    </section>
  );
}

/** Renders the same demos in a light column and a dark column, side by side on wide screens. */
function ThemeColumns({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <ThemeColumn theme="light">{children}</ThemeColumn>
      <ThemeColumn theme="dark">{children}</ThemeColumn>
    </div>
  );
}

function ThemeColumn({ theme, children }: { theme: "light" | "dark"; children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  return (
    <div
      ref={setContainer}
      data-theme-column={theme}
      className={cn(
        theme,
        "flex min-w-0 flex-col gap-8 rounded-lg border border-rule bg-paper p-4 text-ink md:p-6",
      )}
    >
      <p className="text-small font-medium text-graphite">{theme === "light" ? "Light" : "Dark"}</p>
      <PortalContainerProvider value={container}>{children}</PortalContainerProvider>
    </div>
  );
}

/** One demo block inside a column. */
export function Demo({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-h3">{title}</h3>
        {note && <p className="text-small text-graphite">{note}</p>}
      </div>
      <div className={cn("min-w-0", className)}>{children}</div>
    </div>
  );
}

/**
 * Static state matrix: rows = variants, columns = states. Inert, so the forced states can't be
 * focused or clicked; the live examples below each matrix are the interactive ones.
 */
export function StateMatrix({
  columns,
  rows,
}: {
  columns: string[];
  rows: { label: string; cells: ReactNode[] }[];
}) {
  return (
    <div inert className="overflow-x-auto pb-2">
      <table className="border-separate border-spacing-x-0 border-spacing-y-2">
        <thead>
          <tr>
            <th scope="col" className="pr-4 text-left text-small font-medium text-graphite">
              Variant
            </th>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-3 text-left text-small font-medium whitespace-nowrap text-graphite"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th
                scope="row"
                className="pr-4 text-left align-middle text-small font-medium whitespace-nowrap"
              >
                {row.label}
              </th>
              {row.cells.map((cell, i) => (
                <td key={i} className="px-3 py-1 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type DemoState =
  "default" | "hover" | "pressed" | "focus" | "disabled" | "loading" | "error";

/** Props that put a control into a demo state (see the custom variants in globals.css). */
export function forceState(state: DemoState) {
  switch (state) {
    case "hover":
    case "pressed":
    case "focus":
      return { "data-force": state } as const;
    case "disabled":
      return { disabled: true } as const;
    case "loading":
      return { loading: true } as const;
    default:
      return {};
  }
}
