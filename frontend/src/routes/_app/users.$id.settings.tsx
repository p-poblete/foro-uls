import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUser, fetchCareers, updateUser, deleteUser } from "@/lib/api";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GENDER_LABELS } from "@/constants";
import { ImageUpload } from "@/components/ImageUpload";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { requireSelf, clearSession, logout, updateStoredUser } from "@/lib/auth";
import type { Gender } from "@/types";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/users/$id/settings")({
  // Solo tu propia configuración: cambiar el id en la URL redirige a la tuya.
  beforeLoad: ({ params }) => requireSelf(params.id),
  head: () => ({ meta: [{ title: "Configuración — Readuls" }] }),
  component: UserSettingsPage,
});

function UserSettingsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError } = useQuery({ queryKey: ["user", id], queryFn: () => fetchUser(id) });
  const { data: careers } = useQuery({ queryKey: ["careers"], queryFn: fetchCareers });

  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState<Gender>("MALE");
  const [career, setCareer] = useState("");

  const [notifLike, setNotifLike] = useState(true);
  const [notifComment, setNotifComment] = useState(true);
  const [notifCommunity, setNotifCommunity] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);

  const [profileVisibility, setProfileVisibility] = useState("PUBLIC");
  const [showEmail, setShowEmail] = useState(false);
  const [allowDM, setAllowDM] = useState(true);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username);
    setAvatar(user.profile_image);
    setGender(user.gender);
    setCareer(user.career_id);
  }, [user]);

  if (isLoading) return <p className="text-center text-muted-foreground py-10">Cargando…</p>;
  if (isError || !user) return <p className="text-center py-10">Usuario no encontrado.</p>;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateUser(user!.id, { display_name: username, avatar_url: avatar, bio, gender, career_id: career || undefined });
      updateStoredUser({ username, profile_image: avatar, gender, career_id: career });
      await queryClient.invalidateQueries({ queryKey: ["user", user!.id] });
      toast.success("Perfil actualizado");
    } catch {
      toast.error("No se pudo actualizar el perfil");
    }
  }
  function saveNotifs(e: React.FormEvent) { e.preventDefault(); toast.success("Preferencias de notificación guardadas"); }
  function savePrivacy(e: React.FormEvent) { e.preventDefault(); toast.success("Privacidad actualizada"); }

  async function deleteAccount() {
    if (!confirm("¿Estás seguro? Esta acción es irreversible.")) return;
    try {
      await deleteUser(user!.id);
      clearSession();
      toast.success("Cuenta eliminada");
      navigate({ to: "/" });
    } catch {
      toast.error("No se pudo eliminar la cuenta");
    }
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <FeedHeader title="Configuración" subtitle="Administra tu cuenta y preferencias" />
      <Tabs defaultValue="profile">
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="privacy">Privacidad</TabsTrigger>
          <TabsTrigger value="account">Cuenta</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <form onSubmit={saveProfile} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <ImageUpload label="Foto de perfil" prefix="avatars" variant="avatar" value={avatar} onChange={setAvatar} />
            <div>
              <Label htmlFor="u">Usuario</Label>
              <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bio">Biografía</Label>
              <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={280} placeholder="Cuéntanos sobre ti..." />
              <p className="text-xs text-muted-foreground mt-1">{bio.length}/280</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Género</Label>
                <Select value={gender} onValueChange={(v: Gender) => setGender(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Carrera</Label>
                <Select value={career} onValueChange={setCareer}>
                  <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                  <SelectContent>
                    {(careers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="rounded-full">Guardar cambios</Button>
          </form>
        </TabsContent>

        <TabsContent value="notifications">
          <form onSubmit={saveNotifs} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <Row label="Likes en tus publicaciones" checked={notifLike} onChange={setNotifLike} />
            <Row label="Comentarios en tus publicaciones" checked={notifComment} onChange={setNotifComment} />
            <Row label="Actividad en comunidades de las que soy miembro" checked={notifCommunity} onChange={setNotifCommunity} />
            <Separator />
            <Row label="Recibir notificaciones por correo" checked={notifEmail} onChange={setNotifEmail} />
            <Button type="submit" className="rounded-full">Guardar preferencias</Button>
          </form>
        </TabsContent>

        <TabsContent value="privacy">
          <form onSubmit={savePrivacy} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div>
              <Label>Visibilidad del perfil</Label>
              <Select value={profileVisibility} onValueChange={setProfileVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Público — visible para toda la ULS</SelectItem>
                  <SelectItem value="COMMUNITY">Solo miembros de mis comunidades</SelectItem>
                  <SelectItem value="PRIVATE">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Row label="Mostrar mi correo institucional" checked={showEmail} onChange={setShowEmail} />
            <Row label="Permitir mensajes directos" checked={allowDM} onChange={setAllowDM} />
            <Button type="submit" className="rounded-full">Guardar privacidad</Button>
          </form>
        </TabsContent>

        <TabsContent value="account">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div>
              <Label>Correo</Label>
              <Input value={user.email} disabled />
            </div>
            <div>
              <Label>Cambiar contraseña</Label>
              <div className="grid gap-2 mt-1">
                <Input type="password" placeholder="Contraseña actual" />
                <Input type="password" placeholder="Nueva contraseña (mín. 8 caracteres)" />
                <Input type="password" placeholder="Confirmar nueva contraseña" />
              </div>
              <Button className="mt-2 rounded-full" onClick={() => toast.success("Contraseña actualizada (mock)")}>
                Actualizar contraseña
              </Button>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-semibold text-destructive">Zona de peligro</p>
              <p className="text-xs text-muted-foreground mt-1">
                Al eliminar tu cuenta perderás todo tu contenido de forma permanente.
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" onClick={() => logout()}>
                  Cerrar sesión
                </Button>
                <Button variant="destructive" onClick={deleteAccount}>Eliminar cuenta</Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center mt-6">
        <Link to="/rules" className="hover:underline">Reglas de ReadULS</Link>
      </p>
    </div>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
