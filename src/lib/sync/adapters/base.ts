import type { ScrapedMethodology, RegistryName } from "@/types";

/**
 * レジストリスクレイパーの共通インターフェース。
 * 各レジストリごとにこのインターフェースを実装する。
 * 将来のレジストリ追加時もこのパターンに従う。
 */
export interface RegistryAdapter {
  /** レジストリ名 */
  readonly name: RegistryName;
  /** スクレイピング対象 URL */
  readonly baseUrl: string;

  /**
   * レジストリからアクティブなメソドロジー一覧をスクレイピングする。
   * エラー発生時は空配列を返す（graceful degradation）。
   */
  scrape(): Promise<ScrapedMethodology[]>;
}
