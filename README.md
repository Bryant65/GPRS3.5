# GPRS V4.1 Historical Loader

## 目的
V4.1 在 V4.0 的免費官方資料橋接上，加入歷史累積與官方 CSV 歷史匯入。

## 自動
- 每天 GitHub Actions 抓證交所／櫃買中心最新基本面快照
- 月營收依資料年月存進 data/history/monthly/
- 財報依年度／季別存進 data/history/quarterly/
- 自動維護 data/history/index.json
- 網站顯示目前有多少個月／季的歷史覆蓋

## 歷史補資料
官方 OpenAPI主要提供目前公開快照，不是完整 5–7 年回溯 API。
若要一次補舊資料：
1. 下載官方公開 CSV
2. 放入 data/import/
3. GitHub → Actions → Update Fundamental Data → Run workflow
4. scripts/import_history.py 會嘗試轉成歷史 JSON

## 成本
- 官方公開資料：免費
- GitHub Pages：免費
- Public repository 的標準 GitHub Actions：免費

## 第一次更新
上傳所有檔案並 Commit 後：
Actions → Update Fundamental Data → Run workflow
完成後重新整理 GitHub Pages。
