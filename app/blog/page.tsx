"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { StarIcon, ClockIcon, NewspaperIcon } from "@/components/icons";
import { useSession, signOut } from "next-auth/react";
import { sessionToAuthUser, timeAgo } from "@/lib/auth";

type BlogDto = {
  id: string;
  imageKey: string;
  imageUrl?: string | null;
  category: string;
  title: string;
  body: string;
  isFeatured: boolean;
  createdAt: string;
};

type PagedBlogs = {
  content: BlogDto[];
  totalPages: number;
  totalElements: number;
  number: number;
  last: boolean;
};

const CATEGORIES = ["All", "Flood Alert", "Safety Tips", "Community", "Updates", "Research"];

function categoryColor(cat: string): string {
  switch (cat) {
    case "Flood Alert": return "bg-blue-100 text-blue-700";
    case "Safety Tips": return "bg-amber-100 text-amber-700";
    case "Community": return "bg-purple-100 text-purple-700";
    case "Updates": return "bg-blue-100 text-blue-700";
    case "Research": return "bg-emerald-100 text-emerald-700";
    default: return "bg-[var(--color-bg)] text-[var(--color-muted)]";
  }
}

function readingTime(body: string): string {
  const words = (body ?? "").trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function BlogCard({ blog, featured = false }: { blog: BlogDto; featured?: boolean }) {
  return (
    <Link href={`/blog/${blog.id}`} className="block group">
      <article className={`bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-brand)] hover:shadow-md transition-all duration-200 ${featured ? "mb-4" : ""}`}>
        {featured && blog.imageUrl && (
          <div className="relative h-48 bg-[var(--color-bg)] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={blog.imageUrl} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-4">
              <span className="inline-flex items-center gap-1.5 bg-[var(--color-brand)] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                <StarIcon className="h-3.5 w-3.5 text-white shrink-0" />
                Featured
              </span>
            </div>
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColor(blog.category)}`}>
              {blog.category}
            </span>
            {blog.isFeatured && !featured && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)]">
                <StarIcon className="h-3.5 w-3.5 shrink-0" />
                Featured
              </span>
            )}
          </div>
          <h2 className={`font-bold text-[var(--color-text)] group-hover:text-[var(--color-brand)] transition-colors leading-snug mb-1 ${featured ? "text-xl" : "text-base"}`}>
            {blog.title}
          </h2>
          <p className="text-sm text-[var(--color-muted)] line-clamp-2 mb-3">
            {blog.body.replace(/<[^>]+>/g, "").substring(0, 180)}
          </p>
          <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              {readingTime(blog.body)}
            </span>
            <span>·</span>
            <span>{timeAgo(blog.createdAt)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function BlogPage() {
  const { data: session } = useSession();
  const user = session?.user ? sessionToAuthUser(session.user) : null;
  const [activeCategory, setActiveCategory] = useState("All");
  const [blogs, setBlogs] = useState<BlogDto[]>([]);
  const [featured, setFeatured] = useState<BlogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchBlogs = useCallback(async (p = 0, category = activeCategory, reset = false) => {
    if (p === 0) { setLoading(true); setError(null); } else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(p), size: "20" });
      if (category !== "All") params.set("category", category);
      const res = await fetch(`/api/blogs?${params}`);
      if (!res.ok) { setError("Failed to load blogs"); return; }
      const data: PagedBlogs = await res.json();
      const content = Array.isArray(data.content) ? data.content : [];
      setBlogs(prev => reset || p === 0 ? content : [...prev, ...content]);
      setHasMore(!data.last);
      setPage(p);
    } catch { setError("Failed to load blogs"); } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCategory]);

  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch("/api/blogs/featured");
      const data: BlogDto[] = await res.json();
      setFeatured(data ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void fetchFeatured(); }, [fetchFeatured]);
  useEffect(() => { void fetchBlogs(0, activeCategory, true); }, [activeCategory]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setPage(0);
    setHasMore(true);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      <Navbar user={user} onLogout={() => void signOut({ callbackUrl: "/login" })} activeLink="blog" />

      <main className="max-w-5xl mx-auto px-4 py-6 flex-1 w-full">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[var(--color-text)]">Blog & News</h1>
              <p className="text-sm text-[var(--color-muted)] mt-1">Official updates, safety guides, and flood monitoring insights</p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${
                    activeCategory === cat
                      ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                      : "bg-white text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {featured.length > 0 && activeCategory === "All" && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2">Featured</p>
                <BlogCard blog={featured[0]} featured />
              </div>
            )}

            {error && !loading && (
              <div className="bg-white rounded-2xl border border-red-200 p-8 text-center mb-4">
                <p className="text-red-600 font-medium mb-3">{error}</p>
                <button onClick={() => void fetchBlogs(0, activeCategory, true)}
                  className="px-4 py-2 rounded-full bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-dark)] transition-colors">
                  Retry
                </button>
              </div>
            )}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-[var(--color-border)] p-4 animate-pulse">
                    <div className="h-3 w-16 bg-[var(--color-border)] rounded mb-3" />
                    <div className="h-5 w-3/4 bg-[var(--color-border)] rounded mb-2" />
                    <div className="h-3 w-full bg-[var(--color-bg)] rounded mb-1" />
                    <div className="h-3 w-2/3 bg-[var(--color-bg)] rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {blogs
                    .filter(b => !b.isFeatured || activeCategory !== "All")
                    .map(blog => <BlogCard key={blog.id} blog={blog} />)}
                </div>
                {blogs.length === 0 && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)] mb-3">
                      <NewspaperIcon className="h-8 w-8" />
                    </div>
                    <p className="text-[var(--color-muted)] font-medium">No articles in this category yet.</p>
                  </div>
                )}
                {hasMore && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => void fetchBlogs(page + 1)}
                      disabled={loadingMore}
                      className="px-6 py-2 rounded-2xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-brand)] hover:bg-white disabled:opacity-50 transition-colors bg-white"
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 mb-4">
              <h3 className="font-semibold text-[var(--color-text)] mb-2 text-sm">About Blog</h3>
              <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                Official news, safety guides, and flood monitoring insights from the FloodWatch team.
              </p>
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <Link href="/" className="block text-center w-full py-2 rounded-full bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-sm font-semibold transition-colors">
                  Back to Community
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
              <h3 className="font-semibold text-[var(--color-text)] mb-3 text-sm">Categories</h3>
              <div className="space-y-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-sm transition-colors ${
                      activeCategory === cat
                        ? "bg-[var(--color-brand)]/10 text-[var(--color-brand)] font-medium"
                        : "text-[var(--color-muted)] hover:bg-[var(--color-bg)]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
