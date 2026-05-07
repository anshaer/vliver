document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(response => {
            if (!response.ok) throw new Error('無法讀取 JSON 資料');
            return response.json();
        })
        .then(data => {
            document.getElementById("page-title").textContent = data.title;

            // --- 輔助函式：建立輪播區塊 (推廣與合作夥伴共用) ---
            const setupCarouselSection = (containerId, prevBtnId, nextBtnId, items) => {
                const container = document.getElementById(containerId);
                const prevBtn = document.getElementById(prevBtnId);
                const nextBtn = document.getElementById(nextBtnId);
                
                if (!container || !items || items.length === 0) return;

                let currentIndex = 0;
                let timer = null;

                // 渲染所有卡片，但預設隱藏
                container.innerHTML = '';
                items.forEach((item, index) => {
                    const card = document.createElement("div");
                    card.className = "promo-flex-box";
                    card.style.display = index === 0 ? "flex" : "none"; // 只顯示第一張
                    card.innerHTML = `
                        <div class="promo-media"><img src="${item.imageUrl}" alt="${item.title}"></div>
                        <div class="promo-content">
                            <div class="promo-title-box">${item.title}</div>
                            <div class="promo-desc-box">${item.description}</div>
                            <div class="promo-links">
                                ${item.ytUrl ? `<a href="${item.ytUrl}" class="promo-link-item" target="_blank"><i class="fab fa-youtube"></i> ${item.channel1Name || 'YouTube'}</a>` : ''}
                                ${item.xUrl ? `<a href="${item.xUrl}" class="promo-link-item" target="_blank"><i class="fab fa-twitter"></i> ${item.channel2Name || 'X'}</a>` : ''}
                                ${item.twitchUrl ? `<a href="${item.twitchUrl}" class="promo-link-item" target="_blank"><i class="fab fa-twitch"></i> ${item.channel3Name || 'Twitch'}</a>` : ''}
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });

                const cards = container.querySelectorAll('.promo-flex-box');

                const updateView = () => {
                    cards.forEach((card, i) => {
                        card.style.display = i === currentIndex ? "flex" : "none";
                    });
                };

                const startTimer = () => {
                    if (timer) clearInterval(timer);
                    timer = setInterval(() => {
                        currentIndex = (currentIndex + 1) % items.length;
                        updateView();
                    }, 5000);
                };

                prevBtn.addEventListener("click", () => {
                    currentIndex = (currentIndex - 1 + items.length) % items.length;
                    updateView();
                    startTimer(); // 點擊後重新計時
                });

                nextBtn.addEventListener("click", () => {
                    currentIndex = (currentIndex + 1) % items.length;
                    updateView();
                    startTimer();
                });

                startTimer();
            };

            // 執行推廣與合作夥伴輪播
            setupCarouselSection("promo-list", "promo-prev-btn", "promo-next-btn", data.promo);
            setupCarouselSection("partner-list", "partner-prev-btn", "partner-next-btn", data.partner);

            // --- 圖片展示輪播 (Gallery) ---
            const galleryImg = document.getElementById("gallery-img");
            const galleryCaption = document.getElementById("gallery-caption");
            if (data.gallery && data.gallery.length > 0) {
                let gIndex = 0;
                const updateG = () => {
                    galleryImg.src = data.gallery[gIndex].url;
                    galleryCaption.textContent = data.gallery[gIndex].title;
                };
                updateG();
                document.getElementById("prev-btn").onclick = () => { gIndex = (gIndex - 1 + data.gallery.length) % data.gallery.length; updateG(); };
                document.getElementById("next-btn").onclick = () => { gIndex = (gIndex + 1) % data.gallery.length; updateG(); };
            }

            // --- 技術支援網格 ---
            const supportGrid = document.getElementById("support-grid");
            data.support.forEach(item => {
                const a = document.createElement("a");
                a.href = item.url; a.className = "support-link-item"; a.textContent = item.title;
                supportGrid.appendChild(a);
            });

            // --- 社群 Icon (修正為小鳥圖示) ---
            document.getElementById("social-icons").innerHTML = `
                <a href="${data.social.x}" target="_blank" class="social-icon"><i class="fab fa-twitter"></i></a>
                <a href="${data.social.yt}" target="_blank" class="social-icon"><i class="fab fa-youtube"></i></a>
                <a href="${data.social.twitch}" target="_blank" class="social-icon"><i class="fab fa-twitch"></i></a>
                <a href="mailto:${data.social.email}" class="social-icon"><i class="fas fa-envelope"></i></a>
            `;
        })
        .catch(err => console.error("資料載入失敗:", err));
});
