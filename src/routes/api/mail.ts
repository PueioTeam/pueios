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

const UPSTASH_URL = "https://free-elephant-40203.upstash.io";
const UPSTASH_TOKEN = "AZ0LAAIgcDEzNzg3YmJmODc5Mjg0ODdmYTg3YjM4YjA4NjE0MmE0Yg";
const TTL = 60 * 60 * 24 * 365;

const inboxStore = new Map<string, ApiMail[]>();

async function upstash(command: string, ...args: string[]): Promise<unknown> {
  try {
    const r = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([command, ...args]),
    });
    const data = await r.json() as { result?: unknown; error?: string };
    return data.result ?? null;
  } catch { return null; }
}

const mailKey = (owner: string) => `mail:${owner.toLowerCase().trim()}`;

async function fetchInbox(owner: string): Promise<ApiMail[]> {
  const raw = await upstash("GET", mailKey(owner)) as string | null;
  if (raw) { try { return JSON.parse(raw) as ApiMail[]; } catch {} }
  return inboxStore.get(owner.toLowerCase()) ?? [];
}

async function pushInbox(owner: string, msg: ApiMail) {
  const all = await fetchInbox(owner);
  const next = [...all, msg].slice(-1000);
  await upstash("SET", mailKey(owner), JSON.stringify(next), "EX", String(TTL));
  inboxStore.set(owner.toLowerCase(), next);
}

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/mail")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const owner = url.searchParams.get("owner");
        if (!owner) return json({ error: "Missing owner" }, 400);
        return json(await fetchInbox(owner));
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          from: string; to: string; subject: string; body: string;
          attachments?: unknown[];
        };
        if (!body.from || !body.to || !body.subject) return json({ error: "Missing fields" }, 400);
        const msg: ApiMail = {
          id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          from: body.from.trim(), to: body.to.trim(),
          subject: body.subject, body: body.body || "", at: Date.now(),
          attachments: body.attachments,
        };
        await pushInbox(msg.to, msg);
        return json({ ok: true, id: msg.id });
      },
    },
  },
});
