/**
 * 專業動態圖片專案製作器 - 核心控制邏輯腳本 (editor.js)
 */

// 1. 全域核心專案狀態資料結構
let project = { 
    width: 800, 
    height: 450, 
    totalNodes: 50, 
    nodeDuration: 0.1, 
    loopType: 'forward', 
    images: [] 
};

// 執行期暫存器
let loadedFiles = {};       // 存放實體 File 物件，供匯出打包用 { 'pic.png': File }
let imageObjects = {};      // 存放 Image 物件，供 Canvas 渲染用 { 'pic.png': Image }
let selectedImageId = null; // 當前選中的圖層 ID
let currentNode = 0;        // 當前時間軸影格索引位置
let isPlaying = false;      // 播放狀態旗標
let playInterval = null;    // 播放計時器
let playDirection = 1;      // 來回循環模式下的方向指標碼

// 滑鼠拖放狀態追蹤器
let ts = { mode: null, lastX: 0, lastY: 0, layer: null };

// 2. DOM 元素節點快取
const canvas = document.getElementById('main-canvas'), ctx = canvas.getContext('2d');
const canvasW = document.getElementById('canvas-w'), canvasH = document.getElementById('canvas-h');
const totalNodesInput = document.getElementById('total-nodes'), loopTypeSelect = document.getElementById('loop-type');
const fileUpload = document.getElementById('file-upload'), layerListDiv = document.getElementById('layer-list');
const nodeSlider = document.getElementById('node-slider'), directFrameInput = document.getElementById('direct-frame-input');
const nodeIdxLbls = document.querySelectorAll('.node-idx-lbl'), timeSecLbl = document.getElementById('time-sec-lbl');
const propertyPanel = document.getElementById('property-panel'), selectedTitle = document.getElementById('selected-title');

// 3. 專案初始化配置
function init() {
    updateLayoutSettings();
    bindGlobalEvents();
    bindPropertyInputs();
    drawFrame();
}

// 4. 全域環境控制設定更新
function updateLayoutSettings() {
    project.width = parseInt(canvasW.value) || 800;
    project.height = parseInt(canvasH.value) || 450;
    project.totalNodes = parseInt(totalNodesInput.value) || 50;
    project.loopType = loopTypeSelect.value;

    canvas.width = project.width;
    canvas.height = project.height;
    nodeSlider.max = project.totalNodes - 1;

    if (currentNode >= project.totalNodes) {
        currentNode = project.totalNodes - 1;
        nodeSlider.value = currentNode;
        directFrameInput.value = currentNode;
    }

    // 自動補齊或修正所有圖層的時間軸影格長度
    project.images.forEach(layer => {
        while (layer.frames.length < project.totalNodes) {
            layer.frames.push(createDefaultFrameProps(layer.name, layer.frames.length === 0));
        }
    });

    updateFrameLabels();
    drawFrame();
}

function createDefaultFrameProps(textureName, isFirst = false) {
    return {
        isKey: isFirst, // 預設只有第 0 幀是關鍵影格
        x: project.width / 2,
        y: project.height / 2,
        scaleX: 1,
        scaleY: 1,
        rotate: 0,
        opacity: 1,
        texture: textureName,
        easing: 'linear',
        event: ''
    };
}

