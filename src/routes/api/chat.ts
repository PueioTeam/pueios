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

async function fetchMessages(pueiNumber: string): Promise<ApiMessage[]> {
  const kv = getKV();
  if (kv) {
    const raw = await kv.get(`msgs:${pueiNumber}`, "text");
    return raw ? (JSON.parse(raw) as ApiMessage[]) : [];
  }
  return memStore.get(pueiNumber) ?? [];
}
async function storeMessage(pueiNumber: string, msg: ApiMessage) {
  const kv = getKV();
  const existing = await fetchMessages(pueiNumber);
  const updated = [...existing, msg].slice(-500);
  if (kv) await kv.put(`msgs:${pueiNumber}`, JSON.stringify(updated), { expirationTtl: 60 * 60 * 24 * 30 });
  else memStore.set(pueiNumber, updated);
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
        const msg: ApiMessage = {
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          from: body.from, fromNumber: body.fromNumber, text: body.text, at: Date.now(),
        };
        await storeMessage(body.toNumber, msg);
        return json({ ok: true, id: msg.id });
      },
    },
  },
});
