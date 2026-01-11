import { getArticlesByCategory } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';

export default function SciencePage() {
  const articles = getArticlesByCategory('science');
  return (
    <main className="main-content">
      <h1>Science</h1>
      <div className="category-grid">
        {articles.map((article: any) => (
          <ArticleCard key={article.slug} article={article} category="science" />
        ))}
      </div>
    </main>
  );
}
