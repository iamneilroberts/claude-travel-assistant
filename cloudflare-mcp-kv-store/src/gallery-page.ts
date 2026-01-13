/**
 * Gallery page HTML template
 * Browse and copy URLs for uploaded images
 */

export interface GalleryPageParams {
  authKey: string;
  tripId?: string;
  images: GalleryImage[];
}

export interface GalleryImage {
  key: string;
  url: string;
  category: string;
  uploaded: string;
  size?: number;
}

export function getGalleryPageHtml(params: GalleryPageParams): string {
  const { authKey, tripId, images } = params;

  // Group images by category
  const byCategory: Record<string, GalleryImage[]> = {};
  for (const img of images) {
    const cat = img.category || 'uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(img);
  }

  const categoryLabels: Record<string, string> = {
    hero: 'Hero / Cover Images',
    lodging: 'Lodging / Hotels',
    activity: 'Activities',
    destination: 'Destinations',
    support: 'Support Attachments',
    uploads: 'General Uploads',
    uncategorized: 'Other'
  };

  // Build gallery HTML
  let galleryHtml = '';

  if (images.length === 0) {
    galleryHtml = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>No images uploaded yet</p>
        <a href="/upload?key=${authKey}${tripId ? '&trip=' + tripId : ''}" class="upload-link">Upload your first image</a>
      </div>
    `;
  } else {
    for (const [cat, imgs] of Object.entries(byCategory)) {
      const label = categoryLabels[cat] || cat;
      galleryHtml += `
        <div class="category-section">
          <h2 class="category-title">${label}</h2>
          <div class="image-grid">
            ${imgs.map(img => `
              <div class="image-card" data-url="${img.url}">
                <div class="image-wrapper">
                  <img src="${img.url}?w=200" alt="" loading="lazy">
                </div>
                <div class="image-info">
                  <div class="image-date">${new Date(img.uploaded).toLocaleDateString()}</div>
                  <button class="copy-btn" onclick="copyUrl('${img.url}')">📋 Copy URL</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voygent Image Gallery${tripId ? ' - ' + tripId : ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      padding: 20px;
      color: #e4e4e7;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 16px;
    }

    h1 {
      font-size: 28px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .trip-badge {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: normal;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .header-actions a {
      background: rgba(255, 255, 255, 0.1);
      color: #e4e4e7;
      text-decoration: none;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      transition: background 0.2s;
    }

    .header-actions a:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .header-actions a.primary {
      background: #3b82f6;
    }

    .header-actions a.primary:hover {
      background: #2563eb;
    }

    .category-section {
      margin-bottom: 40px;
    }

    .category-title {
      font-size: 18px;
      color: #a1a1aa;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .image-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }

    .image-card {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 0.2s, border-color 0.2s;
    }

    .image-card:hover {
      transform: translateY(-2px);
      border-color: rgba(59, 130, 246, 0.5);
    }

    .image-wrapper {
      aspect-ratio: 1;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .image-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      cursor: pointer;
    }

    .image-info {
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .image-date {
      font-size: 12px;
      color: #71717a;
    }

    .copy-btn {
      background: rgba(16, 185, 129, 0.2);
      border: none;
      color: #34d399;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .copy-btn:hover {
      background: rgba(16, 185, 129, 0.3);
    }

    .copy-btn.copied {
      background: rgba(107, 114, 128, 0.3);
      color: #9ca3af;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 16px;
      border: 1px dashed rgba(255, 255, 255, 0.1);
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-state p {
      color: #71717a;
      margin-bottom: 20px;
    }

    .upload-link {
      display: inline-block;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 500;
    }

    .upload-link:hover {
      background: #2563eb;
    }

    /* Lightbox */
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      padding: 20px;
      cursor: pointer;
    }

    .lightbox.visible {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lightbox img {
      max-width: 90%;
      max-height: 90%;
      object-fit: contain;
      border-radius: 8px;
    }

    .lightbox-close {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 24px;
      cursor: pointer;
    }

    .lightbox-url {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.7);
      padding: 12px 20px;
      border-radius: 8px;
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .lightbox-url code {
      color: #a5f3fc;
      font-size: 13px;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .lightbox-url button {
      background: #10b981;
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }

    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #10b981;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      transition: transform 0.3s ease;
      z-index: 1001;
    }

    .toast.visible {
      transform: translateX(-50%) translateY(0);
    }

    @media (max-width: 600px) {
      .image-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      header {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>
        📁 Image Gallery
        ${tripId ? `<span class="trip-badge">${tripId}</span>` : ''}
      </h1>
      <div class="header-actions">
        ${tripId ? `<a href="/gallery?key=${authKey}">All Images</a>` : ''}
        <a href="/upload?key=${authKey}${tripId ? '&trip=' + tripId : ''}" class="primary">+ Upload New</a>
      </div>
    </header>

    ${galleryHtml}
  </div>

  <!-- Lightbox -->
  <div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
    <button class="lightbox-close" onclick="closeLightbox(event)">&times;</button>
    <img id="lightboxImg" src="" alt="">
    <div class="lightbox-url">
      <code id="lightboxUrl"></code>
      <button onclick="copyLightboxUrl(event)">Copy URL</button>
    </div>
  </div>

  <!-- Toast -->
  <div class="toast" id="toast">URL copied!</div>

  <script>
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxUrl = document.getElementById('lightboxUrl');
    const toast = document.getElementById('toast');

    // Click image to open lightbox
    document.querySelectorAll('.image-wrapper img').forEach(img => {
      img.addEventListener('click', () => {
        const url = img.closest('.image-card').dataset.url;
        lightboxImg.src = url;
        lightboxUrl.textContent = url;
        lightbox.classList.add('visible');
      });
    });

    function closeLightbox(e) {
      if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
        lightbox.classList.remove('visible');
      }
    }

    function copyUrl(url) {
      navigator.clipboard.writeText(url).then(() => {
        showToast();
      });
    }

    function copyLightboxUrl(e) {
      e.stopPropagation();
      const url = lightboxUrl.textContent;
      navigator.clipboard.writeText(url).then(() => {
        showToast();
      });
    }

    function showToast() {
      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
      }, 2000);
    }

    // Close lightbox on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        lightbox.classList.remove('visible');
      }
    });
  </script>
</body>
</html>`;
}
