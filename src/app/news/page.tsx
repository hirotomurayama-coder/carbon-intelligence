import { getArticles } from "@/lib/wordpress";
import { ArticleList } from "@/components/ArticleList";

export default async function NewsPage() {
  const data = await getArticles();
  return <ArticleList data={data} />;
}
