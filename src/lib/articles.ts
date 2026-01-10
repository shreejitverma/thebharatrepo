import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import type { Article as ArticleType } from '@/types/article';

const articlesDirectory = path.join(process.cwd(), '_content');

export function getAllArticleIds() {
  const categories = fs.readdirSync(articlesDirectory);
  const ids = categories.flatMap((category) => {
    const categoryPath = path.join(articlesDirectory, category);
    if (!fs.existsSync(categoryPath) || !fs.lstatSync(categoryPath).isDirectory()) {
      return [];
    }
    const fileNames = fs.readdirSync(categoryPath);
    return fileNames.map((fileName) => {
      return {
        params: {
          category,
          slug: fileName.replace(/\.md$/, ''),
        },
      };
    });
  });
  return ids;
}

export async function getArticleData(category: string, slug: string): Promise<ArticleType> {
  const fullPath = path.join(articlesDirectory, category, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');

  const matterResult = matter(fileContents);

  const processedContent = await remark()
    .use(html)
    .process(matterResult.content);
  const contentHtml = processedContent.toString();

  return {
    slug,
    contentHtml,
    title: matterResult.data.title,
    date: matterResult.data.date,
    tags: matterResult.data.tags,
    content: matterResult.content,
    category,
  };
}

export function getArticlesByCategory(category: string) {
  const categoryPath = path.join(articlesDirectory, category);
  if (!fs.existsSync(categoryPath) || !fs.lstatSync(categoryPath).isDirectory()) {
    return [];
  }
  const fileNames = fs.readdirSync(categoryPath);
  const articles = fileNames.map((fileName) => {
    const slug = fileName.replace(/\.md$/, '');
    const fullPath = path.join(categoryPath, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(fileContents);
    return {
      slug,
      ...data,
    };
  });
  return articles;
}
