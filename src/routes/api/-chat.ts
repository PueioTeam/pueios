import { createAPIFileRoute } from "@tanstack/react-start/api";

interface ApiMessage {
  id: string;
  from: string;
  fromNumber: string;
  text: string;
  at: number;
}

interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface CfEnv {
  MESSAGES_KV?: KVNamespace;
}

// In-memory fallback for local dev (no KV configured)
const memStore = new Map<string, ApiMessage[]>();

function getKV(): KVNamespace | null {
  return ((globalThis as Record<string, unknown>).__cfEnv as CfEnv)?.MESSAGES_KV ?? null;
}

async function fetchMessages(pueiNumber: string): Promise<ApiMessage[]> {
  const kv = getKV();
  if (kv) {
    const raw = await kv.get(`msgs:${pueiNumber}`, "text");
    return raw ? (JSON.parse(raw) as ApiMessage[]) : [];
  }
  return memStore.get(pueiNumber) ?? [];
}

async function storeMessage(pueiNumber: string, msg: ApiMessage): Promise<void> {
  const kv = getKV();
  const existing = await fetchMessages(pueiNumber);
  const updated = [...existing, msg].slice(-500);
  if (kv) {
    await kv.put(`msgs:${pueiNumber}`, JSON.stringify(updated), {
      expirationTtl: 60 * 60 * 24 * 14, // 14 days
    });
  } else {
    memStore.set(pueiNumber, updated);
  }
}

export const APIRoute = createAPIFileRoute("/api/chat")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const pueiNumber = url.searchParams.get("pueiNumber");
    if (!pueiNumber) {
      return new Response(JSON.stringify({ error: "Missing pueiNumber" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const msgs = await fetchMessages(pueiNumber);
    return new Response(JSON.stringify(msgs), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  },

  POST: async ({ request }) => {
    const body = (await request.json()) as {
      from: string;
      fromNumber: string;
      toNumber: string;
      text: string;
    };

    if (!body.toNumber || !body.fromNumber || !body.text) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const msg: ApiMessage = {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      from: body.from,
      fromNumber: body.fromNumber,
      text: body.text,
      at: Date.now(),
    };

    await storeMessage(body.toNumber, msg);
    return new Response(JSON.stringify({ ok: true, id: msg.id }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
