import { getArticlesByCategory } from '@/lib/articles';
import Link from 'next/link';

export default function SciencePage() {
  const articles = getArticlesByCategory('science');
  return (
    <main className="main-content">
      <h1>Science</h1>
      <ul>
        {articles.map((article) => (
          <li key={article.slug}>
            <Link href={`/science/${article.slug}`}>
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
