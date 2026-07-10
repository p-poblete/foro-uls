# Frontend — HablaLaSalle (Readuls)

SPA con **server-side rendering** construida con **TanStack Start** (React 19)
sobre **Vite**, empaquetada con **Bun** y desplegada como **Cloudflare
Worker**. Consume la API REST del backend y maneja la sesión con el
`access_token` que entrega Auth0.

## Resumen técnico

| | |
|---|---|
| Framework | TanStack Start (React 19, SSR) + TanStack Router (file-based) |
| Estado de servidor | TanStack Query |
| Estilos | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| Runtime / gestor de paquetes | Bun |
| Build | Vite 7, preset Cloudflare (nitro) |
| Despliegue | Cloudflare Workers (`wrangler deploy`) |
| Formularios | react-hook-form + zod |

## Estructura

```
frontend/src/
├── routes/                Rutas file-based (TanStack Router)
│   ├── __root.tsx           Shell HTML, fuentes, script no-flash de tema
│   ├── login.tsx             Login (botón único: Continuar con Google)
│   ├── oauth.callback.tsx     Recibe el access_token de Auth0, abre sesión
│   ├── register.tsx            Redirige a /login (el alta la hace Auth0)
│   └── _app/                    Rutas autenticadas/protegidas (layout con Navbar+Sidebar)
│       ├── index.tsx, feed.*.tsx        Feed general y filtrado (label, carrera, anuncios)
│       ├── communities.*.tsx              Listado, detalle, crear, editar, miembros
│       ├── publications.$id.*.tsx           Detalle, edición de publicaciones
│       ├── users.$id.*.tsx                    Perfil público y configuración propia
│       ├── notifications.tsx                    Campana de notificaciones
│       ├── moderation.tsx                         Panel de moderación (gate por rol)
│       ├── bookmarks.tsx, search.tsx, rules.tsx     Guardados, búsqueda, reglas
│       └── onboarding.tsx                             Primer login (elegir carrera)
├── components/
│   ├── layout/             AppShell, Navbar, Sidebar, RightRail
│   ├── publications/        PublicationCard/List/Composer, LabelBadge, ReportDialog
│   ├── feed/                  FeedHeader, FilterableFeed
│   ├── theme/                  ThemeToggle
│   ├── ImageUpload.tsx           Subida de imágenes reutilizable (posts, avatar, comunidad)
│   └── ui/                        Componentes shadcn/ui (Radix) — primitivos de UI
├── lib/
│   ├── api-client.ts       Cliente HTTP base: adjunta Bearer token, parsea errores
│   ├── api.ts               Funciones de dominio (fetchFeed, createPost, joinCommunity…) + adaptadores backend→frontend
│   ├── auth.ts                Sesión (localStorage), guards de ruta, lectura de roles del JWT
│   └── theme.ts                 Tema claro/oscuro (fuente única de verdad)
├── types/index.ts          Tipos del dominio (Publication, Community, Notification, Report…)
└── constants/index.ts      Enums de UI, labels, STORAGE_KEYS, API_BASE_URL
```

## Autenticación (cliente)

El frontend **no implementa login propio**: solo redirige al backend, que a su
vez redirige a Auth0.

1. `login.tsx` → `window.location.href = ${API_BASE_URL}/api/auth/login`.
2. Auth0 gestiona login + consentimiento (con Google institucional detrás).
3. El backend redirige a `oauth.callback.tsx` con el `access_token` en el
   **fragmento** de la URL (`#token=...`), que nunca llega a ningún servidor.
   Ese fragmento se limpia de la URL de inmediato (`history.replaceState`).
4. El callback valida el token contra `GET /api/auth/me` y guarda sesión
   (`lib/auth.ts`: `setSession`) en `localStorage`.
5. `api-client.ts` adjunta `Authorization: Bearer <token>` en cada request.
   Un `401` limpia la sesión local automáticamente.