// 5. 動態關鍵影格補間計算核心 (動態插值)
function getFrameProps(layer, frameIdx) {
    const frames = layer.frames;
    if (!frames[frameIdx]) return createDefaultFrameProps(layer.name);
    if (frames[frameIdx].isKey) return frames[frameIdx];

    // 尋找前一個最近的關鍵影格
    let prevIdx = -1;
    for (let i = frameIdx - 1; i >= 0; i--) {
        if (frames[i] && frames[i].isKey) { prevIdx = i; break; }
    }

    // 尋找後一個最近的關鍵影格
    let nextIdx = -1;
    for (let i = frameIdx + 1; i < project.totalNodes; i++) {
        if (frames[i] && frames[i].isKey) { nextIdx = i; break; }
    }

    if (prevIdx === -1 && nextIdx === -1) return frames[0] || createDefaultFrameProps(layer.name, true);
    if (prevIdx === -1) return frames[nextIdx];
    if (nextIdx === -1) return frames[prevIdx];

    // 執行兩關鍵影格間的 Easing 數值插值計算
    const prevKey = frames[prevIdx];
    const nextKey = frames[nextIdx];
    const t = (frameIdx - prevIdx) / (nextIdx - prevIdx);
    const easedT = applyEasing(t, prevKey.easing || 'linear');

    return {
        isKey: false,
        x: prevKey.x + (nextKey.x - prevKey.x) * easedT,
        y: prevKey.y + (nextKey.y - prevKey.y) * easedT,
        scaleX: prevKey.scaleX + (nextKey.scaleX - prevKey.scaleX) * easedT,
        scaleY: prevKey.scaleY + (nextKey.scaleY - prevKey.scaleY) * easedT,
        rotate: prevKey.rotate + (nextKey.rotate - prevKey.rotate) * easedT,
        opacity: prevKey.opacity + (nextKey.opacity - prevKey.opacity) * easedT,
        texture: prevKey.texture,
        easing: prevKey.easing,
        event: prevKey.event
    };
}

function applyEasing(t, type) {
    switch(type) {
        case 'easeIn': return t * t;
        case 'easeOut': return t * (2 - t);
        case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        case 'bounce':
            const n1 = 7.5625, d1 = 2.75;
            if (t < 1 / d1) return n1 * t * t;
            else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
            else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
            else return n1 * (t -= 2.625 / d1) * t + 0.984375;
        default: return t;
    }
}

// 6. Canvas 核心渲染邏輯
function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 繪製工作透明棋盤背景格
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e0ece6';
    ctx.lineWidth = 1;
    for(let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
    }
    for(let j = 0; j < canvas.height; j += 20) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
    }

    // 由底層向上遍歷渲染圖層
    project.images.forEach(layer => {
        const props = getFrameProps(layer, currentNode);
        const img = imageObjects[props.texture];
        if (!img) return;

        ctx.save();
        ctx.globalAlpha = props.opacity;
        ctx.translate(props.x, props.y);
        ctx.rotate((props.rotate * Math.PI) / 180);
        ctx.scale(props.scaleX, props.scaleY);

        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // 如果目前選中該圖層，繪製外框線與控制節點
        if (layer.id === selectedImageId) {
            ctx.strokeStyle = 'rgba(142, 227, 207, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(-img.width / 2, -img.height / 2, img.width, img.height);
            ctx.fillStyle = 'var(--choco-dark)';
            ctx.fillRect(-img.width/2 - 4, -img.height/2 - 4, 8, 8);
            ctx.fillRect(img.width/2 - 4, -img.height/2 - 4, 8, 8);
            ctx.fillRect(-img.width/2 - 4, img.height/2 - 4, 8, 8);
            ctx.fillRect(img.width/2 - 4, img.height/2 - 4, 8, 8);
        }
        ctx.restore();
    });
}

// 7. 新增圖層（上傳一般圖片素材）
fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const filename = file.name;
    loadedFiles[filename] = file;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
        imageObjects[filename] = img;

        const newLayer = {
            id: 'layer_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
            name: filename,
            filename: 'images/' + filename,
            frames: []
        };

        for (let i = 0; i < project.totalNodes; i++) {
            newLayer.frames.push(createDefaultFrameProps(filename, i === 0));
        }

        project.images.push(newLayer);
        selectedImageId = newLayer.id;

        renderLayerUI();
        updateTextureDropdowns();
        updatePropertyPanel();
        drawFrame();
        fileUpload.value = '';
    };
});

