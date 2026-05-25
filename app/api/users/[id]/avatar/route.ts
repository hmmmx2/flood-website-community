import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { javaFetch } from "@/lib/javaApi";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[id]/avatar — serves a user's avatar as an image response.
 *
 * Why this exists: avatars are stored as base64 `data:` URLs (~30-60 KB).
 * Putting that string into the NextAuth session (session.user.image) bloated
 * the JWT cookie past Vercel's request-header limit → every request 494'd
 * (REQUEST_HEADER_TOO_LARGE). The session now only holds the SHORT path
 * `/api/users/{id}/avatar`, and this route resolves the actual image — so
 * the heavy bytes travel in a cacheable image response, never in a cookie.
 *
 * The backend /community/users/{id} requires auth, so we forward the
 * viewer's token (the navbar only renders the current user's own avatar).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await auth();
    const profile = await javaFetch<{ avatarUrl?: string | null }>(
      `/community/users/${id}`,
      { token: session?.accessToken },
    );

    const avatar = profile?.avatarUrl;
    if (!avatar) {
      return new NextResponse(null, { status: 404 });
    }

    // Decode a `data:<mime>;base64,<payload>` URL into raw image bytes.
    if (avatar.startsWith("data:")) {
      const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(avatar);
      if (!m) return new NextResponse(null, { status: 404 });
      const contentType = m[1] || "image/jpeg";
      const isBase64 = Boolean(m[2]);
      const bytes = isBase64
        ? Buffer.from(m[3], "base64")
        : Buffer.from(decodeURIComponent(m[3]), "utf-8");
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": contentType,
          // Short cache: avatar changes bust via a ?v= query the session
          // appends, but cap staleness for the no-version (login) URL too.
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    // Already a normal URL — just redirect the browser to it.
    return NextResponse.redirect(avatar);
  } catch {
    // No avatar / upstream error → 404 so the client falls back to initials.
    return new NextResponse(null, { status: 404 });
  }
}
