import FeaturedCategoryCard from '@/components/FeaturedCategoryCard';

const categories = [
  { slug: 'history', title: 'History', description: 'Explore the rich and diverse history of the Indian subcontinent.' },
  { slug: 'philosophy', title: 'Philosophy', description: 'Delve into the profound depths of Indian philosophical traditions.' },
  { slug: 'science', title: 'Science', description: 'Discover the scientific and technological advancements from ancient India.' },
  { slug: 'literature', title: 'Literature', description: 'Immerse yourself in the vast ocean of Indian literature.' },
  { slug: 'art-and-culture', title: 'Art & Culture', description: 'Experience the vibrant tapestry of Indian art and culture.' },
];

export default function Home() {
  return (
    <main className="main-content">
      <section className="hero">
        <h1>The Bharat Repo</h1>
        <p>A Universal Repository for Everything Related to Bharatiya Civilisation.</p>
      </section>
      <section className="featured-categories">
        <h2>Featured Categories</h2>
        <div className="category-grid">
          {categories.map((category) => (
            <FeaturedCategoryCard key={category.slug} category={category} />
          ))}
        </div>
      </section>
    </main>
  );
}
