/**
 * Upload page HTML template
 * Supports: paste, drag & drop, file picker, preset IDs from prepare_image_upload
 */

export interface UploadPageParams {
  authKey: string;
  imageId?: string;      // Pre-generated image ID
  tripId?: string;       // Trip ID for organization
  category?: string;     // Pre-selected category
  description?: string;  // Description from AI
}

export function getUploadPageHtml(params: UploadPageParams): string {
  const { authKey, imageId, tripId, category, description } = params;
  const isPreset = !!imageId;

  // Build preset info display
  const presetInfoHtml = isPreset ? `
    <div class="preset-banner">
      <div class="preset-icon">🎯</div>
      <div class="preset-text">
        <strong>Upload for: ${description || category || 'your trip'}</strong>
        ${tripId ? `<br><span class="preset-detail">Trip: ${tripId}</span>` : ''}
        ${category ? `<br><span class="preset-detail">Category: ${category}</span>` : ''}
      </div>
    </div>
  ` : '';

  // Success message varies based on preset
  const successMessage = isPreset
    ? `<p class="success-hint">You can now go back to your chat and say <strong>"done"</strong> or <strong>"uploaded"</strong>.</p>`
    : `<p class="success-hint">Copy this URL and paste it in your chat:</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voygent Image Upload</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: #e4e4e7;
    }

    .container {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .subtitle {
      color: #a1a1aa;
      font-size: 14px;
      margin-bottom: 24px;
    }

    .preset-banner {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .preset-icon {
      font-size: 24px;
    }

    .preset-text {
      font-size: 14px;
      line-height: 1.5;
    }

    .preset-detail {
      color: #a1a1aa;
      font-size: 13px;
    }

    .drop-zone {
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: rgba(255, 255, 255, 0.02);
    }

    .drop-zone:hover, .drop-zone.dragover {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }

    .drop-zone.has-image {
      padding: 20px;
    }

    .drop-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .drop-text {
      font-size: 16px;
      margin-bottom: 8px;
    }

    .drop-hint {
      font-size: 13px;
      color: #71717a;
    }

    .drop-hint kbd {
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: inherit;
    }

    .preview-container {
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .preview-container.visible {
      display: flex;
    }

    .preview-image {
      max-width: 100%;
      max-height: 200px;
      border-radius: 8px;
      object-fit: contain;
    }

    .preview-info {
      font-size: 13px;
      color: #a1a1aa;
    }

    .clear-btn {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 13px;
      padding: 4px 8px;
    }

    .clear-btn:hover {
      text-decoration: underline;
    }

    .form-group {
      margin-top: 20px;
    }

    .form-group label {
      display: block;
      font-size: 14px;
      margin-bottom: 6px;
      color: #a1a1aa;
    }

    .form-group select,
    .form-group input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      color: #e4e4e7;
      font-size: 14px;
    }

    .form-group select:disabled,
    .form-group input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .form-group select:focus,
    .form-group input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .upload-btn {
      width: 100%;
      margin-top: 24px;
      padding: 14px;
      border-radius: 8px;
      border: none;
      background: #3b82f6;
      color: white;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .upload-btn:hover:not(:disabled) {
      background: #2563eb;
    }

    .upload-btn:disabled {
      background: #374151;
      cursor: not-allowed;
    }

    .success-container {
      display: none;
      text-align: center;
    }

    .success-container.visible {
      display: block;
    }

    .success-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }

    .success-title {
      font-size: 20px;
      margin-bottom: 16px;
    }

    .success-hint {
      color: #a1a1aa;
      font-size: 14px;
      margin-bottom: 16px;
    }

    .success-preview {
      max-width: 100%;
      max-height: 150px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .url-container {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
      color: #a5f3fc;
      max-height: 80px;
      overflow-y: auto;
    }

    .button-row {
      display: flex;
      gap: 12px;
    }

    .button-row button {
      flex: 1;
      padding: 12px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .copy-btn {
      background: #10b981;
      color: white;
    }

    .copy-btn:hover {
      background: #059669;
    }

    .copy-btn.copied {
      background: #6b7280;
    }

    .another-btn {
      background: rgba(255, 255, 255, 0.1);
      color: #e4e4e7;
    }

    .another-btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .error-msg {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 12px;
      border-radius: 8px;
      margin-top: 16px;
      font-size: 14px;
      display: none;
    }

    .error-msg.visible {
      display: block;
    }

    .loading {
      display: none;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px;
    }

    .loading.visible {
      display: flex;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .hidden { display: none !important; }

    input[type="file"] { display: none; }

    .gallery-link {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
    }

    .gallery-link a {
      color: #60a5fa;
      text-decoration: none;
      font-size: 14px;
    }

    .gallery-link a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Upload Form -->
    <div id="uploadForm">
      <h1>📷 Voygent Image Upload</h1>
      <p class="subtitle">Add images to your travel proposals</p>

      ${presetInfoHtml}

      <div class="drop-zone" id="dropZone">
        <div id="dropPrompt">
          <div class="drop-icon">🖼️</div>
          <div class="drop-text">Drop image here or click to browse</div>
          <div class="drop-hint">
            Or paste with <kbd>Ctrl+V</kbd> / <kbd>Cmd+V</kbd>
          </div>
        </div>
        <div class="preview-container" id="previewContainer">
          <img id="previewImage" class="preview-image" alt="Preview">
          <div class="preview-info" id="previewInfo"></div>
          <button class="clear-btn" id="clearBtn">Remove and choose different image</button>
        </div>
      </div>

      <input type="file" id="fileInput" accept="image/*">

      <div class="form-group" ${isPreset ? 'style="display:none"' : ''}>
        <label for="category">Category</label>
        <select id="category" ${isPreset ? 'disabled' : ''}>
          <option value="">Select category...</option>
          <option value="hero" ${category === 'hero' ? 'selected' : ''}>Hero / Cover Image</option>
          <option value="lodging" ${category === 'lodging' ? 'selected' : ''}>Lodging / Hotel</option>
          <option value="activity" ${category === 'activity' ? 'selected' : ''}>Activity / Excursion</option>
          <option value="destination" ${category === 'destination' ? 'selected' : ''}>Destination / Place</option>
          <option value="support" ${category === 'support' ? 'selected' : ''}>Support Attachment</option>
        </select>
      </div>

      <div class="form-group" ${isPreset ? 'style="display:none"' : ''}>
        <label for="caption">Caption (optional)</label>
        <input type="text" id="caption" placeholder="e.g., View from hotel balcony" value="${description || ''}" ${isPreset ? 'disabled' : ''}>
      </div>

      <button class="upload-btn" id="uploadBtn" disabled>Select an image first</button>

      <div class="error-msg" id="errorMsg"></div>

      <div class="loading" id="loading">
        <div class="spinner"></div>
        <span>Uploading...</span>
      </div>

      <div class="gallery-link">
        <a href="/gallery?key=${authKey}${tripId ? '&trip=' + tripId : ''}">📁 Browse uploaded images</a>
      </div>
    </div>

    <!-- Success Screen -->
    <div class="success-container" id="successContainer">
      <div class="success-icon">✅</div>
      <h2 class="success-title">Upload Complete!</h2>
      <img id="successPreview" class="success-preview" alt="Uploaded image">
      ${successMessage}
      <div class="url-container" id="imageUrl"></div>
      <div class="button-row">
        <button class="copy-btn" id="copyBtn">📋 Copy URL</button>
        <button class="another-btn" id="anotherBtn">Upload Another</button>
      </div>
    </div>
  </div>

  <script>
    const authKey = '${authKey}';
    const presetId = ${imageId ? `'${imageId}'` : 'null'};
    const presetTrip = ${tripId ? `'${tripId}'` : 'null'};
    const presetCategory = ${category ? `'${category}'` : 'null'};
    const presetDescription = ${description ? `'${description.replace(/'/g, "\\'")}'` : 'null'};
    let selectedFile = null;

    // Elements
    const dropZone = document.getElementById('dropZone');
    const dropPrompt = document.getElementById('dropPrompt');
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    const previewInfo = document.getElementById('previewInfo');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const errorMsg = document.getElementById('errorMsg');
    const loading = document.getElementById('loading');
    const uploadForm = document.getElementById('uploadForm');
    const successContainer = document.getElementById('successContainer');
    const successPreview = document.getElementById('successPreview');
    const imageUrl = document.getElementById('imageUrl');
    const copyBtn = document.getElementById('copyBtn');
    const anotherBtn = document.getElementById('anotherBtn');
    const categorySelect = document.getElementById('category');
    const captionInput = document.getElementById('caption');

    // Handle paste
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleFile(file);
          }
          e.preventDefault();
          break;
        }
      }
    });

    // Handle drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');

      const file = e.dataTransfer?.files[0];
      if (file && file.type.startsWith('image/')) {
        handleFile(file);
      }
    });

    // Handle click to browse
    dropZone.addEventListener('click', (e) => {
      if (e.target === clearBtn) return;
      if (!selectedFile) {
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
    });

    // Handle file selection
    function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        showError('Please select an image file (JPG, PNG, GIF, WebP)');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        showError('Image must be less than 10MB');
        return;
      }

      selectedFile = file;
      hideError();

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImage.src = e.target.result;
        dropPrompt.classList.add('hidden');
        previewContainer.classList.add('visible');
        dropZone.classList.add('has-image');

        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
        previewInfo.textContent = file.name + ' (' + sizeMB + ' MB)';

        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Image';
      };
      reader.readAsDataURL(file);
    }

    // Clear selection
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedFile = null;
      fileInput.value = '';
      previewImage.src = '';
      dropPrompt.classList.remove('hidden');
      previewContainer.classList.remove('visible');
      dropZone.classList.remove('has-image');
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select an image first';
      hideError();
    });

    // Upload
    uploadBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      uploadBtn.disabled = true;
      loading.classList.add('visible');
      hideError();

      try {
        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('category', presetCategory || categorySelect.value);
        formData.append('caption', presetDescription || captionInput.value);
        if (presetId) formData.append('imageId', presetId);
        if (presetTrip) formData.append('tripId', presetTrip);

        const response = await fetch('/upload?key=' + encodeURIComponent(authKey), {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Upload failed');
        }

        // Show success
        successPreview.src = result.url;
        imageUrl.textContent = result.url;
        uploadForm.classList.add('hidden');
        successContainer.classList.add('visible');

      } catch (err) {
        showError(err.message || 'Upload failed. Please try again.');
        uploadBtn.disabled = false;
      } finally {
        loading.classList.remove('visible');
      }
    });

    // Copy URL
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(imageUrl.textContent);
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy URL';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = imageUrl.textContent;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy URL';
          copyBtn.classList.remove('copied');
        }, 2000);
      }
    });

    // Upload another
    anotherBtn.addEventListener('click', () => {
      selectedFile = null;
      fileInput.value = '';
      previewImage.src = '';
      dropPrompt.classList.remove('hidden');
      previewContainer.classList.remove('visible');
      dropZone.classList.remove('has-image');
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Select an image first';
      if (!presetCategory) categorySelect.value = '';
      if (!presetDescription) captionInput.value = '';

      uploadForm.classList.remove('hidden');
      successContainer.classList.remove('visible');
    });

    function showError(msg) {
      errorMsg.textContent = msg;
      errorMsg.classList.add('visible');
    }

    function hideError() {
      errorMsg.classList.remove('visible');
    }
  </script>
</body>
</html>`;
}
