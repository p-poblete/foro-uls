import { STORAGE_KEYS } from "@/constants";
import type { PublicationLabel } from "@/types";

export interface Draft {
  id: string;
  title: string;
  content: string;
  community_id: string;
  label: PublicationLabel | null;
  tags: string;
  external_link: string;
  image_url: string;
  updated_at: string;
}

export function readDrafts(): Draft[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.drafts) ?? "[]"); }
  catch { return []; }
}

export function saveDraft(d: Draft) {
  const all = readDrafts().filter((x) => x.id !== d.id);
  all.unshift(d);
  localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(all.slice(0, 20)));
}

export function deleteDraft(id: string) {
  const all = readDrafts().filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(all));
}

export function emptyDraft(): Draft {
  return {
    id: `d-${Date.now()}`,
    title: "",
    content: "",
    community_id: "",
    label: null,
    tags: "",
    external_link: "",
    image_url: "",
    updated_at: new Date().toISOString(),
  };
}
