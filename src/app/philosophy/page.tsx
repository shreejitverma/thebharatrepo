import { getArticlesByCategory } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';

export default function PhilosophyPage() {
  const articles = getArticlesByCategory('philosophy');
  return (
    <main className="main-content">
      <h1>Philosophy</h1>
      <div className="category-grid">
        {articles.map((article: any) => (
          <ArticleCard key={article.slug} article={article} category="philosophy" />
        ))}
      </div>
    </main>
  );
}
