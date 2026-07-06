import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/constants";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.bookmarks) ?? "[]"); }
  catch { return []; }
}

function write(ids: string[]) {
  localStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(ids));
  window.dispatchEvent(new Event("bookmarks-change"));
}

export function useBookmarks() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(read());
    const on = () => setIds(read());
    window.addEventListener("bookmarks-change", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("bookmarks-change", on);
      window.removeEventListener("storage", on);
    };
  }, []);

  function toggle(id: string) {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    write(next);
  }

  return { ids, has: (id: string) => ids.includes(id), toggle };
}
