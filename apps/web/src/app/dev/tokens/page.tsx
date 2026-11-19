import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { CssVarValue } from "./css-var-value";

export const metadata: Metadata = { title: "Design tokens" };

const CORE_COLOURS = [
  { name: "paper", role: "App background" },
  { name: "sheet", role: "Raised surfaces" },
  { name: "sheet-2", role: "Popovers and menus" },
  { name: "muted", role: "Quiet fills, inline code" },
  { name: "ink", role: "Primary text and icons" },
  { name: "graphite", role: "Secondary text" },
  { name: "rule", role: "Borders and dividers" },
  { name: "primary", role: "Actions, links, focus" },
  { name: "accent", role: "Selected and hover fills" },
  { name: "marker", role: "Source evidence only" },
];

const STATUS_COLOURS: { name: string; word: string; Icon: LucideIcon }[] = [
  { name: "success", word: "Ready", Icon: CircleCheck },
  { name: "warning", word: "Partly indexed", Icon: TriangleAlert },
  { name: "danger", word: "Failed", Icon: CircleAlert },
  { name: "info", word: "Note", Icon: Info },
];

const DIAGRAM_NODES = ["Query", "Key", "Value", "Softmax", "Output"];

const TYPE_ROLES = [
  { className: "text-display", label: "display · 48/54", sample: "Understand any paper" },
  { className: "text-h1", label: "h1 · 32/40", sample: "Attention is all you need" },
  { className: "text-h2", label: "h2 · 24/32", sample: "How multi-head attention works" },
  { className: "text-h3", label: "h3 · 19/28", sample: "Scaled dot-product attention" },
  {
    className: "text-body-read measure",
    label: "body-read · 17/29 · Literata",
    sample:
      "Each head looks at the sentence from a different angle. One may track which word a pronoun refers to; another follows the verb and its object. Their outputs are joined into one view.",
  },
  { className: "text-body", label: "body · 15/24", sample: "Ask anything about your sources." },
  { className: "text-small", label: "small · 13/20", sample: "12 pages, added 2 hours ago" },
  {
    className: "text-code",
    label: "code · 14/22 · JetBrains Mono",
    sample: "(batch, seq, d_model)",
  },
];

const RADII = [
  { className: "rounded-xs", name: "xs · 4px", use: "Tags, citation chips, kbd" },
  { className: "rounded-sm", name: "sm · 8px", use: "Buttons, inputs, menu items" },
  { className: "rounded-md", name: "md · 12px", use: "Cards, message bubbles" },
  { className: "rounded-lg", name: "lg · 16px", use: "Panels, dialogs, composer" },
  { className: "rounded-full", name: "full", use: "Avatars, toggles, status dots" },
];

const SHADOWS = [
  { className: "shadow-1", name: "shadow-1", use: "Cards at rest" },
  { className: "shadow-2", name: "shadow-2", use: "Popovers, hover lift" },
  { className: "shadow-3", name: "shadow-3", use: "Dialogs, command palette" },
];

const DURATIONS = ["dur-instant", "dur-fast", "dur-base", "dur-slow", "dur-draw"];

const EASINGS = [
  { className: "ease-out", name: "ease-out", use: "Things arriving" },
  { className: "ease-in", name: "ease-in", use: "Things leaving (shorter durations)" },
  { className: "ease-inout", name: "ease-inout", use: "Things moving across" },
  { className: "ease-spring", name: "spring", use: "Small confirmations only" },
];

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-12 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-ink">Design tokens</h1>
        <p className="measure text-body text-graphite">
          Every TensorLM token from the design skill, in light and dark. Hover or focus a motion row
          to play it.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <ThemeColumn theme="light" title="Light" />
        <ThemeColumn theme="dark" title="Dark" />
      </div>
    </main>
  );
}

