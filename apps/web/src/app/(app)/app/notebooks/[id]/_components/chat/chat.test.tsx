import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { expectNoAxeViolations } from "@/test/axe";
import { renderUI } from "@/test/render";
import { Composer } from "./composer";
import { AssistantMessage } from "./message";
import { readChunks, type ThreadMessage } from "./use-chat-stream";

vi.mock("mermaid", () => ({ default: { initialize: vi.fn(), parse: vi.fn(), render: vi.fn(async () => ({ svg: "<svg></svg>" })) } }));
vi.mock("../../chat-actions", () => ({ saveFeedback: vi.fn(async () => ({ ok: true })) }));

function composer(over: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSubmit = vi.fn();
  const view = renderUI(
    <Composer
      level="intermediate"
      onLevel={vi.fn()}
      sources={[
        { id: "11111111-1111-4111-8111-111111111111", title: "Attention Is All You Need.pdf" },
        { id: "22222222-2222-4222-8222-222222222222", title: "BERT.pdf" },
      ]}
      asking={{ k: 2, n: 2 }}
      attachments={[]}
      attachmentTitle={() => "Attention Is All You Need.pdf"}
      onRemoveAttachment={vi.fn()}
      busy={false}
      onSubmit={onSubmit}
      onStop={vi.fn()}
      {...over}
    />,
  );
  return { ...view, onSubmit, box: screen.getByRole("textbox", { name: "Ask a question" }) };
}

const answer = (over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id: "a1",
  role: "assistant",
  text: "Heads run in parallel [1].",
  status: "complete",
  errorCode: null,
  level: "intermediate",
  mode: "full_context",
  command: null,
  citations: [
    {
      n: 1,
      chunk_id: "c1",
      document_id: "d1",
      document_title: "Attention Is All You Need",
      page_start: 4,
      page_end: 4,
      bboxes: [],
      kind: "text",
      figure_id: null,
      section: null,
      quote_preview: "Multi-head attention…",
    },
  ],
  followups: ["Why scale by root d?"],
  parentId: "u1",
  version: 1,
  attachments: [],
  flags: {},
  createdAt: new Date().toISOString(),
  ...over,
});

function assistant(message: ThreadMessage, over: Partial<React.ComponentProps<typeof AssistantMessage>> = {}) {
  const props = {
    message,
    live: null,
    versions: [message],
    onVersion: vi.fn(),
    isLast: true,
    busy: false,
    onRegenerate: vi.fn(),
    onContinue: vi.fn(),
    onFollowup: vi.fn(),
    onOpenCitation: vi.fn(),
    diagram: {},
    ...over,
  };
  return { ...renderUI(<AssistantMessage {...props} />), props };
}

describe("composer", () => {
  it("sends on Enter, adds a line on Shift+Enter", async () => {
    const { user, box, onSubmit } = composer();
    await user.type(box, "What is attention?{Shift>}{Enter}{/Shift}More");
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ message: "What is attention?\nMore" }));
    expect(box).toHaveValue("");
  });

  it("picks a command with / and a source with @", async () => {
    const { user, box, onSubmit } = composer();
    await user.type(box, "/dia");
    expect(screen.getByRole("listbox", { name: "Commands" })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Remove Draw a diagram|Remove/ })).toBeInTheDocument();
    await user.type(box, "how heads combine @ber");
    await user.keyboard("{Enter}");
    expect(screen.getByText("BERT.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Asking 1 chosen source/)).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "diagram",
        message: "how heads combine",
        documentIds: ["22222222-2222-4222-8222-222222222222"],
      }),
    );
  });

  it("shows Stop while an answer streams and is disabled without sources", async () => {
    const onStop = vi.fn();
    const { user } = composer({ busy: true, onStop });
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalled();
  });

  it("is accessible", async () => {
    const { container } = composer({ disabled: true, disabledReason: "Add a source to start asking questions about it." });
    expect(screen.getByRole("textbox")).toBeDisabled();
    await expectNoAxeViolations(container);
  });
});

describe("assistant message", () => {
  it("shows actions, follow-ups and opens citations", async () => {
    const { user, props } = assistant(answer());
    await user.click(screen.getByRole("button", { name: "Source 1: Attention Is All You Need, page 4" }));
    expect(props.onOpenCitation).toHaveBeenCalledWith(expect.objectContaining({ n: 1 }));
    await user.click(screen.getByRole("button", { name: /Why scale by root d/ }));
    expect(props.onFollowup).toHaveBeenCalledWith("Why scale by root d?");
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(props.onRegenerate).toHaveBeenCalled();
  });

  it("offers Continue when stopped and Try again on errors", async () => {
    const stopped = assistant(answer({ status: "stopped", followups: [] }));
    await stopped.user.click(screen.getByRole("button", { name: "Continue" }));
    expect(stopped.props.onContinue).toHaveBeenCalled();
    stopped.unmount();
    assistant(answer({ status: "error", text: "", errorCode: "upstream" }));
    expect(screen.getByRole("alert")).toHaveTextContent("didn't respond");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("switches between versions", async () => {
    const v1 = answer({ id: "a1", version: 1 });
    const v2 = answer({ id: "a2", version: 2 });
    const { user, props } = assistant(v2, { versions: [v1, v2] });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous version" }));
    expect(props.onVersion).toHaveBeenCalledWith("a1");
  });

  it("says when an answer isn't grounded in the sources", () => {
    assistant(answer({ citations: [], text: "In general…", flags: { ungrounded: true } }));
    expect(screen.getByText(/don.t seem to cover this/)).toBeInTheDocument();
  });
});

describe("stream reader", () => {
  it("reads UI message stream chunks across arbitrary splits", async () => {
    const lines = [
      { type: "start" },
      { type: "data-meta", data: { assistantMessageId: "a" } },
      { type: "text-delta", id: "t", delta: "Hel" },
      { type: "text-delta", id: "t", delta: "lo" },
    ]
      .map((c) => `data: ${JSON.stringify(c)}\n\n`)
      .join("") + "data: [DONE]\n\n";
    const bytes = new TextEncoder().encode(lines);
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
        c.close();
      },
    });
    const out = [];
    for await (const chunk of readChunks(body)) out.push(chunk);
    expect(out.map((c) => c.type)).toEqual(["start", "data-meta", "text-delta", "text-delta"]);
    expect(out.filter((c) => c.type === "text-delta").map((c) => c.delta).join("")).toBe("Hello");
  });
});
