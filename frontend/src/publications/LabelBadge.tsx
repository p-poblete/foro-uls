import type { PublicationLabel } from "@/types";
import { LABEL_CLASS, LABEL_LABELS } from "@/constants";

export function LabelBadge({ label }: { label: PublicationLabel }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${LABEL_CLASS[label]}`}>
      {LABEL_LABELS[label]}
    </span>
  );
}
