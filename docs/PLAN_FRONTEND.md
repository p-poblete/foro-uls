# Plan Frontend — Unificación con Backend v1

## Estado actual

- Todas las rutas construidas y navegables.
- Datos leídos exclusivamente de `src/lib/mock-data.ts`.
- `apiFetch()` existe en `src/lib/api-client.ts` pero no se usa en ninguna ruta.
- `mockLogin()` acepta cualquier credencial y guarda `CURRENT_USER` hardcodeado.
- No existe archivo `.env`.
- No hay guard de autenticación: cualquier URL es accesible sin sesión.

---

## Paso 1 — Configuración base

### 1.1 Archivo de entorno
Crear `frontend/.env`:
```
VITE_API_BASE_URL=http://localhost:5000
VITE_APP_NAME=HablaLaSalle
VITE_AUTH0_DOMAIN=<tu-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<client-id-de-la-spa-en-auth0>
VITE_AUTH0_AUDIENCE=https://readuls-api
```
Crear también `frontend/.env.example` con los mismos campos en blanco para el repositorio.

### 1.2 Instalar el SDK de Auth0
```bash
bun add @auth0/auth0-react
```

### 1.3 Auth guard en el layout principal
En `src/routes/_app.tsx`, agregar un `beforeLoad` que use el hook de Auth0 para redirigir a `/login` si no hay sesión activa:

```ts
import { useAuth0 } from "@auth0/auth0-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }
  return <AppShell />;
}
```

---

## Paso 2 — Autenticación con Auth0

Con Auth0, el frontend no necesita formularios de login/register propios. Auth0 gestiona toda la UI de autenticación (incluyendo el botón "Continuar con Google").

### 2.1 Configurar `Auth0Provider` en `src/routes/__root.tsx`
Envolver el árbol de la app con el proveedor de Auth0:
```ts
import { Auth0Provider } from "@auth0/auth0-react";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </Auth0Provider>
  );
}
```

### 2.2 Simplificar `login.tsx`
La página de login ya no necesita formulario: solo un botón que inicia el flujo de Auth0.
```ts
function LoginPage() {
  const { loginWithRedirect } = useAuth0();
  return (
    <AuthShell title="Bienvenido" subtitle="Inicia sesión con tu cuenta de Google ULS">
      <Button className="w-full" onClick={() => loginWithRedirect()}>
        Continuar con Google
      </Button>
    </AuthShell>
  );
}
```
`register.tsx` puede redirigir a `/login` — el registro ocurre automáticamente en el primer login.

### 2.3 Actualizar `apiFetch` para enviar el token de Auth0
Reemplazar la lectura desde localStorage por `getAccessTokenSilently()` del SDK:
```ts
// src/lib/api-client.ts
import { useAuth0 } from "@auth0/auth0-react";

// Versión para usar fuera de componentes (ej. en loaders de TanStack Router):
// Exponer el token como una función configurable al inicializar el router.
// Dentro de componentes, usar el hook useAuth0() directamente.
```

En la práctica, la forma más limpia en TanStack Router es pasar `getAccessTokenSilently` como parte del contexto del router:
```ts
// router.tsx
export const getRouter = (getToken: () => Promise<string>) => {
  const queryClient = new QueryClient();
  return createRouter({ routeTree, context: { queryClient, getToken } });
};
```

### 2.4 Obtener el perfil local tras el login
Después de que Auth0 redirige de vuelta, llamar a `GET /api/auth/me` para obtener el perfil del usuario en nuestra BD (incluye `id`, `career`, etc.) y guardarlo en contexto/estado global.

### 2.5 Logout
```ts
const { logout } = useAuth0();
// En el Navbar:
<Button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
  Cerrar sesión
</Button>
```

### 2.6 Alinear el tipo `UserProfile`
El backend actualmente devuelve `avatar_url`; el frontend usa `profile_image`. Actualizar `src/types/index.ts` + `to_dict()` del backend para usar un nombre consistente. Se recomienda mantener `profile_image` / `cover_image` del frontend.

---

## Paso 3 — Vistas de lectura

Patrón estándar para cada ruta: usar `useQuery` de TanStack Query dentro del componente, o un `loader` en la definición de la ruta. El `queryClient` ya está disponible en el contexto del router.

### 3.1 Feed principal (`src/routes/_app/index.tsx`)
```ts
const { data } = useQuery({
  queryKey: ["posts"],
  queryFn: () => apiFetch<{ posts: Publication[] }>("/posts"),
});
```
Reemplazar `PUBLICATIONS` por `data?.posts ?? []`.

### 3.2 Feed de anuncios (`feed.announcements.tsx`)
```ts
apiFetch<{ posts: Publication[] }>("/posts?label=ANNOUNCEMENT")
```

