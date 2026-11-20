import { screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";
import type { Citation } from "@/lib/chats/shared";
import { AnswerMarkdown } from "./answer-markdown";
import { CitationContext } from "./citation-chip";

vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), parse: vi.fn(), render: vi.fn(async () => ({ svg: "<svg></svg>" })) } }));

const citation = (n: number, page: number): Citation => ({
  n,
  chunk_id: `c${n}`,
  document_id: "d1",
  document_title: "Attention Is All You Need",
  page_start: page,
  page_end: page,
  bboxes: [{ page, l: 72, t: 90, r: 540, b: 180 }],
  kind: "text",
  figure_id: null,
  section: "3.2 Attention",
  quote_preview: "Multi-head attention allows the model to jointly attend…",
});

function render(text: string, opts: { streaming?: boolean; citations?: Citation[]; onOpen?: (c: Citation) => void } = {}) {
  const citations = opts.citations ?? [citation(1, 4), citation(2, 5), citation(3, 4)];
  return renderUI(
    <CitationContext.Provider value={{ citations, onOpen: opts.onOpen }}>
      <AnswerMarkdown text={text} citationCount={citations.length} streaming={opts.streaming} />
    </CitationContext.Provider>,
  );
}

describe("answer renderer", () => {
  it("renders each directive with its tag text", () => {
    render(":::key-idea\nOne idea.\n:::\n\n:::note\nA note.\n:::\n\n:::important\nCareful.\n:::\n\n:::general\nOutside knowledge.\n:::");
    expect(screen.getByText("Key idea")).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Important")).toBeInTheDocument();
    expect(screen.getByText("Not from your sources")).toBeInTheDocument();
  });

  it("allows one key idea; extras become notes", () => {
    const { container } = render(":::key-idea\nFirst.\n:::\n\n:::key-idea\nSecond.\n:::");
    expect(container.querySelectorAll('[data-directive="key-idea"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-directive="note"]')).toHaveLength(1);
  });

  it("strips raw HTML: no script, no event handlers", () => {
    const { container } = render('Hello <script>alert(1)</script> <img src=x onerror="alert(1)"> [link](javascript:alert(1))');
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it("renders math, and shows broken LaTeX as source instead of crashing", () => {
    const { container } = render("Inline $x^2$ and\n\n$$\n\\frac{QK^T}{\\sqrt{d_k}}\n$$\n\n$$\n\\frac{broken\n$$");
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/couldn't be drawn/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Show LaTeX/ }).length).toBeGreaterThan(0);
  });

  it("turns [n] into chips with page labels, never inside code", async () => {
    const onOpen = vi.fn();
    const { user, container } = render("Heads run in parallel [1, 2]. Code `x[3]` stays. In [2023] too.", { onOpen });
    const chip = screen.getByRole("button", { name: "Source 2: Attention Is All You Need, page 5" });
    expect(container.querySelectorAll('[data-slot="citation-chip"]')).toHaveLength(2);
    expect(screen.getByText("x[3]")).toBeInTheDocument();
    expect(container.textContent).toContain("[2023]");
    await user.click(chip);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ n: 2, page_start: 5 }));
  });

  it("validates chart specs and falls back quietly", () => {
    render('```chart\n{"type":"bar","xKey":"layers","series":["acc"],"data":[{"layers":1,"acc":61},{"layers":2,"acc":75}]}\n```\n\n```chart\n{"type":"pie"}\n```');
    expect(screen.getByRole("button", { name: "View data" })).toBeInTheDocument();
    expect(screen.getByText(/Couldn't draw this chart/)).toBeInTheDocument();
  });

  it("puts worked examples in a card", () => {
    const { container } = render("## Worked example\n\n1. Take $h = 8$.\n2. Then $d_k = 64$.");
    expect(container.querySelector("section[data-worked] ol")).not.toBeNull();
  });

  it("holds back an unfinished diagram while streaming", () => {
    const { container } = render("Intro [1].\n\n```mermaid\nflowchart LR\n  A --> B", { streaming: true });
    expect(screen.getByText("Drawing a diagram…")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="diagram-card"]')).toBeNull();
  });

  it("renders the three example answers from the spec, accessibly", async () => {
    const examples = readFileSync(path.resolve(process.cwd(), "../../docs/specs/answers.examples.md"), "utf8");
    const { container } = render(examples.split("## Beginner")[1]);
    expect(container.querySelector('[data-slot="diagram-card"]')).not.toBeNull();
    expect(screen.getAllByText("Not from your sources").length).toBeGreaterThan(0);
    await expectNoAxeViolations(container);
  });
});
