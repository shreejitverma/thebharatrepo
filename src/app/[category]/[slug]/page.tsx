import { getArticleData, getAllArticleIds } from '@/lib/articles';
import type { Article as ArticleType } from '@/types/article';

export default async function Article({ params }: { params: { category: string; slug: string } }) {
  const articleData: ArticleType = await getArticleData(params.category, params.slug);
  return (
    <main className="main-content">
      <article>
        <h1>{articleData.title}</h1>
        <div>{articleData.date}</div>
        <div dangerouslySetInnerHTML={{ __html: articleData.contentHtml }} />
      </article>
    </main>
  );
}

export async function generateStaticParams() {
  const paths = getAllArticleIds();
  return paths;
}
