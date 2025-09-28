# FS-001 Dual Timeout Cleanup

## 1. 背景と目的
- FR-1, FR-2 に基づき、既存のアイドルタイムアウトとは別に、ホワイトリストを無視した強制削除タイムアウトを導入する。
- タブの蓄積を確実に防ぎつつ、既存のホワイトリスト機能による猶予も維持し、ユーザーが必要に応じて強制削除を停止できる柔軟性を提供する。

## 2. 用語
- `timeoutMinutes` : 従来のアイドルタイムアウト（ホワイトリスト適用）。
- `fullCleanupMinutes` : 全削除タイムアウト。ホワイトリストに関係なく適用され、内部的には分で保持する。
- `fullCleanupEnabled` : 全削除タイマー機能の有効/無効フラグ。`true` のときのみ `fullCleanupMinutes` が適用される。

## 3. スコープ
- 設定画面（オプション: `options.html` / `options.js`、ポップアップ: `popup.html` / `popup.js`）に UI 要素・保存処理を追加し、全削除タイマーの有効化・無効化と閾値編集を提供する。
- バックグラウンドスクリプト (`background.js`) に全削除タイムアウト判定ロジックを追加し、フラグの状態に応じて処理を切り替える。
- 既存の履歴保存 (`recentlyRemoved`) やログ整備は既存関数を再利用し、理由ラベルを保持する。

## 4. ユースケース整理
1. ユーザーがオプション画面またはポップアップでアイドルタイムアウトと全削除タイムアウトをそれぞれ設定して保存する。
2. ユーザーがホワイトリストに登録したタブは、`timeoutMinutes` を超えても全削除タイムアウトに到達するまでは保持される。
3. どのタブも `fullCleanupMinutes` を超えた場合にはホワイトリストでも削除され、削除履歴に記録される。
4. ユーザーが全削除タイマーを無効化すると、ホワイトリスト無視の強制削除は停止し、通常タイムアウトのみが適用される。

## 5. UI 仕様
- `timeoutMinutes`（分）と `fullCleanupMinutes`（時間入力だが内部では分換算）を別フィールドで表示し、単位の説明をラベルに明示する。
- 全削除タイマー用に ON/OFF トグル（チェックボックス）を設置し、オプション/ポップアップ双方で状態を共有する。
- トグルが OFF のときは `fullCleanupMinutes` 入力欄を無効化し、値を編集できないようにする。
- 初期表示時には `timeoutMinutes` が未設定なら 30（分）、`fullCleanupMinutes` が未設定なら 24（時間、内部 1440 分）、`fullCleanupEnabled` が未設定なら ON として表示する。
- バリデーションエラー時は共通メッセージでアラート表示し、保存処理を中断する（例: "全削除タイムアウトは通常タイムアウトより大きい必要があります"）。

## 6. 設定保存仕様
- `chrome.storage.sync` に `{ timeoutMinutes: number, fullCleanupMinutes: number, fullCleanupEnabled: boolean }` を保存する（時間値はいずれも分単位）。
- 保存時は整数分へ丸め（`Math.floor`）つつ、最小値 1 分を保証。`fullCleanupMinutes` は時間入力値×60 として分へ変換してから保存する。トグルが OFF の場合は既存値を保持し、値を更新しない。
- 既存ユーザーが拡張機能をアップデートした場合、初回ロード時に `fullCleanupMinutes` が未設定なら 1440 を、`fullCleanupEnabled` が未設定なら `true` を適用する。

## 7. バリデーション仕様
- 入力値が数値でない場合、または 1 未満の場合は保存を拒否しアラート表示。
- 全削除タイマーが有効 (`fullCleanupEnabled=true`) の場合に限り、`timeoutMinutes >= fullCleanupMinutes` で保存を拒否しアラート表示。
- 正常時のみアラートで保存成功を通知する（オプション/ポップアップ共通）。

## 8. 背景スクリプト処理
- `chrome.alarms.onAlarm` 内でタブごとに以下を行う:
  1. `timeoutMinutes`、`fullCleanupMinutes`、`fullCleanupEnabled` を `chrome.storage.sync.get` で取得し、ミリ秒に変換。
  2. 各タブの `last` アクティビティからの経過時間 (`elapsed`) を算出。
  3. `fullCleanupEnabled` が `true` かつ `elapsed >= fullCleanupMs` の場合はホワイトリスト判定を無視し削除。
  4. 上記に該当しない場合のみ従来ロジック（ホワイトリスト確認 → `timeoutMinutes` 超過で削除）を適用。
- 強制削除でも `logRemovedTab` を必ず呼び出し、`recentlyRemoved` リストへ記録する。
- タブ削除後は `tabActivity` から該当 ID を削除しメモリを解放する。

