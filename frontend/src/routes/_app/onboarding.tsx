import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCareers, updateUser } from "@/lib/api";
import { GENDER_LABELS, STORAGE_KEYS } from "@/constants";
import { requireAuth, updateStoredUser, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Gender } from "@/types";
import { toast } from "sonner";
import { GraduationCap, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/onboarding")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [{ title: "Bienvenido — Readuls" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const user = useAuth();
  const navigate = useNavigate();
  const { data: careers } = useQuery({ queryKey: ["careers"], queryFn: fetchCareers });
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Gender>(user?.gender ?? "MALE");
  const [careerId, setCareerId] = useState(user?.career_id ?? "");

  useEffect(() => {
    if (user?.gender) setGender(user.gender);
    if (user?.career_id) setCareerId(user.career_id);
  }, [user]);

  async function finish() {
    if (user) {
      try {
        await updateUser(user.id, { gender, career_id: careerId || undefined });
      } catch { /* seguimos igual: guardamos en sesión local */ }
    }
    const career = (careers ?? []).find((c) => c.id === careerId);
    updateStoredUser({ gender, career_id: careerId, career });
    localStorage.setItem(STORAGE_KEYS.onboarding, "1");
    toast.success("¡Perfil configurado!");
    navigate({ to: "/" });
  }

  return (
    <div className="max-w-lg mx-auto w-full">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Bienvenido a Readuls</span>
        </div>
        <h1 className="font-display text-3xl font-semibold mt-2">
          {step === 0 ? "Cuéntanos sobre ti" : "Tu carrera"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalizaremos tu feed con contenido relevante para ti.
        </p>

        <div className="mt-6 space-y-5">
          {step === 0 ? (
            <div>
              <Label>Género</Label>
              <Select value={gender} onValueChange={(v: Gender) => setGender(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GENDER_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4" /> Carrera</Label>
              <Select value={careerId} onValueChange={setCareerId}>
                <SelectTrigger><SelectValue placeholder="Selecciona tu carrera" /></SelectTrigger>
                <SelectContent>
                  {(careers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>Atrás</Button>
          {step === 0 ? (
            <Button onClick={() => setStep(1)} className="rounded-full">Siguiente</Button>
          ) : (
            <Button onClick={finish} className="rounded-full">Comenzar</Button>
          )}
        </div>

        <div className="flex justify-center gap-1.5 mt-6">
          {[0, 1].map((i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i === step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
