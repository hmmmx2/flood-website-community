"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchModal from "@/components/SearchModal";
import { SearchField } from "@/components/ui/search-field";
import { StarIcon, ClockIcon, NewspaperIcon } from "@/components/icons";
import { useSession, signOut } from "next-auth/react";
import { sessionToAuthUser, timeAgo } from "@/lib/auth";
import { fetchJson } from "@/lib/fetchJson";
import { useSiteSearchModal } from "@/lib/useSiteSearchModal";
import { PAGE_CONTAINER } from "@/lib/layout";

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

/** Canonical order — aligned with CRM blog form options; merged with live API categories. */
const CANONICAL_CATEGORY_ORDER: string[] = [
  "General",
  "Flood Alert",
  "Safety Tips",
  "Community",
  "Updates",
  "Research",
];

function mergeCategoryTabs(fromApi: string[]): string[] {
  const list = fromApi.filter((c) => c != null && String(c).trim() !== "");
  const set = new Set(list);
  const ordered = CANONICAL_CATEGORY_ORDER.filter((c) => set.has(c));
  const extras = list
    .filter((c) => !CANONICAL_CATEGORY_ORDER.includes(c))
    .sort((a, b) => a.localeCompare(b));
  return ["All", ...ordered, ...extras];
}

function categoryColor(cat: string): string {
  switch (cat) {
    case "General":
      return "bg-[var(--color-pill-bg)] text-[var(--color-text)]";
    case "Flood Alert":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300";
    case "Safety Tips":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    case "Community":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200";
    case "Updates":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300";
    case "Research":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    default:
      return "bg-[var(--color-pill-bg)] text-[var(--color-muted)]";
  }
}

