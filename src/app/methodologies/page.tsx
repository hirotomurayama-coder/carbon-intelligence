import { getMethodologies } from "@/lib/wordpress";
import { MethodologyList } from "@/components/MethodologyList";

export default async function MethodologiesPage() {
  const data = await getMethodologies();
  return <MethodologyList data={data} />;
}
