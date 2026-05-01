// Types and utility helpers for authentication.
// Session state is managed by NextAuth — see /auth.ts at the project root.

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
};

/** Map a NextAuth session user to the app-wide AuthUser shape. */
export function sessionToAuthUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: user.name ?? "",
    avatarUrl: user.image ?? undefined,
    role: user.role,
  };
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