function readingTime(body: string): string {
  const words = (body ?? "").trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function BlogCard({ blog, featured = false }: { blog: BlogDto; featured?: boolean }) {
  return (
    <Link href={`/blog/${blog.id}`} className="block group">
      <article
        className={`bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden hover:border-[var(--color-brand)] hover:shadow-md transition-all duration-200 ${featured ? "mb-4" : ""}`}
      >
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
          <h2
            className={`font-bold text-[var(--color-text)] group-hover:text-[var(--color-brand)] transition-colors leading-snug mb-1 ${featured ? "text-xl" : "text-base"}`}
          >
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
  const activeCategoryRef = useRef(activeCategory);
  const listFetchGen = useRef(0);
  const [categoryTabs, setCategoryTabs] = useState<string[]>(() => ["All", ...CANONICAL_CATEGORY_ORDER]);

  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);
  const [blogs, setBlogs] = useState<BlogDto[]>([]);
  const [featured, setFeatured] = useState<BlogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [articleQuery, setArticleQuery] = useState("");
  const { searchOpen, openSearch, closeSearch } = useSiteSearchModal();

  const heroBlog =
    activeCategory === "All" && featured.length > 0 && !articleQuery.trim() ? featured[0] : null;

  const listBlogs = useMemo(() => {
    if (activeCategory === "All" && heroBlog) {
      return blogs.filter((b) => b.id !== heroBlog.id);
    }
    return blogs;
  }, [blogs, activeCategory, heroBlog]);

  const listBlogsFiltered = useMemo(() => {
    const q = articleQuery.trim().toLowerCase();
    if (!q) return listBlogs;
    return listBlogs.filter((b) => {
      const plain = b.body.replace(/<[^>]+>/g, "").toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        plain.includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [listBlogs, articleQuery]);

  const showEmpty =
    !loading &&
    listBlogsFiltered.length === 0 &&
    (activeCategory !== "All" || !heroBlog);

  const fetchBlogs = useCallback(async (p = 0, category = activeCategory, reset = false) => {
    const genAtStart = p === 0 ? ++listFetchGen.current : listFetchGen.current;
    if (p === 0) {
      setLoading(true);
      setError(null);
    } else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(p), size: "20" });
      if (category !== "All") params.set("category", category);
      const data = await fetchJson<PagedBlogs>(`/api/blogs?${params}`);
      if (category !== activeCategoryRef.current) return;
      if (p === 0 && genAtStart !== listFetchGen.current) return;
      const content = Array.isArray(data.content) ? data.content : [];
      setBlogs((prev) => (reset || p === 0 ? content : [...prev, ...content]));
      setHasMore(!data.last);
      setPage(p);
    } catch {
      if (p === 0 && genAtStart !== listFetchGen.current) return;
      if (category !== activeCategoryRef.current) return;
      setError("Failed to load blogs");
    } finally {
      if (p === 0 && genAtStart !== listFetchGen.current) return;
      if (p === 0) {
        setLoading(false);
        setLoadingMore(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [activeCategory]);

  const fetchFeatured = useCallback(async () => {
    try {
      const res = await fetch("/api/blogs/featured");
      if (!res.ok) {
        setFeatured([]);
        return;
      }
      const data: BlogDto[] = await res.json();
      setFeatured(Array.isArray(data) ? data : []);
    } catch {
      setFeatured([]);
    }
  }, []);

  useEffect(() => {
    void fetchFeatured();
  }, [fetchFeatured]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchJson<string[]>("/api/blogs/categories");
        if (Array.isArray(data)) setCategoryTabs(mergeCategoryTabs(data));
      } catch {
        /* keep canonical fallback tabs */
      }
    })();
  }, []);

  useEffect(() => {
    if (activeCategory !== "All" && !categoryTabs.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [categoryTabs, activeCategory]);

  useEffect(() => {
    void fetchBlogs(0, activeCategory, true);
  }, [activeCategory, fetchBlogs]);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setPage(0);
    setHasMore(true);
    setArticleQuery("");
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col">
      <Navbar
        user={user}
        onLogout={() => void signOut({ callbackUrl: "/login" })}
        onSearchOpen={openSearch}
        searchPlaceholder="Search articles & community posts…"
        activeLink="blog"
      />

      <main className={`${PAGE_CONTAINER} py-6 flex-1`}>
        {/* Single-column layout. The right-rail (About + Back-to-Community
            + Categories) used to live here but the category list duplicated
            the pill row above the search bar, and "Back to Community" is
            already in the top navbar. Removing the rail makes the page
            read like a focused archive instead of a triple-card layout. */}
        <div className="w-full min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[var(--color-text)]">Blog & News</h1>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Official updates, safety guides, and flood monitoring insights
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
              {categoryTabs.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap border transition-all ${
                    activeCategory === cat
                      ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                      : "bg-[var(--color-card)] text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="mb-6">
              <SearchField
                value={articleQuery}
                onValueChange={setArticleQuery}
                placeholder="Search articles by title or keyword…"
                label="Search articles"
              />
            </div>

            {heroBlog && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-2">Featured</p>
                <BlogCard blog={heroBlog} featured />
              </div>
            )}

            {error && !loading && (
              <div className="bg-[var(--color-card)] rounded-2xl border border-red-200 dark:border-red-900/50 p-8 text-center mb-4">
                <p className="text-red-600 font-medium mb-3">{error}</p>
                <button
                  type="button"
                  onClick={() => void fetchBlogs(0, activeCategory, true)}
                  className="px-4 py-2 rounded-full bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-dark)] transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] p-4 animate-pulse">
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
                  {listBlogsFiltered.map((blog) => (
                    <BlogCard key={blog.id} blog={blog} />
                  ))}
                </div>
                {showEmpty && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)] mb-3">
                      <NewspaperIcon className="h-8 w-8" />
                    </div>
                    <p className="text-[var(--color-muted)] font-medium">
                      {articleQuery.trim()
                        ? `No articles match “${articleQuery.trim()}”.`
                        : "No articles in this category yet."}
                    </p>
                  </div>
                )}
                {hasMore && listBlogs.length > 0 && (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => void fetchBlogs(page + 1, activeCategory, false)}
                      disabled={loadingMore}
                      className="px-6 py-2 rounded-2xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-hover)] disabled:opacity-50 transition-colors bg-[var(--color-card)]"
                    >
                      {loadingMore ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
      </main>

      <Footer />

      {searchOpen && (
        <SearchModal onClose={closeSearch} placeholder="Search posts, communities, articles…" />
      )}
    </div>
  );
}
