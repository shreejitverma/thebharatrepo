import { getArticlesByCategory } from '@/lib/articles';
import ArticleCard from '@/components/ArticleCard';

export default function LiteraturePage() {
  const articles = getArticlesByCategory('literature');
  return (
    <main className="main-content">
      <h1>Literature</h1>
      <div className="category-grid">
        {articles.map((article: any) => (
          <ArticleCard key={article.slug} article={article} category="literature" />
        ))}
      </div>
    </main>
  );
}
