# FS-001 Dual Timeout Cleanup

## 1. 背景と目的
- FR-1, FR-2 に基づき、既存のアイドルタイムアウトとは別に、ホワイトリストを無視した強制削除タイムアウトを導入する。
- タブの蓄積を確実に防ぎつつ、既存のホワイトリスト機能による猶予も維持する二段構えの制御を狙う。

## 2. 用語
- `timeoutMinutes` : 従来のアイドルタイムアウト（ホワイトリスト適用）。
- `fullCleanupMinutes` : 新設する全削除タイムアウト。ホワイトリストに関係なく適用。

## 3. スコープ
- オプションページ (`options.html` / `options.js`) に UI 要素・保存処理を追加。
- バックグラウンドスクリプト (`background.js`) に全削除タイムアウト判定ロジックを追加。
- 既存の履歴保存 (`recentlyRemoved`) やログ整備は既存関数を再利用する。

## 4. ユースケース整理
1. ユーザーがオプション画面でアイドルタイムアウトと全削除タイムアウトをそれぞれ設定して保存する。
2. ユーザーがホワイトリストに登録したタブは、`timeoutMinutes` を超えても全削除タイムアウトに到達するまでは保持される。
3. どのタブも `fullCleanupMinutes` を超えた場合にはホワイトリストでも削除され、削除履歴に記録される。

## 5. UI 仕様
- 従来のタイムアウト入力欄とは別に、`fullCleanupMinutes` 用の数値入力フィールドを追加し説明テキストを表示する。
- 既存の保存ボタンを流用し、押下時に両方の値を検証・保存する。
- 初期表示時には `timeoutMinutes` が未設定なら 30、`fullCleanupMinutes` が未設定なら 1440 を表示する。
- バリデーションエラー時はアラートで理由を示し、保存処理を中断する（例: "全削除タイムアウトは通常タイムアウトより大きい必要があります"）。

## 6. 設定保存仕様
- `chrome.storage.sync` に `{ timeoutMinutes: number, fullCleanupMinutes: number }` を保存。
- 保存時は整数へ丸め（`Math.floor`）つつ、最小値 1 分を保証。
- 既存ユーザーが拡張機能をアップデートした場合、初回ロード時に `fullCleanupMinutes` が未設定なら 1440 を適用する。

## 7. バリデーション仕様
- 入力値が数値でない場合、または 1 未満の場合は保存を拒否しアラート表示。
- `timeoutMinutes >= fullCleanupMinutes` の場合も保存を拒否しアラート表示。
- 正常時のみアラートで保存成功を通知する（既存挙動と一致）。

## 8. 背景スクリプト処理
- `chrome.alarms.onAlarm` 内でタブごとに以下を行う:
  1. `fullCleanupMinutes` を `chrome.storage.sync.get` で取得し、ミリ秒に変換 (`fullCleanupMs`)。
  2. 各タブの `last` アクティビティからの経過時間 (`elapsed`) を算出。
  3. `elapsed >= fullCleanupMs` の場合はホワイトリスト判定を無視し削除 (`FR-2`)。
  4. 上記に該当しない場合のみ従来ロジック（ホワイトリスト確認 → `timeoutMinutes` 超過で削除）を適用。
- 強制削除でも `logRemovedTab` を必ず呼び出し、`recentlyRemoved` リストへ記録する (`FR-5`)。
- タブ削除後は `tabActivity` から該当 ID を削除しメモリを解放する。

## 9. 既存機能との整合
- `tabActivity` の更新や `logRemovedTab` の利用は既存関数を流用して重複を避ける。
- ログ文は既存フォーマットを維持しつつ、強制削除を識別できるフラグを追加する（例: "fullCleanup": true）。
- 既存のホワイトリスト UI・機能には影響を与えない。

## 10. マイグレーション
- バックグラウンド起動時 (`onInstalled`/`onStartup`) に設定を読み込み、`fullCleanupMinutes` が falsy の場合は `chrome.storage.sync.set({ fullCleanupMinutes: 1440 })` を実行。
- 既存の `timeoutMinutes` デフォルト維持（30）。

## 11. 非対象
- タブグループやタブ復元 UI の刷新はスコープ外。
- 全削除タイムアウトの UI を複数箇所へ複製する拡張は行わない。

## 12. 開発タスク概要
1. オプション UI の入力欄追加と読み書きロジック拡張。
2. バリデーション条件の導入（`timeoutMinutes > fullCleanupMinutes` など）。
3. バックグラウンドスクリプトで全削除タイムアウト判定を追加し、ログ出力を調整。
4. 既存ユーザー向けデフォルト適用処理を `onInstalled`/`onStartup` に追加。
