/**
 * 專業動態圖片與文字專案製作器 - 核心控制邏輯腳本 (editor.js)
 */

// 1. 全域核心專案狀態資料結構
let project = { width: 800, height: 450, totalNodes: 50, nodeDuration: 0.1, loopType: 'forward', images: [] };
let loadedFiles = {}, imageObjects = {}, selectedImageId = null, currentNode = 0, isPlaying = false, playInterval = null, playDirection = 1;
let isRecording = false;

// 核心音訊多軌矩陣主機變數
let audioTracks = []; 
let audioCtx = null, audioDest = null;

// 滑鼠拖放、縮放、旋轉狀態追蹤器
let ts = { mode: null, lastX: 0, lastY: 0, initialProps: null, layer: null };

// 2. DOM 元素節點快取
const canvas = document.getElementById('main-canvas'), ctx = canvas.getContext('2d');
const canvasW = document.getElementById('canvas-w'), canvasH = document.getElementById('canvas-h'), totalNodesInput = document.getElementById('total-nodes'), loopTypeSelect = document.getElementById('loop-type');
const canvasBgType = document.getElementById('canvas-bg-type'); 
const fileUpload = document.getElementById('file-upload'), audioUpload = document.getElementById('audio-upload'), audioTrackListDiv = document.getElementById('audio-track-list');
const layerListDiv = document.getElementById('layer-list'), nodeSlider = document.getElementById('node-slider'), directFrameInput = document.getElementById('direct-frame-input');
const nodeIdxLbls = document.querySelectorAll('.node-idx-lbl'), timeSecLbl = document.getElementById('time-sec-lbl');
const propertyPanel = document.getElementById('property-panel'), selectedTitle = document.getElementById('selected-title');

const propStart = document.getElementById('prop-start'), propEnd = document.getElementById('prop-end'), propLockRatio = document.getElementById('prop-lock-ratio');
const pivotXInput = document.getElementById('pivot-x'), pivotYInput = document.getElementById('pivot-y');
const curX = document.getElementById('cur-x'), curY = document.getElementById('cur-y'), curW = document.getElementById('cur-w'), curH = document.getElementById('cur-h'), curRot = document.getElementById('cur-rot'), curOp = document.getElementById('cur-op');
const curTexture = document.getElementById('cur-texture'), curFlipX = document.getElementById('cur-flipx'), curFlipY = document.getElementById('cur-flipy'), curEasing = document.getElementById('cur-easing'), curEvent = document.getElementById('cur-event');

// 🔥 新增：文字模塊 UI 節點快取
const btnAddText = document.getElementById('btn-add-text'), textOnlyPanel = document.getElementById('text-only-panel');
const curTextContent = document.getElementById('cur-text-content'), curTextColor = document.getElementById('cur-text-color'), curTextFont = document.getElementById('cur-text-font');

// 3. 畫布環境與全域設定同步更新
function updateLayoutSettings() {
    project.width = parseInt(canvasW.value) || 800;
    project.height = parseInt(canvasH.value) || 450;
    canvas.width = project.width; canvas.height = project.height;
    
    project.totalNodes = Math.min(6000, Math.max(2, parseInt(totalNodesInput.value) || 50));
    project.loopType = loopTypeSelect.value;
    
    nodeSlider.max = project.totalNodes - 1; directFrameInput.max = project.totalNodes - 1;
    if(currentNode >= project.totalNodes) { currentNode = project.totalNodes - 1; }
    nodeSlider.value = currentNode; directFrameInput.value = currentNode;
    propStart.max = project.totalNodes - 1; propEnd.max = project.totalNodes - 1;
    drawFrame();
}

[canvasW, canvasH, totalNodesInput].forEach(el => el.addEventListener('input', updateLayoutSettings));
loopTypeSelect.addEventListener('change', updateLayoutSettings);
if (canvasBgType) { canvasBgType.addEventListener('change', drawFrame); }

