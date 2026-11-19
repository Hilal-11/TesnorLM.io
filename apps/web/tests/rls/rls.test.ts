/**
 * Proof that one person can never read, change or delete another person's data, in any table or
 * in storage, and that signed-out visitors get nothing. Runs against the TEST Supabase project.
 *
 *   npm run test:rls
 *
 * When this fails, fix the POLICY in a new migration — never weaken the test.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL_ = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  throw new Error(
    "RLS tests need TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY and TEST_SUPABASE_SERVICE_ROLE_KEY " +
      "in the repo-root .env.test (a separate test project — see docs/backlog.md P2.7).",
  );
}
if (URL_ === process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error(
    "Refusing to run: TEST_SUPABASE_URL is the main project. Use a separate test project.",
  );
}

/** Every public table must appear here with a test case; the coverage test enforces it. */
const COVERED = [
  "chats",
  "chunks",
  "documents",
  "figures",
  "lessons",
  "messages",
  "notebooks",
  "profiles",
];

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, opts);
const anon = createClient(URL_, ANON, opts);

type Person = { user: User; client: SupabaseClient; email: string };
const ids = {
  notebook: "",
  document: randomUUID(),
  chunk: "",
  figure: "",
  chat: "",
  message: "",
  lesson: "",
};
let A: Person;
let B: Person;
let filePath = "";

async function person(label: string): Promise<Person> {
  const email = `rls-${label}-${randomUUID()}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${label.toUpperCase()}` },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = createClient(URL_!, ANON!, opts);
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { user: data.user, client, email };
}

const must = <T>(res: { data: T; error: unknown }): NonNullable<T> => {
  if (res.error) throw res.error;
  if (res.data === null || res.data === undefined) throw new Error("expected data, got none");
  return res.data as NonNullable<T>;
};

beforeAll(async () => {
  A = await person("a");
  B = await person("b");
  filePath = `${A.user.id}/${ids.document}/test.pdf`;

  ids.notebook = must(
    await A.client
      .from("notebooks")
      .insert({ user_id: A.user.id, title: "A's notebook" })
      .select("id")
      .single(),
  ).id;
  must(
    await A.client.from("documents").insert({
      id: ids.document,
      notebook_id: ids.notebook,
      user_id: A.user.id,
      title: "attention.pdf",
      file_path: filePath,
    }),
  );
  // Chunks and figures are written by the worker with the service role.
  ids.chunk = must(
    await admin
      .from("chunks")
      .insert({
        document_id: ids.document,
        notebook_id: ids.notebook,
        chunk_index: 0,
        content: "A's private passage about attention",
        embedding: JSON.stringify(Array.from({ length: 1536 }, () => 0.01)),
      })
      .select("id")
      .single(),
  ).id;
  ids.figure = must(
    await admin
      .from("figures")
      .insert({ document_id: ids.document, image_path: `${A.user.id}/${ids.document}/fig.png` })
      .select("id")
      .single(),
  ).id;
  ids.chat = must(
    await A.client
      .from("chats")
      .insert({ notebook_id: ids.notebook, user_id: A.user.id, title: "A's chat" })
      .select("id")
      .single(),
  ).id;
  ids.message = must(
    await A.client
      .from("messages")
      .insert({ chat_id: ids.chat, role: "user", content: "A's private question" })
      .select("id")
      .single(),
  ).id;
  ids.lesson = must(
    await A.client
      .from("lessons")
      .insert({
        notebook_id: ids.notebook,
        document_id: ids.document,
        topic: "Attention",
        content: [],
      })
      .select("id")
      .single(),
  ).id;
  must(
    await A.client.storage
      .from("documents")
      .upload(filePath, new Blob(["%PDF-1.4 rls test"], { type: "application/pdf" })),
  );
  must(await A.client.from("profiles").update({ full_name: "Alice A" }).eq("id", A.user.id));
});

afterAll(async () => {
  if (filePath) await admin.storage.from("documents").remove([filePath]);
  if (ids.notebook) await admin.from("notebooks").delete().eq("id", ids.notebook); // cascades
  for (const p of [A, B]) if (p) await admin.auth.admin.deleteUser(p.user.id); // cascades profiles
});

/** For each table: how to find A's row, a harmless change, and a row B tries to insert as A. */
const CASES: Record<
  string,
  {
    key: string;
    value: () => string;
    patch: Record<string, unknown>;
    column: string;
    forged: () => Record<string, unknown>;
  }
