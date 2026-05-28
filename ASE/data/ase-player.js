/**
 * ASE 旗艦嵌入式動畫播放器 API (速度優化版)
 */
const AsePlayer = {
    async loadAndPlay(fileUrl, canvasId, loadingId = null) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) { console.error(`[AsePlayer] 找不到 Canvas: "${canvasId}"`); return null; }
        const ctx = canvas.getContext('2d');
        const loadingDiv = loadingId ? document.getElementById(loadingId) : null;

        try {
            // 1. 遠端讀取 .ase 檔案
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error(`讀取失敗，Http狀態: ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();

            // 2. 解壓縮專案
            const zip = await JSZip.loadAsync(arrayBuffer);
            const configFile = zip.file("config.json");
            if (!configFile) throw new Error("專案包內遺失 config.json 描述檔");
            
            const config = JSON.parse(await configFile.async("text"));
            canvas.width = config.width; canvas.height = config.height;

            let imageElements = {};

            // 💡 【核心優報：將 for 循環改為 Promise.all 平行排隊載入，速度提升數倍】
            const imagePromises = config.images.map(async (imgData) => {
                const pureName = imgData.filename.replace("images/", "");
                const zipImg = zip.file("images/" + pureName);
                if (zipImg) {
                    const blob = await zipImg.async("blob");
                    const url = URL.createObjectURL(blob);
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.src = url;
                        img.onload = () => { 
                            imageElements[imgData.filename] = img; 
                            resolve(); 
                        };
                        // 💡 【核心優化：防止 GitHub 掉封包導致網頁永久死鎖卡住】
                        img.onerror = () => {
                            console.warn(`[AsePlayer] 圖片解碼失敗或超時: ${pureName}，已自動跳過防止死鎖。`);
                            resolve(); 
                        };
                    });
                }
            });

            // 等待所有圖層同時平行解碼完畢
            await Promise.all(imagePromises);

            if (loadingDiv) loadingDiv.style.display = 'none';
            canvas.style.display = 'block';

            // 補間插值核心
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
                
                let t = (node - p1.node) / (p2.node - p1.node);
                const ease = p1.props.easing || 'linear';
                if (ease === 'easeIn') { t = t * t; } 
                else if (ease === 'easeOut') { t = t * (2 - t); } 
                else if (ease === 'easeInOut') { t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; } 
                else if (ease === 'bounce') {
                    let bT = t;
                    if (bT < (1/2.75)) { t = 7.5625*bT*bT; } 
                    else if (bT < (2/2.75)) { bT -= (1.5/2.75); t = 7.5625*bT*bT + 0.75; } 
                    else if (bT < (2.5/2.75)) { bT -= (2.25/2.75); t = 7.5625*bT*bT + 0.9375; } 
                    else { bT -= (2.625/2.75); t = 7.5625*bT*bT + 0.984375; }
                }

                return {
                    x: p1.props.x + (p2.props.x - p1.props.x) * t,
                    y: p1.props.y + (p2.props.y - p1.props.y) * t,
                    w: p1.props.w + (p2.props.w - p1.props.w) * t,
                    h: p1.props.h + (p2.props.h - p1.props.h) * t,
                    rot: p1.props.rot + (p2.props.rot - p1.props.rot) * t,
                    op: p1.props.op + (p2.props.op - p1.props.op) * t,
                    texture: t < 0.5 ? p1.props.texture : p2.props.texture,
                    flipX: t < 0.5 ? p1.props.flipX : p2.props.flipX,
                    flipY: t < 0.5 ? p1.props.flipY : p2.props.flipY,
                    event: node === p1.node ? p1.props.event : (node === p2.node ? p2.props.event : '')
                };
            }

            let currentNode = 0; let playDirection = 1;

            const timerId = setInterval(() => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                for (let i = config.images.length - 1; i >= 0; i--) {
                    const layer = config.images[i];
                    const props = computeProps(layer, currentNode); if (!props) continue;
                    
                    let activeTex = props.texture || layer.filename;
                    const img = imageElements[activeTex] || imageElements[layer.filename]; if (!img) continue;
                    let px = layer.pivotX ?? 0.5, py = layer.pivotY ?? 0.5;

                    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, props.op));
                    ctx.translate(props.x, props.y); ctx.rotate(props.rot * Math.PI / 180);
                    let sX = props.flipX ? -1 : 1, sY = props.flipY ? -1 : 1;
                    if (sX !== 1 || sY !== 1) ctx.scale(sX, sY);

                    ctx.drawImage(img, -props.w * px, -props.h * py, props.w, props.h); ctx.restore();

                    if (props.event && props.event.trim() !== "") {
                        window.dispatchEvent(new CustomEvent('ase-event', {
                            detail: { eventName: props.event, layerName: layer.filename, node: currentNode }
                        }));
                    }
                }

                if (config.loopType === 'forward') { currentNode = (currentNode + 1) % config.totalNodes; } 
                else {
                    currentNode += playDirection;
                    if (currentNode >= config.totalNodes) { currentNode = config.totalNodes - 2; playDirection = -1; } 
                    else if (currentNode < 0) { currentNode = 1; playDirection = 1; }
                }
            }, config.nodeDuration * 1000);

            return timerId;

        } catch (err) {
            if (loadingDiv) { loadingDiv.textContent = `載入失敗: ${err.message}`; loadingDiv.style.color = "red"; }
            console.error(err); return null;
        }
    }
};
