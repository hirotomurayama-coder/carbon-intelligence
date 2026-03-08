import { getCompanies } from "@/lib/wordpress";
import { CompanyList } from "@/components/CompanyList";

export default async function CompaniesPage() {
  const data = await getCompanies();
  return <CompanyList data={data} />;
}
