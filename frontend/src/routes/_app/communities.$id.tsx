import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout de /communities/$id: renderiza el hijo (detalle en el index, /edit, /members).
export const Route = createFileRoute("/_app/communities/$id")({
  component: () => <Outlet />,
});
