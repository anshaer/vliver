/**
 * 專業動態圖片專案製作器 - 核心控制邏輯腳本 (editor.js)
 */

// 1. 全域核心專案狀態資料結構
let project = { width: 800, height: 450, totalNodes: 50, nodeDuration: 0.1, loopType: 'forward', images: [] };
let loadedFiles = {}, imageObjects = {}, selectedImageId = null, currentNode = 0, isPlaying = false, playInterval = null, playDirection = 1;
let isRecording = false;

// 滑鼠拖放、縮放、旋轉狀態追蹤器
let ts = { mode: null, lastX: 0, lastY: 0, initialProps: null, layer: null };

// 2. DOM 元素節點快取
const canvas = document.getElementById('main-canvas'), ctx = canvas.getContext('2d');
const canvasW = document.getElementById('canvas-w'), canvasH = document.getElementById('canvas-h'), totalNodesInput = document.getElementById('total-nodes'), loopTypeSelect = document.getElementById('loop-type');
const canvasBgType = document.getElementById('canvas-bg-type'); // 綁定新增的底色選單
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
            layer.keyframes[currentNode] = computed ? { ...computed } : { ...layer.init };
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

    let wVal = parseFloat(curW.value) || 10, hVal = parseFloat(curH.value) || 10;
    if (layer.lockRatio && document.activeElement === curW) hVal = wVal / layer.aspect;
    if (layer.lockRatio && document.activeElement === curH) wVal = hVal * layer.aspect;
    curW.value = Math.round(wVal); curH.value = Math.round(hVal);

    let targetData = { 
        x: parseFloat(curX.value)||0, y: parseFloat(curY.value)||0, w: wVal, h: hVal, rot: parseFloat(curRot.value)||0, op: parseFloat(curOp.value) ?? 1,
        texture: curTexture.value, flipX: curFlipX.checked, flipY: curFlipY.checked, easing: curEasing.value, event: curEvent.value
    };

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

// 7. 進階緩動數學曲線插值解算核心
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

    return { 
        x: p1.props.x + (p2.props.x - p1.props.x)*t, y: p1.props.y + (p2.props.y - p1.props.y)*t, 
        w: p1.props.w + (p2.props.w - p1.props.w)*t, h: p1.props.h + (p2.props.h - p1.props.h)*t, 
        rot: p1.props.rot + (p2.props.rot - p1.props.rot)*t, op: p1.props.op + (p2.props.op - p1.props.op)*t,
        texture: t < 0.5 ? p1.props.texture : p2.props.texture,
        flipX: t < 0.5 ? p1.props.flipX : p2.props.flipX,
        flipY: t < 0.5 ? p1.props.flipY : p2.props.flipY,
        easing: p1.props.easing,
        event: node === p1.node ? p1.props.event : (node === p2.node ? p2.props.event : '')
    };
}

