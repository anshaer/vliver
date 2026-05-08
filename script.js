document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            document.getElementById("page-title").textContent = data.title;

            // --- 1. 初始化資料渲染 ---
            
            // 渲染推廣與夥伴 (初始顯示第一張)
            const renderStaticBox = (containerId, items) => {
                const container = document.getElementById(containerId);
                if (!items || items.length === 0) return;
                container.setAttribute('data-index', 0); // 儲存當前索引
                updateBoxView(containerId, items, 0);
            };

            const updateBoxView = (containerId, items, idx) => {
                const container = document.getElementById(containerId);
                const item = items[idx];
                container.innerHTML = `
                    <div class="promo-flex-box">
                        <div class="promo-media"><img src="${item.imageUrl}"></div>
                        <div class="promo-content">
                            <div class="promo-title-box">${item.title}</div>
                            <div class="promo-desc-box">${item.description}</div>
                            <div class="promo-links">
                                ${item.ytUrl ? `<a href="${item.ytUrl}" class="promo-link-item" target="_blank"><i class="fab fa-youtube"></i> ${item.channel1Name || 'YT'}</a>` : ''}
                                ${item.twitchUrl ? `<a href="${item.twitchUrl}" class="promo-link-item" target="_blank"><i class="fab fa-twitch"></i> ${item.channel3Name || '圖奇'}</a>` : ''}
                                ${item.xUrl ? `<a href="${item.xUrl}" class="promo-link-item" target="_blank"><i class="fab fa-twitter"></i> ${item.channel2Name || 'X'}</a>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            };

            renderStaticBox("promo-list", data.promo);
            renderStaticBox("partner-list", data.partner);

            // Gallery 初始顯示
            const gImg = document.getElementById("gallery-img");
            const gCap = document.getElementById("gallery-caption");
            let gIdx = 0;
            const updateG = (idx) => {
                gIdx = idx;
                gImg.src = data.gallery[gIdx].url;
                gCap.textContent = data.gallery[gIdx].title;
            };
            updateG(0);

            // --- 2. 核心計時邏輯 (每9秒一個大循環) ---
            
            let globalTimer = 0; 
            setInterval(() => {
                globalTimer = (globalTimer + 1) % 9;

                if (globalTimer === 0) {
                    // 0秒：圖片展示動 (Gallery)
                    let nextIdx = (gIdx + 1) % data.gallery.length;
                    updateG(nextIdx);
                } 
                else if (globalTimer === 3) {
                    // 3秒：推廣動 (Promo)
                    const container = document.getElementById("promo-list");
                    let idx = (parseInt(container.getAttribute('data-index')) + 1) % data.promo.length;
                    container.setAttribute('data-index', idx);
                    updateBoxView("promo-list", data.promo, idx);
                } 
                else if (globalTimer === 6) {
                    // 6秒：合作夥伴動 (Partner)
                    const container = document.getElementById("partner-list");
                    let idx = (parseInt(container.getAttribute('data-index')) + 1) % data.partner.length;
                    container.setAttribute('data-index', idx);
                    updateBoxView("partner-list", data.partner, idx);
                }
            }, 1000); // 每秒檢查一次狀態

            // --- 3. 手動按鈕功能 (保留並重設計時) ---
            
            document.getElementById("next-btn").onclick = () => { updateG((gIdx + 1) % data.gallery.length); globalTimer = 0; };
            document.getElementById("prev-btn").onclick = () => { updateG((gIdx - 1 + data.gallery.length) % data.gallery.length); globalTimer = 0; };

            document.getElementById("promo-next-btn").onclick = () => {
                const c = document.getElementById("promo-list");
                let idx = (parseInt(c.getAttribute('data-index')) + 1) % data.promo.length;
                c.setAttribute('data-index', idx);
                updateBoxView("promo-list", data.promo, idx);
                globalTimer = 3;
            };
            document.getElementById("promo-prev-btn").onclick = () => {
                const c = document.getElementById("promo-list");
                let idx = (parseInt(c.getAttribute('data-index')) - 1 + data.promo.length) % data.promo.length;
                c.setAttribute('data-index', idx);
                updateBoxView("promo-list", data.promo, idx);
                globalTimer = 3;
            };

            document.getElementById("partner-next-btn").onclick = () => {
                const c = document.getElementById("partner-list");
                let idx = (parseInt(c.getAttribute('data-index')) + 1) % data.partner.length;
                c.setAttribute('data-index', idx);
                updateBoxView("partner-list", data.partner, idx);
                globalTimer = 6;
            };
            document.getElementById("partner-prev-btn").onclick = () => {
                const c = document.getElementById("partner-list");
                let idx = (parseInt(c.getAttribute('data-index')) - 1 + data.partner.length) % data.partner.length;
                c.setAttribute('data-index', idx);
                updateBoxView("partner-list", data.partner, idx);
                globalTimer = 6;
            };

            // --- 4. 其他靜態渲染 ---
            const sGrid = document.getElementById("support-grid");
            data.support.forEach(s => {
                const a = document.createElement("a");
                a.className = "support-link-item"; a.href = s.url; a.textContent = s.title;
                sGrid.appendChild(a);
            });

            document.getElementById("social-icons").innerHTML = `
                <a href="${data.social.x}" target="_blank" class="social-icon"><i class="fab fa-twitter"></i></a>
                <a href="${data.social.yt}" target="_blank" class="social-icon"><i class="fab fa-youtube"></i></a>
                <a href="${data.social.twitch}" target="_blank" class="social-icon"><i class="fab fa-twitch"></i></a>
                <a href="mailto:${data.social.email}" class="social-icon"><i class="fas fa-envelope"></i></a>
            `;
        });
});