function ThemeColumn({ theme, title }: { theme: "light" | "dark"; title: string }) {
  return (
    <section
      aria-labelledby={`${theme}-title`}
      className={`${theme} flex min-w-0 flex-col gap-12 rounded-lg border border-rule bg-paper p-4 text-ink md:p-8`}
    >
      <h2 id={`${theme}-title`} className="text-h2">
        {title}
      </h2>

      <Group title="Colour">
        <div className="grid gap-4 sm:grid-cols-2">
          {CORE_COLOURS.map(({ name, role }) => (
            <Swatch key={name} name={name} role={role} />
          ))}
        </div>
      </Group>

      <Group title="Status" note="Always an icon and a word, never colour alone.">
        <div className="grid gap-4 sm:grid-cols-2">
          {STATUS_COLOURS.map(({ name, word, Icon }) => (
            <div key={name} className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-10 shrink-0 rounded-sm border border-rule"
                style={{ background: `var(--${name})` }}
              />
              <div className="flex min-w-0 flex-col">
                <span
                  className="flex items-center gap-1 text-small font-medium"
                  style={{ color: `var(--${name})` }}
                >
                  <Icon aria-hidden className="size-4" />
                  {word}
                </span>
                <span className="text-small text-graphite">
                  {name} · <CssVarValue name={name} className="font-mono" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group
        title="Diagram palette"
        note="In this order, five series at most. Nodes: 12% fill, 1.5px stroke, ink labels."
      >
        <div className="flex flex-wrap gap-3">
          {DIAGRAM_NODES.map((label, i) => (
            <div key={label} className="flex flex-col gap-1">
              <span
                className="rounded-sm border-[1.5px] px-3 py-2 text-small font-medium text-ink"
                style={{
                  borderColor: `var(--chart-${i + 1})`,
                  backgroundColor: `color-mix(in oklab, var(--chart-${i + 1}) 12%, transparent)`,
                }}
              >
                {label}
              </span>
              <span className="text-small text-graphite">
                {i + 1} · <CssVarValue name={`chart-${i + 1}`} className="font-mono" />
              </span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Source evidence" note="Marker behind ink, only for text from the user's files.">
        <p className="measure text-body-read">
          The model relies on{" "}
          <mark className="rounded-xs bg-highlight box-decoration-clone px-1 text-ink">
            scaled dot-product attention
          </mark>
          , which divides the scores by the square root of the key size.
        </p>
      </Group>

      <Group title="Type">
        <div className="flex flex-col gap-6">
          {TYPE_ROLES.map(({ className, label, sample }) => (
            <div key={label} className="flex min-w-0 flex-col gap-1">
              <span className="text-small text-graphite">{label}</span>
              <span className={`${className} break-words`}>{sample}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Radius">
        <div className="flex flex-wrap gap-6">
          {RADII.map(({ className, name, use }) => (
            <div key={name} className="flex w-32 flex-col gap-2">
              <span aria-hidden className={`${className} size-16 border border-rule bg-sheet`} />
              <span className="text-small font-medium">{name}</span>
              <span className="text-small text-graphite">{use}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group
        title="Depth"
        note="Dark mode uses a surface step and a rule border instead of shadow."
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {SHADOWS.map(({ className, name, use }) => (
            <div
              key={name}
              className={`${className} flex h-24 flex-col justify-end gap-1 rounded-md border border-rule bg-sheet p-4`}
            >
              <span className="text-small font-medium">{name}</span>
              <span className="text-small text-graphite">{use}</span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Motion" note="Transform and opacity only. Exits run at about 70% of entrances.">
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {DURATIONS.map((name) => (
            <div key={name} className="flex items-baseline gap-2">
              <dt className="text-small font-medium">{name}</dt>
              <dd className="text-small font-mono text-graphite tabular-nums">
                <CssVarValue name={name} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-2">
          {EASINGS.map(({ className, name, use }) => (
            <button
              key={name}
              type="button"
              className="group flex flex-wrap items-center gap-4 rounded-sm py-2 text-left"
            >
              <span className="flex w-40 flex-col">
                <span className="text-small font-medium">{name}</span>
                <span className="text-small text-graphite">{use}</span>
              </span>
              <span aria-hidden className="relative h-4 w-48 rounded-full bg-muted">
                <span
                  className={`${className} absolute top-0 left-0 size-4 rounded-full bg-primary transition-transform duration-(--dur-slow) group-hover:translate-x-44 group-focus-visible:translate-x-44`}
                />
              </span>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Textures and AI states">
        <div className="graph-paper flex h-40 items-end rounded-md border border-rule p-4">
          <span className="text-small text-graphite">
            Graph paper: diagram canvas, empty notebook
          </span>
        </div>
        <p className="shimmer text-body font-medium">Reading 3 sources…</p>
      </Group>
    </section>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-h3">{title}</h3>
        {note && <p className="text-small text-graphite">{note}</p>}
      </div>
      {children}
    </div>
  );
}

function Swatch({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="size-10 shrink-0 rounded-sm border border-rule"
        style={{ background: `var(--${name})` }}
      />
      <div className="flex min-w-0 flex-col">
        <span className="text-small font-medium">{name}</span>
        <span className="text-small text-graphite">
          {role} · <CssVarValue name={name} className="font-mono" />
        </span>
      </div>
    </div>
  );
}
