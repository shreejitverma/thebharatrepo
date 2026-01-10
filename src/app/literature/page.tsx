import { getArticlesByCategory } from '@/lib/articles';
import Link from 'next/link';

export default function LiteraturePage() {
  const articles = getArticlesByCategory('literature');
  return (
    <main className="main-content">
      <h1>Literature</h1>
      <ul>
        {articles.map((article) => (
          <li key={article.slug}>
            <Link href={`/literature/${article.slug}`}>
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
