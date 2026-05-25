import { createAPIFileRoute } from "@tanstack/react-start/api";

interface ApiMail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  at: number;
}

interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface CfEnv {
  MAIL_KV?: KVNamespace;
  MESSAGES_KV?: KVNamespace;
}

// In-memory fallback for local dev
const memStore = new Map<string, ApiMail[]>();

function getKV(): KVNamespace | null {
  const env = (globalThis as Record<string, unknown>).__cfEnv as CfEnv | undefined;
  return env?.MAIL_KV ?? env?.MESSAGES_KV ?? null;
}

async function fetchMail(owner: string): Promise<ApiMail[]> {
  const kv = getKV();
  if (kv) {
    const raw = await kv.get(`mail:${owner}`, "text");
    return raw ? (JSON.parse(raw) as ApiMail[]) : [];
  }
  return memStore.get(owner) ?? [];
}

async function storeMail(owner: string, msg: ApiMail): Promise<void> {
  const kv = getKV();
  const existing = await fetchMail(owner);
  const updated = [...existing, msg].slice(-500);
  if (kv) {
    await kv.put(`mail:${owner}`, JSON.stringify(updated), {
      expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });
  } else {
    memStore.set(owner, updated);
  }
}

export const APIRoute = createAPIFileRoute("/api/mail")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const owner = url.searchParams.get("owner");
    if (!owner) {
      return new Response(JSON.stringify({ error: "Missing owner" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const msgs = await fetchMail(owner);
    return new Response(JSON.stringify(msgs), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  },

  POST: async ({ request }) => {
    const body = (await request.json()) as {
      from: string;
      to: string;
      subject: string;
      body: string;
    };
    if (!body.from || !body.to || !body.subject) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const msg: ApiMail = {
      id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      from: body.from.trim(),
      to: body.to.trim(),
      subject: body.subject,
      body: body.body || "",
      at: Date.now(),
    };
    await storeMail(msg.to, msg);
    return new Response(JSON.stringify({ ok: true, id: msg.id }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