// 4. 初始化 Web Audio API 音訊主機
function initAudioEngine() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioDest = audioCtx.createMediaStreamDestination();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// 多音軌異步載入、混音與獨立增益節點控制
function addAudioTrack(file, savedConfig = null) {
    initAudioEngine();
    const audioEl = new Audio();
    audioEl.src = URL.createObjectURL(file);
    const gainNode = audioCtx.createGain();
    const sourceNode = audioCtx.createMediaElementSource(audioEl);
    sourceNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.connect(audioDest);

    const trackObj = {
        id: savedConfig ? savedConfig.id : "audio_" + Date.now() + "_" + Math.floor(Math.random() * 100000),
        rawName: file.name,
        filename: "audio/" + file.name,
        startNode: savedConfig ? savedConfig.startNode : 0,
        endNode: savedConfig ? savedConfig.endNode : "-",
        volume: savedConfig ? (savedConfig.volume ?? 1.0) : 1.0,
        fadeInNodes: savedConfig ? (savedConfig.fadeInNodes ?? 0) : 0,
        fadeOutNodes: savedConfig ? (savedConfig.fadeOutNodes ?? 0) : 0,
        fileBlob: file,
        audioEl: audioEl,
        sourceNode: sourceNode,
        gainNode: gainNode
    };

    gainNode.gain.setValueAtTime(trackObj.volume, audioCtx.currentTime);
    audioTracks.push(trackObj);
    renderAudioTracksUI();
}

if (audioUpload) {
    audioUpload.addEventListener('change', (e) => {
        Array.from(e.target.files).forEach(file => { addAudioTrack(file); });
        audioUpload.value = ""; 
    });
}

function renderAudioTracksUI() {
    audioTrackListDiv.innerHTML = '';
    if (audioTracks.length === 0) {
        audioTrackListDiv.innerHTML = '<div class="audio-status-lbl">尚未載入任何音訊軌</div>';
        return;
    }
    audioTracks.forEach((track, idx) => {
        const item = document.createElement('div');
        item.className = 'audio-track-item';
        const header = document.createElement('div');
        header.className = 'audio-track-header';
        const titleSpan = document.createElement('span');
        titleSpan.className = 'audio-track-title';
        titleSpan.textContent = "🎵 " + track.rawName;
        const delBtn = document.createElement('button');
        delBtn.className = 'layer-btn del';
        delBtn.style.padding = '2px 5px'; delBtn.textContent = '✖';
        delBtn.onclick = () => removeAudioTrack(idx);
        header.appendChild(titleSpan); header.appendChild(delBtn);
        item.appendChild(header);

        const row1 = document.createElement('div');
        row1.className = 'audio-track-row';
        const startPart = document.createElement('div');
        startPart.className = 'audio-track-inputs';
        startPart.innerHTML = `<span class="audio-inner-lbl">起始格:</span>`;
        const startInput = document.createElement('input');
        startInput.type = 'number'; startInput.min = 0; startInput.value = track.startNode;
        startInput.oninput = (e) => { track.startNode = parseInt(e.target.value) || 0; syncAllAudioTracks(currentNode); };
        startPart.appendChild(startInput);

        const endPart = document.createElement('div');
        endPart.className = 'audio-track-inputs';
        endPart.innerHTML = `<span class="audio-inner-lbl">結束格:</span>`;
        const endInput = document.createElement('input');
        endInput.type = 'text'; endInput.value = track.endNode;
        endInput.oninput = (e) => { track.endNode = e.target.value.trim(); syncAllAudioTracks(currentNode); };
        endPart.appendChild(endInput);
        row1.appendChild(startPart); row1.appendChild(endPart);
        item.appendChild(row1);

        const row2 = document.createElement('div');
        row2.className = 'audio-track-row';
        const fadeInPart = document.createElement('div');
        fadeInPart.className = 'audio-track-inputs';
        fadeInPart.innerHTML = `<span class="audio-inner-lbl">淡入(格):</span>`;
        const fadeInInput = document.createElement('input');
        fadeInInput.type = 'number'; fadeInInput.min = 0; fadeInInput.value = track.fadeInNodes;
        fadeInInput.oninput = (e) => { track.fadeInNodes = Math.max(0, parseInt(e.target.value) || 0); syncAllAudioTracks(currentNode); };
        fadeInPart.appendChild(fadeInInput);

        const fadeOutPart = document.createElement('div');
        fadeOutPart.className = 'audio-track-inputs';
        fadeOutPart.innerHTML = `<span class="audio-inner-lbl">淡出(格):</span>`;
        const fadeOutInput = document.createElement('input');
        fadeOutInput.type = 'number'; fadeOutInput.min = 0; fadeOutInput.value = track.fadeOutNodes;
        fadeOutInput.oninput = (e) => { track.fadeOutNodes = Math.max(0, parseInt(e.target.value) || 0); syncAllAudioTracks(currentNode); };
        fadeOutPart.appendChild(fadeOutInput);
        row2.appendChild(fadeInPart); row2.appendChild(fadeOutPart);
        item.appendChild(row2);

        const volWrapper = document.createElement('div');
        volWrapper.className = 'volume-slider-wrapper';
        volWrapper.innerHTML = `<span class="audio-inner-lbl">音量:</span>`;
        const volSlider = document.createElement('input');
        volSlider.type = 'range'; volSlider.className = 'volume-slider';
        volSlider.min = 0; volSlider.max = 100; volSlider.value = Math.round(track.volume * 100);
        const volLabel = document.createElement('span');
        volLabel.className = 'volume-val-lbl';
        volLabel.textContent = volSlider.value + "%";
        volSlider.oninput = (e) => {
            const pct = parseInt(e.target.value);
            track.volume = pct / 100;
            volLabel.textContent = pct + "%";
            syncAllAudioTracks(currentNode);
        };
        volWrapper.appendChild(volSlider); volWrapper.appendChild(volLabel);
        item.appendChild(volWrapper);
        audioTrackListDiv.appendChild(item);
    });
}

