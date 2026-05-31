import { createFileRoute } from "@tanstack/react-router";

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
interface CfEnv { MESSAGES_KV?: KVNamespace }

const memStore = new Map<string, ApiMessage[]>();
const getKV = (): KVNamespace | null =>
  ((globalThis as Record<string, unknown>).__cfEnv as CfEnv | undefined)?.MESSAGES_KV ?? null;

// Upstash Redis REST fallback keeps chat durable when KV isn't bound.
const UPSTASH_URL = "https://free-elephant-40203.upstash.io";
const UPSTASH_TOKEN = "AZ0LAAIgcDEzNzg3YmJmODc5Mjg0ODdmYTg3YjM4YjA4NjE0MmE0Yg";

async function upstashMessages(command: string, ...args: string[]): Promise<unknown> {
  try {
    const r = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([command, ...args]),
    });
    const data = (await r.json()) as { result?: unknown; error?: string };
    if (!r.ok || data.error) throw new Error(data.error ?? `Upstash error ${r.status}`);
    return data.result;
  } catch {
    return null;
  }
}

function normalizePueiNumber(value: string): string {
  const cleaned = value.trim().replace(/[\s-]/g, "");
  if (/^\d{9}$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`;
  }
  return value.trim();
}

const chatKey = (pueiNumber: string) => `msgs:${normalizePueiNumber(pueiNumber)}`;

async function fetchMessages(pueiNumber: string): Promise<ApiMessage[]> {
  const key = chatKey(pueiNumber);
  const kv = getKV();
  if (kv) {
    const raw = await kv.get(key, "text");
    return raw ? (JSON.parse(raw) as ApiMessage[]) : [];
  }
  const upstashRaw = (await upstashMessages("GET", key)) as string | null;
  if (upstashRaw) {
    try {
      return JSON.parse(upstashRaw) as ApiMessage[];
    } catch {
      return [];
    }
  }
  return memStore.get(key) ?? [];
}
async function storeMessage(pueiNumber: string, msg: ApiMessage) {
  const key = chatKey(pueiNumber);
  const kv = getKV();
  const existing = await fetchMessages(pueiNumber);
  const updated = [...existing, msg].slice(-500);
  if (kv) {
    await kv.put(key, JSON.stringify(updated), { expirationTtl: 60 * 60 * 24 * 30 });
  } else {
    await upstashMessages("SET", key, JSON.stringify(updated), "EX", String(60 * 60 * 24 * 30));
    memStore.set(key, updated);
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const pueiNumber = new URL(request.url).searchParams.get("pueiNumber");
        if (!pueiNumber) return json({ error: "Missing pueiNumber" }, 400);
        return json(await fetchMessages(pueiNumber));
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as { from: string; fromNumber: string; toNumber: string; text: string };
        if (!body.toNumber || !body.fromNumber || !body.text) return json({ error: "Missing fields" }, 400);
        const fromNumber = normalizePueiNumber(body.fromNumber);
        const toNumber = normalizePueiNumber(body.toNumber);
        const msg: ApiMessage = {
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          from: body.from, fromNumber, text: body.text, at: Date.now(),
        };
        await storeMessage(toNumber, msg);
        return json({ ok: true, id: msg.id });
      },
    },
  },
});
