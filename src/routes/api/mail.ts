import { createFileRoute } from "@tanstack/react-router";

interface ApiMail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  at: number;
  attachments?: unknown[];
}

interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
interface CfEnv { MAIL_KV?: KVNamespace; MESSAGES_KV?: KVNamespace }

const inboxStore = new Map<string, ApiMail[]>();   // delivered, not yet pulled
const mailboxStore = new Map<string, unknown>();   // full mailbox snapshot per owner

const getKV = (): KVNamespace | null => {
  const env = (globalThis as Record<string, unknown>).__cfEnv as CfEnv | undefined;
  return env?.MAIL_KV ?? env?.MESSAGES_KV ?? null;
};

async function fetchInbox(owner: string): Promise<ApiMail[]> {
  const kv = getKV();
  if (kv) { const raw = await kv.get(`mail:${owner.toLowerCase()}`, "text"); return raw ? JSON.parse(raw) as ApiMail[] : []; }
  return inboxStore.get(owner.toLowerCase()) ?? [];
}
async function pushInbox(owner: string, msg: ApiMail) {
  const all = await fetchInbox(owner);
  const next = [...all, msg].slice(-1000);
  const kv = getKV();
  if (kv) await kv.put(`mail:${owner.toLowerCase()}`, JSON.stringify(next), { expirationTtl: 60 * 60 * 24 * 365 });
  else inboxStore.set(owner.toLowerCase(), next);
}

function normalizeOwners(owner: string, aliases?: string[]): string[] {
  const values = [owner, ...(Array.isArray(aliases) ? aliases : [])]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(values));
}

async function fetchMailbox(owner: string): Promise<unknown> {
  const kv = getKV();
  if (kv) { const raw = await kv.get(`mailbox:${owner.toLowerCase()}`, "text"); return raw ? JSON.parse(raw) : null; }
  return mailboxStore.get(owner.toLowerCase()) ?? null;
}
async function saveMailbox(owner: string, data: unknown) {
  const kv = getKV();
  if (kv) await kv.put(`mailbox:${owner.toLowerCase()}`, JSON.stringify(data), { expirationTtl: 60 * 60 * 24 * 365 });
  else mailboxStore.set(owner.toLowerCase(), data);
}

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/mail")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const owner = url.searchParams.get("owner");
        const mode = url.searchParams.get("mode");
        if (!owner) return json({ error: "Missing owner" }, 400);
        if (mode === "full") return json(await fetchMailbox(owner));
        return json(await fetchInbox(owner));
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          from: string; to: string; subject: string; body: string;
          attachments?: unknown[]; aliases?: string[];
        };
        if (!body.from || !body.to || !body.subject) return json({ error: "Missing fields" }, 400);
        const msg: ApiMail = {
          id: String((body as { id?: string }).id || `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
          from: body.from.trim(), to: body.to.trim(),
          subject: body.subject, body: body.body || "", at: Date.now(),
          attachments: body.attachments,
        };
        await Promise.all(normalizeOwners(msg.to, body.aliases).map((owner) => pushInbox(owner, msg)));
        return json({ ok: true, id: msg.id });
      },
      // PUT: full mailbox sync (entire owner's mailbox state)
      PUT: async ({ request }) => {
        const body = (await request.json()) as { owner: string; mailbox: unknown; aliases?: string[] };
        if (!body.owner) return json({ error: "Missing owner" }, 400);
        await Promise.all(normalizeOwners(body.owner, body.aliases).map((owner) => saveMailbox(owner, body.mailbox)));
        return json({ ok: true });
      },
    },
  },
});
