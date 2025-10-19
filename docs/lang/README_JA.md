日本語 | [English](../../README.md)

---

## 👩‍💻 開発者向け *(すぐ触りたい人へ)*

* [貢献ガイド](../dev/CONTRIBUTING.md)
<br> (準備中)
* [アーキテクチャ & フロー](../ARCHITECTURE.md)
<br> (準備中)
* [変更履歴](../CHANGELOG.md)
<br> (準備中)
---

## 🗑️ Auto-Tab-Cleaner

ブラウザのタブを一定時間ごとに自動整理しつつ、ユーザーにしっかりコントロールを残すChrome拡張です。

---

## ✨ 機能 *(What it does)*

-   **Automatic Tab Cleanup**  
    一定時間操作されていないタブを自動的に閉じ、散らかりとメモリ消費を抑えます。
    
-   **Customizable Rules**  
    アイドル時間、最大タブ数、ホワイトリストなどを柔軟に調整できます。
    
-   **Safety Nets**  
    削除されたタブを履歴として保存し、必要ならすぐ復元できます。
    
-   **Smarter Tab Management**  
    タブをグルーピングしたり、AIで重要なタブを保護するスマート運用も視野に入れています。

---

## 🚀 クイックスタート

1. Chrome拡張のデベロッパーモードを有効にする  
2. `manifest.json` を含むフォルダを読み込む  
3. そのまま使い始める  

---

## ⚠️ 注意事項

* 既知の制限事項や注意点  
* 今後追加予定の要素（任意）  

---

## 🛠️ RoadMap *(What's next)*
### 🔧 基本機能

- [x] **Automatic Tab Cleanup (Idle Tab Deletion)**  
    アイドル状態が続いたタブを自動的に閉じる。

- [x] **Whitelist Support**  
    特定ドメイン・URLを自動削除対象から除外できる。

- [x] **Customizable Timeout via UI**  
    拡張UIからアイドル時間しきい値を設定・変更できる。

- [x] **Tab Restoration**  
    誤って閉じたタブや自動削除タブを簡単に復元できる。

- [x] **Deletion Log Storage**  
    削除済みタブの履歴を保持し、あとから参照できる。

---

### 🧭 ブラウジング体験向上

- [ ] **Tab Overload Warning & Quick Organizer**  
    タブが増えすぎた際にトースト通知と整理アクション（例: 非アクティブタブを閉じる、ドメインごとにグループ化）を提示する。

- [ ] **Smart Tab Sorting (Auto / Manual)**  
    ドメイン・アクティビティ・タイトルなどで自動整列し、サイドバーでのドラッグ整理もサポートする。

- [ ] **Temporary Tab Suspension**  
    優先度の低いタブを一時停止し、ワンクリックで復元できるようにする。

- [ ] **Remaining Time & Deletion Notification**  
    自動削除前に残り時間表示と通知を行い、「延長」や「保管庫へ保存」などの選択肢を提供する。

---

### 📦 情報管理とリコール

- [ ] **Tab Vault (Temporary Page Storage)**  
    気になる／未読ページを一時保管する「タブ保管庫」を提供する。

- [ ] **AI Auto-Tagging & Categorization**  
    タイトルやメタ情報、本文からAIが自動分類し、タグ付けする。

- [ ] **Browsing Timeline / Flowchart Visualization**  
    1日のブラウジング履歴をタイムラインやマインドマップとして可視化する。

- [ ] **Session Snapshot & Recovery**  
    作業中のタブ構成を「セッション」として保存し、後から復元できるようにする。

---

### ☕ 集中とウェルビーイング

- [ ] **Work Session Timer & Break Reminder**  
    作業時間を計測し、適切な休憩を促すリマインダーを出す。

- [ ] **Focus Mode**  
    不要なタブをミュートし、現在の作業コンテキストを際立たせる。

- [ ] **Cognitive Load Indicator**  
    タブ数や操作状況から負荷を推定し、負担が大きいときは整理をやさしく促す。

---

### 🧩 インターフェースと連携

- [ ] **Sidebar Panel Interface**  
    ポップアップの代わりに常駐サイドバーを用意し、ログや保管庫、分析、設定へ一元アクセスできるようにする。

- [ ] **Toast Notification System**  
    警告やタイマー、リマインダーを軽量なトースト通知で表示し、作業の流れを邪魔しない。

- [ ] **Theme Adaptation & Minimal Overlay**  
    ページの雰囲気に溶け込む控えめなUIテーマを採用し、表示の違和感を最小限に抑える。

---

-- *このプロジェクトが役に立ったら、⭐をもらえると嬉しいです。*

## ライセンス
このプロジェクトはMITライセンスで提供されています。詳しくは [LICENSE](../../LICENSE) をご確認ください。
