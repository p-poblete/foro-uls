import type { PublicationLabel, Publication } from "@/types";
import { ALL_LABELS, LABEL_LABELS } from "@/constants";

export type SortKey = "recent" | "popular";

export interface FeedFilter {
  sort: SortKey;
  label: PublicationLabel | "ALL";
}

export function applyFeedFilter(items: Publication[], filter: FeedFilter): Publication[] {
  let out = items;
  if (filter.label !== "ALL") out = out.filter((p) => p.label === filter.label);
  const arr = [...out];
  if (filter.sort === "recent") {
    arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  } else {
    arr.sort((a, b) => (b.like_count - b.dislike_count) - (a.like_count - a.dislike_count));
  }
  return arr;
}

export const LABEL_OPTIONS: Array<{ value: PublicationLabel | "ALL"; label: string }> = [
  { value: "ALL", label: "Todas" },
  ...ALL_LABELS.map((l) => ({ value: l, label: LABEL_LABELS[l] })),
];
