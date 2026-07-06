import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

/** Layout route: wraps everything except /login and /register with the app shell. */
export const Route = createFileRoute("/_app")({
  component: () => (
    <AppShell />
  ),
});

// Silence unused import warning in some TS setups
export const _Outlet = Outlet;
