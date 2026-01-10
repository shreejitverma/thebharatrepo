import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const articlesDirectory = path.join(process.cwd(), '_content');
const publicDirectory = path.join(process.cwd(), 'public');

function getAllArticles() {
  const categories = fs.readdirSync(articlesDirectory);
  const articles = categories.flatMap((category) => {
    const categoryPath = path.join(articlesDirectory, category);
    const fileNames = fs.readdirSync(categoryPath);
    return fileNames.map((fileName) => {
      const slug = fileName.replace(/\.md$/, '');
      const fullPath = path.join(categoryPath, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data, content } = matter(fileContents);
      return {
        slug,
        category,
        ...data,
        content,
      };
    });
  });
  return articles;
}

const articles = getAllArticles();
fs.writeFileSync(path.join(publicDirectory, 'search.json'), JSON.stringify(articles));

console.log('Search index generated.');