// 8. 渲染左側圖層介面列
function renderLayerUI() {
    layerListDiv.innerHTML = '';
    // 反向渲染（讓最上面的圖層顯示在列表頂部）
    for (let i = project.images.length - 1; i >= 0; i--) {
        const layer = project.images[i];
        const div = document.createElement('div');
        div.className = `layer-item ${layer.id === selectedImageId ? 'active' : ''}`;
        div.innerHTML = `
            <span class="layer-name">${layer.name}</span>
            <div class="layer-btns">
                <button class="layer-btn up-btn">▲</button>
                <button class="layer-btn down-btn">▼</button>
                <button class="layer-btn del-btn del">刪除</button>
            </div>
        `;

        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('layer-btn')) return;
            selectedImageId = layer.id;
            renderLayerUI();
            updatePropertyPanel();
            drawFrame();
        });

        div.querySelector('.up-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (i < project.images.length - 1) {
                let temp = project.images[i];
                project.images[i] = project.images[i+1];
                project.images[i+1] = temp;
                renderLayerUI(); drawFrame();
            }
        });

        div.querySelector('.down-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (i > 0) {
                let temp = project.images[i];
                project.images[i] = project.images[i-1];
                project.images[i-1] = temp;
                renderLayerUI(); drawFrame();
            }
        });

        div.querySelector('.del-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            project.images.splice(i, 1);
            if (selectedImageId === layer.id) {
                selectedImageId = null;
                propertyPanel.style.display = 'none';
            }
            renderLayerUI(); updateTextureDropdowns(); drawFrame();
        });

        layerListDiv.appendChild(div);
    }
}

// 9. 右側屬性面板資訊更新與同步
function updatePropertyPanel() {
    const layer = project.images.find(l => l.id === selectedImageId);
    if (!layer) {
        propertyPanel.style.display = 'none';
        return;
    }
    propertyPanel.style.display = 'block';
    selectedTitle.textContent = `圖層屬性: ${layer.name}`;

    const props = layer.frames[currentNode];
    document.getElementById('prop-is-key').checked = props.isKey;
    document.getElementById('prop-x').value = Math.round(props.x);
    document.getElementById('prop-y').value = Math.round(props.y);
    document.getElementById('prop-scale-x').value = props.scaleX;
    document.getElementById('prop-scale-y').value = props.scaleY;
    document.getElementById('prop-rotate').value = props.rotate;
    document.getElementById('prop-opacity').value = props.opacity;
    document.getElementById('prop-texture').value = props.texture;
    document.getElementById('prop-easing').value = props.easing;
    document.getElementById('cur-event').value = props.event;
}

function bindPropertyInputs() {
    const inputsConfig = [
        { id: 'prop-is-key', field: 'isKey', type: 'checkbox' },
        { id: 'prop-x', field: 'x', type: 'int' },
        { id: 'prop-y', field: 'y', type: 'int' },
        { id: 'prop-scale-x', field: 'scaleX', type: 'float' },
        { id: 'prop-scale-y', field: 'scaleY', type: 'float' },
        { id: 'prop-rotate', field: 'rotate', type: 'int' },
        { id: 'prop-opacity', field: 'opacity', type: 'float' },
        { id: 'prop-texture', field: 'texture', type: 'raw' },
        { id: 'prop-easing', field: 'easing', type: 'raw' },
        { id: 'cur-event', field: 'event', type: 'raw' }
    ];

    inputsConfig.forEach(cfg => {
        const el = document.getElementById(cfg.id);
        const eventType = (cfg.type === 'checkbox' || cfg.type === 'raw' && el.tagName === 'SELECT') ? 'change' : 'input';
        
        el.addEventListener(eventType, () => {
            const layer = project.images.find(l => l.id === selectedImageId);
            if (!layer) return;

            let value;
            if (cfg.type === 'checkbox') value = el.checked;
            else if (cfg.type === 'int') value = parseInt(el.value) || 0;
            else if (cfg.type === 'float') value = parseFloat(el.value) || 0;
            else value = el.value;

            layer.frames[currentNode][cfg.field] = value;
            drawFrame();
        });
    });
}

function updateTextureDropdowns() {
    const select = document.getElementById('prop-texture');
    select.innerHTML = '';
    Object.keys(imageObjects).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key; opt.textContent = key;
        select.appendChild(opt);
    });
}

