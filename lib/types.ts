export type CommentSort = "top" | "new" | "old";

export type Comment = {
  id: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  score: number;
  myVote: -1 | 0 | 1;
  createdAt: string;
  updatedAt?: string;
  deleted: boolean;
  replyCount: number;
};

export type CommentNode = Comment & { children: CommentNode[] };

export type CommentsPage = {
  comments: Comment[];
  totalTopLevel: number;
  page: number;
  size: number;
  /** Total comment rows for this post (from API); aligns card count with the comments endpoint. */
  totalComments?: number;
};

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  content: string;
  imageUrl?: string;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
  groupId?: string;
  groupSlug?: string;
  groupName?: string;
};

export type Group = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconLetter: string;
  iconColor: string;
  membersCount: number;
  postsCount: number;
  joinedByMe: boolean;
  createdAt: string;
};

export type PagedPosts = {
  content: Post[];
  totalPages: number;
  totalElements: number;
  number: number;
  last: boolean;
};

// ── Flood map ────────────────────────────────────────────────────────
//
// `Zone` is the public-facing shape served by /api/zones. It exposes
// only an aggregated centroid + radius — never per-sensor coordinates.
// See `lib/zoneAggregate.ts` for the privacy contract.

export type FloodLevel = 0 | 1 | 2 | 3;
export type ZoneSensorBand = "single" | "few" | "many";

export type Zone = {
  /** Stable, derived from (state|area) — never a sensor / node id. */
  id: string;
  /** Display name (e.g. "Tabuan Jaya"). */
  name: string;
  state: string;
  area: string;
  /** Rounded to 3 d.p. (~110 m) before it ever leaves the server. */
  centroidLat: number;
  centroidLng: number;
  /** Clamped to >= 800 m so a single-sensor zone can't shrink to a point. */
  radiusM: number;
  worstLevel: FloodLevel;
  anyOffline: boolean;
  /** When true, every member sensor in the zone is offline. */
  allOffline: boolean;
  /** Coarse cluster-size band — the raw `sensorCount` is never published. */
  sensorBand: ZoneSensorBand;
  lastUpdated?: string;
};
