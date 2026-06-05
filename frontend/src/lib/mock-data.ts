import type { Career, Community, Publication, UserProfile, Comment, Notification } from "@/types";

export const CAREERS: Career[] = [
  { id: "c1", code: "arq", name: "Arquitectura y Urbanismo" },
  { id: "c2", code: "ind", name: "Ingeniería Industrial" },
  { id: "c3", code: "psi", name: "Psicología" },
  { id: "c4", code: "der", name: "Derecho" },
  { id: "c5", code: "adm", name: "Administración y Negocios Internacionales" },
  { id: "c6", code: "sft", name: "Ingeniería de Software" },
  { id: "c7", code: "com", name: "Ciencias de la Comunicación" },
  { id: "c8", code: "cml", name: "Ingeniería Comercial" },
];

export const CURRENT_USER: UserProfile = {
  id: "u1",
  email: "ppobletea@ulasalle.edu.pe",
  username: "ppoblete",
  profile_image: "https://i.pravatar.cc/120?img=12",
  cover_image: null,
  gender: "MALE",
  career_id: "c6",
  career: CAREERS[5],
  created_at: "2025-01-12T10:00:00Z",
};

const users: UserProfile[] = [
  CURRENT_USER,
  { id: "u2", email: "marcos404@ulasalle.edu.pe", username: "marcos404", profile_image: "https://i.pravatar.cc/120?img=33", cover_image: null, gender: "MALE", career_id: "c6", career: CAREERS[5], created_at: "2025-02-01T10:00:00Z" },
  { id: "u3", email: "maria2002@ulasalle.edu.pe", username: "maria2002", profile_image: "https://i.pravatar.cc/120?img=47", cover_image: null, gender: "FEMALE", career_id: "c6", career: CAREERS[5], created_at: "2025-02-12T10:00:00Z" },
  { id: "u4", email: "rectorado@ulasalle.edu.pe", username: "ULS_Oficial", profile_image: "https://i.pravatar.cc/120?img=15", cover_image: null, gender: "NON_BINARY", career_id: "c4", career: CAREERS[3], created_at: "2024-08-01T10:00:00Z" },
  { id: "u5", email: "ana@ulasalle.edu.pe", username: "ana.psico", profile_image: "https://i.pravatar.cc/120?img=49", cover_image: null, gender: "FEMALE", career_id: "c3", career: CAREERS[2], created_at: "2025-03-01T10:00:00Z" },
];

export const USERS = users;

export const COMMUNITIES: Community[] = [
  { id: "cm1", name: "BI_a_profundidad", description: "Comunidad sobre Business Intelligence, dashboards y analítica.", profile_image: null, cover_image: null, privacy_level: "PUBLIC", member_count: 1000, creator_id: "u2", created_at: "2025-01-01T10:00:00Z", is_member: true },
  { id: "cm2", name: "python_y_mas", description: "Todo sobre Python: librerías, tips, proyectos.", profile_image: null, cover_image: null, privacy_level: "PUBLIC", member_count: 750, creator_id: "u3", created_at: "2025-01-04T10:00:00Z", is_member: true },
  { id: "cm3", name: "Anuncios_ULS", description: "Anuncios oficiales de la Universidad La Salle.", profile_image: null, cover_image: null, privacy_level: "RESTRICTED", member_count: 4200, creator_id: "u4", created_at: "2024-08-01T10:00:00Z", is_member: false },
  { id: "cm4", name: "Psicologia_ULS", description: "Estudiantes de Psicología compartiendo lecturas y casos.", profile_image: null, cover_image: null, privacy_level: "PUBLIC", member_count: 340, creator_id: "u5", created_at: "2025-02-10T10:00:00Z", is_member: false },
  { id: "cm5", name: "Derecho_Debate", description: "Debate y análisis jurídico.", profile_image: null, cover_image: null, privacy_level: "PUBLIC", member_count: 220, creator_id: "u4", created_at: "2025-02-20T10:00:00Z", is_member: false },
];

const author = (id: string) => users.find((u) => u.id === id);
const community = (id: string) => COMMUNITIES.find((c) => c.id === id);

