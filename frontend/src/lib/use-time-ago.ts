import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

/** Intervalo de refresco según antigüedad (patrón Reddit/Twitter): valores
 * recientes cambian rápido ("hace segundos" → "hace 1 min") así que se
 * refrescan cada 10s; ya pasado el día, una vez por minuto sobra. */
function refreshMs(iso: string): number {
  const ageSec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (ageSec < 60) return 10_000;
  if (ageSec < 3600) return 30_000;
  return 60_000;
}

/** `timeAgo(iso)` que se mantiene actualizado mientras el componente está
 * montado. `timeAgo` por sí solo es una función pura: calculada una vez en el
 * render, nunca vuelve a evaluarse aunque pase el tiempo (por eso un
 * comentario se quedaba en "hace unos segundos" para siempre). */
export function useTimeAgo(iso: string): string {
  const [label, setLabel] = useState(() => timeAgo(iso));

  useEffect(() => {
    setLabel(timeAgo(iso)); // sincroniza si `iso` cambia
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setLabel(timeAgo(iso));
      id = setTimeout(tick, refreshMs(iso));
    };
    id = setTimeout(tick, refreshMs(iso));
    return () => clearTimeout(id);
  }, [iso]);

  return label;
}

/** Fuerza un re-render periódico del componente que lo llama. Para listas
 * donde varios `timeAgo(x)` se calculan inline dentro de un `.map()` (sin un
 * subcomponente propio por fila): un solo hook en el padre basta para que
 * todos los timestamps de la lista se refresquen juntos, sin tener que
 * extraer una fila por ítem solo para poder usar useTimeAgo individualmente. */
export function useClockTick(intervalMs = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