// 10. 時間軸與播放操作控制
function bindGlobalEvents() {
    canvasW.addEventListener('change', updateLayoutSettings);
    canvasH.addEventListener('change', updateLayoutSettings);
    totalNodesInput.addEventListener('change', updateLayoutSettings);
    loopTypeSelect.addEventListener('change', updateLayoutSettings);

    nodeSlider.addEventListener('input', () => {
        currentNode = parseInt(nodeSlider.value);
        directFrameInput.value = currentNode;
        updateFrameLabels(); updatePropertyPanel(); drawFrame();
    });

    directFrameInput.addEventListener('input', () => {
        let val = parseInt(directFrameInput.value) || 0;
        if (val < 0) val = 0;
        if (val >= project.totalNodes) val = project.totalNodes - 1;
        currentNode = val;
        nodeSlider.value = currentNode;
        updateFrameLabels(); updatePropertyPanel(); drawFrame();
    });

    document.getElementById('btn-play').addEventListener('click', () => {
        if (isPlaying) return;
        isPlaying = true;
        playInterval = setInterval(() => {
            if (project.loopType === 'forward') {
                currentNode++;
                if (currentNode >= project.totalNodes) currentNode = 0;
            } else { // pingpong
                currentNode += playDirection;
                if (currentNode >= project.totalNodes) { currentNode = project.totalNodes - 2; playDirection = -1; }
                if (currentNode < 0) { currentNode = 1; playDirection = 1; }
            }
            nodeSlider.value = currentNode;
            directFrameInput.value = currentNode;
            updateFrameLabels(); updatePropertyPanel(); drawFrame();
        }, project.nodeDuration * 1000);
    });

    document.getElementById('btn-stop').addEventListener('click', () => {
        isPlaying = false;
        clearInterval(playInterval);
    });

    // 11. 畫布上的滑鼠即時拖曳定位圖層邏輯
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let foundLayer = null;
        for (let i = project.images.length - 1; i >= 0; i--) {
            let layer = project.images[i];
            let props = getFrameProps(layer, currentNode);
            let img = imageObjects[props.texture];
            if (!img) continue;

            // 簡易範圍碰撞箱檢測
            if (Math.abs(mouseX - props.x) < (img.width*props.scaleX)/2 && 
                Math.abs(mouseY - props.y) < (img.height*props.scaleY)/2) {
                foundLayer = layer;
                break;
            }
        }

        if (foundLayer) {
            selectedImageId = foundLayer.id;
            // 點選並移動時，強制將當前影格標記固定為「關鍵影格」以記錄位移
            foundLayer.frames[currentNode].isKey = true;
            let currentProps = getFrameProps(foundLayer, currentNode);
            foundLayer.frames[currentNode].x = currentProps.x;
            foundLayer.frames[currentNode].y = currentProps.y;

            ts.mode = 'drag';
            ts.lastX = mouseX;
            ts.lastY = mouseY;
            ts.layer = foundLayer;

            renderLayerUI(); updatePropertyPanel(); drawFrame();
        } else {
            selectedImageId = null;
            propertyPanel.style.display = 'none';
            renderLayerUI(); drawFrame();
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (ts.mode !== 'drag' || !ts.layer) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const dx = mouseX - ts.lastX;
        const dy = mouseY - ts.lastY;

        ts.layer.frames[currentNode].x += dx;
        ts.layer.frames[currentNode].y += dy;

        ts.lastX = mouseX;
        ts.lastY = mouseY;

        updatePropertyPanel();
        drawFrame();
    });

    const clearDrag = () => { ts.mode = null; ts.layer = null; };
    canvas.addEventListener('mouseup', clearDrag);
    canvas.addEventListener('mouseleave', clearDrag);
}

function updateFrameLabels() {
    nodeIdxLbls.forEach(lbl => lbl.textContent = currentNode);
    timeSecLbl.textContent = (currentNode * project.nodeDuration).toFixed(1);
}

