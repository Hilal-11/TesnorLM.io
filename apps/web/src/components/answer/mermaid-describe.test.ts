import { describe, expect, it } from "vitest";
import { describeMermaid, describeText, diagramProblem } from "./mermaid-describe";

describe("describing diagrams from code", () => {
  it("reads a flowchart with labels, chains and edge labels", () => {
    const g = describeMermaid(`flowchart LR
  %% Multi-head attention
  A[Words] --> B[Head 1]
  A --> C(Head 2)
  B -->|concat| E{Join}
  C --> E --> F[Output]`);
    expect(g.kind).toBe("flowchart");
    expect(g.title).toBe("Multi-head attention");
    expect(g.nodes.map((n) => n.label)).toEqual(["Words", "Head 1", "Head 2", "Join", "Output"]);
    expect(describeText(g).connections).toEqual([
      "Words → Head 1",
      "Words → Head 2",
      "Head 1 → Join (concat)",
      "Head 2 → Join",
      "Join → Output",
    ]);
  });

  it("reads a sequence diagram", () => {
    const g = describeMermaid(`sequenceDiagram
  participant E as Encoder
  participant D as Decoder
  E->>D: context vectors
  D-->>E: attention query`);
    expect(g.kind).toBe("sequence");
    expect(describeText(g)).toEqual({
      nodes: ["Encoder", "Decoder"],
      connections: ["Encoder → Decoder (context vectors)", "Decoder → Encoder (attention query)"],
    });
  });

  it("refuses diagram types outside the contract", () => {
    expect(diagramProblem("pie\n  \"a\": 1", ["flowchart", "graph", "sequenceDiagram"], 12)).toMatch(/Only/);
    expect(diagramProblem("flowchart TD\n A-->B", ["flowchart", "graph", "sequenceDiagram"], 12)).toBeNull();
  });
});
