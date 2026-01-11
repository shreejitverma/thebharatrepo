import { getArticlesByCategory } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';

export default function MusicPage() {
  const articles = getArticlesByCategory('music');
  return (
    <main className="main-content">
      <h1>Music</h1>
      <div className="category-grid">
        {articles.map((article: any) => (
          <ArticleCard key={article.slug} article={article} category="music" />
        ))}
      </div>
    </main>
  );
}
