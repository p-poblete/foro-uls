import type { Gender, PrivacyLevel, PublicationLabel, NotificationType } from "@/types";

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Masculino",
  FEMALE: "Femenino",
  NON_BINARY: "No binario",
};

export const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC: "Pública",
  PRIVATE: "Privada",
  RESTRICTED: "Restringida",
};

export const PRIVACY_DESCRIPTIONS: Record<PrivacyLevel, string> = {
  PUBLIC: "Cualquier persona puede unirse y ver el contenido",
  PRIVATE: "Solo por invitación",
  RESTRICTED: "Visible para todos, pero requiere aprobación para unirse",
};

export const LABEL_LABELS: Record<PublicationLabel, string> = {
  HELP: "Ayuda",
  ANNOUNCEMENT: "Anuncio",
  DISCUSSION: "Discusión",
  CASE: "Caso",
};

export const LABEL_CLASS: Record<PublicationLabel, string> = {
  HELP: "bg-[var(--color-label-help)]/15 text-[var(--color-label-help)] border-[var(--color-label-help)]/30",
  ANNOUNCEMENT: "bg-[var(--color-label-announcement)]/15 text-[var(--color-label-announcement)] border-[var(--color-label-announcement)]/30",
  DISCUSSION: "bg-[var(--color-label-discussion)]/15 text-[var(--color-label-discussion)] border-[var(--color-label-discussion)]/30",
  CASE: "bg-[var(--color-label-case)]/15 text-[var(--color-label-case)] border-[var(--color-label-case)]/30",
};

export const ALL_LABELS: PublicationLabel[] = ["HELP", "ANNOUNCEMENT", "DISCUSSION", "CASE"];

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  LIKE: "Le dio like a tu publicación",
  DISLIKE: "Le dio dislike a tu publicación",
  COMMENT: "Comentó en tu publicación",
  COMMUNITY_POST: "Nueva publicación en tu comunidad",
};

export const REPORT_REASONS = [
  { value: "SPAM", label: "Spam o autopromoción" },
  { value: "HARASSMENT", label: "Acoso o discurso de odio" },
  { value: "MISINFO", label: "Desinformación" },
  { value: "NSFW", label: "Contenido sexual o violento" },
  { value: "OFFTOPIC", label: "Fuera de tema en la comunidad" },
  { value: "OTHER", label: "Otro motivo" },
] as const;

export const STORAGE_KEYS = {
  token: import.meta.env.VITE_TOKEN_KEY ?? "auth_token",
  user: import.meta.env.VITE_USER_KEY ?? "current_user",
  theme: "readuls_theme",
  bookmarks: "readuls_bookmarks",
  drafts: "readuls_drafts",
  onboarding: "readuls_onboarding_done",
  notifsRead: "readuls_notifs_read",
  reports: "readuls_reports",
  loginError: "readuls_login_error",
};

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
export const APP_NAME = import.meta.env.VITE_APP_NAME ?? "HablaLaSalle";
