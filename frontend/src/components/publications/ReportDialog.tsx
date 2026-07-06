import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REPORT_REASONS, STORAGE_KEYS } from "@/constants";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: "publication" | "comment" | "user" | "community";
  targetId: string;
  targetLabel?: string;
}

export function ReportDialog({ open, onOpenChange, targetType, targetId, targetLabel }: Props) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].value);
  const [detail, setDetail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const arr = JSON.parse(localStorage.getItem(STORAGE_KEYS.reports) ?? "[]");
      arr.push({
        id: `r-${Date.now()}`,
        target_type: targetType,
        target_id: targetId,
        target_label: targetLabel,
        reason,
        detail,
        status: "PENDING",
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(STORAGE_KEYS.reports, JSON.stringify(arr));
    } catch { /* noop */ }
    toast.success("Reporte enviado. Nuestro equipo lo revisará.");
    onOpenChange(false);
    setDetail("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reportar contenido</DialogTitle>
          <DialogDescription>
            {targetLabel ? `Reportando: ${targetLabel}` : "Elige un motivo de reporte."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-2">
                <RadioGroupItem value={r.value} id={`r-${r.value}`} />
                <Label htmlFor={`r-${r.value}`} className="cursor-pointer font-normal">{r.label}</Label>
              </div>
            ))}
          </RadioGroup>
          <div>
            <Label htmlFor="detail">Detalles adicionales (opcional)</Label>
            <Textarea id="detail" value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={500} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="destructive">Enviar reporte</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
