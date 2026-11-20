/** Diagram repair (lib/answers/repair.ts): ownership, fast-model reply checks, saving the fix. */
import { MockLanguageModelV4 } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";
import { repairDiagram, saveRepair } from "@/lib/answers/repair";
import * as chats from "@/lib/chats/server";
import { admin, must, person, type Person } from "./support";

let A: Person;
let B: Person;
let messageId = "";
const broken = "flowchart LR\n  A[Words (input)] --> B";
const fixed = "flowchart LR\n  A[Words input] --> B";

const reply = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: undefined },
      },
      warnings: [],
    }),
  });

beforeAll(async () => {
  A = await person("repa");
  B = await person("repb");
  const notebook = must(
    await A.client.from("notebooks").insert({ user_id: A.user.id, title: "Diagrams" }).select("id").single(),
  ).id;
  const chat = await chats.createChat(A.client, A.user.id, notebook, "intermediate");
  messageId = must(
    await admin
      .from("messages")
      .insert({ chat_id: chat.id, user_id: A.user.id, role: "assistant", content: `See:\n\n\`\`\`mermaid\n${broken}\n\`\`\`` })
      .select("id")
      .single(),
  ).id;
});

describe("diagram repair", () => {
  it("returns fixed code, without a fence", async () => {
    const code = await repairDiagram(
      { db: A.client, model: reply("```mermaid\n" + fixed + "\n```") },
      { messageId, code: broken, error: "Parse error" },
    );
    expect(code).toBe(fixed);
  });

  it("rejects a reply that isn't an allowed diagram", async () => {
    const code = await repairDiagram(
      { db: A.client, model: reply("pie title x") },
      { messageId, code: broken, error: "Parse error" },
    );
    expect(code).toBeNull();
  });

  it("refuses someone else's message", async () => {
    await expect(
      repairDiagram({ db: B.client, model: reply(fixed) }, { messageId, code: broken, error: "x" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await saveRepair({ db: B.client, admin }, { messageId, from: broken, to: fixed }).catch(() => "no")).toBe("no");
  });

  it("saves the repaired code into the message once", async () => {
    expect(await saveRepair({ db: A.client, admin }, { messageId, from: broken, to: fixed })).toBe(true);
    const row = must(await admin.from("messages").select("content").eq("id", messageId).single());
    expect(row.content).toContain(fixed);
    expect(row.content).not.toContain(broken);
    expect(await saveRepair({ db: A.client, admin }, { messageId, from: broken, to: fixed })).toBe(false);
  });
});
