"use client";

import { ChevronLeft, ChevronRight, Download, Maximize2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { IconButton } from "@/components/ui/icon-button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MERMAID } from "@/lib/answers/format";
import { cn } from "@/lib/utils";
import { describeMermaid, describeText, diagramProblem } from "./mermaid-describe";

export type DiagramHandlers = {
  /** One repair attempt (fast model); returns new code or null. */
  onRepair?: (code: string, error: string) => Promise<string | null>;
  /** The repaired code rendered: persist it so it's never repaired again. */
  onRepaired?: (from: string, to: string) => void;
  onOpenCanvas?: (code: string, title: string) => void;
};

// ───────────── Rendering ─────────────

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** a over b at `amount` (mermaid needs real colours, not CSS variables). */
function mix(a: string, b: string, amount: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x * amount + y * (1 - amount)).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

let renderQueue: Promise<unknown> = Promise.resolve();

/** Renders Mermaid code to SVG (lazy import, strict security, colours from the design tokens). */
async function renderMermaid(id: string, code: string) {
  const run = async () => {
    const mermaid = (await import("mermaid")).default;
    const paper = css("--paper") || "#ffffff";
    const ink = css("--ink") || "#09090b";
    const series = css("--chart-1") || "#2563eb";
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: getComputedStyle(document.body).fontFamily,
      flowchart: { htmlLabels: false, curve: "basis" },
      themeVariables: {
        background: paper,
        primaryColor: mix(series, paper, 0.12),
        primaryBorderColor: series,
        primaryTextColor: ink,
        secondaryColor: mix(css("--chart-2") || "#0d9488", paper, 0.12),
        tertiaryColor: mix(css("--chart-3") || "#d97706", paper, 0.12),
        lineColor: mix(ink, paper, 0.7),
        textColor: ink,
        fontSize: "14px",
        actorBkg: mix(series, paper, 0.12),
        actorBorder: series,
        signalColor: mix(ink, paper, 0.7),
        noteBkgColor: mix(css("--chart-3") || "#d97706", paper, 0.12),
      },
    });
    await mermaid.parse(code);
    return (await mermaid.render(id, code)).svg;
  };
  const next = renderQueue.then(run, run); // mermaid renders one diagram at a time
  renderQueue = next.catch(() => undefined);
  return next;
}

// ───────────── Drawing animation (skill 7.2) ─────────────

type Parts = { nodes: SVGGElement[]; edges: SVGPathElement[]; labels: Element[] };

function parts(svg: SVGSVGElement, order: string[]): Parts {
  const nodes = [...svg.querySelectorAll<SVGGElement>("g.node, g.actor, rect.actor")]
    .filter((n) => n instanceof SVGGElement) as SVGGElement[];
  const rank = (el: Element) => {
    const id = el.id || "";
    const i = order.findIndex((name) => new RegExp(`(^|-)${name}(-|$)`).test(id));
    return i === -1 ? 999 : i;
  };
  nodes.sort((a, b) => rank(a) - rank(b));
  const edges = [...svg.querySelectorAll<SVGPathElement>("path.flowchart-link, .edgePaths path, line.messageLine0, line.messageLine1, path.messageLine0, path.messageLine1")] as SVGPathElement[];
  const labels = [...svg.querySelectorAll(".edgeLabels .edgeLabel, .edgeLabel, text.messageText")];
  return { nodes, edges, labels };
}

const length = (el: SVGGeometryElement) => {
  try {
    return el.getTotalLength();
  } catch {
    return 400;
  }
};