function removeAudioTrack(index) {
    if (!audioTracks[index]) return;
    audioTracks[index].audioEl.pause(); audioTracks[index].audioEl.src = "";
    try { audioTracks[index].sourceNode.disconnect(); audioTracks[index].gainNode.disconnect(); } catch(e){}
    audioTracks.splice(index, 1); renderAudioTracksUI();
}

function syncAllAudioTracks(node, forcePlay = false) {
    initAudioEngine();
    audioTracks.forEach(track => {
        if (!track.audioEl.src) return;
        const bgmStart = track.startNode;
        const bgmEndStr = track.endNode.toString().trim();
        const bgmEndVal = (bgmEndStr === '-' || bgmEndStr === '') ? Infinity : (parseInt(bgmEndStr) || 0);

        if (node >= bgmStart && node <= bgmEndVal) {
            const targetTime = (node - bgmStart) * project.nodeDuration;
            let fadeRatio = 1.0; 
            const currentOffset = node - bgmStart;
            const remainingNodes = bgmEndVal - node;
            
            if (track.fadeInNodes > 0 && currentOffset < track.fadeInNodes) {
                fadeRatio = currentOffset / track.fadeInNodes;
            } else if (bgmEndVal !== Infinity && track.fadeOutNodes > 0 && remainingNodes < track.fadeOutNodes) {
                fadeRatio = remainingNodes / track.fadeOutNodes;
            }
            
            const finalVolume = track.volume * fadeRatio;
            if (track.gainNode) { track.gainNode.gain.setValueAtTime(finalVolume, audioCtx.currentTime); }

            if (isPlaying || forcePlay) {
                if (track.audioEl.paused) {
                    track.audioEl.currentTime = targetTime;
                    track.audioEl.play().catch(e => {});
                } else {
                    if (Math.abs(track.audioEl.currentTime - targetTime) > 0.2) { track.audioEl.currentTime = targetTime; }
                }
            } else { track.audioEl.currentTime = targetTime; }
        } else {
            if (!track.audioEl.paused) { track.audioEl.pause(); }
            track.audioEl.currentTime = 0;
            if (track.gainNode) { track.gainNode.gain.setValueAtTime(0, audioCtx.currentTime); }
        }
    });
}

// 5. 素材檔案與動態文字異步上傳/創建處理
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
                type: "image", // 標記為圖片圖層
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

// 🔥 新增：動態文字圖層創建監聽器
if (btnAddText) {
    btnAddText.addEventListener('click', () => {
        const textId = "layer_" + Date.now() + "_" + Math.floor(Math.random()*1000);
        project.images.unshift({
            id: textId,
            type: "text", // 標記為文字圖層
            filename: "", rawName: "📝 文字圖層_" + (project.images.filter(l => l.type === 'text').length + 1), aspect: 4,
            startNode: 0, endNode: project.totalNodes - 1, lockRatio: false,
            pivotX: 0.5, pivotY: 0.5,
            init: { 
                x: project.width/2, y: project.height/2, w: 200, h: 50, rot: 0, op: 1, 
                texture: '', flipX: false, flipY: false, easing: 'linear', event: '',
                text: '請輸入文字', color: '#3d2620', fontFamily: 'Arial' // 文字初始化屬性
            },
            keyframes: {}
        });
        renderLayerUI(); selectLayer(textId);
    });
}

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

