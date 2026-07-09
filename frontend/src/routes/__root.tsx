import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { STORAGE_KEYS } from "@/constants";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La ruta que buscas no existe o fue movida.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Ocurrió un error</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HablaLaSalle — Foro ULS" },
      { name: "description", content: "Foro de discusión por hilos para la Universidad La Salle (ULS): comunidades, publicaciones y comentarios anidados." },
      { property: "og:title", content: "HablaLaSalle — Foro ULS" },
      { property: "og:description", content: "Foro de discusión por hilos para la Universidad La Salle (ULS): comunidades, publicaciones y comentarios anidados." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "HablaLaSalle — Foro ULS" },
      { name: "twitter:description", content: "Foro de discusión por hilos para la Universidad La Salle (ULS): comunidades, publicaciones y comentarios anidados." },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        // No-flash: aplica el tema guardado antes del primer paint. Default: claro.
        // La clave es STORAGE_KEYS.theme; queda literal porque corre antes del bundle.
        children:
          "try{if(localStorage.getItem('readuls_theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // El error de dominio en el login redirige por Auth0-logout antes de poder
  // mostrar el toast; el motivo queda en localStorage y se muestra al aterrizar.
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEYS.loginError) === "dominio") {
      localStorage.removeItem(STORAGE_KEYS.loginError);
      toast.error("Solo se admiten cuentas @ulasalle.edu.pe. Puedes intentar con otra cuenta.");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
