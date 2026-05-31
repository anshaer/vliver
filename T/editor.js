/**
 * 專業動態圖片專案製作器 - 核心控制邏輯腳本 (editor.js)
 * 進階版：支援全自由四角拉伸與形變映射矩引擎
 */

// 1. 全域核心專案狀態資料結構
let project = { width: 800, height: 450, totalNodes: 50, nodeDuration: 0.1, loopType: 'forward', images: [] };
let loadedFiles = {}, imageObjects = {}, selectedImageId = null, currentNode = 0, isPlaying = false, playInterval = null, playDirection = 1;
let isRecording = false;

// 滑鼠拖放、縮放、旋轉、四角變形狀態追蹤器
let ts = { mode: null, lastX: 0, lastY: 0, cornerIndex: -1, layer: null };

// 2. DOM 元素節點快取
const canvas = document.getElementById('main-canvas'), ctx = canvas.getContext('2d');
const canvasW = document.getElementById('canvas-w'), canvasH = document.getElementById('canvas-h'), totalNodesInput = document.getElementById('total-nodes'), loopTypeSelect = document.getElementById('loop-type');
const canvasBgType = document.getElementById('canvas-bg-type');
const fileUpload = document.getElementById('file-upload'), layerListDiv = document.getElementById('layer-list'), nodeSlider = document.getElementById('node-slider'), directFrameInput = document.getElementById('direct-frame-input');
const nodeIdxLbls = document.querySelectorAll('.node-idx-lbl'), timeSecLbl = document.getElementById('time-sec-lbl');
const propertyPanel = document.getElementById('property-panel'), selectedTitle = document.getElementById('selected-title');

const propStart = document.getElementById('prop-start'), propEnd = document.getElementById('prop-end'), propLockRatio = document.getElementById('prop-lock-ratio');
const pivotXInput = document.getElementById('pivot-x'), pivotYInput = document.getElementById('pivot-y');
const curX = document.getElementById('cur-x'), curY = document.getElementById('cur-y'), curW = document.getElementById('cur-w'), curH = document.getElementById('cur-h'), curRot = document.getElementById('cur-rot'), curOp = document.getElementById('cur-op');
const curTexture = document.getElementById('cur-texture'), curFlipX = document.getElementById('cur-flipx'), curFlipY = document.getElementById('cur-flipy'), curEasing = document.getElementById('cur-easing'), curEvent = document.getElementById('cur-event');

// 3. 畫布環境與全域設定同步更新
function updateLayoutSettings() {
    project.width = parseInt(canvasW.value) || 800;
    project.height = parseInt(canvasH.value) || 450;
    canvas.width = project.width; canvas.height = project.height;
    project.totalNodes = Math.min(50, Math.max(2, parseInt(totalNodesInput.value) || 50));
    project.loopType = loopTypeSelect.value;
    
    nodeSlider.max = project.totalNodes - 1; directFrameInput.max = project.totalNodes - 1;
    if(currentNode >= project.totalNodes) { currentNode = project.totalNodes - 1; }
    nodeSlider.value = currentNode; directFrameInput.value = currentNode;
    propStart.max = project.totalNodes - 1; propEnd.max = project.totalNodes - 1;
    drawFrame();
}
[canvasW, canvasH, totalNodesInput, loopTypeSelect].forEach(el => el.addEventListener('change', updateLayoutSettings));
if (canvasBgType) { canvasBgType.addEventListener('change', drawFrame); }

// 4. 素材檔案異步上傳處理
fileUpload.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
        if (loadedFiles[file.name]) return;
        loadedFiles[file.name] = file;
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            imageObjects[file.name] = img;
            const ratio = img.width / img.height;
            project.images.unshift({
                id: "layer_" + Date.now() + "_" + Math.floor(Math.random()*1000),
                filename: "images/" + file.name, rawName: file.name, aspect: ratio,
                startNode: 0, endNode: project.totalNodes - 1, lockRatio: true,
                pivotX: 0.5, pivotY: 0.5, 
                init: { x: project.width/2, y: project.height/2, w: Math.min(img.width, 200), h: Math.min(img.width, 200)/ratio, rot: 0, op: 1, texture: '', flipX: false, flipY: false, easing: 'linear', event: '' },
                keyframes: {}
            });
            updateTextureDropdowns(); renderLayerUI(); drawFrame();
        };
    });
});