## 9. 既存機能との整合
- `tabActivity` の更新や `logRemovedTab` の利用は既存関数を流用して重複を避ける。
- ログ文は既存フォーマットを維持しつつ、強制削除を識別できるフラグを追加する（例: `reason: "fullCleanup"`）。
- 既存のホワイトリスト UI・機能には影響を与えない。

## 10. マイグレーション
- バックグラウンド起動時 (`onInstalled`/`onStartup`) に設定を読み込み、`fullCleanupMinutes` が falsy の場合は `chrome.storage.sync.set({ fullCleanupMinutes: 1440 })` を、`fullCleanupEnabled` が undefined の場合は `chrome.storage.sync.set({ fullCleanupEnabled: true })` を実行。
- 既存の `timeoutMinutes` デフォルト維持（30）。

## 11. 非対象
- タブグループやタブ復元 UI の刷新はスコープ外。
- 追加のタイムアウト段階や AI 判定は別 FS で扱う。

## 12. 開発タスク概要
1. 設定 UI（オプション/ポップアップ）の入力欄を拡張し、通常タイムアウトと時間単位の全削除タイマー、ON/OFF トグルを追加する。
2. バリデーション条件の導入（`timeoutMinutes < fullCleanupMinutes` など）と共通エラーメッセージの整備。
3. 時間入力を分に変換するロジックを実装し、保存/初期表示の双方で共通利用する。トグル OFF 時は既存値を保持する。
4. バックグラウンドスクリプトで全削除タイムアウト判定を追加し、トグル状態に応じて処理を分岐、ログ出力を調整。
5. 既存ユーザー向けデフォルト適用処理を `onInstalled`/`onStartup` に追加。

## 13. 処理メカニズム解説 (Why重視)

### 背景スクリプトの流れ
1. **設定読み込み**: `chrome.storage.sync.get` で `timeoutMinutes`、`fullCleanupMinutes`、`fullCleanupEnabled` を同時に取得する。Why: 単一 IO で状態を把握し、判定分岐の整合を保つため。
2. **経過時間計測**: `tabActivity` に保持した最後のアクティビティ時刻から `elapsed` を算出する。Why: 「いつ触られたか」を一元管理し全ロジックで再利用するため。
3. **強制削除判定**: `fullCleanupEnabled` が `true` かつ `elapsed >= fullCleanupMs` のときはホワイトリスト確認をスキップして即削除する。Why: ホワイトリストの有無に関係ない“最終ライン”を実現するため。
4. **通常削除判定**: 強制削除に該当しなかったタブについて `isWhitelisted` → `timeoutMinutes` 超過かを順に判定。Why: 既存ホワイトリスト体験を維持し、UI と直結した期待を壊さないため。
5. **削除処理**: `logRemovedTab`→`chrome.tabs.remove`→`tabActivity` から削除の順で呼ぶ。Why: 履歴とメモリ解放の整合性を保ち、復元フローを壊さないため。

### データ構造の役割
- `tabActivity`: タブ ID → タイムスタンプのマップ。Why: 両タイムアウト判定の共通ソースとして冗長データを持たない設計を守るため。
- `recentlyRemoved`: ローカルストレージの配列。Why: 強制削除でも同じ復元パスを提供し、ユーザーが理由を把握しやすくするため。
- `chrome.storage.sync`: 設定値の保管場所。Why: 複数端末で設定を共有し、タイムアウト条件の一貫性を維持するため。

### UI/バリデーションの意図
- 数値入力＋説明テキストを分離: Why: 2種類のタイムアウトの役割を明確化し、誤設定を減らすため。
- 全削除タイマーは時間単位で入力し内部で分へ換算: Why: 長期タイマー値を扱いやすくしつつ既存ロジック（分単位）との整合を取るため。
- `fullCleanupEnabled` で入力を制御: Why: 強制削除を一時停止したいケースで誤操作を防ぎ、後で再開する際に値を保持するため。
- `timeoutMinutes < fullCleanupMinutes` の強制: Why: 全削除タイムアウトが最終手段として機能するための前提条件を保証するため。

### ログ拡張の理由
- 削除ログにフラグ（例: `reason: "fullCleanup"`）を付与する。Why: ユーザーや開発者が「どの条件で消えたか」を後から分析できるようにするため。

### 将来拡張への布石
- 2階層タイムアウトの導入は将来的な段階的削除（例: タブグループ移動 → 削除）にも流用できる。Why: 判定レイヤーを拡張するだけで新しいアクションを差し込める設計にすることで、将来の要件追加コストを下げるため。