// ==========================================================
// 12. 專案封包匯出模組 (.ase 生成)
// ==========================================================
document.getElementById('btn-export').addEventListener('click', async () => {
    if (project.images.length === 0) {
        alert("匯出提示：當前專案內無任何圖層資產。");
    }

    try {
        const zip = new JSZip();
        
        // 1. 過濾並建構結構乾淨的 config.json
        const exportConfig = {
            width: project.width,
            height: project.height,
            totalNodes: project.totalNodes,
            nodeDuration: project.nodeDuration,
            loopType: project.loopType,
            images: project.images.map(l => ({
                name: l.name,
                filename: l.filename,
                frames: l.frames
            }))
        };

        zip.file("config.json", JSON.stringify(exportConfig, null, 4));

        // 2. 將全域暫存的實體圖片二進位檔案寫入 images/ 目錄
        const imgFolder = zip.folder("images");
        Object.keys(loadedFiles).forEach(key => {
            imgFolder.file(key, loadedFiles[key]);
        });

        // 3. 封裝並導出下載
        const contentBlob = await zip.generateAsync({ type: "blob" });
        const dlLink = document.createElement('a');
        dlLink.href = URL.createObjectURL(contentBlob);
        dlLink.download = `project_${Date.now()}.ase`;
        dlLink.click();

    } catch (err) {
        console.error(err);
        alert("專案壓縮打包失敗！");
    }
});

// ==========================================================
// 13. 核心功能：解開 .ase 專案壓縮包上傳還原
// ==========================================================
const aseUpload = document.getElementById('ase-upload');
const btnImportTrigger = document.getElementById('btn-import-trigger');

if (btnImportTrigger && aseUpload) {
    btnImportTrigger.addEventListener('click', () => aseUpload.click());
}

aseUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const zip = await JSZip.loadAsync(file);
        const configFile = zip.file("config.json");
        
        if (!configFile) {
            alert("讀取失敗：找不到核心專案設定檔 config.json！");
            return;
        }

        const configText = await configFile.async("text");
        const importedConfig = JSON.parse(configText);

        // A. 導入全域設定與 DOM 同步
        canvasW.value = importedConfig.width || 800;
        canvasH.value = importedConfig.height || 450;
        totalNodesInput.value = importedConfig.totalNodes || 50;
        loopTypeSelect.value = importedConfig.loopType || 'forward';

        project.width = parseInt(canvasW.value);
        project.height = parseInt(canvasH.value);
        project.totalNodes = parseInt(totalNodesInput.value);
        project.nodeDuration = importedConfig.nodeDuration || 0.1;
        project.loopType = importedConfig.loopType;
        project.images = importedConfig.images || [];

        // B. 完全清空初始化當前執行快取
        loadedFiles = {};
        imageObjects = {};
        selectedImageId = null;
        propertyPanel.style.display = 'none';

        // C. 還原解析 images/ 中的二進位圖檔並綁定回 URL 快取
        const imagePromises = [];

        project.images.forEach((layer) => {
            // 動態補齊在匯出時被濾除的執行期專用隨機 ID
            layer.id = "layer_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
            const rawImageName = layer.name; 

            const zipImgFile = zip.file(`images/${rawImageName}`);
            if (zipImgFile) {
                const promise = zipImgFile.async("blob").then((blob) => {
                    // 包裝回實體 File 結構
                    const imgFile = new File([blob], rawImageName, { type: blob.type });
                    loadedFiles[rawImageName] = imgFile;

                    // 重新建立 Canvas 連動需要的 Image 物件
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.src = URL.createObjectURL(imgFile);
                        img.onload = () => {
                            imageObjects[rawImageName] = img;
                            resolve();
                        };
                        img.onerror = () => resolve();
                    });
                });
                imagePromises.push(promise);
            }
        });

        // 等待所有異步載入的圖層圖片就緒
        await Promise.all(imagePromises);

        // D. 重設時間軸狀態並刷新所有編輯器介面元件
        currentNode = 0;
        nodeSlider.value = 0;
        directFrameInput.value = 0;

        updateLayoutSettings();
        updateTextureDropdowns();
        renderLayerUI();
        drawFrame();

        alert("🎉 .ase 專案檔已成功上傳匯入！所有影格軌道與補間參數皆已還原。");

    } catch (err) {
        console.error("Import Error: ", err);
        alert("匯入失敗！請檢查檔案是否損毀或非標準格式。");
    } finally {
        aseUpload.value = ""; // 歸零防卡死
    }
});

// 啟動專案
window.onload = init;