// 表情貼圖選單刷新
function updateTextureDropdowns() {
    const currentSel = curTexture.value;
    curTexture.innerHTML = '<option value="">保持原圖</option>';
    Object.keys(loadedFiles).forEach(name => {
        const opt = document.createElement('option');
        opt.value = "images/" + name; opt.textContent = name;
        curTexture.appendChild(opt);
    });
    curTexture.value = currentSel;
}

// 5. 圖層渲染與排序管理
function renderLayerUI() {
    layerListDiv.innerHTML = '';
    project.images.forEach((layer, idx) => {
        const item = document.createElement('div');
        item.className = 'layer-item' + (selectedImageId === layer.id ? ' active' : '');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name'; nameSpan.textContent = layer.rawName;
        nameSpan.onclick = () => selectLayer(layer.id);
        item.appendChild(nameSpan);

        const btnGrp = document.createElement('div');
        btnGrp.className = 'layer-btns';
        const upBtn = document.createElement('button'); upBtn.className = 'layer-btn'; upBtn.textContent = '▲'; upBtn.onclick = (e) => { e.stopPropagation(); moveLayer(idx, -1); };
        const downBtn = document.createElement('button'); downBtn.className = 'layer-btn'; downBtn.textContent = '▼'; downBtn.onclick = (e) => { e.stopPropagation(); moveLayer(idx, 1); };
        const delBtn = document.createElement('button'); delBtn.className = 'layer-btn del'; delBtn.textContent = '✖'; delBtn.onclick = (e) => { e.stopPropagation(); deleteLayer(idx); };

        btnGrp.appendChild(upBtn); btnGrp.appendChild(downBtn); btnGrp.appendChild(delBtn);
        item.appendChild(btnGrp); layerListDiv.appendChild(item);
    });
}

function moveLayer(index, dir) {
    let targetIndex = index + dir; if (targetIndex < 0 || targetIndex >= project.images.length) return;
    let temp = project.images[index]; project.images[index] = project.images[targetIndex]; project.images[targetIndex] = temp;
    renderLayerUI(); drawFrame();
}

function deleteLayer(index) {
    if(project.images[index].id === selectedImageId) { selectedImageId = null; propertyPanel.style.display = 'none'; }
    project.images.splice(index, 1); renderLayerUI(); drawFrame();
}

// 6. 選取圖層與屬性面板同步
function selectLayer(id) {
    selectedImageId = id; renderLayerUI();
    const layer = project.images.find(l => l.id === id);
    if(!layer) { propertyPanel.style.display = 'none'; drawFrame(); return; }
    
    propertyPanel.style.display = 'block';
    selectedTitle.textContent = `編輯: ${layer.rawName}`;
    propStart.value = layer.startNode; propEnd.value = layer.endNode;
    propLockRatio.checked = layer.lockRatio;
    pivotXInput.value = layer.pivotX; pivotYInput.value = layer.pivotY;
    
    nodeIdxLbls.forEach(lbl => lbl.textContent = currentNode); directFrameInput.value = currentNode;
    timeSecLbl.textContent = (currentNode * 0.1).toFixed(1);

    const currentProps = computeProps(layer, currentNode);
    if(currentProps) {
        curX.value = Math.round(currentProps.x); curY.value = Math.round(currentProps.y);
        curW.value = Math.round(currentProps.w); curH.value = Math.round(currentProps.h);
        curRot.value = Math.round(currentProps.rot); curOp.value = currentProps.op;
        curTexture.value = currentProps.texture || '';
        curFlipX.checked = currentProps.flipX || false;
        curFlipY.checked = currentProps.flipY || false;
        curEasing.value = currentProps.easing || 'linear';
        curEvent.value = currentProps.event || '';
    }
    drawFrame();
}

function autoActivateGlobalKeyframe() {
    if (currentNode === 0) return;
    project.images.forEach(layer => {
        if (!layer.keyframes[currentNode]) {
            const computed = computeProps(layer, currentNode);
            layer.keyframes[currentNode] = computed ? JSON.parse(JSON.stringify(computed)) : JSON.parse(JSON.stringify(layer.init));
        }
    });
}

