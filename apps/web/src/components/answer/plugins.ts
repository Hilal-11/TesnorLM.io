/**
 * Markdown plugins for answers (docs/specs/answers.md §4–5):
 * - citations: "[1, 2]" in prose → <sup data-cite="1,2"> (never inside code or math)
 * - directives: :::key-idea / note / important / general → <aside data-directive>; the second
 *   key idea becomes a note; unknown directives become plain paragraphs
 * - worked examples: a "Worked example" heading + the list after it → <section data-worked>
 * - streaming: unfinished fences and display math are held back until they close
 */
import type { Root as MdRoot, Text, PhrasingContent } from "mdast";
import type { Root as HRoot, Element, ElementContent } from "hast";
import { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import { visit, SKIP } from "unist-util-visit";
import { expandGroup } from "@/lib/answers/citations";
import { DIRECTIVES } from "@/lib/answers/format";

const CITE = /\[(\d{1,4}(?:\s*(?:,|–|-|—)\s*\d{1,4})*)\]/g;

/** [n] → <sup data-cite>, only for numbers that are real citations of this answer. */
export function remarkCitations(options: { max: number }) {
  return (tree: MdRoot) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined || !CITE.test(node.value)) return;
      CITE.lastIndex = 0;
      const out: PhrasingContent[] = [];
      let last = 0;
      for (const m of node.value.matchAll(CITE)) {
        const nums = expandGroup(m[1]).filter((n) => n >= 1 && n <= options.max);
        if (nums.length === 0) continue;
        if (m.index > last) out.push({ type: "text", value: node.value.slice(last, m.index) });
        out.push({
          type: "text",
          value: "",
          data: { hName: "sup", hProperties: { dataCite: nums.join(",") } },
        } as Text);
        last = m.index + m[0].length;
      }
      if (out.length === 0) return;
      if (last < node.value.length) out.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...out);
      return [SKIP, index + out.length];
    });
  };
}

type DirectiveNode = {
  type: "containerDirective" | "leafDirective" | "textDirective";
  name: string;
  children: unknown[];
  data?: Record<string, unknown>;
};

export function remarkAnswerDirectives() {
  return (tree: MdRoot) => {
    let keyIdeas = 0;
    visit(tree, (node) => {
      const d = node as unknown as DirectiveNode;
      if (d.type !== "containerDirective" && d.type !== "leafDirective" && d.type !== "textDirective") return;
      let name = d.name;
      if (name === "key-idea" && ++keyIdeas > DIRECTIVES["key-idea"].max) name = "note";
      const known = d.type === "containerDirective" && name in DIRECTIVES;
      d.data = known
        ? { hName: "aside", hProperties: { dataDirective: name } }
        : { hName: d.type === "textDirective" ? "span" : "div" };
    });
  };
}

const text = (el: ElementContent): string =>
  el.type === "text" ? el.value : el.type === "element" ? el.children.map(text).join("") : "";

export function rehypeWorkedExamples() {
  return (tree: HRoot) => {
    visit(tree, (node) => {
      if (node.type !== "root" && node.type !== "element") return;
      // Never look inside a card that was just made (it holds the same heading + list).
      if (node.type === "element" && node.tagName === "section" && node.properties?.dataWorked) return SKIP;
      const kids = (node as Element | HRoot).children as ElementContent[];
      for (let i = 0; i < kids.length; i += 1) {
        const h = kids[i];
        if (h.type !== "element" || !/^h[2-4]$/.test(h.tagName)) continue;
        if (!/^worked example/i.test(text(h).trim())) continue;
        let j = i + 1;
        while (j < kids.length && kids[j].type === "text" && text(kids[j]).trim() === "") j += 1;
        const list = kids[j];
        if (!list || list.type !== "element" || list.tagName !== "ol") continue;
        const section: Element = {
          type: "element",
          tagName: "section",
          properties: { dataWorked: "true" },
          children: [h, list],
        };
        kids.splice(i, j - i + 1, section);
      }
    });
  };
}

/** Sanitizing allow-list: GitHub-style defaults plus exactly what the renderer understands. */
export const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "aside", "section", "sup"],
  clobberPrefix: "",
  attributes: {
    ...defaultSchema.attributes,
    aside: ["dataDirective"],
    section: ["dataWorked"],
    sup: ["dataCite"],
    code: [["className", /^language-[\w-]+$/, "math-inline", "math-display"]],
    span: [],
    div: [],
  },
};

/**
 * While streaming: an unclosed ``` fence or $$ block is cut off and reported, so half a diagram,
 * chart or formula never renders (the block appears once it closes; a placeholder keeps its room).
 */
export function streamingSafe(markdown: string): { text: string; pending: null | "diagram" | "chart" | "code" | "math" } {
  const fences = [...markdown.matchAll(/^```(\w*)/gm)];
  if (fences.length % 2 === 1) {
    const open = fences.at(-1)!;
    const lang = open[1];
    return {
      text: markdown.slice(0, open.index),
      pending: lang === "mermaid" ? "diagram" : lang === "chart" ? "chart" : "code",
    };
  }
  const displays = [...markdown.matchAll(/\$\$/g)];
  if (displays.length % 2 === 1) return { text: markdown.slice(0, displays.at(-1)!.index), pending: "math" };
  return { text: markdown, pending: null };
}
