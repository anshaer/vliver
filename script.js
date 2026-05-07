document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(response => {
            if (!response.ok) throw new Error('無法讀取 JSON 資料');
            return response.json();
        })
        .then(data => {
            document.getElementById("page-title").textContent = data.title;

            // --- 輪播邏輯優化 (推廣 & 合作夥伴) ---
            const initSectionCarousel = (containerId, prevBtnId, nextBtnId, items) => {
                const container = document.getElementById(containerId);
                const prevBtn = document.getElementById(prevBtnId);
                const nextBtn = document.getElementById(nextBtnId);
                if (!container || !items || items.length === 0) return;

                let currentIndex = 0;
                let timer = null;

                const render = () => {
                    container.innerHTML = '';
                    const item = items[currentIndex];
                    const card = document.createElement("div");
                    card.className = "promo-flex-box active"; // 使用 CSS 控制動畫或顯示
                    card.innerHTML = `
                        <div class="promo-media"><img src="${item.imageUrl}" alt="${item.title}"></div>
                        <div class="promo-content">
                            <div class="promo-title-box">${item.title}</div>
                            <div class="promo-desc-box">${item.description}</div>
                            <div class="promo-links">
                                ${item.ytUrl ? `<a href="${item.ytUrl}" class="promo-link-item" target="_blank"><i class="fab fa-youtube"></i> ${item.channel1Name || 'YT'}</a>` : ''}
                                ${item.xUrl ? `<a href="${item.xUrl}" class="promo-link-item" target="_blank"><i class="fab fa-twitter"></i> ${item.channel2Name || 'X'}</a>` : ''}
                                ${item.twitchUrl ? `<a href="${item.twitchUrl}" class="promo-link-item" target="_blank"><i class="fab fa-twitch"></i> ${item.channel3Name || '圖奇'}</a>` : ''}
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                };

                const startAuto = () => {
                    if (timer) clearInterval(timer);
                    timer = setInterval(() => {
                        currentIndex = (currentIndex + 1) % items.length;
                        render();
                    }, 5000);
                };

                prevBtn.onclick = () => { currentIndex = (currentIndex - 1 + items.length) % items.length; render(); startAuto(); };
                nextBtn.onclick = () => { currentIndex = (currentIndex + 1) % items.length; render(); startAuto(); };

                render();
                startAuto();
            };

            initSectionCarousel("promo-list", "promo-prev-btn", "promo-next-btn", data.promo);
            initSectionCarousel("partner-list", "partner-prev-btn", "partner-next-btn", data.partner);

            // --- Gallery 輪播 ---
            const galleryImg = document.getElementById("gallery-img");
            const galleryCaption = document.getElementById("gallery-caption");
            if (data.gallery && data.gallery.length > 0) {
                let gIdx = 0;
                const upG = () => {
                    galleryImg.src = data.gallery[gIdx].url;
                    galleryCaption.textContent = data.gallery[gIdx].title;
                };
                upG();
                document.getElementById("prev-btn").onclick = () => { gIdx = (gIdx - 1 + data.gallery.length) % data.gallery.length; upG(); };
                document.getElementById("next-btn").onclick = () => { gIdx = (gIdx + 1) % data.gallery.length; upG(); };
            }

            // --- 其他區塊 ---
            const supportGrid = document.getElementById("support-grid");
            data.support.forEach(item => {
                const a = document.createElement("a");
                a.href = item.url; a.className = "support-link-item"; a.textContent = item.title;
                supportGrid.appendChild(a);
            });

            document.getElementById("social-icons").innerHTML = `
                <a href="${data.social.x}" target="_blank" class="social-icon"><i class="fab fa-twitter"></i></a>
                <a href="${data.social.yt}" target="_blank" class="social-icon"><i class="fab fa-youtube"></i></a>
                <a href="${data.social.twitch}" target="_blank" class="social-icon"><i class="fab fa-twitch"></i></a>
                <a href="mailto:${data.social.email}" class="social-icon"><i class="fas fa-envelope"></i></a>
            `;
        });
});
