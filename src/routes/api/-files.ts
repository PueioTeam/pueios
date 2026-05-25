import { createAPIFileRoute } from "@tanstack/react-start/api";

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

interface CfEnv {
  MESSAGES_KV?: KVNamespace;
}

// In-memory fallback for local dev
const memStore = new Map<string, SavedFile[]>();

function getKV(): KVNamespace | null {
  return ((globalThis as Record<string, unknown>).__cfEnv as CfEnv)?.MESSAGES_KV ?? null;
}

function userKey(username: string) {
  return `files:${username.toLowerCase().trim()}`;
}

async function fetchUserFiles(username: string): Promise<SavedFile[]> {
  const kv = getKV();
  const key = userKey(username);
  if (kv) {
    const raw = await kv.get(key, "text");
    return raw ? (JSON.parse(raw) as SavedFile[]) : [];
  }
  return memStore.get(key) ?? [];
}

async function saveUserFiles(username: string, files: SavedFile[]): Promise<void> {
  const kv = getKV();
  const key = userKey(username);
  if (kv) {
    await kv.put(key, JSON.stringify(files), { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days
  } else {
    memStore.set(key, files);
  }
}

export const APIRoute = createAPIFileRoute("/api/files")({
  // GET /api/files?user=Alice  → returns all files for that user
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get("user");
    if (!username) {
      return new Response(JSON.stringify({ error: "Missing user" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const files = await fetchUserFiles(username);
    return new Response(JSON.stringify(files), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  },

  // POST /api/files  body: { user, file }  → upsert one file
  POST: async ({ request }) => {
    const body = (await request.json()) as { user: string; file: SavedFile };
    if (!body.user || !body.file?.id) {
      return new Response(JSON.stringify({ error: "Missing user or file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const files = await fetchUserFiles(body.user);
    const idx = files.findIndex((f) => f.id === body.file.id);
    if (idx >= 0) files[idx] = body.file; else files.push(body.file);
    await saveUserFiles(body.user, files);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },

  // DELETE /api/files?user=Alice&fileId=xyz  → remove one file
  DELETE: async ({ request }) => {
    const url = new URL(request.url);
    const username = url.searchParams.get("user");
    const fileId = url.searchParams.get("fileId");
    if (!username || !fileId) {
      return new Response(JSON.stringify({ error: "Missing user or fileId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const files = await fetchUserFiles(username);
    await saveUserFiles(username, files.filter((f) => f.id !== fileId));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  },
});
