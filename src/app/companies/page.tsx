import { getCompanies } from "@/lib/wordpress";
import { CompanyList } from "@/components/CompanyList";

export default async function CompaniesPage() {
  const data = await getCompanies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">企業データベース</h1>
        <p className="mt-1 text-sm text-gray-500">
          カーボンクレジット関連企業の一覧
        </p>
      </div>
      <CompanyList data={data} />
    </div>
  );
}