// 8. 畫布即時重繪渲染引擎
function drawFrame() {
    // A. 乾淨清空畫布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // B. 🔥 核心修復：依據選擇的底色真實填充畫布像素，徹底解決錄影時半透明邊緣產生白邊/雜邊的壓縮編碼問題
    const bgMode = canvasBgType ? canvasBgType.value : 'white';
    if (bgMode === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgMode === 'green') {
        ctx.fillStyle = '#00ff00'; // 標準高亮去背綠
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } // 如果是 'transparent' 則維持純透明像素底

    // C. 依序繪製各個圖層
    for(let i = project.images.length - 1; i >= 0; i--) {
        const layer = project.images[i];
        const props = computeProps(layer, currentNode); if (!props) continue;
        
        let activeTexture = props.texture || layer.filename;
        let pureTexName = activeTexture.replace("images/", "");
        const img = imageObjects[pureTexName] || imageObjects[layer.rawName]; if (!img) continue;
        
        let px = layer.pivotX ?? 0.5, py = layer.pivotY ?? 0.5;

        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, props.op));
        ctx.translate(props.x, props.y); ctx.rotate(props.rot * Math.PI / 180);
        
        let sX = props.flipX ? -1 : 1, sY = props.flipY ? -1 : 1;
        if (sX !== 1 || sY !== 1) ctx.scale(sX, sY);

        ctx.drawImage(img, -props.w * px, -props.h * py, props.w, props.h); ctx.restore();
    }

    // 繪製包含選取狀態、控制手把與自訂紅色錨點的外框
    if(selectedImageId && !isPlaying && !isRecording) {
        const layer = project.images.find(l => l.id === selectedImageId);
        const props = computeProps(layer, currentNode);
        if(props) {
            let px = layer.pivotX ?? 0.5, py = layer.pivotY ?? 0.5;
            let rxCorner = props.w * (1 - px), ryCorner = props.h * (1 - py);
            let rotX = props.w * (0.5 - px), rotY = -props.h * py;

            ctx.save(); ctx.translate(props.x, props.y); ctx.rotate(props.rot * Math.PI / 180);
            ctx.strokeStyle = '#007fff'; ctx.lineWidth = 2; 
            ctx.strokeRect(-props.w * px, -props.h * py, props.w, props.h);
            
            // 右下角縮放點
            ctx.fillStyle = '#ffffff'; ctx.fillRect(rxCorner - 6, ryCorner - 6, 12, 12);
            ctx.strokeStyle = '#007fff'; ctx.strokeRect(rxCorner - 6, ryCorner - 6, 12, 12);
            
            // 上方旋轉點
            ctx.beginPath(); ctx.moveTo(rotX, rotY); ctx.lineTo(rotX, rotY - 25); ctx.stroke();
            ctx.beginPath(); ctx.arc(rotX, rotY - 25, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            
            // 繪製中心紅色原點把手位置
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }
}

// 9. 畫布滑鼠矩陣座標換算與拖拉事件監聽
function getRotatedLocalCoords(layer, mx, my) {
    const props = computeProps(layer, currentNode); if(!props) return null;
    const rad = -props.rot * Math.PI / 180;
    const dx = mx - props.x, dy = my - props.y;
    return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad), props: props };
}

canvas.addEventListener('mousedown', (e) => {
    if(isPlaying || isRecording) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.top || (e.clientY - rect.top);

    let hitFound = false;
    for(let i = 0; i < project.images.length; i++) {
        const layer = project.images[i];
        const local = getRotatedLocalCoords(layer, mx, my); if(!local) continue;
        
        let px = layer.pivotX ?? 0.5, py = layer.pivotY ?? 0.5;
        let rxCorner = local.props.w * (1 - px), ryCorner = local.props.h * (1 - py);
        let rotX = local.props.w * (0.5 - px), rotY = -local.props.h * py;

        if(layer.id === selectedImageId) {
            if(Math.sqrt((local.x - rotX)*(local.x - rotX) + (local.y - (rotY - 25))*(local.y - (rotY - 25))) < 12) {
                ts = { mode: 'rotate', lastX: mx, lastY: my, initialProps: { ...local.props }, layer: layer }; hitFound = true; break;
            }
            if(Math.abs(local.x - rxCorner) < 12 && Math.abs(local.y - ryCorner) < 12) {
                ts = { mode: 'resize', lastX: mx, lastY: my, initialProps: { ...local.props }, layer: layer }; hitFound = true; break;
            }
        }

        if(local.x >= -local.props.w*px && local.x <= local.props.w*(1-px) && local.y >= -local.props.h*py && local.y <= local.props.h*(1-py)) {
            selectLayer(layer.id);
            ts = { mode: 'move', lastX: mx, lastY: my, initialProps: { ...local.props }, layer: layer }; hitFound = true; break;
        }
    }
    if(!hitFound) { selectedImageId = null; renderLayerUI(); propertyPanel.style.display = 'none'; drawFrame(); }
});

