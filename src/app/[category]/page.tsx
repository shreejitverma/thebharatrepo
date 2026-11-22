import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/content/schema';
import { CATEGORY_META, getGraph } from '@/lib/content/site';
import { primaryDating, summarizeDatings } from '@/lib/content/lens';

type Cat = (typeof CATEGORIES)[number];

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const meta = CATEGORY_META[category as Cat];
  return meta ? { title: meta.title, description: meta.description } : {};
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!(CATEGORIES as readonly string[]).includes(category)) notFound();
  const meta = CATEGORY_META[category as Cat];
  const articles = getGraph()
    .articles.filter((a) => a.category === category)
    .sort((a, b) => primaryDating(a.datings).range.earliest - primaryDating(b.datings).range.earliest);
  return (
    <div className="main-content">
      <p className="eyebrow">Articles</p>
      <h1>{meta.title}</h1>
      <p className="lede" style={{ marginTop: 0 }}>{meta.description}</p>
      {articles.length === 0 ? (
        <p className="empty">0 articles in this category yet.</p>
      ) : (
        <div className="category-grid" style={{ marginTop: 24 }}>
          {articles.map((a) => (
            <Link key={a.slug} href={`/${category}/${a.slug}`} className="card">
              <h3>{a.title}</h3>
              <p>{a.summary}</p>
              <p className="card__meta">{summarizeDatings(a.datings)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