> = {
  notebooks: {
    key: "id",
    value: () => ids.notebook,
    patch: { title: "changed by B" },
    column: "title",
    forged: () => ({ user_id: A.user.id, title: "forged" }),
  },
  documents: {
    key: "id",
    value: () => ids.document,
    patch: { title: "changed by B" },
    column: "title",
    forged: () => ({
      notebook_id: ids.notebook,
      user_id: B.user.id,
      title: "forged",
      file_path: `${B.user.id}/x/y.pdf`,
    }),
  },
  chunks: {
    key: "id",
    value: () => ids.chunk,
    patch: { content: "changed by B" },
    column: "content",
    forged: () => ({
      document_id: ids.document,
      notebook_id: ids.notebook,
      chunk_index: 9,
      content: "forged",
    }),
  },
  figures: {
    key: "id",
    value: () => ids.figure,
    patch: { caption: "changed by B" },
    column: "caption",
    forged: () => ({ document_id: ids.document, image_path: "forged.png" }),
  },
  chats: {
    key: "id",
    value: () => ids.chat,
    patch: { title: "changed by B" },
    column: "title",
    forged: () => ({ notebook_id: ids.notebook, user_id: B.user.id, title: "forged" }),
  },
  messages: {
    key: "id",
    value: () => ids.message,
    patch: { content: "changed by B" },
    column: "content",
    forged: () => ({ chat_id: ids.chat, role: "user", content: "forged" }),
  },
  lessons: {
    key: "id",
    value: () => ids.lesson,
    patch: { topic: "changed by B" },
    column: "topic",
    forged: () => ({ notebook_id: ids.notebook, topic: "forged", content: [] }),
  },
  profiles: {
    key: "id",
    value: () => A.user.id,
    patch: { full_name: "changed by B" },
    column: "full_name",
    forged: () => ({ id: A.user.id, full_name: "forged" }),
  },
};

describe("coverage", () => {
  it("every public table has RLS enabled and a test case here", async () => {
    const rows = must(await admin.rpc("rls_status")) as {
      table_name: string;
      rls_enabled: boolean;
    }[];
    expect(
      rows.filter((r) => !r.rls_enabled).map((r) => r.table_name),
      "tables without RLS",
    ).toEqual([]);
    expect(
      rows.map((r) => r.table_name).filter((t) => !COVERED.includes(t)),
      "tables with no RLS test case: add them to COVERED and CASES",
    ).toEqual([]);
    expect(Object.keys(CASES).sort()).toEqual([...COVERED].sort());
  });
});

describe.each(COVERED)("user B against A's %s", (table) => {
  const c = () => CASES[table];

  it("cannot read A's rows", async () => {
    const { data } = await B.client.from(table).select("*").eq(c().key, c().value());
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot update A's rows", async () => {
    const { data } = await B.client.from(table).update(c().patch).eq(c().key, c().value()).select();
    expect(data ?? []).toHaveLength(0);
    const after = must(
      await admin.from(table).select(c().column).eq(c().key, c().value()).single(),
    ) as Record<string, unknown>;
    expect(after[c().column]).not.toBe("changed by B");
  });

  it("cannot delete A's rows", async () => {
    await B.client.from(table).delete().eq(c().key, c().value());
    const { data } = await admin.from(table).select(c().key).eq(c().key, c().value());
    expect(data ?? []).toHaveLength(1);
  });

  it("cannot insert rows into A's data", async () => {
    const { error } = await B.client.from(table).insert(c().forged());
    expect(error, `${table} accepted a forged row`).not.toBeNull();
  });
});

describe("user B, other paths", () => {
  it("hybrid_search on A's notebook returns nothing", async () => {
    const { data } = await B.client.rpc("hybrid_search", {
      query_text: "attention",
      query_embedding: JSON.stringify(Array.from({ length: 1536 }, () => 0.01)),
      p_notebook_id: ids.notebook,
      match_count: 5,
    });
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot download, list or upload in A's storage folder", async () => {
    const download = await B.client.storage.from("documents").download(filePath);
    expect(download.data).toBeNull();
    const list = await B.client.storage.from("documents").list(`${A.user.id}/${ids.document}`);
    expect(list.data ?? []).toHaveLength(0);
    const upload = await B.client.storage
      .from("documents")
      .upload(
        `${A.user.id}/${ids.document}/planted.pdf`,
        new Blob(["x"], { type: "application/pdf" }),
      );
    expect(upload.error).not.toBeNull();
  });
});

describe("signed-out visitor", () => {
  it.each(COVERED)("gets no rows from %s", async (table) => {
    const { data } = await anon.from(table).select("*").limit(5);
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot download A's file", async () => {
    const { data } = await anon.storage.from("documents").download(filePath);
    expect(data).toBeNull();
  });

  it("cannot call rls_status", async () => {
    const { error } = await anon.rpc("rls_status");
    expect(error).not.toBeNull();
  });
});

describe("user A, sanity", () => {
  it("can read their own rows (the setup really worked)", async () => {
    for (const table of COVERED) {
      const { data } = await (table === "chunks" || table === "figures"
        ? A.client.from(table).select("*").eq("id", CASES[table].value())
        : A.client.from(table).select("*").eq(CASES[table].key, CASES[table].value()));
      expect(data, table).toHaveLength(1);
    }
  });
});