function syncPanelToData() {
    if (!selectedImageId) return;
    const layer = project.images.find(l => l.id === selectedImageId);
    if (!layer) return;

    layer.startNode = parseInt(propStart.value) || 0;
    layer.endNode = parseInt(propEnd.value) || 0;
    layer.lockRatio = propLockRatio.checked;
    layer.pivotX = parseFloat(pivotXInput.value) ?? 0.5;
    layer.pivotY = parseFloat(pivotYInput.value) ?? 0.5;

    autoActivateGlobalKeyframe();
    let target = currentNode === 0 ? layer.init : layer.keyframes[currentNode];

    // 🔥 如果手動更改數值面板，清除自訂四角頂點，讓其重新依據數值產生正規矩形
    if (document.activeElement === curX || document.activeElement === curY || 
        document.activeElement === curW || document.activeElement === curH || document.activeElement === curRot) {
        delete target.corners;
    }

    let wVal = parseFloat(curW.value) || 10, hVal = parseFloat(curH.value) || 10;
    if (layer.lockRatio && document.activeElement === curW) hVal = wVal / layer.aspect;
    if (layer.lockRatio && document.activeElement === curH) wVal = hVal * layer.aspect;
    curW.value = Math.round(wVal); curH.value = Math.round(hVal);

    let targetData = { 
        x: parseFloat(curX.value)||0, y: parseFloat(curY.value)||0, w: wVal, h: hVal, rot: parseFloat(curRot.value)||0, op: parseFloat(curOp.value) ?? 1,
        texture: curTexture.value, flipX: curFlipX.checked, flipY: curFlipY.checked, easing: curEasing.value, event: curEvent.value
    };

    // 保留可能已經存在的 corners 資料
    if (target.corners) targetData.corners = target.corners;

    if (currentNode === 0) { layer.init = targetData; } 
    else { layer.keyframes[currentNode] = targetData; }
    drawFrame();
}

[propStart, propEnd, propLockRatio, pivotXInput, pivotYInput, curX, curY, curW, curH, curRot, curOp, curTexture, curFlipX, curFlipY, curEasing, curEvent].forEach(el => el.addEventListener('input', syncPanelToData));

function changeCurrentNode(nodeValue) {
    currentNode = Math.min(project.totalNodes - 1, Math.max(0, parseInt(nodeValue) || 0));
    nodeSlider.value = currentNode; directFrameInput.value = currentNode;
    nodeIdxLbls.forEach(lbl => lbl.textContent = currentNode); timeSecLbl.textContent = (currentNode * 0.1).toFixed(1);
    if(selectedImageId) selectLayer(selectedImageId); else drawFrame();
}
nodeSlider.addEventListener('input', (e) => changeCurrentNode(e.target.value));
directFrameInput.addEventListener('input', (e) => changeCurrentNode(e.target.value));

// ==========================================================
// 核心數學公式增強：將 2D 基礎屬性轉化為 4 個絕對頂點座標 (TL, TR, BR, BL)
// ==========================================================
function getCornersFromProps(props, layer) {
    if (props.corners) {
        return JSON.parse(JSON.stringify(props.corners));
    }
    let px = layer.pivotX ?? 0.5, py = layer.pivotY ?? 0.5;
    let w = props.w, h = props.h;
    
    // 尚未旋轉時相對於中心點的 4 角偏移
    let tl = { x: -w * px, y: -h * py };
    let tr = { x: w * (1 - px), y: -h * py };
    let br = { x: w * (1 - px), y: h * (1 - py) };
    let bl = { x: -w * px, y: h * (1 - py) };
    
    let rad = (props.rot || 0) * Math.PI / 180;
    let cos = Math.cos(rad), sin = Math.sin(rad);
    
    function rotatePoint(p) {
        return {
            x: props.x + (p.x * cos - p.y * sin),
            y: props.y + (p.x * sin + p.y * cos)
        };
    }
    return [rotatePoint(tl), rotatePoint(tr), rotatePoint(br), rotatePoint(bl)];
}

