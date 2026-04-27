"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, getToken, timeAgo } from "@/lib/auth";
import type { AuthUser } from "@/lib/auth";

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

function BlogCard({ blog, featured = false }: { blog: BlogDto; featured?: boolean }) {
  return (
    <Link href={`/blog/${blog.id}`} className="block group">
      <article className={`bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-orange-300 hover:shadow-md transition-all duration-200 ${featured ? "mb-4" : ""}`}>
        {featured && blog.imageUrl && (
          <div className="relative h-48 bg-gray-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={blog.imageUrl} alt={blog.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-4">
              <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                ★ Featured
              </span>
            </div>
          </div>
        )}
        <div className="p-4">
          {/* Top row */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColor(blog.category)}`}>
              {blog.category}
            </span>
            {blog.isFeatured && !featured && (
              <span className="text-xs font-semibold text-orange-500">★ Featured</span>
            )}
          </div>
          {/* Title */}
          <h2 className={`font-bold text-gray-900 group-hover:text-orange-600 transition-colors leading-snug mb-1 ${featured ? "text-xl" : "text-base"}`}>
            {blog.title}
          </h2>
          {/* Preview */}
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {blog.body.replace(/<[^>]+>/g, "").substring(0, 180)}
          </p>
          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>🕐 {readingTime(blog.body)}</span>
            <span>·</span>
            <span>{timeAgo(blog.createdAt)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function BlogPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [blogs, setBlogs] = useState<BlogDto[]>([]);
  const [featured, setFeatured] = useState<BlogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { setUser(getUser()); }, []);

  const fetchBlogs = useCallback(async (p = 0, category = activeCategory, reset = false) => {
    if (p === 0) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(p), size: "20" });
      if (category !== "All") params.set("category", category);
      const res = await fetch(`/api/blogs?${params}`);
      const data: PagedBlogs = await res.json();
      setBlogs(prev => reset || p === 0 ? data.content : [...prev, ...data.content]);
      setHasMore(!data.last);
      setPage(p);
    } catch { /* ignore */ } finally {
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
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-bold text-[var(--color-brand)] text-lg tracking-tight">FloodWatch</Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link href="/" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Community</Link>
              <span className="px-3 py-1.5 rounded-lg text-sm font-semibold text-[var(--color-brand)] bg-red-50">Blog</span>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-[var(--color-brand)] font-bold text-sm">
                  {user.displayName?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.displayName}</span>
              </div>
            ) : (
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-[var(--color-brand)] transition-colors">Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Page header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Blog & News</h1>
              <p className="text-sm text-gray-500 mt-1">Official updates, safety guides, and flood monitoring insights</p>
            </div>

            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${
                    activeCategory === cat
                      ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Featured blog */}
            {featured.length > 0 && activeCategory === "All" && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Featured</p>
                <BlogCard blog={featured[0]} featured />
              </div>
            )}

            {/* Blog list */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                    <div className="h-3 w-16 bg-gray-200 rounded mb-3" />
                    <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-full bg-gray-100 rounded mb-1" />
                    <div className="h-3 w-2/3 bg-gray-100 rounded" />
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
                    <p className="text-4xl mb-3">📰</p>
                    <p className="text-gray-500 font-medium">No articles in this category yet.</p>
                  </div>
                )}
                {hasMore && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => void fetchBlogs(page + 1)}
                      disabled={loadingMore}
                      className="px-6 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">About Blog</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Official news, safety guides, and flood monitoring insights from the FloodWatch team.
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link href="/" className="block text-center w-full py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-sm font-semibold transition-colors">
                  Back to Community
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">Categories</h3>
              <div className="space-y-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      activeCategory === cat ? "bg-red-50 text-[var(--color-brand)] font-medium" : "text-gray-600 hover:bg-gray-50"
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
    </div>
  );
}
