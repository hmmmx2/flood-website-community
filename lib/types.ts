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
  /** Hashed key for React rendering. Never the raw uuid / node_id. */
  id: string;
  /**
   * Subscription identifier — opaque to the user but accepted by the
   * favourites API so the bell menu can mute / unmute this node
   * without ever displaying its identity. Present only when the row
   * came from the live `nodes` table; the UI MUST NOT render this
   * value as text anywhere.
   */
  nodeId?: string;
  /** Display name. Currently the row's `area`. Never the row's `name` (often encodes node_id). */
  name: string;
  state: string;
  area: string;
  /** Rounded to 4 d.p. (~11 m) before it ever leaves the server. */
  centroidLat: number;
  centroidLng: number;
  /** Fixed per-node visualisation radius (250 m). */
  radiusM: number;
  worstLevel: FloodLevel;
  anyOffline: boolean;
  /** Per-node: true iff this node is offline. */
  allOffline: boolean;
  /** Always "single" — kept for backward-compat with downstream code. */
  sensorBand: ZoneSensorBand;
  lastUpdated?: string;
};
