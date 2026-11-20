"use client";

import { ChartLine, Table } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { parseChartSpec, type ChartSpec } from "@/lib/answers/format";

const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const AXIS = { fontSize: 12, fill: "var(--graphite)" };

/** ```chart blocks (skill 10.4): validated JSON, the diagram palette in order, a data table toggle. */
export function ChartBlock({ source }: { source: string }) {
  const spec = useMemo(() => parseChartSpec(source), [source]);
  const [table, setTable] = useState(false);
  if (!spec) {
    return (
      <div role="note" className="my-4 rounded-md border border-rule p-3 text-small text-graphite">
        Couldn&apos;t draw this chart.
        <details className="mt-2">
          <summary className="cursor-pointer text-ink">Show the data</summary>
          <pre className="mt-2 overflow-x-auto text-code">{source}</pre>
        </details>
      </div>
    );
  }
  return (
    <figure data-slot="chart-block" className="my-4 rounded-md border border-rule bg-sheet p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <figcaption className="text-h3 text-ink">{spec.title ?? "Chart"}</figcaption>
        <button
          type="button"
          aria-pressed={table}
          onClick={() => setTable((t) => !t)}
          className="interactive inline-flex h-7 items-center gap-1 rounded-sm px-2 text-small text-graphite hover:bg-muted hover:text-ink"
        >
          {table ? <ChartLine aria-hidden className="size-3.5" /> : <Table aria-hidden className="size-3.5" />}
          {table ? "View chart" : "View data"}
        </button>
      </div>
      {table ? <DataTable spec={spec} /> : <Plot spec={spec} />}
    </figure>
  );
}

function Plot({ spec }: { spec: ChartSpec }) {
  const common = (
    <>
      <CartesianGrid stroke="var(--rule)" strokeOpacity={0.6} vertical={false} />
      <XAxis dataKey={spec.xKey} tick={AXIS} stroke="var(--rule)" label={spec.xLabel ? { value: spec.xLabel, position: "insideBottom", offset: -4, ...AXIS } : undefined} />
      <YAxis tick={AXIS} stroke="var(--rule)" label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: "insideLeft", ...AXIS } : undefined} />
      <Tooltip
        contentStyle={{ background: "var(--sheet-2)", border: "1px solid var(--rule)", borderRadius: 6, fontVariantNumeric: "tabular-nums", fontSize: 13 }}
      />
    </>
  );
  return (
    <div className="h-64 w-full" role="img" aria-label={`${spec.title ?? "Chart"}: ${spec.series.join(", ")} by ${spec.xKey}`}>
      <ResponsiveContainer width="100%" height="100%">
        {spec.type === "bar" ? (
          <BarChart data={spec.data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            {common}
            {spec.series.map((s, i) => (
              <Bar key={s} dataKey={s} fill={SERIES[i]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        ) : spec.type === "scatter" ? (
          <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            {common}
            {spec.series.map((s, i) => (
              <Scatter key={s} data={spec.data} dataKey={s} fill={SERIES[i]} isAnimationActive={false} />
            ))}
          </ScatterChart>
        ) : (
          <LineChart data={spec.data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            {common}
            {spec.series.map((s, i) => (
              <Line key={s} dataKey={s} stroke={SERIES[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function DataTable({ spec }: { spec: ChartSpec }) {
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full text-small tabular-nums">
        <caption className="sr-only">{spec.title ?? "Chart data"}</caption>
        <thead>
          <tr className="border-b border-rule text-left text-graphite">
            <th scope="col" className="py-1 pr-3 font-medium">{spec.xKey}</th>
            {spec.series.map((s) => (
              <th key={s} scope="col" className="py-1 pr-3 font-medium">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.data.map((row, i) => (
            <tr key={i} className="border-b border-rule last:border-0">
              <td className="py-1 pr-3">{String(row[spec.xKey])}</td>
              {spec.series.map((s) => (
                <td key={s} className="py-1 pr-3">{row[s] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
