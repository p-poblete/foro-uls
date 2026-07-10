/**
 * Llamadas reales a la API + adaptadores del shape del backend a los tipos
 * del frontend. El backend usa PKs enteros y nombres distintos (content,
 * vote_score, avatar_url…); aquí los normalizamos a los tipos del dominio.
 */
import { apiFetch } from "@/lib/api-client";
import type {
  Career, Comment, Community, CommunityMembership, Notification, Publication,
  Report, UserProfile,
} from "@/types";

// ---------- shapes del backend ----------
type BackendUser = {
  id: number; email: string; username: string; avatar_url: string | null;
  gender: string | null; career_id: number | null; created_at: string;
};
type BackendCommunity = {
  id: number; name: string; description: string | null;
  owner_id: number; visibility: string; created_at: string;
  image_url?: string | null; banner_url?: string | null;
  member_count?: number; membership?: "active" | "pending" | null;
  status?: string;
};
type BackendPost = {
  id: number; title: string; content: string | null; image_url: string | null;
  external_link: string | null; label: string | null; vote_score: number;
  community_id: number; author_id: number; created_at: string;
  comment_count?: number; user_vote?: number;
  author?: BackendUser | null; community?: BackendCommunity | null;
};
type BackendComment = {
  _id: string; post_id: number; author_id: number; parent_id: string | null;
  content: string; image_url?: string | null; vote_score: number; created_at: string;
};

// ---------- adaptadores ----------
function mapUser(u: BackendUser): UserProfile {
  return {
    id: String(u.id),
    email: u.email,
    username: u.username,
    profile_image: u.avatar_url ?? null,
    cover_image: null,
    gender: (u.gender as UserProfile["gender"]) ?? "NON_BINARY",
    career_id: u.career_id != null ? String(u.career_id) : "",
    created_at: u.created_at,
  };
}

function mapCareer(c: { id: number; code: string; name: string }): Career {
  return { id: String(c.id), code: c.code, name: c.name };
}

function mapCommunity(c: BackendCommunity): Community {
  return {
    id: String(c.id),
    name: c.name,
    description: c.description ?? "",
    profile_image: c.image_url ?? null,
    cover_image: c.banner_url ?? null,
    privacy_level:
      c.visibility === "public" ? "PUBLIC" : c.visibility === "restricted" ? "RESTRICTED" : "PRIVATE",
    member_count: c.member_count ?? 0,
    membership: c.membership ?? null,
    status: c.status ?? "active",
    creator_id: String(c.owner_id),
    created_at: c.created_at,
  };
}

function mapPost(p: BackendPost): Publication {
  return {
    id: String(p.id),
    title: p.title,
    content_text: p.content,
    external_link: p.external_link,
    tags: [],
    label: (p.label as Publication["label"]) ?? null,
    multimedia: p.image_url ? [p.image_url] : [],
    community_id: String(p.community_id),
    author_id: String(p.author_id),
    like_count: p.vote_score > 0 ? p.vote_score : 0,
    dislike_count: p.vote_score < 0 ? -p.vote_score : 0,
    comment_count: p.comment_count ?? 0,
    created_at: p.created_at,
    community: p.community ? mapCommunity(p.community) : undefined,
    author: p.author ? mapUser(p.author) : undefined,
    user_reaction: p.user_vote === 1 ? "LIKE" : p.user_vote === -1 ? "DISLIKE" : null,
  };
}