// 判斷點擊是否落在不規則四邊形內 (射線法)
function isPointInQuad(x, y, corners) {
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
        let xi = corners[i].x, yi = corners[i].y;
        let xj = corners[j].x, yj = corners[j].y;
        let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// 🔥 核心變形映射渲染器：利用雙三角形仿射技術，將圖片扭曲至任意四邊形內
function drawTextureQuad(ctx, img, corners, flipX, flipY) {
    let pts = [ { ...corners[0] }, { ...corners[1] }, { ...corners[2] }, { ...corners[3] } ];
    
    // 水平與垂直翻轉映射處理
    if (flipX) {
        let tmp0 = pts[0]; pts[0] = pts[1]; pts[1] = tmp0;
        let tmp3 = pts[3]; pts[3] = pts[2]; pts[2] = tmp3;
    }
    if (flipY) {
        let tmp0 = pts[0]; pts[0] = pts[3]; pts[3] = tmp0;
        let tmp1 = pts[1]; pts[1] = pts[2]; pts[2] = tmp1;
    }
    
    const W = img.width, H = img.height;

    // 三角形 1: 左上-右上-左下 (pts[0], pts[1], pts[3])
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath(); ctx.clip();
    
    let a1 = (pts[1].x - pts[0].x) / W;
    let b1 = (pts[1].y - pts[0].y) / W;
    let c1 = (pts[3].x - pts[0].x) / H;
    let d1 = (pts[3].y - pts[0].y) / H;
    let e1 = pts[0].x, f1 = pts[0].y;
    
    ctx.transform(a1, b1, c1, d1, e1, f1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    // 三角形 2: 右下-左下-右上 (pts[2], pts[3], pts[1])
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[3].x, pts[3].y); ctx.lineTo(pts[1].x, pts[1].y);
    ctx.closePath(); ctx.clip();
    
    let e2 = pts[1].x + pts[3].x - pts[2].x;
    let f2 = pts[1].y + pts[3].y - pts[2].y;
    let a2 = (pts[2].x - pts[3].x) / W;
    let b2 = (pts[2].y - pts[3].y) / W;
    let c2 = (pts[2].x - pts[1].x) / H;
    let d2 = (pts[2].y - pts[1].y) / H;
    
    ctx.transform(a2, b2, c2, d2, e2, f2);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
}

// 7. 進階緩動數學曲線插值解算核心 (擴充支援 4 角獨立頂點內插)
function computeProps(layer, node) {
    if (node < layer.startNode || node > layer.endNode) return null;
    let points = [{ node: layer.startNode, props: layer.init }];
    Object.keys(layer.keyframes).forEach(k => { const n = parseInt(k); if(n > layer.startNode && n <= layer.endNode) points.push({ node: n, props: layer.keyframes[k] }); });
    points.sort((a,b) => a.node - b.node);
    if(node <= points[0].node) return points[0].props;
    if(node >= points[points.length-1].node) return points[points.length-1].props;
    
    let p1 = points[0], p2 = points[0];
    for(let i=0; i<points.length-1; i++){ if(node >= points[i].node && node <= points[i+1].node) { p1 = points[i]; p2 = points[i+1]; break; } }
    
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

    let baseProps = { 
        x: p1.props.x + (p2.props.x - p1.props.x)*t, y: p1.props.y + (p2.props.y - p1.props.y)*t, 
        w: p1.props.w + (p2.props.w - p1.props.w)*t, h: p1.props.h + (p2.props.h - p1.props.h)*t, 
        rot: p1.props.rot + (p2.props.rot - p1.props.rot)*t, op: p1.props.op + (p2.props.op - p1.props.op)*t,
        texture: t < 0.5 ? p1.props.texture : p2.props.texture,
        flipX: t < 0.5 ? p1.props.flipX : p2.props.flipX,
        flipY: t < 0.5 ? p1.props.flipY : p2.props.flipY,
        easing: p1.props.easing,
        event: node === p1.node ? p1.props.event : (node === p2.node ? p2.props.event : '')
    };

    // 🔥 頂點插值：讓變形自由順滑地進行補間動畫
    let c1 = getCornersFromProps(p1.props, layer);
    let c2 = getCornersFromProps(p2.props, layer);
    baseProps.corners = [];
    for (let i = 0; i < 4; i++) {
        baseProps.corners.push({
            x: c1[i].x + (c2[i].x - c1[i].x) * t,
            y: c1[i].y + (c2[i].y - c1[i].y) * t
        });
    }
    return baseProps;
}

// 8. 畫布即時重繪渲染引擎
function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const bgMode = canvasBgType ? canvasBgType.value : 'white';
    if (bgMode === 'white') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgMode === 'green') {
        ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for(let i = project.images.length - 1; i >= 0; i--) {
        const layer = project.images[i];
        const props = computeProps(layer, currentNode); if (!props) continue;
        
        let activeTexture = props.texture || layer.filename;
        let pureTexName = activeTexture.replace("images/", "");
        const img = imageObjects[pureTexName] || imageObjects[layer.rawName]; if (!img) continue;
        
        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, props.op));
        let corners = getCornersFromProps(props, layer);
        // 呼叫變形網格渲染
        drawTextureQuad(ctx, img, corners, props.flipX, props.flipY);
        ctx.restore();
    }

    // 繪製控制外框把手與 4 個變形操縱點
    if(selectedImageId && !isPlaying && !isRecording) {
        const layer = project.images.find(l => l.id === selectedImageId);
        const props = computeProps(layer, currentNode);
        if(props) {
            let corners = getCornersFromProps(props, layer);

            ctx.save(); 
            ctx.strokeStyle = '#007fff'; ctx.lineWidth = 2; 
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            ctx.lineTo(corners[1].x, corners[1].y);
            ctx.lineTo(corners[2].x, corners[2].y);
            ctx.lineTo(corners[3].x, corners[3].y);
            ctx.closePath(); ctx.stroke();
            
            // 🔥 繪製 4 個角落的自由變形方塊
            ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#007fff';
            for (let j = 0; j < 4; j++) {
                ctx.fillRect(corners[j].x - 6, corners[j].y - 6, 12, 12);
                ctx.strokeRect(corners[j].x - 6, corners[j].y - 6, 12, 12);
            }
            
            // 繪製旋轉把手 (基於上邊緣上方)
            let dx = corners[1].x - corners[0].x, dy = corners[1].y - corners[0].y;
            let dLen = Math.sqrt(dx*dx + dy*dy) || 1;
            let nx = -dy / dLen, ny = dx / dLen;
            let rotHandleX = (corners[0].x + corners[1].x)/2 + nx * 25;
            let rotHandleY = (corners[0].y + corners[1].y)/2 + ny * 25;
            
            ctx.beginPath();
            ctx.moveTo((corners[0].x + corners[1].x)/2, (corners[0].y + corners[1].y)/2);
            ctx.lineTo(rotHandleX, rotHandleY); ctx.stroke();
            
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(rotHandleX, rotHandleY, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            
            // 中心點
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(props.x, props.y, 5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }
}

// 9. 畫布滑鼠事件監聽 (四角拉伸核心觸發)
canvas.addEventListener('mousedown', (e) => {
    if(isPlaying || isRecording) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    let hitFound = false;
    for(let i = 0; i < project.images.length; i++) {
        const layer = project.images[i];
        const props = computeProps(layer, currentNode); if(!props) continue;
        const corners = getCornersFromProps(props, layer);

        if(layer.id === selectedImageId) {
            // A. 檢查是否點擊到 4 個角中的其中一個
            let hitCorner = -1;
            for (let j = 0; j < 4; j++) {
                if (Math.sqrt((mx - corners[j].x)**2 + (my - corners[j].y)**2) < 12) {
                    hitCorner = j; break;
                }
            }
            if (hitCorner !== -1) {
                autoActivateGlobalKeyframe();
                let target = currentNode === 0 ? layer.init : layer.keyframes[currentNode];
                if (!target.corners) target.corners = getCornersFromProps(target, layer);
                
                ts = { mode: 'corner_stretch', cornerIndex: hitCorner, layer: layer };
                hitFound = true; break;
            }

            // B. 檢查旋轉把手
            let dx = corners[1].x - corners[0].x, dy = corners[1].y - corners[0].y;
            let dLen = Math.sqrt(dx*dx + dy*dy) || 1;
            let nx = -dy / dLen, ny = dx / dLen;
            let rotHandleX = (corners[0].x + corners[1].x)/2 + nx * 25;
            let rotHandleY = (corners[0].y + corners[1].y)/2 + ny * 25;

            if (Math.sqrt((mx - rotHandleX)**2 + (my - rotHandleY)**2) < 12) {
                ts = { mode: 'rotate', lastX: mx, lastY: my, initialProps: { ...props }, layer: layer };
                hitFound = true; break;
            }
        }

        // C. 整體平移碰撞偵測
        if (isPointInQuad(mx, my, corners)) {
            selectLayer(layer.id);
            ts = { mode: 'move', lastX: mx, lastY: my, initialProps: { ...props }, layer: layer };
            hitFound = true; break;
        }
    }
    if(!hitFound) { selectedImageId = null; renderLayerUI(); propertyPanel.style.display = 'none'; drawFrame(); }
});

window.addEventListener('mousemove', (e) => {
    if(!ts.mode) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const layer = ts.layer;
    const deltaX = mx - ts.lastX, deltaY = my - ts.lastY;

    autoActivateGlobalKeyframe();
    let target = currentNode === 0 ? layer.init : layer.keyframes[currentNode];

    if(ts.mode === 'move') {
        target.x += deltaX; target.y += deltaY;
        if (target.corners) {
            for (let i = 0; i < 4; i++) {
                target.corners[i].x += deltaX; target.corners[i].y += deltaY;
            }
        }
    } 
    else if(ts.mode === 'corner_stretch') {
        // 🔥 更新被拉拽的那個頂點座標
        target.corners[ts.cornerIndex].x = mx;
        target.corners[ts.cornerIndex].y = my;
        
        // 重新同步估算中心點
        let cx = 0, cy = 0;
        for(let i=0; i<4; i++) { cx += target.corners[i].x; cy += target.corners[i].y; }
        target.x = cx / 4; target.y = cy / 4;
    }
    else if(ts.mode === 'rotate') {
        const angle = Math.atan2(my - target.y, mx - target.x) * 180 / Math.PI;
        target.rot = Math.round((angle + 90) % 360);
        delete target.corners; // 旋轉重置為標準矩形
    }

    ts.lastX = mx; ts.lastY = my; selectLayer(selectedImageId);
});

window.addEventListener('mouseup', () => { ts.mode = null; });

// 10. 播放預覽控制器
document.getElementById('btn-play').addEventListener('click', () => {
    if(isPlaying || isRecording) return; isPlaying = true; playDirection = 1;
    playInterval = setInterval(() => {
        if(project.loopType === 'forward') { currentNode = (currentNode + 1) % project.totalNodes; } 
        else {
            currentNode += playDirection;
            if(currentNode >= project.totalNodes) { currentNode = project.totalNodes - 2; playDirection = -1; }
            else if(currentNode < 0) { currentNode = 1; playDirection = 1; }
        }
        nodeSlider.value = currentNode; directFrameInput.value = currentNode;
        nodeIdxLbls.forEach(lbl => lbl.textContent = currentNode); timeSecLbl.textContent = (currentNode * 0.1).toFixed(1);
        
        project.images.forEach(l => {
            const p = computeProps(l, currentNode);
            if(p && p.event && currentNode === parseInt(nodeSlider.value)) console.log(`[製作器預覽事件] ${l.rawName} -> 觸發: ${p.event}`);
        });

        drawFrame();
    }, project.nodeDuration * 1000);
});

document.getElementById('btn-stop').addEventListener('click', () => { clearInterval(playInterval); isPlaying = false; if(selectedImageId) selectLayer(selectedImageId); });

// 11. 專案封包打包下載 (.ase)
document.getElementById('btn-export').addEventListener('click', () => {
    if(project.images.length === 0) { alert("請上傳圖片素材再行匯出！"); return; }
    const zip = new JSZip(), imgFolder = zip.folder("images");
    const cleanConfig = {
        width: project.width, height: project.height, totalNodes: project.totalNodes, nodeDuration: project.nodeDuration, loopType: project.loopType,
        images: project.images.map(l => ({ filename: l.filename, startNode: l.startNode, endNode: l.endNode, pivotX: l.pivotX, pivotY: l.pivotY, init: l.init, keyframes: l.keyframes }))
    };
    zip.file("config.json", JSON.stringify(cleanConfig, null, 2));
    project.images.forEach(l => { const f = loadedFiles[l.rawName]; if(f) imgFolder.file(l.rawName, f); });
    zip.generateAsync({type:"blob"}).then(blob => {
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = "animation_project.ase"; document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    });
});

// 12. 畫布高畫質 WebM 錄製外包導出
document.getElementById('btn-export-webm').addEventListener('click', async () => {
    if(project.images.length === 0) { alert("請上傳素材！"); return; }
    const btnWebm = document.getElementById('btn-export-webm'); const backup = btnWebm.textContent;
    btnWebm.textContent = "錄製中..."; btnWebm.disabled = true;
    document.getElementById('btn-stop').click(); isRecording = true;
    
    let queue = [];
    for(let i=0; i<project.totalNodes; i++) queue.push(i);
    if(project.loopType === 'pingpong') { for(let i=project.totalNodes-2; i>=0; i--) queue.push(i); }

    const stream = canvas.captureStream(30);
    let selectedFormat = ['video/webm;codecs=vp9', 'video/webm'].find(f => MediaRecorder.isTypeSupported(f));
    
    const recorder = new MediaRecorder(stream, { 
        mimeType: selectedFormat,
        videoBitsPerSecond: 15000000 
    });
    
    const chunks = []; recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    const finishPromise = new Promise(r => recorder.onstop = () => r(new Blob(chunks, { type: 'video/webm' })));
    recorder.start();

    for(let f of queue) {
        currentNode = f; nodeSlider.value = f; directFrameInput.value = f;
        nodeIdxLbls.forEach(lbl => lbl.textContent = f); timeSecLbl.textContent = (f * 0.1).toFixed(1);
        drawFrame(); await new Promise(r => setTimeout(r, 100));
    }
    await new Promise(r => setTimeout(r, 100)); recorder.stop();
    const finalBlob = await finishPromise;

    const videoUrl = URL.createObjectURL(finalBlob); const dl = document.createElement('a');
    dl.href = videoUrl; dl.download = "animation_output.webm"; document.body.appendChild(dl); dl.click();
    document.body.removeChild(dl); URL.revokeObjectURL(videoUrl);

    isRecording = false; btnWebm.textContent = backup; btnWebm.disabled = false; changeCurrentNode(0);
});

// 13. 核心功能：解開 .ase 專案壓縮包上傳還原
const btnImport = document.getElementById('btn-import') || document.getElementById('btn-import-trigger');
const aseUpload = document.getElementById('ase-upload');

if (btnImport && aseUpload) {
    btnImport.addEventListener('click', () => aseUpload.click());
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

        canvasW.value = importedConfig.width || 800;
        canvasH.value = importedConfig.height || 450;
        totalNodesInput.value = importedConfig.totalNodes || 50;
        loopTypeSelect.value = importedConfig.loopType || 'forward';

        updateLayoutSettings();

        loadedFiles = {}; imageObjects = {}; selectedImageId = null; propertyPanel.style.display = 'none';

        const imagePromises = [];
        const importedImages = importedConfig.images || [];

        for (let layer of importedImages) {
            layer.rawName = layer.filename.replace("images/", "");
            layer.id = "layer_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
            if (layer.lockRatio === undefined) layer.lockRatio = true;

            const zipImgFile = zip.file(layer.filename) || zip.file("images/" + layer.rawName);
            if (zipImgFile) {
                const promise = zipImgFile.async("blob").then((blob) => {
                    const imgFile = new File([blob], layer.rawName, { type: blob.type });
                    loadedFiles[layer.rawName] = imgFile;

                    return new Promise((resolve) => {
                        const img = new Image();
                        img.src = URL.createObjectURL(imgFile);
                        img.onload = () => {
                            imageObjects[layer.rawName] = img;
                            layer.aspect = img.width / img.height; 
                            resolve();
                        };
                        img.onerror = () => resolve();
                    });
                });
                imagePromises.push(promise);
            }
        }

        await Promise.all(imagePromises);

        project.images = importedImages;
        updateTextureDropdowns(); renderLayerUI(); changeCurrentNode(0);

        alert("🎉 .ase 專案檔已成功匯入！所有變形影格軌道與素材已完全還原。");

    } catch (err) {
        console.error("Import Error: ", err);
        alert("匯入失敗！請確認該檔案是否為本系統導出的標準 .ase 專案封包。");
    } finally {
        aseUpload.value = ""; 
    }
});

// 初始化環境執行
updateLayoutSettings();