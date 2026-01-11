import { getArticleData, getAllArticleIds } from '@/lib/articles';
import type { Article as ArticleType } from '@/types/article';
import SocialShare from '@/components/SocialShare';

export default async function Article({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  const articleData: ArticleType = await getArticleData(category, slug);
  return (
    <main className="main-content">
      <article>
        <h1>{articleData.title}</h1>
        <div>{articleData.date}</div>
        <div className="article-content" dangerouslySetInnerHTML={{ __html: articleData.contentHtml }} />
        <SocialShare title={articleData.title} category={category} slug={slug} tags={articleData.tags} />
      </article>
    </main>
  );
}

export async function generateStaticParams() {
  const paths = getAllArticleIds();
  return paths;
}
