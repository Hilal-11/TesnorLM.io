import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonsSection } from "./sections/buttons";
import { DataSection } from "./sections/data";
import { DisplaySection } from "./sections/display";
import { InputsSection } from "./sections/inputs";
import { NavigationSection } from "./sections/navigation";
import { OverlaysSection } from "./sections/overlays";
import { SettingsShowcaseSection } from "./sections/settings";

export const metadata: Metadata = { title: "Components" };

const SECTIONS = [
  { id: "buttons", label: "Buttons" },
  { id: "inputs", label: "Inputs" },
  { id: "display", label: "Display" },
  { id: "overlays", label: "Overlays" },
  { id: "navigation", label: "Navigation" },
  { id: "data", label: "Data" },
  { id: "settings", label: "Settings" },
];

export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1600px] gap-12 px-4 py-12 md:px-8">
      <nav
        aria-label="Component families"
        className="sticky top-12 hidden h-fit w-44 shrink-0 lg:block"
      >
        <p className="pb-2 text-small font-medium text-graphite">Components</p>
        <ul className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex h-9 items-center rounded-sm px-3 text-body text-ink interactive hover:bg-cobalt-soft/50"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex min-w-0 flex-1 flex-col gap-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1">Components</h1>
          <p className="measure text-body text-graphite">
            Every TensorLM component in every state, in light and dark. The state tables are static;
            the live examples under them work with mouse, keyboard and touch.
          </p>
          <nav aria-label="Jump to a family" className="pt-2 lg:hidden">
            <ul className="flex flex-wrap gap-2">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex h-8 items-center rounded-sm border border-rule bg-sheet px-3 text-small text-ink"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <ButtonsSection />
        <InputsSection />
        <DisplaySection />
        <OverlaysSection />
        <NavigationSection />
        <DataSection />
        <SettingsShowcaseSection />
      </main>
    </div>
  );
}
