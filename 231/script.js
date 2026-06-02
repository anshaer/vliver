// 確保所有變數在 DOM 載入後才初始化，解決 ReferenceError
const cursorSchemeMap = [
    { key: 'Arrow', name: 'Arrow' }, { key: 'Help', name: 'Help' },
    { key: 'AppStarting', name: 'Background' }, { key: 'Wait', name: 'Busy' },
    { key: 'Crosshair', name: 'Precision' }, { key: 'IBeam', name: 'Text' },
    { key: 'NWPen', name: 'Handwriting' }, { key: 'No', name: 'Unavailable' },
    { key: 'SizeNS', name: 'Vertical' }, { key: 'SizeWE', name: 'Horizontal' },
    { key: 'SizeNWSE', name: 'Diagonal1' }, { key: 'SizeNESW', name: 'Diagonal2' },
    { key: 'SizeAll', name: 'Move' }, { key: 'UpArrow', name: 'Alternate' },
    { key: 'Hand', name: 'Link' }, { key: 'Pin', name: 'Location' },
    { key: 'Person', name: 'Person' }
];

let viewParsedFrames = []; 
let viewAnimationSteps = [];
let packDataStorage = {};

// 初始化表格函數
function initPackerTable() {
    const tbody = document.getElementById('packTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    cursorSchemeMap.forEach(item => {
        packDataStorage[item.key] = null;
        let tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${item.name}</strong></td><td><input type="file" onchange="handlePackRowUpload(this.files, '${item.key}')"></td>...`;
        tbody.appendChild(tr);
    });
}

// 監聽 DOM 載入
window.addEventListener('DOMContentLoaded', () => {
    initPackerTable();
});

// 其餘邏輯 (handlePackRowUpload, exportFullZipPack 等) 照舊貼入下方