6. `logout()` limpia la sesión local **y** cierra la sesión SSO en Auth0
   (`/api/auth/logout`), para poder reintentar el login con otra cuenta.

### Guards de ruta

- `requireAuth()` — exige sesión; si no hay, redirige a `/login`.
- `requireSelf(id)` — para rutas personales (`/users/$id/settings`): si el
  `id` de la URL no es el del usuario logueado, redirige a la ruta propia.
  Se aplica tanto en `beforeLoad` como con una re-verificación dentro del
  componente (defensa en profundidad: una carga directa por URL puede saltar
  el guard en SSR).
- `isModerator()` — decodifica el claim de roles del JWT (`https://readuls/roles`)
  para decidir qué mostrar en la UI (menú, panel de moderación). La
  autorización real siempre la aplica el backend; esto solo evita mostrar
  algo que el servidor rechazaría.

## Manejo de estado

- **Datos remotos:** TanStack Query (`useQuery`/`useQueryClient`), *fetching*
  100% client-side (no hay loaders SSR que llamen al backend).
- **Sesión y tema:** `localStorage` + eventos custom (`auth-change`,
  `theme-change`) para sincronizar todos los componentes montados sin un
  store global.
- **Adaptadores:** `lib/api.ts` traduce el shape del backend (ids numéricos,
  `snake_case`, `vote_score`) a los tipos del dominio del frontend
  (`Publication`, `Community`…), incluyendo cómputo de `like_count`/
  `dislike_count` a partir de `vote_score`.

## Tema claro/oscuro

- Variables CSS en `styles.css` (`:root` y `.dark`, paleta v2 con contraste
  reforzado para el modo oscuro).
- Default **claro** si no hay preferencia guardada (no se hereda del SO).
- Un script inline en `__root.tsx` aplica la clase `dark` **antes del primer
  paint** (evita el parpadeo/flash al cargar).
- `lib/theme.ts` es la única fuente de verdad en cliente; todos los
  `ThemeToggle` quedan sincronizados vía el evento `theme-change`.

## Funcionalidades por área

**Comunidades** — crear con privacidad (pública/restringida/privada), unirse
(directo o pendiente de aprobación según privacidad), salir, ver miembros,
aprobar/expulsar (dueño), editar y archivar (dueño o moderador).

**Publicaciones y comentarios** — crear con etiqueta e imagen, votar, comentar
en hilos anidados, editar/borrar (autor o moderador), reportar.

**Notificaciones** — lista con distinción visual entre notificaciones
sociales (avatar + @usuario) y anónimas/de sistema (ícono de escudo, sin
autor, usadas para reportes y moderación), marcar todas como leídas.

**Moderación** (`moderation.tsx`, visible solo con rol `moderator`):
- Reportes: ver quién reportó, resolver con motivo (eliminar contenido,
  mantener o descartar).
- Comunidades: suspender/reactivar (toggle), archivar, atajos a editar y
  miembros.
- Usuarios: búsqueda y desactivación de cuentas.

## Variables de entorno

```
VITE_API_BASE_URL=https://<backend>     # se hornea en el build; cambiarla exige recompilar
VITE_APP_NAME=HablaLaSalle
```

Ver [`.env.example`](.env.example).

## Desarrollo local

```bash
cd frontend
bun install
cp .env.example .env   # apunta VITE_API_BASE_URL al backend (local o desplegado)
bun run dev             # http://localhost:8080 (o el puerto configurado)
```

Otros scripts: `bun run build` (build de producción), `bun run lint`,
`bun run format`, `bun run deploy` (build + `wrangler deploy`).

## Despliegue

Cloudflare Workers, vía Wrangler:

```bash
bun run build
bunx wrangler deploy -c .output/server/wrangler.json --name foro-uls
```

Guía completa (incluye por qué `--name` y la config de Auth0) en
[`../docs/DEPLOY.md`](../docs/DEPLOY.md).
