import { createFileRoute } from "@tanstack/react-router";
import { FeedHeader } from "@/components/feed/FeedHeader";

export const Route = createFileRoute("/_app/rules")({
  head: () => ({ meta: [{ title: "Reglas de ReadULS" }] }),
  component: () => (
    <div className="max-w-2xl mx-auto w-full">
      <FeedHeader title="Reglas de ReadULS" subtitle="Cómo convivimos en esta comunidad" />
      <ol className="space-y-3 rounded-xl border border-border bg-card p-6 list-decimal list-inside">
        <li><span className="font-medium">Respeto</span> — Trata a todos con cortesía. No se tolera acoso ni discriminación.</li>
        <li><span className="font-medium">Identidad ULS</span> — Usa tu correo institucional al registrarte.</li>
        <li><span className="font-medium">Sin spam</span> — Evita autopromoción excesiva o contenido repetido.</li>
        <li><span className="font-medium">Veracidad</span> — Cita fuentes cuando compartas información académica.</li>
        <li><span className="font-medium">Privacidad</span> — No compartas datos personales de terceros.</li>
        <li><span className="font-medium">Etiquetas</span> — Usa Ayuda, Discusión, Anuncio o Caso según corresponda.</li>
      </ol>
    </div>
  ),
});
