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

const memStore = new Map<string, SavedFile[]>();
const getKV = (): KVNamespace | null => {
  const env = (globalThis as Record<string, unknown>).__cfEnv as CfEnv | undefined;
  return env?.FILES_KV ?? env?.MESSAGES_KV ?? null;
};
const key = (u: string) => `files:${u.toLowerCase().trim()}`;

async function fetchUserFiles(u: string): Promise<SavedFile[]> {
  const kv = getKV();
  if (kv) { const raw = await kv.get(key(u), "text"); return raw ? JSON.parse(raw) as SavedFile[] : []; }
  return memStore.get(key(u)) ?? [];
}
async function saveUserFiles(u: string, files: SavedFile[]) {
  const kv = getKV();
  if (kv) await kv.put(key(u), JSON.stringify(files), { expirationTtl: 60 * 60 * 24 * 365 });
  else memStore.set(key(u), files);
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
