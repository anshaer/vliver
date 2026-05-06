***

# 創作者專屬平台 (Creator Platform)

這是一個專為創作者打造的個人網站專案，採用柔和的淡色薄荷與淡色巧克力配色風格。專案整合了動態資料載入與響應式排版，提供良好的視覺與互動體驗。

## 專案架構

本專案包含以下主要檔案：

- `index.html`：網頁的主結構（包含頁首、圖片輪播區、推廣區塊、技術支持與社群連結）。
- `styles.css`：網站的樣式表，包含自定義顏色變數、絕對定位的輪播按鈕與排版細節。
- `script.js`：處理 JSON 資料讀取與動態渲染的邏輯。
- `data.json`：存放網站內容的資料來源。

## 主要功能特色

1. **輪播系統**：
   - 圖片輪播區 (Gallery)：每 5 秒自動切換，具備手動左右切換功能。
   - 推廣區輪播 (Promo)：支援自動切換且會過濾未填寫的資料。
2. **響應式排版**：使用 CSS Grid 和 Flexbox，適應各種螢幕尺寸。
3. **薄荷巧克力配色**：柔和的綠色系與棕色系搭配，提升視覺體驗。

## 安裝與執行

1. 將專案檔案（`index.html`, `styles.css`, `script.js`, `data.json`）放置於同一個資料夾。
2. 透過瀏覽器開啟 `index.html` 即可檢視網站。

### JSON 資料格式 (`data.json`)

```json
{
    "title": "創作者專屬平台",
    "promo": [
        {
            "title": "測試標題",
            "description": "測試敘述",
            "imageUrl": "1.png",
            "ytUrl": "https://youtube.com",
            "channel1Name": "YouTube",
            "twitchUrl": "https://twitch.tv",
            "channel3Name": "Twitch",
            "xUrl": "https://x.com",
            "channel2Name": "X"
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
