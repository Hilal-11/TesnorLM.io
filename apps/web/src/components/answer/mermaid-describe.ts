/**
 * Reads a Mermaid flowchart or sequence diagram into nodes and connections, without rendering. Used
 * for "Describe this diagram" (a text alternative built from the code, not by a model) and to
 * order the drawing animation by first mention.
 */
export type DiagramGraph = {
  kind: "flowchart" | "sequence" | "other";
  title: string | null;
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label: string | null }[];
};

const SHAPE = /([A-Za-z][\w-]*)\s*(\[\[|\[\(|\(\(|\[\/|\[\\|\[|\(|\{\{|\{|>)\s*"?([^\]\)\}"]*?)"?\s*(\]\]|\)\]|\)\)|\/\]|\\\]|\]|\)|\}\}|\})/g;
const ARROW = /\s*(?:<-->|<==>|-\.->|-\.-|==>|-->|---|--x|--o|~~~|===)\s*(?:\|([^|]*)\|)?\s*/;

export function describeMermaid(code: string): DiagramGraph {
  const lines = code.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const titleLine = lines.find((l) => l.startsWith("%%"));
  const title = titleLine ? titleLine.replace(/^%%\s*/, "").trim() || null : null;
  const body = lines.filter((l) => !l.startsWith("%%"));
  const header = body[0] ?? "";
  const nodes = new Map<string, string>();
  const edges: DiagramGraph["edges"] = [];
  const touch = (id: string, label?: string) => {
    if (!nodes.has(id) || (label && nodes.get(id) === id)) nodes.set(id, label || nodes.get(id) || id);
  };

  if (/^sequenceDiagram/.test(header)) {
    for (const line of body.slice(1)) {
      const p = line.match(/^participant\s+([\w-]+)(?:\s+as\s+(.+))?$/i) ?? line.match(/^actor\s+([\w-]+)(?:\s+as\s+(.+))?$/i);
      if (p) {
        touch(p[1], p[2]?.trim());
        continue;
      }
      // Participant ids may contain single hyphens ("text-encoder"), never the arrow's "--".
      const m = line.match(/^(\w+(?:-(?!-)\w+)*)\s*-{1,2}[>x)]{1,2}[+-]?\s*(\w+(?:-\w+)*)\s*:\s*(.*)$/);
      if (m) {
        touch(m[1]);
        touch(m[2]);
        edges.push({ from: m[1], to: m[2], label: m[3].trim() || null });
      }
    }
    return { kind: "sequence", title, nodes: [...nodes].map(([id, label]) => ({ id, label })), edges };
  }

  if (!/^(flowchart|graph)\b/.test(header)) return { kind: "other", title, nodes: [], edges: [] };

  for (const raw of body.slice(1)) {
    if (/^(subgraph|end|classDef|class|style|linkStyle|click|direction)\b/.test(raw)) continue;
    // Record labels, then reduce "A[Label]" to "A".
    const line = raw.replace(SHAPE, (_, id: string, _o, label: string) => {
      touch(id, label.trim());
      return id;
    });
    const parts = line.split(ARROW);
    // split with a capture group: [node, edgeLabel, node, edgeLabel, node...]
    const ids: string[] = [];
    const labels: (string | null)[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      if (i % 2 === 0) {
        const id = parts[i]?.trim().split(/[\s&;]+/)[0];
        if (id && /^[A-Za-z][\w-]*$/.test(id)) {
          ids.push(id);
          touch(id);
        }
      } else labels.push(parts[i]?.trim() || null);
    }
    for (let i = 0; i + 1 < ids.length; i += 1) edges.push({ from: ids[i], to: ids[i + 1], label: labels[i] ?? null });
  }
  return { kind: "flowchart", title, nodes: [...nodes].map(([id, label]) => ({ id, label })), edges };
}

/** "Words → Head 1", the sentence list the text alternative shows. */
export function describeText(graph: DiagramGraph) {
  const name = new Map(graph.nodes.map((n) => [n.id, n.label]));
  return {
    nodes: graph.nodes.map((n) => n.label),
    connections: graph.edges.map(
      (e) => `${name.get(e.from) ?? e.from} → ${name.get(e.to) ?? e.to}${e.label ? ` (${e.label})` : ""}`,
    ),
  };
}

/** Basic checks before rendering: allowed diagram type and the node limit. */
export function diagramProblem(code: string, allowed: readonly string[], maxNodes: number) {
  const header = code.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith("%%")) ?? "";
  const type = header.split(/\s+/)[0];
  if (!allowed.includes(type)) return `Only ${allowed.join(", ")} diagrams are supported.`;
  const graph = describeMermaid(code);
  if (graph.nodes.length > maxNodes * 2) return "This diagram has too many parts to draw clearly.";
  return null;
}
