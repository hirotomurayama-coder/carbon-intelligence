type Props = {
  message?: string;
};

/** データ取得エラー表示 */
export function ErrorMessage({
  message = "データの取得に失敗しました。しばらく経ってから再度お試しください。",
}: Props) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <svg
        className="mx-auto mb-2 h-8 w-8 text-red-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <p className="text-sm text-red-600">{message}</p>
    </div>
  );
}
