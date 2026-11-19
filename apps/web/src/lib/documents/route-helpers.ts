import "server-only";
import { z } from "zod";
import { notFound } from "@/lib/errors";

/** A route's `[id]`: anything that isn't a uuid is a 404 (never a 500 from Postgres). */
export async function idParam(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) throw notFound();
  return id;
}
