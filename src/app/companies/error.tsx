"use client";

import { ErrorMessage } from "@/components/ui/ErrorMessage";

export default function Error() {
  return (
    <div className="py-12">
      <ErrorMessage message="企業データの取得に失敗しました。" />
    </div>
  );
}
