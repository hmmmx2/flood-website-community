import type { Comment, CommentNode } from "./types";

export function buildCommentTree(flat: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  for (const c of flat) {
    map.set(c.id, { ...c, children: [] });
  }
  const roots: CommentNode[] = [];
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parentId) {
      const parent = map.get(c.parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortByCreated = (a: CommentNode, b: CommentNode) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  function sortTree(nodes: CommentNode[]) {
    nodes.sort(sortByCreated);
    for (const n of nodes) sortTree(n.children);
  }
  sortTree(roots);
  return roots;
}
