import Link from 'next/link';

type FeaturedCategoryCardProps = {
  category: {
    slug: string;
    title: string;
    description: string;
  };
};

export default function FeaturedCategoryCard({ category }: FeaturedCategoryCardProps) {
  return (
    <Link href={`/${category.slug}`} className="card">
      <h3>{category.title}</h3>
      <p>{category.description}</p>
    </Link>
  );
}
