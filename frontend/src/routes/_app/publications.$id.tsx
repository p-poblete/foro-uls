import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout de /publications/$id: renderiza el hijo (detalle en el index, /edit).
export const Route = createFileRoute("/_app/publications/$id")({
  component: () => <Outlet />,
});
