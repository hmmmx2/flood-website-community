"use client";

import type { Comment, CommentNode } from "@/lib/types";
import CommentItem from "./CommentItem";

type Props = {
  postId: string;
  nodes: CommentNode[];
  currentUserId?: string;
  depth: number;
  onPatch: (c: CommentNode) => void;
  onAdd: (c: Comment) => void;
};

export default function CommentThread({ postId, nodes, currentUserId, depth, onPatch, onAdd }: Props) {
  return (
    <div className="space-y-4">
      {nodes.map((n) => (
        <CommentItem
          key={n.id}
          postId={postId}
          node={n}
          currentUserId={currentUserId}
          depth={depth}
          onPatch={onPatch}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}
