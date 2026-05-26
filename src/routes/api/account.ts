import { createFileRoute } from "@tanstack/react-router";

interface AccountRecord {
  name: string;
  password: string;
  snapshot: unknown;
  updatedAt: number;
}

const UPSTASH_URL = "https://free-elephant-40203.upstash.io";
const UPSTASH_TOKEN = "AZ0LAAIgcDEzNzg3YmJmODc5Mjg0ODdmYTg3YjM4YjA4NjE0MmE0Yg";

const key = (name: string) => `account:${name.toLowerCase().trim()}`;

async function upstash(command: string, ...args: string[]): Promise<unknown> {
  const r = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([command, ...args]),
  });
  const data = await r.json() as { result: unknown };
  return data.result;
}

async function fetchAccount(name: string): Promise<AccountRecord | null> {
  const raw = await upstash("GET", key(name)) as string | null;
  return raw ? (JSON.parse(raw) as AccountRecord) : null;
}

async function saveAccount(rec: AccountRecord) {
  await upstash("SET", key(rec.name), JSON.stringify(rec));
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
      // PUT → sync snapshot. body: { name, password, newPassword?, snapshot }
      PUT: async ({ request }) => {
        const body = (await request.json()) as { name?: string; password?: string; newPassword?: string; snapshot?: unknown };
        if (!body.name) return json({ error: "Missing name" }, 400);
        const existing = await fetchAccount(body.name);
        if (!existing) {
          // first-time push (account created locally before cloud existed) — accept
          await saveAccount({
            name: body.name.trim(),
            password: body.newPassword ?? body.password ?? "",
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
          password: body.newPassword ?? existing.password,
          snapshot: body.snapshot ?? null,
          updatedAt: Date.now(),
        });
        return json({ ok: true });
      },
    },
  },
});
