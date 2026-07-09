import { createFileRoute, redirect } from "@tanstack/react-router";

// El registro dejó de ser manual: con Auth0, la primera vez que alguien entra
// con su Google institucional, su cuenta se provisiona sola en el callback.
// /register redirige al login para no mantener un alta paralela sin OAuth.
export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