window.addEventListener('mousemove', (e) => {
    if(!ts.mode) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const layer = ts.layer, initProps = ts.initialProps;
    const deltaX = mx - ts.lastX, deltaY = my - ts.lastY;

    autoActivateGlobalKeyframe();
    let target = currentNode === 0 ? layer.init : layer.keyframes[currentNode];

    if(ts.mode === 'move') {
        target.x += deltaX; target.y += deltaY;
    } 
    else if(ts.mode === 'resize') {
        const local = getRotatedLocalCoords(layer, mx, my);
        let px = layer.pivotX ?? 0.5, py = layer.pivotY ?? 0.5;
        let fx = 1 - px; if(Math.abs(fx) < 0.05) fx = 0.05;
        let fy = 1 - py; if(Math.abs(fy) < 0.05) fy = 0.05;
        
        let newW = Math.max(10, local.x / fx);
        let newH = Math.max(10, local.y / fy);
        if(layer.lockRatio) { newH = newW / layer.aspect; }
        target.w = newW; target.h = newH;
    } 
    else if(ts.mode === 'rotate') {
        const angle = Math.atan2(my - initProps.y, mx - initProps.x) * 180 / Math.PI;
        target.rot = Math.round((angle + 90) % 360);
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

    // 提升畫布擷取率至 30 FPS 確保細節飽和
    const stream = canvas.captureStream(30);
    let selectedFormat = ['video/webm;codecs=vp9', 'video/webm'].find(f => MediaRecorder.isTypeSupported(f));
    
    // 手動指定高位元率流量 15Mbps 徹底打破低畫質魔咒
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

// 12-2. 新增：畫布高畫質 MP4 錄製外包導出
const btnExportMp4 = document.getElementById('btn-export-mp4');
if (btnExportMp4) {
    btnExportMp4.addEventListener('click', async () => {
        if(project.images.length === 0) { alert("請上傳素材！"); return; }
        
        // 檢查瀏覽器是否支援原生 MP4 錄製編碼格式
        let selectedFormat = ['video/mp4;codecs=avc1', 'video/mp4', 'video/x-matroska;codecs=avc1'].find(f => MediaRecorder.isTypeSupported(f));
        
        if (!selectedFormat) {
            alert("當前瀏覽器不支援原生 MP4 錄製。\n建議使用 Safari 執行，或匯出 WebM 影片後再進行外部轉檔。");
            return;
        }

        const backup = btnExportMp4.textContent;
        btnExportMp4.textContent = "錄製中..."; btnExportMp4.disabled = true;
        document.getElementById('btn-stop').click(); isRecording = true;
        
        let queue = [];
        for(let i=0; i<project.totalNodes; i++) queue.push(i);
        if(project.loopType === 'pingpong') { for(let i=project.totalNodes-2; i>=0; i--) queue.push(i); }

        // 擷取畫布串流 (30 FPS)
        const stream = canvas.captureStream(30);
        
        // 指定 15Mbps 高位元率確保動態細節不失真
        const recorder = new MediaRecorder(stream, { 
            mimeType: selectedFormat,
            videoBitsPerSecond: 15000000 
        });
        
        const chunks = []; 
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

        const finishPromise = new Promise(r => recorder.onstop = () => r(new Blob(chunks, { type: selectedFormat })));
        recorder.start();

        // 步進逐格刷新畫布重繪
        for(let f of queue) {
            currentNode = f; nodeSlider.value = f; directFrameInput.value = f;
            nodeIdxLbls.forEach(lbl => lbl.textContent = f); timeSecLbl.textContent = (f * 0.1).toFixed(1);
            drawFrame(); await new Promise(r => setTimeout(r, 100));
        }
        
        await new Promise(r => setTimeout(r, 100)); 
        recorder.stop();
        const finalBlob = await finishPromise;

        // 觸發下載
        const videoUrl = URL.createObjectURL(finalBlob); 
        const dl = document.createElement('a');
        dl.href = videoUrl; 
        dl.download = "animation_output.mp4"; 
        document.body.appendChild(dl); 
        dl.click();
        document.body.removeChild(dl); 
        URL.revokeObjectURL(videoUrl);

        isRecording = false; 
        btnExportMp4.textContent = backup; 
        btnExportMp4.disabled = false; 
        changeCurrentNode(0);
    });
}

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

        // A. 填入環境全域變數設定並同步 UI 數值
        canvasW.value = importedConfig.width || 800;
        canvasH.value = importedConfig.height || 450;
        totalNodesInput.value = importedConfig.totalNodes || 50;
        loopTypeSelect.value = importedConfig.loopType || 'forward';

        updateLayoutSettings();

        // B. 初始化當前專案緩存，避免髒資料殘留
        loadedFiles = {};
        imageObjects = {};
        selectedImageId = null;
        propertyPanel.style.display = 'none';

        // C. 解析圖層，並對 images/ 資料夾下的二進位原始圖檔執行異步重載
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

        // D. 套用圖層資料並全面刷新界面
        project.images = importedImages;
        updateTextureDropdowns();
        renderLayerUI();
        changeCurrentNode(0);

        alert("🎉 .ase 專案檔已成功匯入！所有影格軌道與素材已完全還原。");

    } catch (err) {
        console.error("Import Error: ", err);
        alert("匯入失敗！請確認該檔案是否為本系統導出的標準 .ase 專案封包。");
    } finally {
        aseUpload.value = ""; 
    }
});

// 初始化環境執行
updateLayoutSettings();