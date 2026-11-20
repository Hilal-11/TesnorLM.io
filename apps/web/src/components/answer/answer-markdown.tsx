"use client";

import { BookDashed, Info, Lightbulb, TriangleAlert } from "lucide-react";
import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { DIRECTIVES } from "@/lib/answers/format";
import { cn } from "@/lib/utils";
import { ChartBlock } from "./chart-block";
import { CitationChips } from "./citation-chip";
import { CodeBlock } from "./code-block";
import { DiagramCard, type DiagramHandlers } from "./diagram-card";
import { InlineMath, MathBlock } from "./math";
import {
  rehypeWorkedExamples,
  remarkAnswerDirectives,
  remarkCitations,
  sanitizeSchema,
  streamingSafe,
} from "./plugins";

const textOf = (node: ReactNode): string =>
  typeof node === "string" ? node : Array.isArray(node) ? node.map(textOf).join("") : "";

function Directive({ name, children }: { name: string; children: ReactNode }) {
  if (name === "key-idea") {
    return (
      <div role="note" data-directive="key-idea" className="my-4 rounded-r-sm border-l-[3px] border-l-primary bg-subtle px-4 py-3">
        <p className="mb-1 flex items-center gap-1.5 font-sans text-small font-semibold text-ink">
          <Lightbulb aria-hidden className="size-4" /> {DIRECTIVES["key-idea"].label}
        </p>
        <div className="[&>p:last-child]:mb-0">{children}</div>
      </div>
    );
  }
  if (name === "important") {
    return (
      <div role="note" data-directive="important" className="my-4 rounded-r-sm border-l-2 border-l-rule-strong px-4 py-2">
        <p className="mb-1 flex items-center gap-1.5 font-sans text-small font-semibold text-ink">
          <TriangleAlert aria-hidden className="size-4 text-warning" />
          <span className="text-warning-strong">{DIRECTIVES.important.label}</span>
        </p>
        <div className="[&>p:last-child]:mb-0">{children}</div>
      </div>
    );
  }
  if (name === "general") {
    return (
      <div role="note" data-directive="general" className="my-4 rounded-sm border border-dashed border-rule-strong px-4 py-3">
        <p className="mb-1 inline-flex items-center gap-1.5 rounded-xs bg-muted px-1.5 py-0.5 font-sans text-caption font-medium text-graphite">
          <BookDashed aria-hidden className="size-3.5" /> {DIRECTIVES.general.label}
        </p>
        <div className="[&>p:last-child]:mb-0">{children}</div>
      </div>
    );
  }
  return (
    <div role="note" data-directive="note" className="my-4 rounded-r-sm border-l-2 border-l-graphite px-4 py-2">
      <p className="mb-1 flex items-center gap-1.5 font-sans text-small font-semibold text-graphite">
        <Info aria-hidden className="size-4" /> {DIRECTIVES.note.label}
      </p>
      <div className="[&>p:last-child]:mb-0">{children}</div>
    </div>
  );
}

function Placeholder({ kind }: { kind: "diagram" | "chart" | "code" | "math" }) {
  const label = { diagram: "Drawing a diagram…", chart: "Preparing a chart…", code: "Writing code…", math: "Writing a formula…" }[kind];
  return (
    <div
      aria-hidden
      className={cn(
        "my-4 flex items-center justify-center rounded-md border border-dashed border-rule",
        kind === "diagram" || kind === "chart" ? "min-h-40 graph-paper" : "min-h-12",
      )}
    >
      <span className="shimmer text-small">{label}</span>
    </div>
  );
}

type AnswerMarkdownProps = DiagramHandlers & {
  text: string;
  /** Highest citation number that renders as a chip (others stay text). */
  citationCount: number;
  streaming?: boolean;
};

/**
 * An answer in reading type (skill 10.2): sanitized Markdown, directives, citations, math, code,
 * charts and self-drawing diagrams. While streaming, an unfinished block shows a placeholder that
 * keeps its room, so nothing jumps when it closes.
 */
export const AnswerMarkdown = memo(function AnswerMarkdown({
  text,
  citationCount,
  streaming = false,
  ...diagram
}: AnswerMarkdownProps) {
  const { text: safe, pending } = streaming ? streamingSafe(text) : { text, pending: null };

  const components = useMemo<Components>(
    () => ({
      aside: ({ node, children }) => (
        <Directive name={String(node?.properties?.dataDirective ?? "note")}>{children}</Directive>
      ),
      section: ({ node, children }) =>
        node?.properties?.dataWorked ? (
          <section data-worked className="my-4 rounded-md border border-rule bg-sheet p-4 shadow-1 [&_h2]:mt-0 [&_h3]:mt-0 [&_ol]:mb-0">
            {children}
          </section>
        ) : (
          <section>{children}</section>
        ),
      sup: ({ node, children }) => {
        const cite = node?.properties?.dataCite;
        if (!cite) return <sup>{children}</sup>;
        return <CitationChips numbers={String(cite).split(",").map(Number)} />;
      },
      pre: ({ children }) => <>{children}</>,
      code: ({ className, children }) => {
        const source = textOf(children).replace(/\n$/, "");
        const cls = String(className ?? "");
        if (cls.includes("math-display")) return <MathBlock tex={source} />;
        if (cls.includes("math-inline")) return <InlineMath tex={source} />;
        const lang = cls.match(/language-([\w-]+)/)?.[1] ?? null;
        if (lang === "mermaid") return <DiagramCard code={source} {...diagram} />;
        if (lang === "chart") return <ChartBlock source={source} />;
        const block = source.includes("\n") || lang !== null;
        if (!block) {
          return <code className="rounded-xs bg-muted px-1 py-px font-mono text-[0.92em]">{children}</code>;
        }
        return <CodeBlock code={source} language={lang} />;
      },
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="link-underline text-ink">
          {children}
        </a>
      ),
      table: ({ children }) => (
        <div className="my-4 overflow-x-auto">
          <table className="w-full border-collapse font-sans text-small">{children}</table>
        </div>
      ),
    }),
    // Diagram handlers are stable per message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div data-slot="answer" className="answer-prose measure text-body-read text-ink">
      <ReactMarkdown
        remarkPlugins={[
          remarkGfm,
          [remarkMath, { singleDollarTextMath: true }],
          remarkDirective,
          remarkAnswerDirectives,
          [remarkCitations, { max: citationCount }],
        ]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema], rehypeWorkedExamples]}
        components={components}
      >
        {safe}
      </ReactMarkdown>
      {pending && <Placeholder kind={pending} />}
    </div>
  );
});
