import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { uploadImage } from "@/lib/api";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  prefix?: string;
  /** Alto de la vista previa. Por defecto rectángulo; "avatar" = círculo. */
  variant?: "rect" | "avatar";
}

const MAX_MB = 5;

export function ImageUpload({ value, onChange, label, prefix = "uploads", variant = "rect" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("El archivo debe ser una imagen.");
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`La imagen supera ${MAX_MB} MB.`);
    setUploading(true);
    try {
      const url = await uploadImage(file, prefix);
      onChange(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  const isAvatar = variant === "avatar";

  return (
    <div>
      {label && <Label className="mb-1 block">{label}</Label>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="Vista previa"
            className={isAvatar ? "h-20 w-20 rounded-full object-cover border" : "max-h-48 rounded-lg border object-cover"}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1 shadow"
            aria-label="Quitar imagen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={
            isAvatar
              ? "h-20 w-20 rounded-full border border-dashed flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition"
              : "w-full rounded-lg border border-dashed py-6 flex flex-col items-center gap-1 text-sm text-muted-foreground hover:border-primary hover:text-primary transition"
          }
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          {!isAvatar && <span>{uploading ? "Subiendo…" : "Subir imagen"}</span>}
        </button>
      )}
    </div>
  );
}