// 6. 圖層渲染與排序管理
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
    project.images.splice(index, 1); selectedImageId = null; propertyPanel.style.display = 'none'; renderLayerUI(); drawFrame();
}

// 7. 選取圖層與屬性面板同步
function selectLayer(id) {
    selectedImageId = id; renderLayerUI();
    const layer = project.images.find(l => l.id === id);
    if(!layer) { propertyPanel.style.display = 'none'; drawFrame(); return; }
    
    propertyPanel.style.display = 'block';
    selectedTitle.textContent = `編輯: ${layer.rawName}`;
    propStart.value = layer.startNode; propEnd.value = layer.endNode;
    propLockRatio.checked = layer.lockRatio;
    pivotXInput.value = layer.pivotX; pivotYInput.value = layer.pivotY;
    
    // 🔥 新增：動態切換文字專用控制面板
    if (textOnlyPanel) { textOnlyPanel.style.display = (layer.type === 'text') ? 'block' : 'none'; }

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
        
        // 🔥 新增：若為文字圖層，同步文字核心數值到 UI 欄位
        if (layer.type === 'text') {
            curTextContent.value = currentProps.text || '';
            curTextColor.value = currentProps.color || '#3d2620';
            curTextFont.value = currentProps.fontFamily || 'Arial';
        }
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

    // 🔥 新增：擷取文字欄位特有數據，並實時更新圖層清單標題
    if (layer.type === 'text') {
        targetData.text = curTextContent.value;
        targetData.color = curTextColor.value;
        targetData.fontFamily = curTextFont.value;
        layer.rawName = "📝 " + (curTextContent.value || '空文字');
        selectedTitle.textContent = `編輯: ${layer.rawName}`;
        
        // 實時反映圖層名稱變更，防止打字時失焦
        const activeNameSpan = layerListDiv.querySelector('.layer-item.active .layer-name');
        if (activeNameSpan) activeNameSpan.textContent = layer.rawName;
    }

    if (currentNode === 0) { layer.init = targetData; } 
    else { layer.keyframes[currentNode] = targetData; }
    drawFrame();
}

// 🔥 把新的文字輸入元件也加入事件綁定陣列中
[propStart, propEnd, propLockRatio, pivotXInput, pivotYInput, curX, curY, curW, curH, curRot, curOp, curTexture, curFlipX, curFlipY, curEasing, curEvent, curTextContent, curTextColor, curTextFont].forEach(el => {
    if (el) el.addEventListener('input', syncPanelToData);
});

function changeCurrentNode(nodeValue) {
    currentNode = Math.min(project.totalNodes - 1, Math.max(0, parseInt(nodeValue) || 0));
    nodeSlider.value = currentNode; directFrameInput.value = currentNode;
    nodeIdxLbls.forEach(lbl => lbl.textContent = currentNode); timeSecLbl.textContent = (currentNode * 0.1).toFixed(1);
    syncAllAudioTracks(currentNode);
    if(selectedImageId) selectLayer(selectedImageId); else drawFrame();
}
nodeSlider.addEventListener('input', (e) => changeCurrentNode(e.target.value));
directFrameInput.addEventListener('input', (e) => changeCurrentNode(e.target.value));

// 8. 進階緩動數學曲線插值解算核心
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
        event: node === p1.node ? p1.props.event : (node === p2.node ? p2.props.event : ''),
        // 🔥 新增：文字數值在各影格節點的步進傳遞
        text: t < 0.5 ? p1.props.text : p2.props.text,
        color: t < 0.5 ? p1.props.color : p2.props.color,
        fontFamily: t < 0.5 ? p1.props.fontFamily : p2.props.fontFamily
    };
}

