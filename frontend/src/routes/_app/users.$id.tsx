import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout de /users/$id: renderiza el hijo (perfil en el index, /settings, etc.).
export const Route = createFileRoute("/_app/users/$id")({
  component: () => <Outlet />,
});
