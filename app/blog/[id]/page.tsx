"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { sessionToAuthUser, timeAgo } from "@/lib/auth";
import { StarIcon, ClockIcon, NewspaperIcon, ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { fetchJson } from "@/lib/fetchJson";

type BlogDto = {
  id: string;
  imageKey?: string;
  imageUrl?: string | null;
  category: string;
  title: string;
  body: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt?: string | null;
};

function categoryColor(cat: string): string {
  switch (cat) {
    case "Flood Alert": return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300";
    case "Safety Tips": return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    case "Community": return "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200";
    case "Updates": return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300";
    case "Research": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "General": return "bg-[var(--color-pill-bg)] text-[var(--color-text)]";
    default: return "bg-[var(--color-pill-bg)] text-[var(--color-muted)]";
  }
}

function readingTime(body: string): string {
  const words = (body ?? "").trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;
  const [blog, setBlog] = useState<BlogDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchJson<BlogDto>(`/api/blogs/${id}`);
        setBlog(data);
      } catch {
        setError("Article not found");
      }
      finally { setLoading(false); }
    })();
  }, [id]);

  const shell = (
    children: ReactNode,
    opts?: { showNav?: boolean }
  ) => (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      {opts?.showNav !== false && (
        <Navbar user={user} onLogout={() => void signOut({ callbackUrl: "/login" })} activeLink="blog" />
      )}
      {children}
      <Footer />
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex-1 flex items-center justify-center py-24">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-[var(--color-brand)] border-t-transparent" aria-label="Loading" />
      </div>,
      { showNav: true }
    );
  }

  if (error || !blog) {
    return shell(
      <>
        <main className="max-w-3xl mx-auto px-4 py-8 flex-1 w-full">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors mb-8 font-medium">
            <ArrowLeftIcon className="h-4 w-4 shrink-0" />
            Back to Blog
          </Link>
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)] mb-4 mx-auto">
              <NewspaperIcon className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Article Not Found</h2>
            <p className="text-[var(--color-muted)]">{error ?? "This article may have been removed."}</p>
            <Link href="/blog" className="mt-6 inline-block px-6 py-2.5 bg-[var(--color-brand)] text-white rounded-full font-semibold hover:bg-[var(--color-brand-dark)] transition-colors">
              Back to Blog
            </Link>
          </div>
        </main>
      </>
    );
  }

  return shell(
    <>
      <main className="max-w-3xl mx-auto px-4 py-6 flex-1 w-full">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] mb-6 transition-colors font-medium">
          <ArrowLeftIcon className="h-4 w-4 shrink-0" />
          Back to Blog
        </Link>

        <article className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
          {blog.imageUrl && (
            <div className="h-64 bg-[var(--color-bg)] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blog.imageUrl} alt={blog.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColor(blog.category)}`}>
                {blog.category}
              </span>
              {blog.isFeatured && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)] bg-[var(--color-brand)]/10 px-2.5 py-1 rounded-full">
                  <StarIcon className="h-3.5 w-3.5 shrink-0" />
                  Featured
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] leading-tight mb-4">
              {blog.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-[var(--color-muted)] mb-6 pb-6 border-b border-[var(--color-border)] flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="h-4 w-4 shrink-0 opacity-80" />
                {readingTime(blog.body)}
              </span>
              <span>·</span>
              <span>Published {timeAgo(blog.createdAt)}</span>
              {blog.updatedAt && blog.updatedAt !== blog.createdAt && (
                <>
                  <span>·</span>
                  <span>Updated {timeAgo(blog.updatedAt)}</span>
                </>
              )}
            </div>

            <div className="text-[var(--color-text)] leading-relaxed text-[15px] sm:text-base space-y-4">
              {blog.body.replace(/<[^>]+>/g, "").split("\n").filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
              <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors font-medium">
                <ArrowLeftIcon className="h-4 w-4 shrink-0" />
                All articles
              </Link>
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors font-medium">
                Community
                <ArrowRightIcon className="h-4 w-4 shrink-0" />
              </Link>
            </div>
          </div>
        </article>
      </main>
    </>
  );
}
