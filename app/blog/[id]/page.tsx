"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getUser, timeAgo } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

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
    case "Flood Alert": return "bg-red-100 text-red-700";
    case "Safety Tips": return "bg-amber-100 text-amber-700";
    case "Community": return "bg-purple-100 text-purple-700";
    case "Updates": return "bg-blue-100 text-blue-700";
    case "Research": return "bg-emerald-100 text-emerald-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function readingTime(body: string): string {
  const words = (body ?? "").trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [blog, setBlog] = useState<BlogDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setUser(getUser()); }, []);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/blogs/${id}`);
        if (!res.ok) { setError("Article not found"); return; }
        const data: BlogDto = await res.json();
        setBlog(data);
      } catch { setError("Failed to load article"); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 rounded-full border-2 border-[var(--color-brand)] border-t-transparent" />
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
            <Link href="/blog" className="text-gray-600 hover:text-[var(--color-brand)] transition-colors">← Back to Blog</Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-5xl mb-4">📰</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article Not Found</h2>
          <p className="text-gray-500">{error ?? "This article may have been removed."}</p>
          <Link href="/blog" className="mt-6 inline-block px-6 py-2 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:bg-[var(--color-brand-dark)] transition-colors">
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/blog" className="text-gray-500 hover:text-[var(--color-brand)] transition-colors flex items-center gap-1 text-sm">
              ← Blog
            </Link>
            <span className="text-gray-300">|</span>
            <Link href="/" className="font-bold text-[var(--color-brand)] text-sm">FloodWatch</Link>
          </div>
          {user ? (
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-[var(--color-brand)] font-bold text-sm">
              {user.displayName?.charAt(0).toUpperCase() ?? "U"}
            </div>
          ) : (
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[var(--color-brand)]">Sign in</Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <article className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Cover image */}
          {blog.imageUrl && (
            <div className="h-64 bg-gray-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blog.imageUrl} alt={blog.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Category + featured badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryColor(blog.category)}`}>
                {blog.category}
              </span>
              {blog.isFeatured && (
                <span className="text-xs font-semibold text-[var(--color-brand)] bg-red-50 px-2.5 py-1 rounded-full">★ Featured</span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-4">
              {blog.title}
            </h1>

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-6 pb-6 border-b border-gray-100">
              <span>🕐 {readingTime(blog.body)}</span>
              <span>·</span>
              <span>Published {timeAgo(blog.createdAt)}</span>
              {blog.updatedAt && blog.updatedAt !== blog.createdAt && (
                <>
                  <span>·</span>
                  <span>Updated {timeAgo(blog.updatedAt)}</span>
                </>
              )}
            </div>

            {/* Body */}
            <div className="prose prose-sm sm:prose max-w-none text-gray-700 leading-relaxed">
              {blog.body.split("\n").filter(Boolean).map((para, i) => (
                <p key={i} className="mb-4">{para}</p>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
              <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[var(--color-brand)] transition-colors font-medium">
                ← All articles
              </Link>
              <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[var(--color-brand)] transition-colors font-medium">
                Community →
              </Link>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
