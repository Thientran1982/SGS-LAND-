import type { Article } from "@/data/articles";

/**
 * Returns up to `limit` related articles, prioritising same category,
 * then same tags, sorted by publishedAt descending.
 * Always excludes the current article's own slug.
 */
export function getRelatedArticles(
  articles: Article[],
  currentSlug: string,
  category: string,
  tags: string[],
  limit = 3
): Article[] {
  const others = articles.filter((a) => a.slug !== currentSlug);

  const scored = others.map((a) => {
    let score = 0;
    if (a.category === category) score += 10;
    const sharedTags = a.tags.filter((t) => tags.includes(t)).length;
    score += sharedTags * 2;
    return { article: a, score };
  });

  return scored
    .sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      return new Date(y.article.publishedAt).getTime() - new Date(x.article.publishedAt).getTime();
    })
    .slice(0, limit)
    .map((s) => s.article);
}
