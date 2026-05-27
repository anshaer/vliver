/**
 * ASE 動態圖片播放器嵌入式 API (SDK)
 * 支援功能：解壓縮 .ase、自動線性補間、順/反雙向循環播放
 */
const AsePlayer = {
    /**
     * 自動載入並播放 .ase 專案
     * @param {string} fileUrl - .ase 檔案的伺服器相對或絕對路徑
     * @param {string} canvasId - 網頁中指定的 Canvas 元素 ID
     * @param {string} [loadingId] - 可選：用於顯示/隱藏載入中提示的元素 ID
     */
    async loadAndPlay(fileUrl, canvasId, loadingId = null) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`[AsePlayer] 找不到 ID 為 "${canvasId}" 的 Canvas 元素。`);
            return null;
        }
        const ctx = canvas.getContext('2d');
        const loadingDiv = loadingId ? document.getElementById(loadingId) : null;

        try {
            // 1. 遠端讀取 .ase 檔案二進制流
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`無法讀取檔案，請確認路徑正確。狀態碼: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();

            // 2. 解壓縮專案
            const zip = await JSZip.loadAsync(arrayBuffer);
            const configFile = zip.file("config.json");
            if (!configFile) throw new Error("專案包內遺失 config.json 描述檔");
            
            const config = JSON.parse(await configFile.async("text"));
            
            // 3. 配置透明畫布尺寸
            canvas.width = config.width;
            canvas.height = config.height;

            // 4. 解析內部圖片並轉成快取物件
            let imageElements = {};
            for (let imgData of config.images) {
                const pureName = imgData.filename.replace("images/", "");
                const zipImg = zip.file("images/" + pureName);
                if (zipImg) {
                    const blob = await zipImg.async("blob");
                    const url = URL.createObjectURL(blob);
                    await new Promise((resolve) => {
                        const img = new Image();
                        img.src = url;
                        img.onload = () => { imageElements[imgData.filename] = img; resolve(); };
                    });
                }
            }

            // 5. 隱藏載入提示，顯示畫布
            if (loadingDiv) loadingDiv.style.display = 'none';
            canvas.style.display = 'block';

            // 6. 內部即時數學補間函數
            function computeProps(layer, node) {
                if (node < layer.startNode || node > layer.endNode) return null;
                let points = [{ node: layer.startNode, props: layer.init }];
                Object.keys(layer.keyframes).forEach(k => {
                    const n = parseInt(k);
                    if (n > layer.startNode && n <= layer.endNode) points.push({ node: n, props: layer.keyframes[k] });
                });
                points.sort((a, b) => a.node - b.node);
                if (node <= points[0].node) return points[0].props;
                if (node >= points[points.length - 1].node) return points[points.length - 1].props;
                let p1 = points[0], p2 = points[0];
                for (let i = 0; i < points.length - 1; i++) {
                    if (node >= points[i].node && node <= points[i + 1].node) { p1 = points[i]; p2 = points[i + 1]; break; }
                }
                const t = (node - p1.node) / (p2.node - p1.node);
                return {
                    x: p1.props.x + (p2.props.x - p1.props.x) * t,
                    y: p1.props.y + (p2.props.y - p1.props.y) * t,
                    w: p1.props.w + (p2.props.w - p1.props.w) * t,
                    h: p1.props.h + (p2.props.h - p1.props.h) * t,
                    rot: p1.props.rot + (p2.props.rot - p1.props.rot) * t,
                    op: p1.props.op + (p2.props.op - p1.props.op) * t
                };
            }

            // 7. 啟動雙向循環計時器
            let currentNode = 0;
            let playDirection = 1;

            const timerId = setInterval(() => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 依圖層渲染順序繪製
                for (let i = config.images.length - 1; i >= 0; i--) {
                    const layer = config.images[i];
                    const props = computeProps(layer, currentNode); if (!props) continue;
                    const img = imageElements[layer.filename]; if (!img) continue;
                    
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, Math.min(1, props.op));
                    ctx.translate(props.x, props.y);
                    ctx.rotate(props.rot * Math.PI / 180);
                    ctx.drawImage(img, -props.w / 2, -props.h / 2, props.w, props.h);
                    ctx.restore();
                }

                // 計算下一幀
                if (config.loopType === 'forward') {
                    currentNode = (currentNode + 1) % config.totalNodes;
                } else {
                    currentNode += playDirection;
                    if (currentNode >= config.totalNodes) { currentNode = config.totalNodes - 2; playDirection = -1; }
                    else if (currentNode < 0) { currentNode = 1; playDirection = 1; }
                }
            }, config.nodeDuration * 1000);

            return timerId; // 回傳計時器 ID 供未來擴充外部控制使用

        } catch (err) {
            if (loadingDiv) {
                loadingDiv.textContent = `載入失敗: ${err.message}`;
                loadingDiv.style.color = "red";
            }
            console.error("[AsePlayer Error]", err);
            return null;
        }
    }
};