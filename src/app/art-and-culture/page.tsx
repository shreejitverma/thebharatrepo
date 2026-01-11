import { getArticlesByCategory } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';

export default function ArtAndCulturePage() {
  const articles = getArticlesByCategory('art-and-culture');
  return (
    <main className="main-content">
      <h1>Art & Culture</h1>
      <div className="category-grid">
        {articles.map((article: any) => (
          <ArticleCard key={article.slug} article={article} category="art-and-culture" />
        ))}
      </div>
    </main>
  );
}
