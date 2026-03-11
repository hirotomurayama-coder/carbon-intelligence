"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * クライアントサイドのレンダリングエラーを捕捉し、
 * エラーメッセージ + スタックトレースを画面に表示する。
 * ハイドレーションエラーなどで白画面になるのを防ぐ。
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-700">
            クライアントサイドエラー（ハイドレーション等）
          </p>
          <p className="mt-2 text-sm text-red-600 break-all font-mono">
            {this.state.error?.message ?? "Unknown error"}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-red-500">
              スタックトレース
            </summary>
            <pre className="mt-1 max-h-60 overflow-auto rounded bg-red-100 p-2 text-[10px] text-red-500 whitespace-pre-wrap">
              {this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