// 9. 畫布即時重繪渲染引擎
function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bgMode = canvasBgType ? canvasBgType.value : 'white';
    if (bgMode === 'white') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); } 
    else if (bgMode === 'green') { ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, canvas.width, canvas.height); }

    for(let i = project.images.length - 1; i >= 0; i--) {
        const layer = project.images[i];
        const props = computeProps(layer, currentNode); if (!props) continue;
        
        let px = layer.pivotX ?? 0.5, py = layer.pivotY ?? 0.5;

        ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, props.op));
        ctx.translate(props.x, props.y); ctx.rotate(props.rot * Math.PI / 180);
        
        let sX = props.flipX ? -1 : 1, sY = props.flipY ? -1 : 1;
        if (sX !== 1 || sY !== 1) ctx.scale(sX, sY);

        // 🔥 新增：區分圖片渲染與文字渲染邏輯
        if (layer.type === 'text') {
            ctx.fillStyle = props.color || '#3d2620';
            ctx.font = `${props.h}px ${props.fontFamily || 'Arial'}`; // 將選取高度 h 作為動態 Font-size
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            
            // 完美對齊中心點與錨點換算矩陣
            let cx = props.w * (0.5 - px);
            let cy = props.h * (0.5 - py);
            ctx.fillText(props.text || '', cx, cy, props.w); // 限制寬度 w
        } else {
            let activeTexture = props.texture || layer.filename;
            let pureTexName = activeTexture.replace("images/", "");
            const img = imageObjects[pureTexName] || imageObjects[layer.rawName]; 
            if (!img) { ctx.restore(); continue; }
            ctx.drawImage(img, -props.w * px, -props.h * py, props.w, props.h);
        }
        ctx.restore();
    }

    // 繪製滑鼠操控選取框、錨點與旋轉控制手把
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
            ctx.fillStyle = '#ffffff'; ctx.fillRect(rxCorner - 6, ryCorner - 6, 12, 12);
            ctx.strokeStyle = '#007fff'; ctx.strokeRect(rxCorner - 6, ryCorner - 6, 12, 12);
            ctx.beginPath(); ctx.moveTo(rotX, rotY); ctx.lineTo(rotX, rotY - 25); ctx.stroke();
            ctx.beginPath(); ctx.arc(rotX, rotY - 25, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }
}

// 10. 畫布滑鼠矩陣座標換算
function getRotatedLocalCoords(layer, mx, my) {
    const props = computeProps(layer, currentNode); if(!props) return null;
    const rad = -props.rot * Math.PI / 180;
    const dx = mx - props.x, dy = my - props.y;
    return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad), props: props };
}

canvas.addEventListener('mousedown', (e) => {
    if(isPlaying || isRecording) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

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
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    
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
        if(layer.lockRatio && layer.aspect) { newH = newW / layer.aspect; }
        target.w = newW; target.h = newH;
    } 
    else if(ts.mode === 'rotate') {
        const angle = Math.atan2(my - initProps.y, mx - initProps.x) * 180 / Math.PI;
        target.rot = Math.round((angle + 90) % 360);
    }
    ts.lastX = mx; ts.lastY = my; selectLayer(selectedImageId);
});

window.addEventListener('mouseup', () => { ts.mode = null; });

// 11. 播放預覽控制器
document.getElementById('btn-play').addEventListener('click', () => {
    if(isPlaying || isRecording) return; 
    isPlaying = true; playDirection = 1;
    initAudioEngine();
    syncAllAudioTracks(currentNode);

    playInterval = setInterval(() => {
        if(project.loopType === 'forward') { currentNode = (currentNode + 1) % project.totalNodes; } 
        else {
            currentNode += playDirection;
            if(currentNode >= project.totalNodes) { currentNode = project.totalNodes - 2; playDirection = -1; }
            else if(currentNode < 0) { currentNode = 1; playDirection = 1; }
        }
        nodeSlider.value = currentNode; directFrameInput.value = currentNode;
        nodeIdxLbls.forEach(lbl => lbl.textContent = currentNode); timeSecLbl.textContent = (currentNode * 0.1).toFixed(1);
        syncAllAudioTracks(currentNode); drawFrame();
    }, project.nodeDuration * 1000);
});

document.getElementById('btn-stop').addEventListener('click', () => { 
    clearInterval(playInterval); isPlaying = false; 
    audioTracks.forEach(t => { if(t.audioEl) { t.audioEl.pause(); t.audioEl.currentTime = 0; } });
    changeCurrentNode(0);
});

