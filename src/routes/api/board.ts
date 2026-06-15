import { createFileRoute } from "@tanstack/react-router";

interface PueiBoardPin {
  id: string;
  author: string;
  title: string;
  desc?: string;
  imgData?: string;
  link?: string;
  tag?: string;
  createdAt: number;
  likes: number;
  likedBy?: string[];
}

interface KVNamespace {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
interface CfEnv { MESSAGES_KV?: KVNamespace }

const memStore = new Map<string, PueiBoardPin[]>();
const getKV = (): KVNamespace | null =>
  ((globalThis as Record<string, unknown>).__cfEnv as CfEnv | undefined)?.MESSAGES_KV ?? null;

const UPSTASH_URL = "https://free-elephant-40203.upstash.io";
const UPSTASH_TOKEN = "AZ0LAAIgcDEzNzg3YmJmODc5Mjg0ODdmYTg3YjM4YjA4NjE0MmE0Yg";
const BOARD_KEY = "puei-board-v2";
const MAX_PINS = 200;
const TTL = 60 * 60 * 24 * 90; // 90 days

async function upstash(command: string, ...args: string[]): Promise<unknown> {
  try {
    const r = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([command, ...args]),
    });
    const data = (await r.json()) as { result?: unknown; error?: string };
    if (!r.ok || data.error) throw new Error(data.error ?? `Upstash error ${r.status}`);
    return data.result;
  } catch {
    return null;
  }
}

async function loadPins(): Promise<PueiBoardPin[]> {
  const kv = getKV();
  if (kv) {
    const raw = await kv.get(BOARD_KEY, "text");
    return raw ? (JSON.parse(raw) as PueiBoardPin[]) : [];
  }
  const raw = (await upstash("GET", BOARD_KEY)) as string | null;
  if (raw) { try { return JSON.parse(raw) as PueiBoardPin[]; } catch { return []; } }
  return memStore.get(BOARD_KEY) ?? [];
}

async function savePins(pins: PueiBoardPin[]): Promise<void> {
  const trimmed = pins.slice(0, MAX_PINS);
  const kv = getKV();
  if (kv) {
    await kv.put(BOARD_KEY, JSON.stringify(trimmed), { expirationTtl: TTL });
  } else {
    await upstash("SET", BOARD_KEY, JSON.stringify(trimmed), "EX", String(TTL));
    memStore.set(BOARD_KEY, trimmed);
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/board")({
  server: {
    handlers: {
      GET: async () => {
        return json(await loadPins());
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as { action: string; pin?: PueiBoardPin; id?: string; liker?: string };
        const pins = await loadPins();
        if (body.action === "add" && body.pin) {
          const pin = body.pin;
          if (!pin.id || !pin.author || !pin.title) return json({ error: "Missing fields" }, 400);
          const next = [pin, ...pins.filter((p) => p.id !== pin.id)].slice(0, MAX_PINS);
          await savePins(next);
          return json({ ok: true });
        }
        if (body.action === "delete" && body.id) {
          await savePins(pins.filter((p) => p.id !== body.id));
          return json({ ok: true });
        }
        if (body.action === "like" && body.id && body.liker) {
          const next = pins.map((p) => {
            if (p.id !== body.id) return p;
            const liked = p.likedBy ?? [];
            if (liked.includes(body.liker!)) {
              return { ...p, likes: Math.max(0, p.likes - 1), likedBy: liked.filter((u) => u !== body.liker) };
            }
            return { ...p, likes: p.likes + 1, likedBy: [...liked, body.liker!] };
          });
          await savePins(next);
          return json({ ok: true });
        }
        return json({ error: "Unknown action" }, 400);
      },
    },
  },
});
