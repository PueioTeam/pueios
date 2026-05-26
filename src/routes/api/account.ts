import { createFileRoute } from "@tanstack/react-router";

interface AccountRecord {
  name: string;
  password: string;
  snapshot: unknown;
  updatedAt: number;
}

interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
interface CfEnv { ACCOUNT_KV?: KVNamespace; MESSAGES_KV?: KVNamespace }

const memStore = new Map<string, AccountRecord>();
const getKV = (): KVNamespace | null => {
  const env = (globalThis as Record<string, unknown>).__cfEnv as CfEnv | undefined;
  return env?.ACCOUNT_KV ?? env?.MESSAGES_KV ?? null;
};
const key = (name: string) => `account:${name.toLowerCase().trim()}`;

async function fetchAccount(name: string): Promise<AccountRecord | null> {
  const kv = getKV();
  if (kv) {
    const raw = await kv.get(key(name), "text");
    return raw ? (JSON.parse(raw) as AccountRecord) : null;
  }
  return memStore.get(key(name)) ?? null;
}
async function saveAccount(rec: AccountRecord) {
  const kv = getKV();
  if (kv) await kv.put(key(rec.name), JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 365 * 5 });
  else memStore.set(key(rec.name), rec);
}

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/account")({
  server: {
    handlers: {
      // GET ?name=&password= → { exists, snapshot? }
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("name");
        const password = url.searchParams.get("password") ?? "";
        if (!name) return json({ error: "Missing name" }, 400);
        const rec = await fetchAccount(name);
        if (!rec) return json({ exists: false }, 404);
        if ((rec.password ?? "") !== password) return json({ exists: true, error: "Wrong password" }, 401);
        return json({ exists: true, snapshot: rec.snapshot, updatedAt: rec.updatedAt });
      },
      // POST → create. body: { name, password, snapshot }
      POST: async ({ request }) => {
        const body = (await request.json()) as { name?: string; password?: string; snapshot?: unknown };
        if (!body.name) return json({ error: "Missing name" }, 400);
        const existing = await fetchAccount(body.name);
        if (existing) return json({ error: "Account already exists" }, 409);
        await saveAccount({
          name: body.name.trim(),
          password: body.password ?? "",
          snapshot: body.snapshot ?? null,
          updatedAt: Date.now(),
        });
        return json({ ok: true });
      },
      // PUT → sync snapshot. body: { name, password, snapshot }
      PUT: async ({ request }) => {
        const body = (await request.json()) as { name?: string; password?: string; snapshot?: unknown };
        if (!body.name) return json({ error: "Missing name" }, 400);
        const existing = await fetchAccount(body.name);
        if (!existing) {
          // first-time push (account created locally before cloud existed) — accept
          await saveAccount({
            name: body.name.trim(),
            password: body.password ?? "",
            snapshot: body.snapshot ?? null,
            updatedAt: Date.now(),
          });
          return json({ ok: true, created: true });
        }
        if ((existing.password ?? "") !== (body.password ?? "")) {
          return json({ error: "Wrong password" }, 401);
        }
        await saveAccount({
          name: existing.name,
          password: existing.password,
          snapshot: body.snapshot ?? null,
          updatedAt: Date.now(),
        });
        return json({ ok: true });
      },
    },
  },
});