### 3.3 Feed por carrera (`feed.career.$careerCode.tsx`)
```ts
apiFetch<{ posts: Publication[] }>(`/posts?career_code=${careerCode}`)
```
El parámetro `careerCode` se obtiene de `Route.useParams()`.

### 3.4 Listado de comunidades (`communities.index.tsx`)
```ts
apiFetch<{ communities: Community[] }>("/communities")
```

### 3.5 Detalle de comunidad (`communities.$id.tsx`)
Dos queries en paralelo:
```ts
apiFetch<{ community: Community }>(`/communities/${id}`)
apiFetch<{ posts: Publication[] }>(`/communities/${id}/posts`)
```

### 3.6 Detalle de publicación (`publications.$id.tsx`)
```ts
apiFetch<{ post: Publication }>(`/posts/${id}`)
apiFetch<{ comments: Comment[] }>(`/posts/${id}/comments`)
```
Los replies se cargan bajo demanda con `?parent_id=<commentId>`.

### 3.7 Perfil de usuario (`users.$id.tsx`)
```ts
apiFetch<{ user: UserProfile }>(`/users/${id}`)
```
Mostrar publicaciones del usuario: `apiFetch<{ posts: Publication[] }>(`/posts?author_id=${id}`)`.

### 3.8 Búsqueda (`search.tsx`)
```ts
apiFetch<{ posts: Publication[]; communities: Community[] }>(`/search?q=${query}`)
```
Mientras el backend no tenga este endpoint, mantener el filtro sobre el listado en memoria como está ahora.

---

## Paso 4 — Acciones de escritura

### 4.1 Crear publicación
El formulario de creación (en `communities.create.tsx` o modal) envía:
```ts
apiFetch("/posts", { method: "POST", body: JSON.stringify({ title, content, community_id, label, tags }) })
```
Si incluye imagen, usar `FormData` en lugar de JSON (el backend ya soporta `multipart/form-data`).

### 4.2 Crear comentario
En el detalle de publicación:
```ts
apiFetch(`/posts/${postId}/comments`, {
  method: "POST",
  body: JSON.stringify({ content, parent_id: parentCommentId ?? null }),
})
```
El `author_id` lo pone el backend leyendo el JWT — no enviarlo desde el cliente.

### 4.3 Votar publicación
```ts
apiFetch(`/posts/${postId}/vote`, {
  method: "POST",
  body: JSON.stringify({ vote_type: 1 }), // 1 o -1
})
```
Actualizar el estado local con `queryClient.invalidateQueries(["posts"])` tras el voto.

### 4.4 Votar comentario
```ts
apiFetch(`/comments/${commentId}/vote`, { method: "POST", body: JSON.stringify({ vote_type: 1 }) })
```

### 4.5 Unirse / salir de comunidad
```ts
// unirse
apiFetch(`/communities/${id}/join`, { method: "POST" })
// salir
apiFetch(`/communities/${id}/leave`, { method: "DELETE" })
```
Actualizar `is_member` en la UI de forma optimista.

### 4.6 Editar perfil (`users.$id.settings.tsx`)
```ts
apiFetch(`/users/${userId}`, {
  method: "PUT",
  body: JSON.stringify({ display_name, bio, gender, career_id }),
})
```

### 4.7 Crear comunidad (`communities.create.tsx`)
```ts
apiFetch("/communities", {
  method: "POST",
  body: JSON.stringify({ name, description, visibility }),
})
```

---

## Paso 5 — Limpieza final

- Eliminar todos los imports de `mock-data.ts` en las rutas.
- Eliminar `src/lib/auth.ts` completamente: `useAuth()`, `setSession()`, `clearSession()` y `mockLogin()` quedan reemplazados por los hooks de `@auth0/auth0-react`.
- Revisar `src/components/publications/PublicationCard.tsx` y componentes relacionados para que soporten campos `null` del backend real (el mock siempre tiene todos los campos).
- Agregar estados de carga (`skeleton`) y error en todas las vistas que usan `useQuery`.

---

## Orden de ejecución

```
1. Paso 1 — .env + instalar @auth0/auth0-react + auth guard en _app.tsx
2. Paso 2.1 / 2.2 — Auth0Provider + página de login simplificada
3. Paso 2.3 / 2.4 — apiFetch con token de Auth0 + GET /api/auth/me al cargar
4. Paso 3.1 a 3.4 — vistas de lectura
5. Paso 4.3 / 4.4 — votos (acción más sencilla)
6. Paso 3.5 a 3.8 — resto de vistas de lectura
7. Paso 4.1 a 4.7 — acciones de escritura completas
8. Paso 5 — limpieza (eliminar mock-data, auth.ts legacy)
```
