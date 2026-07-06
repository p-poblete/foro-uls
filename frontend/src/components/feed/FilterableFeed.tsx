import { useState } from "react";
import { applyFeedFilter, LABEL_OPTIONS, type FeedFilter, type SortKey } from "@/lib/feed-filter";
import { PublicationList } from "@/components/publications/PublicationList";
import type { Publication, PublicationLabel } from "@/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flame, Clock } from "lucide-react";

export function FilterableFeed({
  items,
  showLabelFilter = true,
  defaultLabel = "ALL",
}: {
  items: Publication[];
  showLabelFilter?: boolean;
  defaultLabel?: PublicationLabel | "ALL";
}) {
  const [filter, setFilter] = useState<FeedFilter>({ sort: "recent", label: defaultLabel });
  const visible = applyFeedFilter(items, filter);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs value={filter.sort} onValueChange={(v) => setFilter((f) => ({ ...f, sort: v as SortKey }))}>
          <TabsList>
            <TabsTrigger value="recent" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Recientes</TabsTrigger>
            <TabsTrigger value="popular" className="gap-1.5"><Flame className="h-3.5 w-3.5" />Populares</TabsTrigger>
          </TabsList>
        </Tabs>
        {showLabelFilter && (
          <Select
            value={filter.label}
            onValueChange={(v) => setFilter((f) => ({ ...f, label: v as PublicationLabel | "ALL" }))}
          >
            <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LABEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <PublicationList items={visible} />
    </>
  );
}
