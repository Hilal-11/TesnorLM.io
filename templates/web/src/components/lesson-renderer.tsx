"use client";

import { useEffect, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

/** Renders LLM output: markdown + KaTeX math + ```mermaid diagrams + ```chart JSON charts. */
export function LessonRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children }) {
            const lang = /language-(\w+)/.exec(className ?? "")?.[1];
            const code = String(children).replace(/\n$/, "");
            if (lang === "mermaid") return <Mermaid code={code} />;
            if (lang === "chart") return <Chart spec={code} />;
            return <code className={className}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function Mermaid({ code }: { code: string }) {
  const id = "m" + useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      try {
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setFailed(true); // phase 2: ask the model to fix the diagram
      }
    })();
    return () => { cancelled = true; };
  }, [code, id]);

  if (failed) return <pre>{code}</pre>;
  return <div className="my-4 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />;
}

type ChartSpec = {
  type: "line" | "bar";
  xKey: string;
  series: string[];
  data: Record<string, string | number>[];
};

function Chart({ spec }: { spec: string }) {
  let parsed: ChartSpec;
  try {
    parsed = JSON.parse(spec);
  } catch {
    return <pre>{spec}</pre>; // still streaming or invalid JSON
  }
  const Wrapper = parsed.type === "bar" ? BarChart : LineChart;
  return (
    <div className="my-4 h-72 w-full">
      <ResponsiveContainer>
        <Wrapper data={parsed.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={parsed.xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {parsed.series.map((s) =>
            parsed.type === "bar"
              ? <Bar key={s} dataKey={s} />
              : <Line key={s} dataKey={s} type="monotone" dot={false} />,
          )}
        </Wrapper>
      </ResponsiveContainer>
    </div>
  );
}
