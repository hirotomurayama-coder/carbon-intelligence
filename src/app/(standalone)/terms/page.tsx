import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約 | Carbon Intelligence",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-6 py-12 md:py-16">
        <h1 className="mb-2 border-b-2 border-gray-900 pb-4 text-xl font-bold tracking-wide text-gray-900 md:text-2xl">
          Carbon Intelligence 利用規約
        </h1>
        <p className="mb-8 text-sm text-gray-500">株式会社クレイドルトゥー</p>

        <p className="mb-8 text-sm leading-relaxed text-gray-600">
          本利用規約（以下「本規約」という）は、株式会社クレイドルトゥー（以下「当社」という）が提供するCarbon Intelligenceサービス（以下「本サービス」という）の利用条件を定めるものです。ユーザーは、本規約に同意のうえ本サービスをご利用ください。本サービスの利用申込みをもって、本規約の全条項に同意したものとみなします。
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-gray-600">

          {/* 第１章 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">第１章　総則</h2>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第１条（定義）</h3>
              <p>１　本規約において使用する用語の定義は以下のとおりとします。</p>
              <ol className="mt-2 space-y-1 pl-4">
                <li>（１）「本サービス」とは、当社が運営するウェブサイト（https://intelligence.carboncredits.jp）にて提供する、カーボンクレジット市場に関する情報・データ・分析等のデジタルインテリジェンスサービスをいいます。</li>
                <li>（２）「ユーザー」とは、本規約に同意のうえ本サービスの利用登録を行った個人または法人をいいます。</li>
                <li>（３）「アカウント」とは、ユーザーが本サービスを利用するために登録したID・パスワード等の情報をいいます。</li>
                <li>（４）「利用料金」とは、本サービスの利用対価として当社に支払う月額料金をいいます。</li>
                <li>（５）「コンテンツ」とは、本サービス上で提供される文章、データ、グラフィック、分析レポートその他一切の情報をいいます。</li>
              </ol>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第２条（規約の適用）</h3>
              <ol className="space-y-1">
                <li>１　本規約は、ユーザーと当社との間の本サービスに関する一切の関係に適用されます。</li>
                <li>２　当社が本サービス上またはウェブサイト上に掲載するガイドライン・ポリシー等は、本規約の一部を構成するものとします。</li>
                <li>３　本規約の内容と前項のガイドライン等が異なる場合は、本規約が優先して適用されます。</li>
              </ol>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-700">第３条（規約の変更）</h3>
              <ol className="space-y-1">
                <li>１　当社は、必要と判断した場合、ユーザーへの事前通知なく本規約を変更することができます。ただし、ユーザーの権利を制限する重要な変更については、変更の適用日の30日前までに本サービス上またはメールにて通知するよう努めます。</li>
                <li>２　変更後の規約は本サービス上に掲示された時点から効力を生じます。変更後も本サービスを継続利用した場合、ユーザーは変更後の規約に同意したものとみなします。</li>
              </ol>
            </div>
          </section>

          {/* 第２章 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">第２章　利用登録</h2>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第４条（利用登録）</h3>
              <ol className="space-y-1">
                <li>１　本サービスの利用を希望する方は、当社所定の方法により申込みを行い、当社がこれを承認することにより利用登録が完了します。</li>
                <li>２　当社は、以下のいずれかに該当する場合、利用登録を承認しないことがあります。</li>
              </ol>
              <ol className="mt-2 space-y-1 pl-4">
                <li>（１）虚偽の情報を申告した場合</li>
                <li>（２）過去に本規約に違反したことがある場合</li>
                <li>（３）反社会的勢力等に該当する場合</li>
                <li>（４）その他当社が利用登録を不適当と判断した場合</li>
              </ol>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-700">第５条（アカウントの管理）</h3>
              <ol className="space-y-1">
                <li>１　ユーザーは、アカウントを善良なる管理者の注意をもって管理する責任を負います。</li>
                <li>２　アカウントは一身専属であり、第三者への貸与・譲渡・共有はできません。</li>
                <li>３　アカウントが不正利用された場合、ユーザーは直ちに当社に通知するとともに当社の指示に従うものとします。</li>
                <li>４　アカウントの不正使用により生じた損害について、当社の故意または重大な過失による場合を除き、当社は責任を負いません。</li>
              </ol>
            </div>
          </section>

          {/* 第３章 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">第３章　料金・支払い</h2>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第６条（利用料金）</h3>
              <ol className="space-y-1">
                <li>１　本サービスの利用料金は月額5,000円（税込）とします。</li>
                <li>２　当社は、ユーザーへの事前通知のうえ利用料金を変更することができます。変更後の料金は通知に定める適用日以降の請求期間から適用されます。</li>
              </ol>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第７条（支払い方法・時期）</h3>
              <ol className="space-y-1">
                <li>１　ユーザーは、クレジットカード（VISA・Mastercard・JCB・American Express）により利用料金を支払うものとします。</li>
                <li>２　初回の利用料金は申込み完了時に即時決済されます。以降は毎月の契約更新日に自動的にクレジットカードに請求されます。</li>
                <li>３　決済処理はStripe, Inc.が提供する決済サービスを利用して行われます。クレジットカード情報は当社サーバーには保存されません。</li>
              </ol>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第８条（解約）</h3>
              <ol className="space-y-1">
                <li>１　ユーザーはマイページより、いつでも解約手続きを行うことができます。</li>
                <li>２　解約の効力は当該請求期間の末日に生じ、次回更新日以降の料金請求は行われません。解約後も当該請求期間の末日まで本サービスを利用できます。</li>
                <li>３　次回更新日の前日までに解約手続きを完了した場合、翌月以降の料金は発生しません。</li>
              </ol>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-700">第９条（返金ポリシー）</h3>
              <ol className="space-y-1">
                <li>１　本サービスはデジタルコンテンツの提供であるため、お申込み後の返金は原則として行いません。</li>
                <li>２　ただし、以下の場合は個別に対応します。</li>
              </ol>
              <ol className="mt-2 space-y-1 pl-4">
                <li>（１）【サービス瑕疵時】当社の責に帰すべきシステム障害・重大な機能不全により本サービスが相当期間提供されなかった場合：該当期間分の返金または翌月無償提供等の補償対応を行います。</li>
              </ol>
              <p className="mt-2">３　返金が認められる場合、登録クレジットカードへの返金処理を行います。返金の完了まで決済会社の処理期間（通常5〜10営業日）を要します。</p>
            </div>
          </section>

          {/* 第４章 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">第４章　サービスの提供</h2>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第１０条（サービスの内容）</h3>
              <ol className="space-y-1">
                <li>１　当社はユーザーに対し、以下の内容を含む本サービスを提供します。</li>
              </ol>
              <ol className="mt-2 space-y-1 pl-4">
                <li>（１）カーボンクレジット市場に関する価格情報・取引動向の提供</li>
                <li>（２）国内外の制度・規制動向に関する情報提供</li>
                <li>（３）企業の気候変動対策・カーボンニュートラル戦略に関する分析レポートの提供</li>
                <li>（４）その他当社が定めるコンテンツの提供</li>
              </ol>
              <p className="mt-2">２　本サービスのコンテンツ内容および機能は、当社の裁量により変更・追加・廃止することがあります。</p>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第１１条（サービスの提供開始）</h3>
              <p>１　当社は、決済が完了した時点から速やかに本サービスへのアクセスをユーザーに提供します。</p>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第１２条（サービスの停止・中断）</h3>
              <ol className="space-y-1">
                <li>１　当社は以下の場合に本サービスの全部または一部を停止・中断することができます。</li>
              </ol>
              <ol className="mt-2 space-y-1 pl-4">
                <li>（１）システムの保守・点検・更新を行う場合</li>
                <li>（２）天災・停電・通信障害等、当社の責に帰さない事由が発生した場合</li>
                <li>（３）セキュリティ上の問題が発生した場合</li>
                <li>（４）その他当社が必要と判断した場合</li>
              </ol>
              <ol className="mt-2 space-y-1">
                <li>２　当社は前項の停止・中断について、可能な範囲で事前にユーザーに通知するよう努めます。</li>
                <li>３　当社の故意または重大な過失によらないサービス停止・中断により生じた損害について、当社は責任を負いません。</li>
              </ol>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-700">第１３条（動作環境）</h3>
              <ol className="space-y-1">
                <li>１　本サービスの推奨動作環境は以下のとおりです。</li>
              </ol>
              <ol className="mt-2 space-y-1 pl-4">
                <li>（１）Google Chrome（最新版）</li>
                <li>（２）Microsoft Edge（最新版）</li>
                <li>（３）Safari（最新版）</li>
                <li>（４）Firefox（最新版）</li>
              </ol>
              <p className="mt-2">２　推奨環境以外での動作については保証しません。</p>
            </div>
          </section>

          {/* 第５章 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">第５章　ユーザーの義務・禁止事項</h2>

            <div>
              <h3 className="mb-2 font-semibold text-gray-700">第１４条（禁止事項）</h3>
              <p>１　ユーザーは本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
              <ol className="mt-2 space-y-1 pl-4">
                <li>（１）本サービスのコンテンツを無断で複製・転載・再配布・販売する行為</li>
                <li>（２）本サービスを商業目的で第三者に再販・転貸・提供する行為</li>
                <li>（３）当社または第三者の著作権・商標権等の知的財産権を侵害する行為</li>
                <li>（４）本サービスのシステムへの不正アクセス・クローリング・スクレイピング行為</li>
                <li>（５）本サービスの運営を妨害する行為</li>
                <li>（６）虚偽の情報を登録する行為</li>
                <li>（７）法令または公序良俗に違反する行為</li>
                <li>（８）その他当社が不適切と判断する行為</li>
              </ol>
            </div>
          </section>

          {/* 第６章 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">第６章　知的財産権・免責</h2>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第１５条（知的財産権）</h3>
              <ol className="space-y-1">
                <li>１　本サービスに含まれるコンテンツ（文章・データ・グラフィック・ロゴ等）の著作権その他一切の知的財産権は当社または正当な権利者に帰属します。</li>
                <li>２　本規約は、ユーザーに対して本サービスを利用する権利のみを付与するものであり、ユーザーは上記知的財産権を何ら取得しません。</li>
              </ol>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-700">第１６条（免責事項）</h3>
              <ol className="space-y-1">
                <li>１　本サービスで提供するコンテンツは情報提供を目的とするものであり、投資・取引・意思決定等の推奨を目的とするものではありません。コンテンツの利用はユーザーの責任において行ってください。</li>
                <li>２　当社は本サービスのコンテンツの正確性・完全性・最新性について保証しません。</li>
                <li>３　ユーザーが本サービスの情報を利用した結果生じた損害について、当社の故意または重大な過失による場合を除き、当社は責任を負いません。</li>
                <li>４　当社がユーザーに対して負う損害賠償責任の範囲は、当該損害が発生した月に支払済みの利用料金を上限とします。</li>
              </ol>
            </div>
          </section>

          {/* 第７章 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">第７章　登録解除・個人情報</h2>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第１７条（登録解除）</h3>
              <ol className="space-y-1">
                <li>１　当社は、ユーザーが以下のいずれかに該当する場合、事前通知なくアカウントを停止・削除することができます。</li>
              </ol>
              <ol className="mt-2 space-y-1 pl-4">
                <li>（１）本規約に違反した場合</li>
                <li>（２）利用料金の支払いを遅滞・拒否した場合</li>
                <li>（３）登録情報に虚偽があることが判明した場合</li>
                <li>（４）反社会的勢力等に該当することが判明した場合</li>
                <li>（５）その他当社が利用継続を不適当と判断した場合</li>
              </ol>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-700">第１８条（個人情報の取扱い）</h3>
              <ol className="space-y-1">
                <li>１　当社は、ユーザーから取得した個人情報を当社のプライバシーポリシーに従い適切に取り扱います。</li>
                <li>２　プライバシーポリシーは本サービスサイト上に掲載します。</li>
              </ol>
            </div>
          </section>

          {/* 第８章 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">第８章　一般条項</h2>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第１９条（サービスの廃止）</h3>
              <ol className="space-y-1">
                <li>１　当社は、30日前の事前通知をもって本サービスを廃止することができます。</li>
                <li>２　サービス廃止時には、廃止日以降の利用料金の請求を行わず、廃止日を含む当月分について日割計算による返金を行います。</li>
              </ol>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold text-gray-700">第２０条（分離可能性）</h3>
              <p>１　本規約のいずれかの条項が無効または執行不能とされた場合も、その他の条項は引き続き有効に存続します。</p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-gray-700">第２１条（準拠法・合意管轄）</h3>
              <ol className="space-y-1">
                <li>１　本規約は日本法に準拠し、日本法に従い解釈されます。</li>
                <li>２　本規約に関する紛争については、福岡地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
              </ol>
            </div>
          </section>

          {/* 運営者情報 */}
          <section>
            <h2 className="mb-4 text-base font-bold text-gray-800">運営者情報</h2>
            <table className="w-full border-collapse">
              <tbody>
                {[
                  { label: "事業者名", content: "株式会社クレイドルトゥー（CradleTo, inc.）" },
                  { label: "代表者", content: "村山大翔" },
                  { label: "所在地", content: "〒810-0001 福岡県福岡市中央区天神1丁目1番1号 アクロス福岡1階 fabbit GGアクロス福岡" },
                  { label: "電話番号", content: "092-600-0563（受付時間：10:00〜18:00、土日祝除く）" },
                  { label: "メールアドレス", content: "info@cradleto.com" },
                  { label: "サービスURL", content: "https://intelligence.carboncredits.jp" },
                ].map(({ label, content }) => (
                  <tr key={label} className="border-b border-gray-200 last:border-b-0">
                    <th className="w-36 py-3 pr-4 text-left align-top text-xs font-semibold whitespace-nowrap text-gray-700">
                      {label}
                    </th>
                    <td className="py-3 text-xs text-gray-600">{content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="border-t border-gray-200 pt-6 text-xs text-gray-400">制定日：2026年4月1日</p>
        </div>
      </div>
    </div>
  );
}
