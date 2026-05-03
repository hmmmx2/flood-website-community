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
