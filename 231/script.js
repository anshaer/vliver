/* ================= 17種滑鼠狀態全域對照陣列 (已徹底歸位) ================= */
    const cursorSchemeMap = [
        { key: 'Arrow', name: '標準選擇 (Normal Select)' },
        { key: 'Help', name: '說明選擇 (Help Select)' },
        { key: 'AppStarting', name: '背景作業 (Working in Background)' },
        { key: 'Wait', name: '忙碌 (Busy)' },
        { key: 'Crosshair', name: '精確選擇 (Precision Select)' },
        { key: 'IBeam', name: '文字選擇 (Text Select)' },
        { key: 'NWPen', name: '手寫 (Handwriting)' },
        { key: 'No', name: '無法使用 (Unavailable)' },
        { key: 'SizeNS', name: '垂直調整 (Vertical Resize)' },
        { key: 'SizeWE', name: '水平調整 (Horizontal Resize)' },
        { key: 'SizeNWSE', name: '對角線調整 1 (Diagonal Resize 1)' },
        { key: 'SizeNESW', name: '對角線調整 2 (Diagonal Resize 2)' },
        { key: 'SizeAll', name: '移動 (Move)' },
        { key: 'UpArrow', name: '替代選擇 (Alternate Select)' },
        { key: 'Hand', name: '連結選擇 (Link Select)' },
        { key: 'Pin', name: '位置選擇 (Location Select)' },
        { key: 'Person', name: '人員選擇 (Person Select)' }
    ];

    /* ================= 通用頁籤與全域參數 ================= */
    let viewParsedFrames = []; let viewAnimationSteps = []; let viewTimeout = null; let viewCurrentIdx = 0;
    let genImages = []; let genLoopTimeout = null; let genCurrentIdx = 0;
    let packDataStorage = {}; 

    function switchTab(e, tabId) {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        e.currentTarget.classList.add('active');

        if (tabId !== 'tabViewer' && viewTimeout) clearTimeout(viewTimeout);
        if (tabId !== 'tabGenerator' && genLoopTimeout) clearTimeout(genLoopTimeout);
        document.getElementById('cursorSim').style.display = 'none';
    }

    /* ================= 頁籤一：產生器邏輯 ================= */
    const genSize = document.getElementById('genSize');
    const genHX = document.getElementById('genHX'); const genHY = document.getElementById('genHY');
    const genCanvas = document.getElementById('genPickerCanvas'); const genCtx = genCanvas.getContext('2d');
    const genDot = document.getElementById('genDot'); const genDownloadBtn = document.getElementById('genDownloadBtn');
    const genFrameThumbs = document.getElementById('genFrameThumbs');

    genSize.addEventListener('change', () => { updateGenMaxHotspot(); drawGenFirstFrame(); });
    genHX.addEventListener('input', syncGenDotFromInputs); genHY.addEventListener('input', syncGenDotFromInputs);

    document.getElementById('genCanvasWrapper').addEventListener('mousedown', function(e) {
        if(genImages.length === 0) return;
        const rect = this.getBoundingClientRect(); const targetSize = parseInt(genSize.value);
        const hX = Math.floor(((e.clientX - rect.left) / 256) * targetSize);
        const hY = Math.floor(((e.clientY - rect.top) / 256) * targetSize);
        genHX.value = Math.max(0, Math.min(targetSize - 1, hX)); genHY.value = Math.max(0, Math.min(targetSize - 1, hY));
        syncGenDotFromInputs();
    });

    function updateGenMaxHotspot() {
        const m = parseInt(genSize.value) - 1; genHX.max = m; genHY.max = m;
        if(parseInt(genHX.value) > m) genHX.value = m; if(parseInt(genHY.value) > m) genHY.value = m;
    }
    function setGenPresetHotspot(type) {
        const s = parseInt(genSize.value);
        if(type === 'topleft') { genHX.value = 0; genHY.value = 0; } else { genHX.value = Math.floor(s/2); genHY.value = Math.floor(s/2); }
        syncGenDotFromInputs();
    }
    function syncGenDotFromInputs() {
        const s = parseInt(genSize.value); const x = parseInt(genHX.value) || 0; const y = parseInt(genHY.value) || 0;
        genDot.style.left = `${((x + 0.5) / s) * 256}px`; genDot.style.top = `${((y + 0.5) / s) * 256}px`;
    }

    function handleGenUpload(files) {
        if(!files.length) return; if(genLoopTimeout) clearTimeout(genLoopTimeout);
        genImages = []; genFrameThumbs.innerHTML = '';
        let loaded = 0; const fileArr = Array.from(files).sort((a,b)=>a.name.localeCompare(b.name));

        fileArr.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    genImages.push(img);
                    const t = document.createElement('img'); t.src = e.target.result; t.className='frame-thumb';
                    genFrameThumbs.appendChild(t); loaded++;
                    if(loaded === fileArr.length) {
                        genDownloadBtn.disabled = false; updateGenMaxHotspot(); drawGenFirstFrame(); syncGenDotFromInputs();
                        genCurrentIdx = 0; triggerGenLoop();
                    }
                }; img.src = e.target.result;
            }; reader.readAsDataURL(file);
        });
    }

    function drawGenFirstFrame() {
        genCtx.clearRect(0,0,256,256); if(!genImages.length) return;
        genCtx.imageSmoothingEnabled = false; genCtx.drawImage(genImages[0],0,0,256,256);
    }

    function triggerGenLoop() {
        if(!genImages.length) return; if(genLoopTimeout) clearTimeout(genLoopTimeout);
        document.getElementById('genPreviewImg').src = genImages[genCurrentIdx].src;
        if(genImages.length === 1) { document.getElementById('genPreviewInfo').innerText = "單張偵測：將導出靜態游標 (.cur)"; return; }
        document.getElementById('genPreviewInfo').innerText = `動態同步中 (${genCurrentIdx+1}/${genImages.length}) -> 將導出 .ani`;
        const ms = parseInt(document.getElementById('genDuration').value) || 100;
        genLoopTimeout = setTimeout(() => { genCurrentIdx = (genCurrentIdx + 1) % genImages.length; triggerGenLoop(); }, ms);
    }

    function buildCurBuffer(img, size, hX, hY) {
        return new Promise((resolve) => {
            const os = document.createElement('canvas'); os.width = size; os.height = size;
            const oCtx = os.getContext('2d'); oCtx.drawImage(img, 0, 0, size, size);
            os.toBlob((b) => {
                const r = new FileReader(); r.onload = function(e) {
                    const pngBuf = e.target.result; const pngLen = pngBuf.byteLength;
                    const curBuffer = new ArrayBuffer(22 + pngLen); const view = new DataView(curBuffer);
                    view.setUint16(0, 0, true); view.setUint16(2, 2, true); view.setUint16(4, 1, true);
                    view.setUint8(6, size >= 256 ? 0 : size); view.setUint8(7, size >= 256 ? 0 : size);
                    view.setUint16(10, hX, true); view.setUint16(12, hY, true);
                    view.setUint32(14, pngLen, true); view.setUint32(18, 22, true);
                    new Uint8Array(curBuffer).set(new Uint8Array(pngBuf), 22); resolve(new Uint8Array(curBuffer));
                }; r.readAsArrayBuffer(b);
            }, 'image/png');
        });
    }

    function compileAniBuffer(curBytesArray, ms) {
        const jiffies = Math.max(1, Math.round(ms / 16.6666)); const numFrames = curBytesArray.length;
        let iconChunksSize = 0; const paddedFiles = curBytesArray.map(cur => { const p = cur.byteLength % 2; return { d: cur, len: cur.byteLength + p, hasPad: p > 0 }; });
        paddedFiles.forEach(item => { iconChunksSize += 8 + item.len; });
        const listSize = 4 + iconChunksSize; const riffSize = 4 + 44 + (8 + listSize);
        const aniBuffer = new ArrayBuffer(8 + riffSize); const view = new DataView(aniBuffer);
        writeString(view, 0, "RIFF"); view.setUint32(4, riffSize, true); writeString(view, 8, "ACON");
        writeString(view, 12, "anih"); view.setUint32(16, 36, true); view.setUint32(20, 36, true);
        view.setUint32(24, numFrames, true); view.setUint32(28, numFrames, true); view.setUint32(48, jiffies, true); view.setUint32(52, 1, true);
        writeString(view, 56, "LIST"); view.setUint32(60, listSize, true); writeString(view, 64, "fram");
        let offset = 68; const u8 = new Uint8Array(aniBuffer);
        paddedFiles.forEach(item => {
            writeString(view, offset, "icon"); view.setUint32(offset + 4, item.d.byteLength, true); offset += 8;
            u8.set(item.d, offset); offset += item.d.byteLength; if (item.hasPad) { view.setUint8(offset, 0); offset += 1; }
        }); return aniBuffer;
    }

    async function outputSingleCursor() {
        if(!genImages.length) return; const size = parseInt(genSize.value); const hX = parseInt(genHX.value) || 0; const hY = parseInt(genHY.value) || 0;
        const curBytesList = []; for(let img of genImages) curBytesList.push(await buildCurBuffer(img, size, hX, hY));
        let finalBlob, finalExt;
        if(genImages.length === 1) { finalBlob = new Blob([curBytesList[0]], {type: "application/octet-stream"}); finalExt = 'cur'; } 
        else { const ms = parseInt(document.getElementById('genDuration').value) || 100; finalBlob = new Blob([compileAniBuffer(curBytesList, ms)], {type: "application/octet-stream"}); finalExt = 'ani'; }
        const dlUrl = URL.createObjectURL(finalBlob); const a = document.createElement('a'); a.href = dlUrl; a.download = `custom_cursor.${finalExt}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(dlUrl);
    }

    /* ================= 頁籤二：游標檔案檢視器 ================= */
    const viewDropZone = document.getElementById('viewDropZone'); const viewSandbox = document.getElementById('viewSandbox');

    ['dragenter','dragover'].forEach(n => viewDropZone.addEventListener(n, (e)=>{e.preventDefault(); viewDropZone.style.borderColor='var(--mint-primary)';}));
    ['dragleave','drop'].forEach(n => viewDropZone.addEventListener(n, (e)=>{e.preventDefault(); viewDropZone.style.borderColor='var(--border-color)';}));
    viewDropZone.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if(f) loadViewFile(f); });

    viewSandbox.addEventListener('mousemove', (e) => {
        if(!viewAnimationSteps.length) return;
        const sim = document.getElementById('cursorSim');
        sim.style.display = 'block'; sim.style.left = `${e.clientX}px`; sim.style.top = `${e.clientY}px`;
    });
    viewSandbox.addEventListener('mouseleave', () => document.getElementById('cursorSim').style.display = 'none');

    function loadViewFile(file) {
        if(!file) return; if(viewTimeout) clearTimeout(viewTimeout);
        document.getElementById('viewErrorMessage').style.display = 'none'; document.getElementById('viewGallery').innerHTML = '';
        viewParsedFrames.forEach(f => URL.revokeObjectURL(f.url)); viewParsedFrames = []; viewAnimationSteps = []; viewCurrentIdx = 0;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const buffer = e.target.result; const view = new DataView(buffer); const first4 = readASCIIString(view, 0, 4);
                if(first4 === 'RIFF') {
                    if(readASCIIString(view, 8, 4) !== 'ACON') throw new Error('錯誤：非標準 ACON 游標貨櫃。');
                    let offset = 12; let defaultJif = 0; let seqTable = [], rateTable = [];
                    while(offset < view.byteLength) {
                        if(offset + 8 > view.byteLength) break;
                        const chunkId = readASCIIString(view, offset, 4); const chunkSize = view.getUint32(offset + 4, true); offset += 8;
                        const nextChunk = offset + chunkSize + (chunkSize % 2);
                        if(chunkId === 'anih') { defaultJif = view.getUint32(offset + 28, true); } 
                        else if(chunkId === 'seq ') { for(let i=0; i<chunkSize/4; i++) seqTable.push(view.getUint32(offset+(i*4), true)); } 
                        else if(chunkId === 'rate') { for(let i=0; i<chunkSize/4; i++) rateTable.push(view.getUint32(offset+(i*4), true)); } 
                        else if(chunkId === 'LIST' && readASCIIString(view, offset, 4) === 'fram') {
                            let listOffset = offset + 4;
                            while(listOffset < offset + chunkSize) {
                                const subId = readASCIIString(view, listOffset, 4); const subSize = view.getUint32(listOffset + 4, true); listOffset += 8;
                                if(subId === 'icon') parseAndExtractFrame(buffer.slice(listOffset, listOffset + subSize));
                                listOffset += subSize + (subSize % 2);
                            }
                        } offset = nextChunk;
                    }
                    const steps = seqTable.length > 0 ? seqTable.length : viewParsedFrames.length;
                    for(let i=0; i<steps; i++) {
                        viewAnimationSteps.push({ fIdx: seqTable[i] !== undefined ? seqTable[i] : (i % viewParsedFrames.length), dur: (rateTable[i] !== undefined ? rateTable[i] : defaultJif) * 16.6666 });
                    }
                    document.getElementById('vMetaType').innerText = "動態游標 (.ani)";
                    document.getElementById('vMetaFrames').innerText = viewParsedFrames.length;
                    document.getElementById('vMetaSteps').innerText = viewAnimationSteps.length;
                    document.getElementById('vMetaMs').innerText = Math.round(defaultJif * 16.6666) + ' ms';
                } 
                else if(view.getUint16(2, true) === 2) {
                    parseAndExtractFrame(buffer); viewAnimationSteps.push({ fIdx: 0, dur: 1000 });
                    document.getElementById('vMetaType').innerText = "靜態游標 (.cur)"; document.getElementById('vMetaFrames').innerText = "1";
                    document.getElementById('vMetaSteps').innerText = "常態靜止"; document.getElementById('vMetaMs').innerText = "--";
                } else { throw new Error('未知的指標檔案格式，請上傳正確的 .cur 或 .ani 檔案。'); }
                document.getElementById('viewSandboxHint').style.display = 'none'; renderViewGallery(); renderViewLoop();
            } catch(err) { const box = document.getElementById('viewErrorMessage'); box.innerText = err.message; box.style.display='block'; }
        }; reader.readAsArrayBuffer(file);
    }

    function parseAndExtractFrame(subBuffer) {
        const view = new DataView(subBuffer); let hX = view.getUint16(10, true); let hY = view.getUint16(12, true); let url = '', isPng = false;
        if(view.byteLength > 26 && view.getUint8(22)===0x89 && view.getUint8(23)===0x50) { isPng = true; url = URL.createObjectURL(new Blob([subBuffer.slice(22)], {type:'image/png'})); } 
        else { url = URL.createObjectURL(new Blob([subBuffer], {type:'image/x-icon'})); }
        viewParsedFrames.push({ url, hX, hY, isPng });
    }

    function renderViewGallery() {
        const g = document.getElementById('viewGallery');
        viewParsedFrames.forEach((f, idx) => {
            const c = document.createElement('div'); c.className = 'frame-card'; c.id = `v-card-${idx}`;
            c.innerHTML = `<img src="${f.url}"><br>影格 ${idx}<br>(${f.hX}, ${f.hY})`; g.appendChild(c);
        });
    }

    document.getElementById('viewSandbox').addEventListener('mouseenter', () => { if(viewAnimationSteps.length) document.getElementById('cursorSim').style.display = 'block'; });

    function renderViewLoop() {
        if(!viewAnimationSteps.length) return; const step = viewAnimationSteps[viewCurrentIdx]; const frame = viewParsedFrames[step.fIdx];
        document.getElementById('viewPreviewImg').src = frame.url; document.getElementById('viewPreviewDetails').innerText = `影格指向: ${step.fIdx} (${frame.hX}, ${frame.hY})`;
        const sim = document.getElementById('cursorSim');
        sim.style.backgroundImage = `url(${frame.url})`; sim.style.width = '48px'; sim.style.height = '48px';
        sim.style.marginLeft = `-${frame.hX}px`; sim.style.marginTop = `-${frame.hY}px`;
        document.querySelectorAll('.frame-card').forEach(c => c.classList.remove('active'));
        const activeCard = document.getElementById(`v-card-${step.fIdx}`); if(activeCard) activeCard.classList.add('active');
        viewTimeout = setTimeout(() => { viewCurrentIdx = (viewCurrentIdx + 1) % viewAnimationSteps.length; renderViewLoop(); }, step.dur);
    }

    /* ================= 頁籤三：17手裝方案打包器 ================= */
    function initPackerTable() {
        const tbody = document.getElementById('packTableBody'); tbody.innerHTML = '';
        cursorSchemeMap.forEach(item => {
            packDataStorage[item.key] = null; const tr = document.createElement('tr'); tr.className = 'pack-row';
            tr.innerHTML = `
                <td><strong style="color:var(--mint-primary);">${item.name}</strong></td>
                <td><input type="file" multiple accept=".png,.svg,.cur,.ani,image/png,image/svg+xml" style="width:180px; font-size:11px;" onchange="handlePackRowUpload(this.files, '${item.key}')"></td>
                <td><div style="display:flex; gap:4px; width:110px;" id="pGroupX_${item.key}"><input type="number" value="0" min="0" style="padding:4px; width:50px;" id="pX_${item.key}"><input type="number" value="0" min="0" style="padding:4px; width:50px;" id="pY_${item.key}"></div></td>
                <td><input type="number" value="100" min="16" step="16" style="padding:4px; width:70px;" id="pDur_${item.key}"></td>
                <td><div class="pack-preview-slot checkerboard" id="pPrev_${item.key}">-</div></td>
            `; tbody.appendChild(tr);
        });
    }

    function handlePackRowUpload(files, key) {
        if(!files.length) return; const file = files[0]; const ext = file.name.split('.').pop().toLowerCase(); const slot = document.getElementById(`pPrev_${key}`); slot.innerHTML = '';
        if (ext === 'cur' || ext === 'ani') {
            document.getElementById(`pGroupX_${key}`).style.opacity = "0.3"; document.getElementById(`pDur_${key}`).style.opacity = "0.3";   
            const r = new FileReader(); r.onload = function(e) { const buffer = e.target.result; const pUrl = getPreviewUrlFromBinary(buffer); packDataStorage[key] = { isRawCursor: true, buffer: buffer, ext: ext, previewUrl: pUrl }; slot.innerHTML = `<img src="${pUrl}">`; }; r.readAsArrayBuffer(file);
        } else {
            document.getElementById(`pGroupX_${key}`).style.opacity = "1"; document.getElementById(`pDur_${key}`).style.opacity = "1";
            let loaded = 0; const fileArr = Array.from(files).sort((a,b)=>a.name.localeCompare(b.name)); const imgList = new Array(fileArr.length);
            fileArr.forEach((f, index) => {
                const r = new FileReader(); r.onload = function(ev) {
                    const img = new Image(); img.onload = function() {
                        imgList[index] = img; loaded++; if(loaded === fileArr.length) { const finalUrl = fileArr[0].name.endsWith('.svg') ? ev.target.result : imgList[0].src; packDataStorage[key] = { isRawCursor: false, images: imgList, previewUrl: finalUrl }; slot.innerHTML = `<img src="${finalUrl}">`; }
                    }; img.src = ev.target.result;
                }; r.readAsDataURL(f);
            });
        }
    }

    function getPreviewUrlFromBinary(buffer) {
        const view = new DataView(buffer);
        try {
            if (readASCIIString(view, 0, 4) === 'RIFF') {
                let offset = 12;
                while (offset < view.byteLength) {
                    if (offset + 8 > view.byteLength) break;
                    const cid = readASCIIString(view, offset, 4); const csize = view.getUint32(offset + 4, true); offset += 8;
                    if (cid === 'LIST' && readASCIIString(view, offset, 4) === 'fram') {
                        let sub = offset + 4;
                        while (sub < offset + csize) {
                            if (sub + 8 > offset + csize) break;
                            const sid = readASCIIString(view, sub, 4); const ssize = view.getUint32(sub + 4, true); sub += 8;
                            if (sid === 'icon') return makeUrlFromChunk(buffer.slice(sub, sub + ssize));
                            sub += ssize + (ssize % 2);
                        }
                    } offset += csize + (csize % 2);
                }
            } else if (view.getUint16(2, true) === 2) { return makeUrlFromChunk(buffer); }
        } catch(e){}
        return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    function makeUrlFromChunk(buf) { const v = new DataView(buf); if (v.byteLength > 26 && v.getUint8(22) === 0x89 && v.getUint8(23) === 0x50) { return URL.createObjectURL(new Blob([buf.slice(22)], {type: 'image/png'})); } return URL.createObjectURL(new Blob([buf], {type: 'image/x-icon'})); }

    async function exportFullZipPack() {
        const schemeName = document.getElementById('packSchemeName').value.trim().replace(/[^a-zA-Z0-9]/g, "") || "CustomTheme";
        const zip = new JSZip(); let hasAnyFile = false;
        let batRegistryBody = "";

        for(let item of cursorSchemeMap) {
            const packItem = packDataStorage[item.key];
            if(packItem) {
                hasAnyFile = true; let fileBuffer, ext;
                if (packItem.isRawCursor) { fileBuffer = packItem.buffer; ext = packItem.ext; } 
                else if (packItem.images && packItem.images.length > 0) {
                    const hX = parseInt(document.getElementById(`pX_${item.key}`).value) || 0; const hY = parseInt(document.getElementById(`pY_${item.key}`).value) || 0; const curBytesList = [];
                    for(let img of packItem.images) curBytesList.push(await buildCurBuffer(img, 32, hX, hY));
                    if(packItem.images.length === 1) { fileBuffer = curBytesList[0]; ext = 'cur'; } else { const ms = parseInt(document.getElementById(`pDur_${item.key}`).value) || 100; fileBuffer = compileAniBuffer(curBytesList, ms); ext = 'ani'; }
                } else { continue; }

                const finalFileName = `${item.key}.${ext}`;
                zip.file(`${schemeName}/${finalFileName}`, fileBuffer);
                batRegistryBody += `    reg add "HKCU\\Control Panel\\Cursors" /v "${item.key}" /t REG_EXPAND_SZ /d "%%LOCALAPPDATA%%\\CustomCursors\\%%SCHEME_NAME%%\\${finalFileName}" /f >nul\n`;
            }
        }

        if(!hasAnyFile) { alert('操作終止：你必須至少在一個狀態中部署圖檔才能進行封裝！'); return; }

        const advancedInstallBat = `@echo off\n` +
            `pushd "%~dp0"\n\n` +
            `for %%I in ("%~dp0.") do set "SCHEME_NAME=%%~nxI"\n\n` +
            `set "TARGET_DIR=%LOCALAPPDATA%\\CustomCursors\\%SCHEME_NAME%"\n` +
            `if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"\n` +
            `copy /Y *.cur "%TARGET_DIR%\\" >nul 2>&1\n` +
            `copy /Y *.ani "%TARGET_DIR%\\" >nul 2>&1\n\n` +
            `reg add "HKCU\\Control Panel\\Cursors" /ve /t REG_SZ /d "%SCHEME_NAME%" /f >nul\n` +
            `reg add "HKCU\\Control Panel\\Cursors" /v "Scheme Source" /t REG_DWORD /d 1 /f >nul\n` +
            batRegistryBody + `\n` +
            `powershell -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")]public static extern bool SystemParametersInfo(int u,int p,string l,int f);' -Name 'W' -Namespace 'S'; [S.W]::SystemParametersInfo(87,0,$null,0)" >nul 2>&1\n\n` +
            `echo ====================================================\n` +
            `echo   Installation Successful! Theme applied.\n` +
            `echo ====================================================\n` +
            `pause\n`;

        zip.file(`${schemeName}/Install.bat`, advancedInstallBat);
        zip.generateAsync({type:"blob"}).then((content) => {
            const url = URL.createObjectURL(content); const a = document.createElement('a'); a.href = url; a.download = `${schemeName}_CursorTheme.zip`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        });
    }

    /* ================= 頁籤四：系統還原 ================= */
    function downloadRestoreBat() {
        const bat = `@echo off\n` +
            `reg add "HKCU\\Control Panel\\Cursors" /ve /t REG_SZ /d "Windows Default" /f >nul\n` +
            `reg add "HKCU\\Control Panel\\Cursors" /v "Scheme Source" /t REG_DWORD /d 1 /f >nul\n` +
            `for %%v in (Arrow Help AppStarting Wait Crosshair IBeam NWPen No SizeNS SizeWE SizeNWSE SizeNESW SizeAll UpArrow Hand Pin Person) do (\n` +
            `    reg delete "HKCU\\Control Panel\\Cursors" /v "%%v" /f >nul 2>&1\n` +
            `)\n` +
            `powershell -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")]public static extern bool SystemParametersInfo(int u,int p,string l,int f);' -Name 'W' -Namespace 'S'; [S.W]::SystemParametersInfo(87,0,$null,0)" >nul 2>&1\n` +
            `echo Cursors restored to Windows Default.\n` +
            `pause\n`;
        const blob = new Blob([bat], {type: "application/octet-stream"}); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = "RestoreDefaultCursors.bat";
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    function writeString(view, offset, str) { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }
    function readASCIIString(view, offset, length) { let str = ''; for (let i = 0; i < length; i++) { str += String.fromCharCode(view.getUint8(offset + i)); } return str; }

    window.onload = function() { initPackerTable(); };