export const PUBLICATIONS: Publication[] = [
  {
    id: "p1",
    title: "Cómo puedo cambiar los colores de este gráfico en Python?",
    content_text: "Estoy haciendo un análisis con seaborn y no encuentro la forma de cambiar la paleta por defecto. ¿Alguna recomendación?",
    external_link: null,
    tags: ["python", "seaborn", "matplotlib"],
    label: "HELP",
    multimedia: ["https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&auto=format&fit=crop"],
    community_id: "cm1",
    author_id: "u2",
    like_count: 170,
    dislike_count: 4,
    comment_count: 110,
    created_at: "2026-06-04T10:00:00Z",
    community: community("cm1"),
    author: author("u2"),
    user_reaction: null,
  },
  {
    id: "p2",
    title: "Cómo aprendí Python",
    content_text: "Tomé dos cursos virtuales y obtuve certificados internacionales!",
    external_link: null,
    tags: ["python", "aprendizaje"],
    label: "DISCUSSION",
    multimedia: [],
    community_id: "cm2",
    author_id: "u3",
    like_count: 150,
    dislike_count: 2,
    comment_count: 100,
    created_at: "2026-06-03T12:30:00Z",
    community: community("cm2"),
    author: author("u3"),
    user_reaction: "LIKE",
  },
  {
    id: "p3",
    title: "Convocatoria: Beca de Investigación 2026-II",
    content_text: "Postulaciones abiertas hasta el 30 de junio para la beca de investigación interdisciplinaria.",
    external_link: "https://ulasalle.edu.pe/becas",
    tags: ["becas", "investigacion"],
    label: "ANNOUNCEMENT",
    multimedia: [],
    community_id: "cm3",
    author_id: "u4",
    like_count: 320,
    dislike_count: 1,
    comment_count: 45,
    created_at: "2026-06-02T09:00:00Z",
    community: community("cm3"),
    author: author("u4"),
    user_reaction: null,
  },
  {
    id: "p4",
    title: "Caso clínico: ansiedad académica en estudiantes de primer ciclo",
    content_text: "Comparto un caso anónimo trabajado en práctica supervisada. Busco feedback.",
    external_link: null,
    tags: ["psicologia", "casos"],
    label: "CASE",
    multimedia: [],
    community_id: "cm4",
    author_id: "u5",
    like_count: 88,
    dislike_count: 0,
    comment_count: 31,
    created_at: "2026-06-01T16:00:00Z",
    community: community("cm4"),
    author: author("u5"),
    user_reaction: null,
  },
];

export const COMMENTS: Record<string, Comment[]> = {
  p1: [
    {
      _id: "cmt1",
      publication_id: "p1",
      author_id: "u3",
      content_text: "Prueba con sns.set_palette('Set2') antes de plotear.",
      created_at: "2026-06-04T11:00:00Z",
      like_count: 24,
      dislike_count: 0,
      parent_comment_id: null,
      author: author("u3"),
      user_reaction: null,
      replies: [
        {
          _id: "cmt2",
          publication_id: "p1",
          author_id: "u2",
          content_text: "¡Funciona! Gracias 🙌",
          created_at: "2026-06-04T11:30:00Z",
          like_count: 5,
          dislike_count: 0,
          parent_comment_id: "cmt1",
          author: author("u2"),
          user_reaction: null,
          replies: [],
        },
      ],
    },
    {
      _id: "cmt3",
      publication_id: "p1",
      author_id: "u5",
      content_text: "También puedes pasar el parámetro palette directo al sns.histplot().",
      created_at: "2026-06-04T12:00:00Z",
      like_count: 9,
      dislike_count: 0,
      parent_comment_id: null,
      author: author("u5"),
      user_reaction: null,
      replies: [],
    },
  ],
};

export const NOTIFICATIONS: Notification[] = [
  { _id: "n1", user_id: "u1", type: "LIKE", trigger_user_id: "u2", publication_id: "p2", comment_id: null, message: "le dio like a tu publicación", is_read: false, created_at: "2026-06-05T09:00:00Z", trigger_user: author("u2") },
  { _id: "n2", user_id: "u1", type: "COMMENT", trigger_user_id: "u3", publication_id: "p2", comment_id: null, message: "comentó en tu publicación", is_read: false, created_at: "2026-06-05T08:30:00Z", trigger_user: author("u3") },
  { _id: "n3", user_id: "u1", type: "COMMUNITY_POST", trigger_user_id: "u4", publication_id: "p3", comment_id: null, message: "nueva publicación en Anuncios_ULS", is_read: true, created_at: "2026-06-04T18:00:00Z", trigger_user: author("u4") },
];
