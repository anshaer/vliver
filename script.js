
document.addEventListener("DOMContentLoaded", () => {
    fetch('data.json')
        .then(res => res.json())
        .then(data => {
            if (data.title) document.getElementById("page-title").textContent = data.title;

            // --- 1. 渲染全展出網格 (Grid) ---
            const renderGrid = (containerId, items) => {
                const container = document.getElementById(containerId);
                if (!items || items.length === 0) return;

                container.innerHTML = items.map(item => `
                    <div class="promo-card">
                        <div class="card-media">
                            <img src="${item.imageUrl}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/150'">
                        </div>
                        <div class="card-title">${item.title}</div>
                        <div class="card-desc">${item.description}</div>
                        <div class="card-links">
                            ${item.ytUrl ? `<a href="${item.ytUrl}" class="card-link-item" target="_blank" title="YouTube"><i class="fab fa-youtube"></i></a>` : ''}
                            ${item.xUrl ? `<a href="${item.xUrl}" class="card-link-item" target="_blank" title="X (Twitter)"><i class="fab fa-twitter"></i></a>` : ''}
                            ${item.twitchUrl ? `<a href="${item.twitchUrl}" class="card-link-item" target="_blank" title="Twitch"><i class="fab fa-twitch"></i></a>` : ''}
                        </div>
                    </div>
                `).join('');
            };

            renderGrid("promo-list", data.promo);
            renderGrid("partner-list", data.partner);

            // --- 2. 小工具渲染 ---
            const sGrid = document.getElementById("support-grid");
            if(data.support) {
                data.support.forEach(s => {
                    const a = document.createElement("a");
                    a.className = "support-link-item";
                    a.href = s.url;
                    a.textContent = s.title;
                    sGrid.appendChild(a);
                });
            }

            // --- 3. 社交連結渲染 ---
            const socialIcons = document.getElementById("social-icons");
            if(data.social) {
                socialIcons.innerHTML = `
                    <a href="${data.social.x}" target="_blank" class="social-icon"><i class="fab fa-twitter"></i></a>
                    <a href="${data.social.yt}" target="_blank" class="social-icon"><i class="fab fa-youtube"></i></a>
                    <a href="${data.social.twitch}" target="_blank" class="social-icon"><i class="fab fa-twitch"></i></a>
                    <a href="mailto:${data.social.email}" class="social-icon"><i class="fas fa-envelope"></i></a>
                `;
            }

            // --- 4. 頂部輪播圖邏輯 (Gallery) ---
            if (data.gallery && data.gallery.length > 0) {
                let gIdx = 0;
                const gImg = document.getElementById("gallery-img");
                const gCap = document.getElementById("gallery-caption");
                
                const updateGallery = () => {
                    gImg.src = data.gallery[gIdx].url;
                    gCap.textContent = data.gallery[gIdx].caption || "";
                };
                
                updateGallery();
                document.getElementById("next-btn").onclick = () => { gIdx = (gIdx + 1) % data.gallery.length; updateGallery(); };
                document.getElementById("prev-btn").onclick = () => { gIdx = (gIdx - 1 + data.gallery.length) % data.gallery.length; updateGallery(); };
            }
        })
        .catch(err => console.error("Error loading data:", err));
});
