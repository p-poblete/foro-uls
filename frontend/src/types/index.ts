export type Gender = "MALE" | "FEMALE" | "NON_BINARY";
export type PrivacyLevel = "PUBLIC" | "PRIVATE" | "RESTRICTED";
export type PublicationLabel = "HELP" | "ANNOUNCEMENT" | "DISCUSSION" | "CASE";
export type ReactionType = "LIKE" | "DISLIKE";
export type NotificationType = "LIKE" | "DISLIKE" | "COMMENT" | "COMMUNITY_POST";

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
  trigger_user_id: string;
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
