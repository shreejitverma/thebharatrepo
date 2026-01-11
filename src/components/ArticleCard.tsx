import Link from 'next/link';

type ArticleCardProps = {
  article: {
    slug: string;
    title: string;
    date: string;
    // content: string;
  };
  category: string;
};

export default function ArticleCard({ article, category }: ArticleCardProps) {
  return (
    <Link href={`/${category}/${article.slug}`} className="card">
      <h3>{article.title}</h3>
      <p>{article.date}</p>
    </Link>
  );
}
