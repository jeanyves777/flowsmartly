"use client";

import type { WebsiteBlock, WebsiteTheme, BlogContent } from "@/types/website-builder";
import { Calendar, User } from "lucide-react";

interface Props { block: WebsiteBlock; theme: WebsiteTheme; isEditing?: boolean; }

export function BlogBlock({ block, isEditing }: Props) {
  const content = block.content as BlogContent;
  const colClass = content.columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";

  if (content.layout === "featured" && content.posts.length > 0) {
    const [featured, ...rest] = content.posts;
    return (
      <div className="py-16 sm:py-24">
        {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
        {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
        <div className="mb-8">
          <a href={isEditing ? undefined : featured.link} className="group block">
            <div className="aspect-video rounded-xl overflow-hidden bg-[var(--wb-surface)] border border-[var(--wb-border)] mb-4">
              {featured.imageUrl && <img src={featured.imageUrl} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
            </div>
            <h3 className="text-2xl font-bold group-hover:text-[var(--wb-primary)] transition-colors">{featured.title}</h3>
            <p className="text-[var(--wb-text-muted)] mt-2">{featured.excerpt}</p>
          </a>
        </div>
        <div className={`grid grid-cols-1 ${colClass} gap-8`}>
          {rest.map((post, i) => (
            <PostCard key={i} post={post} showDate={content.showDate} showAuthor={content.showAuthor} isEditing={isEditing} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-16 sm:py-24">
      {content.headline && <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">{content.headline}</h2>}
      {content.subheadline && <p className="text-lg text-[var(--wb-text-muted)] text-center mb-12 max-w-2xl mx-auto">{content.subheadline}</p>}
      <div className={content.layout === "list" ? "space-y-6 max-w-3xl mx-auto" : `grid grid-cols-1 ${colClass} gap-8`}>
        {content.posts.map((post, i) => (
          <PostCard key={i} post={post} showDate={content.showDate} showAuthor={content.showAuthor} isEditing={isEditing} isList={content.layout === "list"} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, showDate, showAuthor, isEditing, isList }: {
  post: BlogContent["posts"][0]; showDate?: boolean; showAuthor?: boolean; isEditing?: boolean; isList?: boolean;
}) {
  return (
    <a href={isEditing ? undefined : post.link} className={`group ${isList ? "flex gap-6" : "block"}`}>
      <div className={`${isList ? "w-48 flex-shrink-0" : ""} aspect-video rounded-lg overflow-hidden bg-[var(--wb-surface)] border border-[var(--wb-border)] mb-3`}>
        {post.imageUrl && <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
      </div>
      <div>
        {post.category && <span className="text-xs font-medium text-[var(--wb-primary)] uppercase tracking-wide">{post.category}</span>}
        <h3 className="text-lg font-semibold mt-1 group-hover:text-[var(--wb-primary)] transition-colors">{post.title}</h3>
        <p className="text-sm text-[var(--wb-text-muted)] mt-1 line-clamp-2">{post.excerpt}</p>
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--wb-text-muted)]">
          {showDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{post.date}</span>}
          {showAuthor && post.author && <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>}
        </div>
      </div>
    </a>
  );
}
