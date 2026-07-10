export type Gender = "MALE" | "FEMALE" | "NON_BINARY";
export type PrivacyLevel = "PUBLIC" | "PRIVATE" | "RESTRICTED";
export type PublicationLabel = "HELP" | "ANNOUNCEMENT" | "DISCUSSION" | "CASE";
export type ReactionType = "LIKE" | "DISLIKE";
export type NotificationType =
  | "LIKE" | "DISLIKE" | "COMMENT" | "REPLY" | "COMMUNITY_POST" | "ANNOUNCEMENT"
  | "REPORT_RECEIVED" | "REPORT_RESOLVED" | "CONTENT_REMOVED" | "CONTENT_EDITED";

export interface Career {
  id: string;
  code: string;
  name: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  profile_image: string | null;
  cover_image: string | null;
  gender: Gender;
  career_id: string;
  career?: Career;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  profile_image: string | null;
  cover_image: string | null;
  privacy_level: PrivacyLevel;
  member_count: number;
  creator_id: string;
  created_at: string;
  is_member?: boolean;
  /** Estado de membresía del usuario autenticado: active | pending | null. */
  membership?: "active" | "pending" | null;
  /** Estado administrativo: active | suspended | archived. */
  status?: string;
}

export interface CommunityMembership {
  community_id: string;
  user_id: string;
  role: "member" | "owner";
  status: "active" | "pending";
  joined_at: string;
  user?: UserProfile;
}

export interface Report {
  _id: string;
  target_type: "publication" | "comment" | "user" | "community";
  target_id: string;
  target_label?: string | null;
  reason: string;
  detail: string;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  reporter_id: string;
  /** Visible solo para moderadores (el autor nunca ve quién reportó). */
  reporter_username?: string | null;
  /** "remove" si la resolución baneó el contenido. */
  action?: string | null;
  /** Motivo del moderador al resolver. */
  note?: string;
  created_at: string;
}

export interface CommunityRule {
  id: string;
  community_id: string;
  title: string;
  description: string;
  order_index: number;
}

export interface Publication {
  id: string;
  title: string;
  content_text: string | null;
  external_link: string | null;
  tags: string[];
  label: PublicationLabel | null;
  multimedia: string[];
  community_id: string;
  author_id: string;
  like_count: number;
  dislike_count: number;
  comment_count: number;
  created_at: string;
  // populated
  community?: Community;
  author?: UserProfile;
  user_reaction?: ReactionType | null;
}

export interface Comment {
  _id: string;
  publication_id: string;
  author_id: string;
  content_text: string;
  image_url?: string | null;
  created_at: string;
  like_count: number;
  dislike_count: number;
  parent_comment_id: string | null;
  replies: Comment[];
  author?: UserProfile;
  user_reaction?: ReactionType | null;
}

export interface Notification {
  _id: string;
  user_id: string;
  type: NotificationType;
  /** null = notificación anónima/de sistema (reportes, moderación). */
  trigger_user_id: string | null;
  publication_id: string | null;
  comment_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  trigger_user?: UserProfile;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}
