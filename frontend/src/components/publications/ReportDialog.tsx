import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REPORT_REASONS } from "@/constants";
import { createReport } from "@/lib/api";
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
  const [sending, setSending] = useState(false); // evita el doble-submit

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      await createReport({
        target_type: targetType,
        target_id: targetId,
        target_label: targetLabel,
        reason,
        detail,
      });
      toast.success("Reporte enviado. Un moderador lo revisará.");
      onOpenChange(false);
      setDetail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el reporte (¿iniciaste sesión?)");
    } finally {
      setSending(false);
    }
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
            <Button type="submit" variant="destructive" disabled={sending}>
              {sending ? "Enviando…" : "Enviar reporte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
