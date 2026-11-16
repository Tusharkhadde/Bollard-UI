import { ARTICLE_AUTHOR, ARTICLE_DATE_MODIFIED, ARTICLE_DATE_PUBLISHED } from "@/lib/article-metadata"

export function ArticleByline() {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      By {ARTICLE_AUTHOR} · <span>Published <time dateTime={ARTICLE_DATE_PUBLISHED}>{ARTICLE_DATE_PUBLISHED}</time></span> · <span>Updated <time dateTime={ARTICLE_DATE_MODIFIED}>{ARTICLE_DATE_MODIFIED}</time></span>
    </p>
  )
}
