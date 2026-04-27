export type Comment = {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
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
  number: number;   // current page (0-based)
  last: boolean;
};
