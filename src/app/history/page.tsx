import { getArticlesByCategory } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';

export default function HistoryPage() {
  const articles = getArticlesByCategory('history');
  return (
    <main className="main-content">
      <h1>History</h1>
      <div className="category-grid">
        {articles.map((article: any) => (
          <ArticleCard key={article.slug} article={article} category="history" />
        ))}
      </div>
    </main>
  );
}