/** Construye el árbol de comentarios a partir de la lista plana del backend. */
function buildCommentTree(flat: BackendComment[], authors: Map<string, UserProfile>): Comment[] {
  const nodes = new Map<string, Comment>();
  flat.forEach((c) => {
    nodes.set(c._id, {
      _id: c._id,
      publication_id: String(c.post_id),
      author_id: String(c.author_id),
      content_text: c.content,
      image_url: c.image_url ?? null,
      created_at: c.created_at,
      like_count: c.vote_score > 0 ? c.vote_score : 0,
      dislike_count: c.vote_score < 0 ? -c.vote_score : 0,
      parent_comment_id: c.parent_id,
      author: authors.get(String(c.author_id)),
      user_reaction: null,
      replies: [],
    });
  });
  const roots: Comment[] = [];
  nodes.forEach((node) => {
    if (node.parent_comment_id && nodes.has(node.parent_comment_id)) {
      nodes.get(node.parent_comment_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// ---------- lecturas ----------
/** El user_id opcional hace que el backend incluya el voto del usuario (para resaltarlo). */
function userQuery(userId?: string) {
  return userId ? `&user_id=${Number(userId)}` : "";
}

export async function fetchFeed(userId?: string): Promise<Publication[]> {
  const res = await apiFetch<{ data: BackendPost[] }>(`/posts?limit=100${userQuery(userId)}`);
  return res.data.map(mapPost);
}

export async function fetchPost(id: string, userId?: string): Promise<Publication> {
  const q = userId ? `?user_id=${Number(userId)}` : "";
  const res = await apiFetch<{ post: BackendPost }>(`/posts/${id}${q}`);
  return mapPost(res.post);
}

export async function fetchCommunities(): Promise<Community[]> {
  const res = await apiFetch<{ communities: BackendCommunity[] }>("/communities");
  return res.communities.map(mapCommunity);
}

export async function fetchCommunity(id: string): Promise<Community> {
  const res = await apiFetch<{ community: BackendCommunity }>(`/communities/${id}`);
  return mapCommunity(res.community);
}

export async function fetchCommunityPosts(id: string, userId?: string): Promise<Publication[]> {
  const q = userId ? `?user_id=${Number(userId)}` : "";
  const res = await apiFetch<{ posts: BackendPost[] }>(`/communities/${id}/posts${q}`);
  return res.posts.map(mapPost);
}

export async function fetchUsers(): Promise<UserProfile[]> {
  const res = await apiFetch<{ users: BackendUser[] }>("/users");
  return res.users.map(mapUser);
}

export async function fetchUser(id: string): Promise<UserProfile> {
  const res = await apiFetch<{ user: BackendUser }>(`/users/${id}`);
  return mapUser(res.user);
}

export async function fetchCareers(): Promise<Career[]> {
  const res = await apiFetch<{ careers: { id: number; code: string; name: string }[] }>("/careers");
  return res.careers.map(mapCareer);
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const [res, users] = await Promise.all([
    apiFetch<{ comments: BackendComment[] }>(`/posts/${postId}/comments`),
    fetchUsers(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  return buildCommentTree(res.comments, byId);
}

export async function fetchUserComments(userId: string): Promise<Comment[]> {
  const [res, users] = await Promise.all([
    apiFetch<{ comments: BackendComment[] }>(`/users/${userId}/comments`),
    fetchUsers(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  return res.comments.map((c) => ({
    _id: c._id,
    publication_id: String(c.post_id),
    author_id: String(c.author_id),
    content_text: c.content,
    image_url: c.image_url ?? null,
    created_at: c.created_at,
    like_count: c.vote_score > 0 ? c.vote_score : 0,
    dislike_count: c.vote_score < 0 ? -c.vote_score : 0,
    parent_comment_id: c.parent_id,
    author: byId.get(String(c.author_id)),
    user_reaction: null,
    replies: [],
  }));
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const res = await apiFetch<{ data: Notification[] }>(`/users/${userId}/notifications`);
  return res.data;
}

// ---------- subida de imágenes ----------
/** Sube una imagen y devuelve su URL pública. Reutilizado en todos los formularios. */
export async function uploadImage(file: File, prefix = "uploads"): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("prefix", prefix);
  const res = await apiFetch<{ url: string }>("/uploads", { method: "POST", body: form });
  return res.url;
}

// ---------- mutaciones ----------
export async function createPost(input: {
  community_id: string; author_id: string; title: string;
  content?: string; label?: string | null; external_link?: string | null;
  image_url?: string | null;
}): Promise<Publication> {
  const res = await apiFetch<{ post: BackendPost }>("/posts", {
    method: "POST",
    body: JSON.stringify({
      community_id: Number(input.community_id),
      author_id: Number(input.author_id),
      title: input.title,
      content: input.content,
      label: input.label ?? null,
      external_link: input.external_link ?? null,
      image_url: input.image_url ?? null,
    }),
  });
  return mapPost(res.post);
}

export async function updatePost(id: string, input: {
  title?: string; content?: string; label?: string | null; image_url?: string | null;
}): Promise<Publication> {
  const res = await apiFetch<{ post: BackendPost }>(`/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return mapPost(res.post);
}

export async function deletePost(id: string): Promise<void> {
  await apiFetch(`/posts/${id}`, { method: "DELETE" });
}

export async function votePost(
  postId: string, userId: string, voteType: 1 | -1,
): Promise<{ vote_score: number; user_vote: number }> {
  return apiFetch(`/posts/${postId}/vote`, {
    method: "POST",
    body: JSON.stringify({ user_id: Number(userId), vote_type: voteType }),
  });
}

export async function voteComment(commentId: string, voteType: 1 | -1): Promise<void> {
  await apiFetch(`/comments/${commentId}/vote`, {
    method: "POST",
    body: JSON.stringify({ vote_type: voteType }),
  });
}

export async function updateComment(commentId: string, content: string): Promise<void> {
  await apiFetch(`/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await apiFetch(`/comments/${commentId}`, { method: "DELETE" });
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch(`/users/${id}`, { method: "DELETE" });
}

export async function createComment(
  postId: string, authorId: string, content: string,
  parentId?: string, imageUrl?: string | null,
) {
  await apiFetch(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({
      author_id: Number(authorId), content, parent_id: parentId ?? null,
      image_url: imageUrl ?? null,
    }),
  });
}

export async function updateCommunity(id: string, input: {
  description?: string; visibility?: string; status?: string;
  image_url?: string | null; banner_url?: string | null;
}): Promise<Community> {
  const res = await apiFetch<{ community: BackendCommunity }>(`/communities/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return mapCommunity(res.community);
}

export async function deleteCommunity(id: string): Promise<void> {
  await apiFetch(`/communities/${id}`, { method: "DELETE" });
}

export async function createCommunity(input: {
  name: string; description?: string; visibility?: "public" | "restricted" | "private";
}): Promise<Community> {
  const res = await apiFetch<{ community: BackendCommunity }>("/communities", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      visibility: input.visibility ?? "public",
    }),
  });
  return mapCommunity(res.community);
}

// ---------- membresía de comunidades ----------
export async function joinCommunity(id: string): Promise<{ status: "active" | "pending" }> {
  const res = await apiFetch<{ membership: { status: "active" | "pending" } }>(
    `/communities/${id}/join`, { method: "POST" });
  return { status: res.membership.status };
}

export async function leaveCommunity(id: string): Promise<void> {
  await apiFetch(`/communities/${id}/leave`, { method: "POST" });
}

export async function fetchMembers(id: string): Promise<CommunityMembership[]> {
  const res = await apiFetch<{ members: (Omit<CommunityMembership, "user" | "community_id" | "user_id"> &
    { community_id: number; user_id: number; user: BackendUser })[] }>(`/communities/${id}/members`);
  return res.members.map((m) => ({
    ...m,
    community_id: String(m.community_id),
    user_id: String(m.user_id),
    user: mapUser(m.user),
  }));
}

export async function approveMember(communityId: string, userId: string): Promise<void> {
  await apiFetch(`/communities/${communityId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "active" }),
  });
}

export async function removeMember(communityId: string, userId: string): Promise<void> {
  await apiFetch(`/communities/${communityId}/members/${userId}`, { method: "DELETE" });
}

// ---------- reportes (moderación) ----------
export async function createReport(input: {
  target_type: Report["target_type"]; target_id: string;
  target_label?: string; reason: string; detail?: string;
}): Promise<void> {
  await apiFetch("/reports", { method: "POST", body: JSON.stringify(input) });
}

export async function fetchReports(status?: string): Promise<Report[]> {
  const q = status ? `?status=${status}` : "";
  const res = await apiFetch<{ reports: Report[] }>(`/reports${q}`);
  return res.reports;
}

export async function resolveReport(
  id: string,
  status: "REVIEWED" | "DISMISSED",
  opts: { action?: "remove"; note?: string } = {},
): Promise<void> {
  await apiFetch(`/reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...opts }),
  });
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await apiFetch(`/users/${userId}/notifications/read`, { method: "PATCH" });
}

export async function updateUser(id: string, input: {
  display_name?: string; avatar_url?: string | null; bio?: string;
  gender?: string; career_id?: string;
}): Promise<UserProfile> {
  const body: Record<string, unknown> = { ...input };
  if (input.career_id !== undefined) body.career_id = input.career_id ? Number(input.career_id) : null;
  const res = await apiFetch<{ user: BackendUser }>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return mapUser(res.user);
}
