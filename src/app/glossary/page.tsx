import { getGlossaryTerms } from "@/lib/wordpress";
import { GlossaryList } from "@/components/GlossaryList";

export default async function GlossaryPage() {
  const data = await getGlossaryTerms();
  return <GlossaryList data={data} />;
}
