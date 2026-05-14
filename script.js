document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            document.getElementById("page-title").textContent = data.title;

            // --- 1. 渲染頂部圖片輪播 (Gallery) ---
            const gImg = document.getElementById("gallery-img");
            const gCap = document.getElementById("gallery-caption");
            let gIdx = 0;

            if (data.gallery && data.gallery.length > 0) {
                const updateGallery = () => {
                    gImg.style.opacity = 0; // 淡出
                    setTimeout(() => {
                        gImg.src = data.gallery[gIdx].url;
                        gCap.textContent = data.gallery[gIdx].caption || "";
                        gImg.style.opacity = 1; // 淡入
                    }, 200);
                };

                updateGallery();

                document.getElementById("next-btn").onclick = () => {
                    gIdx = (gIdx + 1) % data.gallery.length;
                    updateGallery();
                };
                document.getElementById("prev-btn").onclick = () => {
                    gIdx = (gIdx - 1 + data.gallery.length) % data.gallery.length;
                    updateGallery();
                };

                // 自動輪播 (每 5 秒)
                setInterval(() => {
                    gIdx = (gIdx + 1) % data.gallery.length;
                    updateGallery();
                }, 5000);
            }

            // --- 2. 渲染全展出網格 (Grid) ---
            const renderGrid = (containerId, items) => {
                const container = document.getElementById(containerId);
                if (!items) return;
                container.innerHTML = items.map(item => `
                    <div class="promo-card">
                        <div class="card-media"><img src="${item.imageUrl}" onerror="this.src='https://via.placeholder.com/150'"></div>
                        <div class="card-title">${item.title}</div>
                        <div class="card-desc">${item.description}</div>
                        <div class="card-links">
                            ${item.ytUrl ? `<a href="${item.ytUrl}" class="card-link-item" target="_blank"><i class="fab fa-youtube"></i></a>` : ''}
                            ${item.xUrl ? `<a href="${item.xUrl}" class="card-link-item" target="_blank"><i class="fab fa-twitter"></i></a>` : ''}
                            ${item.twitchUrl ? `<a href="${item.twitchUrl}" class="card-link-item" target="_blank"><i class="fab fa-twitch"></i></a>` : ''}
                        </div>
                    </div>
                `).join('');
            };

            renderGrid("promo-list", data.promo);
            renderGrid("partner-list", data.partner);

            // --- 3. 渲染小工具 ---
            const sGrid = document.getElementById("support-grid");
            data.support.forEach(s => {
                const a = document.createElement("a");
                a.className = "support-link-item"; a.href = s.url; a.textContent = s.title;
                sGrid.appendChild(a);
            });

            // --- 4. 社交連結 ---
            document.getElementById("social-icons").innerHTML = `
                <a href="${data.social.x}" target="_blank" class="social-icon"><i class="fab fa-twitter"></i></a>
                <a href="${data.social.yt}" target="_blank" class="social-icon"><i class="fab fa-youtube"></i></a>
                <a href="${data.social.twitch}" target="_blank" class="social-icon"><i class="fab fa-twitch"></i></a>
                <a href="mailto:${data.social.email}" class="social-icon"><i class="fas fa-envelope"></i></a>
            `;
        });
});
