import { createFileRoute } from "@tanstack/react-router";

interface AccountRecord {
  name: string;
  password: string;
  snapshot: unknown;
  updatedAt: number;
}

interface DirectoryProfile {
  pueiNumber: string;
  name: string;
  avatar: string;
  color: string;
}

interface SnapshotUser {
  pueiNumber?: string;
  name?: string;
  avatar?: string;
  color?: string;
}

const UPSTASH_URL = "https://free-elephant-40203.upstash.io";
const UPSTASH_TOKEN = "AZ0LAAIgcDEzNzg3YmJmODc5Mjg0ODdmYTg3YjM4YjA4NjE0MmE0Yg";

const key = (name: string) => `account:${name.toLowerCase().trim()}`;
const dirKey = (pueiNumber: string) => `directory:${pueiNumber.trim()}`;

function normalizePueiNumber(raw: string): string {
  const cleaned = raw.trim().replace(/[\s-]/g, "");
  if (/^\d{9}$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`;
  }
  return raw.trim();
}

function deterministicPueiNumberFor(name: string): string {
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  const n = Math.abs(h) % 900000000 + 100000000;
  const s = String(n);
  return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6, 9)}`;
}

async function upstash(command: string, ...args: string[]): Promise<unknown> {
  const r = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([command, ...args]),
  });
  const data = await r.json() as { result?: unknown; error?: string };
  if (!r.ok || data.error) throw new Error(data.error ?? `Upstash error ${r.status}`);
  return data.result;
}

async function fetchAccount(name: string): Promise<AccountRecord | null> {
  const raw = await upstash("GET", key(name)) as string | null;
  return raw ? (JSON.parse(raw) as AccountRecord) : null;
}

async function saveAccount(rec: AccountRecord) {
  await upstash("SET", key(rec.name), JSON.stringify(rec));
}

async function fetchDirectoryProfile(pueiNumber: string): Promise<DirectoryProfile | null> {
  const raw = await upstash("GET", dirKey(normalizePueiNumber(pueiNumber))) as string | null;
  return raw ? (JSON.parse(raw) as DirectoryProfile) : null;
}

async function saveDirectoryProfile(profile: DirectoryProfile) {
  const normalized = normalizePueiNumber(profile.pueiNumber);
  const record = { ...profile, pueiNumber: normalized };
  await upstash("SET", dirKey(normalized), JSON.stringify(record));
  // Backward compatibility alias: older accounts may have shared the deterministic number.
  const deterministic = deterministicPueiNumberFor(record.name);
  if (deterministic !== normalized) {
    await upstash("SET", dirKey(deterministic), JSON.stringify(record));
  }
}

function extractProfile(nameFallback: string, snapshot: unknown): DirectoryProfile | null {
  const user = (snapshot as { user?: SnapshotUser } | null)?.user;
  const name = String(user?.name ?? nameFallback).trim();
  const pueiNumber = user?.pueiNumber ? normalizePueiNumber(String(user.pueiNumber)) : deterministicPueiNumberFor(name);
  if (!/^\d{3}-\d{3}-\d{3}$/.test(pueiNumber)) return null;
  return {
    pueiNumber,
    name,
    avatar: String(user?.avatar ?? "👤"),
    color: String(user?.color ?? "200"),
  };
}

async function findProfileByPueiFromAccounts(pueiNumber: string): Promise<DirectoryProfile | null> {
  const wanted = normalizePueiNumber(pueiNumber);
  const keys = (await upstash("KEYS", "account:*") as string[] | null) ?? [];
  for (const accountKey of keys) {
    const raw = await upstash("GET", accountKey) as string | null;
    if (!raw) continue;
    const rec = JSON.parse(raw) as AccountRecord;
    const profile = extractProfile(rec.name, rec.snapshot);
    if (!profile) continue;
    const aliases = new Set<string>([profile.pueiNumber, deterministicPueiNumberFor(profile.name)]);
    if (aliases.has(wanted)) {
      await saveDirectoryProfile(profile);
      return { ...profile, pueiNumber: wanted };
    }
  }
  return null;
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
        const pueiNumber = url.searchParams.get("pueiNumber");
        if (pueiNumber) {
          try {
            const wanted = normalizePueiNumber(pueiNumber);
            let profile = await fetchDirectoryProfile(wanted);
            if (!profile) profile = await findProfileByPueiFromAccounts(wanted);
            if (!profile) return json({ error: "Not found" }, 404);
            // Keep the queried number as contact key in the client.
            return json({ ...profile, pueiNumber: wanted });
          } catch {
            return json({ error: "Storage unavailable" }, 503);
          }
        }
        const name = url.searchParams.get("name");
        const password = url.searchParams.get("password") ?? "";
        if (!name) return json({ error: "Missing name" }, 400);
        let rec: AccountRecord | null;
        try { rec = await fetchAccount(name); }
        catch { return json({ error: "Storage unavailable" }, 503); }
        if (!rec) return json({ exists: false }, 404);
        if ((rec.password ?? "") !== password) return json({ exists: true, error: "Wrong password" }, 401);
        return json({ exists: true, snapshot: rec.snapshot, updatedAt: rec.updatedAt });
      },
      // POST → create. body: { name, password, snapshot }
      POST: async ({ request }) => {
        const body = (await request.json()) as { name?: string; password?: string; snapshot?: unknown };
        if (!body.name) return json({ error: "Missing name" }, 400);
        let existing: AccountRecord | null;
        try { existing = await fetchAccount(body.name); }
        catch { return json({ error: "Storage unavailable" }, 503); }
        if (existing) return json({ error: "Account already exists" }, 409);
        try {
          const record: AccountRecord = {
            name: body.name.trim(),
            password: body.password ?? "",
            snapshot: body.snapshot ?? null,
            updatedAt: Date.now(),
          };
          await saveAccount(record);
          const profile = extractProfile(record.name, body.snapshot);
          if (profile) await saveDirectoryProfile(profile);
        } catch { return json({ error: "Storage unavailable" }, 503); }
        return json({ ok: true });
      },
      // PUT → sync snapshot. body: { name, password, newPassword?, snapshot }
      PUT: async ({ request }) => {
        const body = (await request.json()) as { name?: string; password?: string; newPassword?: string; snapshot?: unknown };
        if (!body.name) return json({ error: "Missing name" }, 400);
        let existing: AccountRecord | null;
        try { existing = await fetchAccount(body.name); }
        catch { return json({ error: "Storage unavailable" }, 503); }
        if (!existing) {
          // first-time push (account created locally before cloud existed) — accept
          try {
            const record: AccountRecord = {
              name: body.name.trim(),
              password: body.newPassword ?? body.password ?? "",
              snapshot: body.snapshot ?? null,
              updatedAt: Date.now(),
            };
            await saveAccount(record);
            const profile = extractProfile(record.name, body.snapshot);
            if (profile) await saveDirectoryProfile(profile);
          } catch { return json({ error: "Storage unavailable" }, 503); }
          return json({ ok: true, created: true });
        }
        if ((existing.password ?? "") !== (body.password ?? "")) {
          return json({ error: "Wrong password" }, 401);
        }
        try {
          const record: AccountRecord = {
            name: existing.name,
            password: body.newPassword ?? existing.password,
            snapshot: body.snapshot ?? null,
            updatedAt: Date.now(),
          };
          await saveAccount(record);
          const profile = extractProfile(record.name, body.snapshot ?? existing.snapshot);
          if (profile) await saveDirectoryProfile(profile);
        } catch { return json({ error: "Storage unavailable" }, 503); }
        return json({ ok: true });
      },
    },
  },
});