/** Shows the first `step` nodes and the edges between shown nodes; animates what's new. */
function applyStep(p: Parts, step: number, animate: boolean) {
  const shown = new Set(p.nodes.slice(0, step));
  p.nodes.forEach((node, i) => {
    const visible = i < step;
    node.style.transition = animate ? `opacity 220ms var(--ease-out) ${(i % 4) * 60}ms, transform 220ms var(--ease-out) ${(i % 4) * 60}ms` : "none";
    node.style.transformBox = "fill-box";
    node.style.transformOrigin = "center";
    node.style.opacity = visible ? "1" : "0";
    node.style.scale = visible ? "1" : "0.92";
  });
  const totalEdges = p.edges.length;
  const edgesShown = p.nodes.length === 0 ? totalEdges : Math.round((totalEdges * shown.size) / Math.max(1, p.nodes.length));
  p.edges.forEach((edge, i) => {
    const visible = i < edgesShown;
    const len = length(edge);
    edge.style.strokeDasharray = `${len}`;
    edge.style.transition = animate ? "stroke-dashoffset 700ms var(--ease-inout)" : "none";
    edge.style.strokeDashoffset = visible ? "0" : `${len}`;
    const marker = edge.getAttribute("marker-end");
    if (marker) edge.dataset.marker = marker;
    if (visible && edge.dataset.marker) edge.setAttribute("marker-end", edge.dataset.marker);
    if (!visible) edge.removeAttribute("marker-end");
  });
  p.labels.forEach((label, i) => {
    (label as HTMLElement).style.transition = animate ? "opacity 220ms var(--ease-out) 400ms" : "none";
    (label as HTMLElement).style.opacity = i < edgesShown ? "1" : "0";
  });
}

// ───────────── Card ─────────────

type State =
  | { kind: "loading" }
  | { kind: "ready"; svg: string }
  | { kind: "repairing" }
  | { kind: "failed" };

/**
 * An inline diagram (skill 10.3): graph paper, title, "Step 2 of 5", Prev / Next / Replay, Open in
 * canvas, Download SVG/PNG and "Describe this diagram". Draws itself node by node, edge by edge;
 * with reduced motion it appears complete. A failed diagram is repaired once, never in a loop.
 */
