import { type SavedFile, loadDeletedFileIds, loadFiles, saveFiles } from "./state";

/** Merge server files into localStorage, server wins on conflict (by updatedAt) */
export async function pullAndMergeFiles(username: string): Promise<void> {
  try {
    const res = await fetch(`/api/files?user=${encodeURIComponent(username)}`);
    if (!res.ok) return;
    const serverFiles: SavedFile[] = await res.json();
    if (!serverFiles.length) return;

    const local = loadFiles();
    const deleted = new Set(loadDeletedFileIds());
    const merged = [...local];
    for (const sf of serverFiles) {
      if (deleted.has(sf.id)) continue;
      const idx = merged.findIndex((f) => f.id === sf.id);
      if (idx >= 0) {
        // server wins if newer
        if (sf.updatedAt > merged[idx].updatedAt) merged[idx] = sf;
      } else {
        merged.push(sf);
      }
    }
    saveFiles(merged);
  } catch {
    // API unavailable (local dev without backend) — silent fail
  }
}

/** Push a single file to the server */
export async function pushFile(username: string, file: SavedFile): Promise<void> {
  try {
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: username, file }),
    });
  } catch {
    // silent fail
  }
}

/** Remove a file from the server */
export async function removeFileFromServer(username: string, fileId: string): Promise<void> {
  try {
    await fetch(`/api/files?user=${encodeURIComponent(username)}&fileId=${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    });
  } catch {
    // silent fail
  }
}
