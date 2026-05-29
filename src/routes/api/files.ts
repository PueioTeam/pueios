import { createFileRoute } from "@tanstack/react-router";

interface SavedFile {
  id: string;
  name: string;
  type: "text" | "image";
  content: string;
  updatedAt: number;
  folder?: string;
}
interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
interface CfEnv { MESSAGES_KV?: KVNamespace; FILES_KV?: KVNamespace }

// Upstash Redis REST (same instance as accounts so files survive server restarts)
const UPSTASH_URL = "https://free-elephant-40203.upstash.io";
const UPSTASH_TOKEN = "AZ0LAAIgcDEzNzg3YmJmODc5Mjg0ODdmYTg3YjM4YjA4NjE0MmE0Yg";

async function upstashFiles(command: string, ...args: string[]): Promise<unknown> {
  try {
    const r = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([command, ...args]),
    });
    const data = await r.json() as { result?: unknown; error?: string };
    if (!r.ok || data.error) throw new Error(data.error ?? `Upstash error ${r.status}`);
    return data.result;
  } catch {
    return null;
  }
}

// Fallback in-memory store for local dev (no Upstash reachable)
const memStore = new Map<string, SavedFile[]>();
const getKV = (): KVNamespace | null => {
  const env = (globalThis as Record<string, unknown>).__cfEnv as CfEnv | undefined;
  return env?.FILES_KV ?? env?.MESSAGES_KV ?? null;
};
const key = (u: string) => `files:${u.toLowerCase().trim()}`;

async function fetchUserFiles(u: string): Promise<SavedFile[]> {
  // 1. Try Cloudflare KV (production Workers)
  const kv = getKV();
  if (kv) { const raw = await kv.get(key(u), "text"); return raw ? JSON.parse(raw) as SavedFile[] : []; }
  // 2. Try Upstash (Node / any environment)
  const raw = await upstashFiles("GET", key(u)) as string | null;
  if (raw) { try { return JSON.parse(raw) as SavedFile[]; } catch {} }
  // 3. In-memory fallback
  return memStore.get(key(u)) ?? [];
}
async function saveUserFiles(u: string, files: SavedFile[]) {
  const serialized = JSON.stringify(files);
  const kv = getKV();
  if (kv) { await kv.put(key(u), serialized, { expirationTtl: 60 * 60 * 24 * 365 }); return; }
  // Upstash with 1-year TTL
  await upstashFiles("SET", key(u), serialized, "EX", String(60 * 60 * 24 * 365));
  // Also keep in-memory as instant cache
  memStore.set(key(u), files);
}

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/files")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = new URL(request.url).searchParams.get("user");
        if (!user) return json({ error: "Missing user" }, 400);
        return json(await fetchUserFiles(user));
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as { user: string; file: SavedFile };
        if (!body.user || !body.file?.id) return json({ error: "Missing user or file" }, 400);
        const files = await fetchUserFiles(body.user);
        const i = files.findIndex((f) => f.id === body.file.id);
        if (i >= 0) files[i] = body.file; else files.push(body.file);
        await saveUserFiles(body.user, files);
        return json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const user = url.searchParams.get("user");
        const fileId = url.searchParams.get("fileId");
        if (!user || !fileId) return json({ error: "Missing user or fileId" }, 400);
        const files = await fetchUserFiles(user);
        await saveUserFiles(user, files.filter((f) => f.id !== fileId));
        return json({ ok: true });
      },
    },
  },
});
