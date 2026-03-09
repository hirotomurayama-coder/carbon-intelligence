"use client";

import { ErrorMessage } from "@/components/ui/ErrorMessage";

export default function Error() {
  return (
    <div className="py-12">
      <ErrorMessage message="メソドロジーの取得に失敗しました。しばらく経ってから再度お試しください。" />
    </div>
  );
}
