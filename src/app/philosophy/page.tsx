import { getArticlesByCategory } from '@/lib/articles';
import Link from 'next/link';

export default function PhilosophyPage() {
  const articles = getArticlesByCategory('philosophy');
  return (
    <main className="main-content">
      <h1>Philosophy</h1>
      <ul>
        {articles.map((article) => (
          <li key={article.slug}>
            <Link href={`/philosophy/${article.slug}`}>
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