// 12. 專案檔匯出 (.ase) —— 🔥 打包機制升級：同步儲存 type 欄位
document.getElementById('btn-export').addEventListener('click', () => {
    if(project.images.length === 0) { alert("請上傳素材或新增文字再行匯出！"); return; }
    const zip = new JSZip(), imgFolder = zip.folder("images");
    
    const cleanConfig = {
        width: project.width, height: project.height, totalNodes: project.totalNodes, nodeDuration: project.nodeDuration, loopType: project.loopType,
        images: project.images.map(l => ({ 
            type: l.type || 'image', // 注入圖層型態
            filename: l.filename, startNode: l.startNode, endNode: l.endNode, pivotX: l.pivotX, pivotY: l.pivotY, init: l.init, keyframes: l.keyframes 
        })),
        audioTracks: audioTracks.map(t => ({
            id: t.id, filename: t.filename, rawName: t.rawName, startNode: t.startNode, endNode: t.endNode, volume: t.volume, fadeInNodes: t.fadeInNodes, fadeOutNodes: t.fadeOutNodes
        }))
    };
    
    zip.file("config.json", JSON.stringify(cleanConfig, null, 2));
    project.images.forEach(l => { if (l.type === 'image') { const f = loadedFiles[l.rawName]; if(f) imgFolder.file(l.rawName, f); } });
    
    if (audioTracks.length > 0) {
        const audioFolder = zip.folder("audio");
        audioTracks.forEach(t => { if (t.fileBlob) { audioFolder.file(t.rawName, t.fileBlob); } });
    }
    
    zip.generateAsync({type:"blob"}).then(blob => {
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = "animation_project.ase"; document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    });
});

// 13. 實時影音大合流錄製模組
async function startRealtimeAudioVideoRecord(formatType, extension) {
    if(project.images.length === 0) { alert("請建立素材項目！"); return; }
    let selectedFormat = [formatType].find(f => MediaRecorder.isTypeSupported(f));
    if (!selectedFormat && extension === 'mp4') { selectedFormat = ['video/mp4;codecs=avc1', 'video/x-matroska;codecs=avc1'].find(f => MediaRecorder.isTypeSupported(f)); }
    if (!selectedFormat) { alert(`當前瀏覽器不支援原生 ${extension.toUpperCase()} 錄製。`); return; }

    document.getElementById('btn-stop').click(); 
    isRecording = true; initAudioEngine();

    let queue = [];
    for(let i=0; i<project.totalNodes; i++) queue.push(i);
    if(project.loopType === 'pingpong') { for(let i=project.totalNodes-2; i>=0; i--) queue.push(i); }

    const videoStream = canvas.captureStream(30);
    const tracks = [...videoStream.getVideoTracks()];
    if (audioTracks.length > 0 && audioDest) { tracks.push(...audioDest.stream.getAudioTracks()); }

    const combinedStream = new MediaStream(tracks);
    const recorder = new MediaRecorder(combinedStream, { mimeType: selectedFormat, videoBitsPerSecond: 15000000 });
    const chunks = []; 
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

    const finishPromise = new Promise(r => recorder.onstop = () => r(new Blob(chunks, { type: selectedFormat })));
    changeCurrentNode(0); recorder.start(); syncAllAudioTracks(0, true);

    let step = 0;
    const recordInterval = setInterval(() => {
        step++;
        if (step >= queue.length) {
            clearInterval(recordInterval); recorder.stop();
            audioTracks.forEach(t => { if(t.audioEl) t.audioEl.pause(); });
        } else {
            currentNode = queue[step];
            nodeSlider.value = currentNode; directFrameInput.value = currentNode;
            nodeIdxLbls.forEach(lbl => lbl.textContent = currentNode); timeSecLbl.textContent = (currentNode * 0.1).toFixed(1);
            syncAllAudioTracks(currentNode, true); drawFrame();
        }
    }, project.nodeDuration * 1000);

    const finalBlob = await finishPromise;
    const videoUrl = URL.createObjectURL(finalBlob); const dl = document.createElement('a');
    dl.href = videoUrl; dl.download = `animation_output.${extension}`; 
    document.body.appendChild(dl); dl.click(); document.body.removeChild(dl); URL.revokeObjectURL(videoUrl);
    isRecording = false; changeCurrentNode(0);
}

document.getElementById('btn-export-webm').addEventListener('click', async () => {
    const btn = document.getElementById('btn-export-webm'), bkp = btn.textContent;
    btn.textContent = "錄製中..."; btn.disabled = true;
    await startRealtimeAudioVideoRecord('video/webm;codecs=vp9', 'webm');
    btn.textContent = bkp; btn.disabled = false;
});

document.getElementById('btn-export-mp4').addEventListener('click', async () => {
    const btn = document.getElementById('btn-export-mp4'), bkp = btn.textContent;
    btn.textContent = "錄製中..."; btn.disabled = true;
    await startRealtimeAudioVideoRecord('video/mp4;codecs=avc1', 'mp4');
    btn.textContent = bkp; btn.disabled = false;
});

