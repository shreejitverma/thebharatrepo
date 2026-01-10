import { getArticlesByCategory } from '@/lib/articles';
import Link from 'next/link';

export default function HistoryPage() {
  const articles = getArticlesByCategory('history');
  return (
    <main className="main-content">
      <h1>History</h1>
      <ul>
        {articles.map((article) => (
          <li key={article.slug}>
            <Link href={`/history/${article.slug}`}>
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
