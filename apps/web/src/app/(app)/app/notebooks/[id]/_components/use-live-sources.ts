"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { applyChange, applySnapshot } from "@/lib/documents/live";
import type { Source } from "@/lib/documents/shared";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 5000;
const MAX_BACKOFF_MS = 30_000;

export type Connection = "live" | "reconnecting";

/**
 * The notebook's sources, live: Realtime changes on its documents (RLS limits them to the
 * owner's rows). When the channel drops it resubscribes with backoff and polls every 5 s until
 * it's back, so a card never freezes. All updates go through the merge rules in live.ts.
 */
export function useLiveSources(notebookId: string, initial: Source[]) {
  const [sources, setSources] = useState(initial);
  const [connection, setConnection] = useState<Connection>("live");

  useEffect(() => {
    const supabase = createClient();
    let current: RealtimeChannel | null = null;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let poller: ReturnType<typeof setInterval> | undefined;
    let disposed = false;
    // A unique topic per effect run: supabase.channel() returns an existing channel with the same
    // name, and React runs effects twice in development.
    const instance = Math.random().toString(36).slice(2, 8);

    const poll = async () => {
      try {
        const res = await fetch(`/api/notebooks/${notebookId}/documents`, { cache: "no-store" });
        if (!res.ok || disposed) return;
        const { sources: rows } = (await res.json()) as { sources: Source[] };
        setSources((list) => applySnapshot(list, rows));
      } catch {
        // offline: the next tick tries again
      }
    };
    const startPolling = () => {
      poller ??= setInterval(poll, POLL_MS);
    };
    const stopPolling = () => {
      clearInterval(poller);
      poller = undefined;
    };

    const subscribe = async () => {
      if (disposed) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      const channel = supabase.channel(`sources:${notebookId}:${instance}:${attempt}`).on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `notebook_id=eq.${notebookId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setSources((list) => applyChange(list, { type: "delete", id }));
          } else {
            setSources((list) => applyChange(list, { type: "upsert", row: payload.new as Source }));
          }
        },
      );
      current = channel;
      channel.subscribe((status) => {
        if (disposed || channel !== current) return; // a channel we already replaced
        if (status === "SUBSCRIBED") {
          attempt = 0;
          setConnection("live");
          stopPolling();
          void poll(); // catch up on anything missed while disconnected
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnection("reconnecting");
          startPolling();
          void poll();
          current = null;
          void supabase.removeChannel(channel);
          const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
          attempt += 1;
          retry = setTimeout(() => void subscribe(), delay);
        }
      });
    };

    void subscribe();
    return () => {
      disposed = true;
      clearTimeout(retry);
      stopPolling();
      if (current) void supabase.removeChannel(current);
    };
  }, [notebookId]);

  return { sources, setSources, connection };
}