// 14. 專案還原功能 (.ase) —— 🔥 向下防呆相容舊檔案與新文字解析
const btnImport = document.getElementById('btn-import'), aseUpload = document.getElementById('ase-upload');
if (btnImport && aseUpload) { btnImport.addEventListener('click', () => aseUpload.click()); }

aseUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
        const zip = await JSZip.loadAsync(file);
        const configFile = zip.file("config.json");
        if (!configFile) { alert("讀取失敗：找不到核心設定檔 config.json！"); return; }

        const configText = await configFile.async("text");
        const importedConfig = JSON.parse(configText);

        canvasW.value = importedConfig.width || 800;
        canvasH.value = importedConfig.height || 450;
        totalNodesInput.value = importedConfig.totalNodes || 50;
        loopTypeSelect.value = importedConfig.loopType || 'forward';

        updateLayoutSettings();
        loadedFiles = {}; imageObjects = {}; selectedImageId = null;
        propertyPanel.style.display = 'none';

        audioTracks.forEach(t => { t.audioEl.pause(); try{ t.sourceNode.disconnect(); t.gainNode.disconnect(); }catch(err){} });
        audioTracks = []; renderAudioTracksUI();

        const imagePromises = [];
        const importedImages = importedConfig.images || [];

        for (let layer of importedImages) {
            // 防呆解析：無 type 欄位時預設為舊版 image 型態
            if (!layer.type) layer.type = 'image';
            
            if (layer.type === 'image') {
                layer.rawName = layer.filename.replace("images/", "");
            } else if (layer.type === 'text') {
                layer.rawName = "📝 " + (layer.init.text || "文字圖層");
            }
            
            layer.id = "layer_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
            if (layer.lockRatio === undefined) layer.lockRatio = (layer.type === 'image');

            if (layer.type === 'image') {
                const zipImgFile = zip.file(layer.filename) || zip.file("images/" + layer.rawName);
                if (zipImgFile) {
                    const promise = zipImgFile.async("blob").then((blob) => {
                        const imgFile = new File([blob], layer.rawName, { type: blob.type });
                        loadedFiles[layer.rawName] = imgFile;
                        return new Promise((resolve) => {
                            const img = new Image();
                            img.src = URL.createObjectURL(imgFile);
                            img.onload = () => { imageObjects[layer.rawName] = img; layer.aspect = img.width/img.height; resolve(); };
                            img.onerror = () => resolve();
                        });
                    });
                    imagePromises.push(promise);
                }
            }
        }

        if (importedConfig.audioTracks && Array.isArray(importedConfig.audioTracks)) {
            for (let audioCfg of importedConfig.audioTracks) {
                const zipAudioFile = zip.file(audioCfg.filename) || zip.file("audio/" + audioCfg.rawName);
                if (zipAudioFile) {
                    const audioPromise = zipAudioFile.async("blob").then((blob) => {
                        const audioFile = new File([blob], audioCfg.rawName, { type: blob.type });
                        addAudioTrack(audioFile, audioCfg);
                    });
                    imagePromises.push(audioPromise);
                }
            }
        } else if (importedConfig.audio) {
            const audioCfg = importedConfig.audio;
            const zipAudioFile = zip.file(audioCfg.filename) || zip.file("audio/" + audioCfg.rawName);
            if (zipAudioFile) {
                const audioPromise = zipAudioFile.async("blob").then((blob) => {
                    const audioFile = new File([blob], audioCfg.rawName, { type: blob.type });
                    addAudioTrack(audioFile, { id: "legacy_audio_track", startNode: audioCfg.startNode ?? 0, endNode: audioCfg.endNode ?? "-", volume: 1.0, fadeInNodes: 0, fadeOutNodes: 0 });
                });
                imagePromises.push(audioPromise);
            }
        }

        await Promise.all(imagePromises);
        project.images = importedImages;
        updateTextureDropdowns(); renderLayerUI(); changeCurrentNode(0);
        alert("🎉 .ase 專案與新增的動態文字控制項已完美還原！");
    } catch (err) {
        alert("匯入失敗！請確認該檔案是否為本系統導出的標準格式。");
    } finally { aseUpload.value = ""; }
});

updateLayoutSettings();