export function DiagramCard({
  code: initialCode,
  title: fallbackTitle,
  large = false,
  ...handlers
}: DiagramHandlers & { code: string; title?: string; large?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [code, setCode] = useState(initialCode);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [repaired, setRepaired] = useState(false);
  const tried = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const partsRef = useRef<Parts | null>(null);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const graph = useMemo(() => describeMermaid(code), [code]);
  const text = useMemo(() => describeText(graph), [graph]);
  const title = graph.title ?? fallbackTitle ?? "Diagram";
  const totalSteps = Math.max(1, graph.nodes.length);
  const [step, setStep] = useState(totalSteps);

  // Render (and repair once on failure).
  useEffect(() => {
    let live = true;
    const problem = diagramProblem(code, MERMAID.allowed, MERMAID.maxNodes);
    (async () => {
      try {
        if (problem) throw new Error(problem);
        const svg = await renderMermaid(`d${uid}${Math.random().toString(36).slice(2, 7)}`, code);
        if (live) setState({ kind: "ready", svg });
      } catch (err) {
        if (!live) return;
        if (!tried.current && handlers.onRepair) {
          tried.current = true;
          setState({ kind: "repairing" });
          const fixed = await handlers.onRepair(code, err instanceof Error ? err.message.slice(0, 500) : "render failed").catch(() => null);
          if (live && fixed && fixed.trim() !== code.trim()) {
            setRepaired(true);
            setCode(fixed);
            return;
          }
        }
        if (live) setState({ kind: "failed" });
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-render only when the code changes
  }, [code, uid]);

  // Persist a repair once it actually renders.
  useEffect(() => {
    if (repaired && state.kind === "ready") handlers.onRepaired?.(initialCode, code);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per successful repair
  }, [repaired, state.kind]);

  // Attach the SVG and play the drawing.
  useEffect(() => {
    if (state.kind !== "ready" || !host.current) return;
    host.current.innerHTML = state.svg;
    const svg = host.current.querySelector("svg");
    if (!svg) return;
    svg.removeAttribute("height");
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
    const p = parts(svg, graph.nodes.map((n) => n.id));
    partsRef.current = p;
    if (reduced) {
      applyStep(p, p.nodes.length || totalSteps, false);
      return;
    }
    applyStep(p, 0, false);
    let k = 0;
    const timer = setInterval(() => {
      k += 1;
      applyStep(p, k, true);
      setStep(k);
      if (k >= totalSteps) clearInterval(timer);
    }, 380);
    return () => clearInterval(timer);
  }, [state, reduced, graph.nodes, totalSteps]);

  const go = useCallback(
    (to: number) => {
      const next = Math.min(totalSteps, Math.max(1, to));
      setStep(next);
      if (partsRef.current) applyStep(partsRef.current, next, !reduced);
    },
    [totalSteps, reduced],
  );
  const replay = () => {
    if (!partsRef.current) return;
    applyStep(partsRef.current, 0, false);
    let k = 0;
    const timer = setInterval(() => {
      k += 1;
      go(k);
      if (k >= totalSteps) clearInterval(timer);
    }, reduced ? 0 : 380);
  };

  const download = async (kind: "svg" | "png") => {
    const svg = host.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const name = `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "diagram"}.${kind}`;
    let blob = new Blob([xml], { type: "image/svg+xml" });
    if (kind === "png") {
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await img.decode();
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = (svg.viewBox.baseVal.width || img.width) * scale;
      canvas.height = (svg.viewBox.baseVal.height || img.height) * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--paper") || "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  };

  if (state.kind === "failed") {
    return (
      <div data-slot="diagram-card" data-state="failed" className="my-4 rounded-md border border-rule p-3">
        <p className="text-body text-ink">Couldn&apos;t draw this diagram.</p>
        <p className="mb-2 text-small text-graphite">Here is its code; copy it into any Mermaid editor.</p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-sm bg-muted p-3 text-code">{code}</pre>
          <CopyButton value={code} label="Copy diagram code" className="absolute top-2 right-2" />
        </div>
      </div>
    );
  }

  return (
    <figure
      data-slot="diagram-card"
      data-state={state.kind}
      tabIndex={0}
      aria-label={`Diagram: ${title}`}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          go(step >= totalSteps ? 1 : step + 1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(step - 1);
        }
      }}
      className="graph-paper my-4 flex flex-col gap-3 rounded-md border border-rule p-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-h3 text-ink">{title}</span>
        <span className="text-small text-graphite tabular-nums" aria-live="polite">
          Step {Math.min(step, totalSteps)} of {totalSteps}
        </span>
      </figcaption>
      <div
        ref={host}
        aria-hidden
        className={cn("flex min-h-40 items-center justify-center overflow-x-auto", large && "min-h-80")}
      >
        {state.kind !== "ready" && (
          <span className="shimmer text-small">{state.kind === "repairing" ? "Fixing this diagram…" : "Drawing the diagram…"}</span>
        )}
      </div>
      {repaired && state.kind === "ready" && (
        <p className="text-caption text-graphite">Diagram fixed automatically</p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <IconButton icon={ChevronLeft} size="sm" aria-label="Previous step" onClick={() => go(step - 1)} disabled={step <= 1} />
        <IconButton icon={ChevronRight} size="sm" aria-label="Next step" onClick={() => go(step + 1)} disabled={step >= totalSteps} />
        <Button variant="ghost" size="sm" leadingIcon={RotateCcw} onClick={replay}>
          Replay
        </Button>
        <span className="flex-1" />
        {handlers.onOpenCanvas && !large && (
          <Button variant="ghost" size="sm" leadingIcon={Maximize2} onClick={() => handlers.onOpenCanvas?.(code, title)}>
            Open in canvas
          </Button>
        )}
        <Button variant="ghost" size="sm" leadingIcon={Download} onClick={() => void download("svg")}>
          SVG
        </Button>
        <Button variant="ghost" size="sm" leadingIcon={Download} onClick={() => void download("png")}>
          PNG
        </Button>
      </div>
      <details className="text-small">
        <summary className="cursor-pointer text-graphite hover:text-ink">Describe this diagram</summary>
        <div className="mt-2 flex flex-col gap-1 text-ink">
          {text.nodes.length > 0 && <p>Parts: {text.nodes.join(", ")}.</p>}
          {text.connections.length > 0 && (
            <ul className="list-disc pl-5">
              {text.connections.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </figure>
  );
}
