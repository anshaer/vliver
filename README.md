您的 README.md 檔案已經準備好了：
[file-tag: code-generated-file-0-1778045718631575102]

以下為您產生的 Markdown 檔案內容，您可以將其儲存至專案目錄中使用：

***

# 創作者專屬平台 (Creator Platform)

這是一個專為創作者打造的清爽風格個人網站，採用了柔和的「淡色薄荷與淡色巧克力」配色風格，並包含動態輪播與社群連結功能。

## 主要功能特色

- **雙輪播系統**：
  - **圖片輪播區 (Gallery)**：頂部圖片自動輪播，每 5 秒切換下一張，手動點擊時會重置計時器。
  - **推廣區輪播 (Promo)**：多卡片單張循環切換，支援 5 秒自動切換，且會自動過濾未填寫的連結。
- **動態資料載入**：所有內容皆透過 `data.json` 動態生成，方便日後擴充。
- **自適應排版 (Responsive Layout)**：使用 CSS Grid 實作技術支持區塊，在各種裝置上皆有良好的閱讀體驗。
- **薄荷巧克力配色**：柔和清爽的配色方案，提供舒適的視覺環境。

## 檔案結構說明

- `index.html`：網頁的主結構（包含導覽列、畫廊區塊、推廣區塊與頁尾）。
- `styles.css`：網站的樣式表（薄荷巧克力色彩、輪播按鈕、響應式排版）。
- `script.js`：包含輪播邏輯、計時器、以及從 JSON 讀取資料並動態生成的邏輯。
- `data.json`：存放網站的標題、畫廊圖片、推廣資料與社群連結的資料檔。

## 專案設定與使用

1. 請確保將專案檔案放置於同一個資料夾下。
2. 透過瀏覽器開啟 `index.html`，即可瀏覽網站。

### JSON 資料格式 (`data.json`) 範例：

```json
{
    "title": "創作者專屬平台",
    "promo": [
        {
            "title": "測試標題",
            "description": "測試敘述",
            "imageUrl": "1.png",
            "ytUrl": "https://youtube.com",
            "channel1Name": "YT 連結",
            "twitchUrl": "https://twitch.tv",
            "channel3Name": "圖奇連結",
            "xUrl": "https://x.com",
            "channel2Name": "X 連結"
        }
    ],
    "gallery": [
        { "title": "視覺作品預覽 01", "url": "1.jpg" }
    ],
    "support": [
        { "title": "A1", "url": "A1.html" }
    ],
    "social": {
        "x": "https://x.com",
        "yt": "https://youtube.com",
        "twitch": "https://twitch.tv",
        "email": "contact@example.com"
    }
}
