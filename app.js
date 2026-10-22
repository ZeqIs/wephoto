/**
 * Wedding Photo & Video Booth Frontend Logic
 * Theme: "Share the Love" - Is and Mimi (24.10.2026)
 */

(() => {
  'use strict';

  // --- Configuration ---
  const CONFIG = {
    TOTAL_ITEMS: 5,
    // Replace with your actual AWS API Gateway endpoint when deployed
    API_ENDPOINT: 'https://your-api-id.execute-api.us-east-1.amazonaws.com/upload-urls',
    // Allowed file types
    MAX_FILE_SIZE_MB: 100
  };

  // --- Application State ---
  const state = {
    guestName: '',
    currentSlot: 0, // 0 to 4 (representing items 1 to 5)
    slots: Array(CONFIG.TOTAL_ITEMS).fill(null), // Array of objects: { file: File, previewUrl: string, type: 'image'|'video' }
    activeSlotDraft: null // Holds file staged for confirmation in current step
  };

  // --- DOM Elements ---
  const screens = {
    welcome: document.getElementById('screen-welcome'),
    capture: document.getElementById('screen-capture'),
    review: document.getElementById('screen-review'),
    success: document.getElementById('screen-success')
  };

  // Inputs & buttons
  const guestNameInput = document.getElementById('guest-name-input');
  const btnStart = document.getElementById('btn-start');
  const guestBadgeName = document.getElementById('guest-badge-name');
  const stepLabel = document.getElementById('step-label');
  const stepDotsContainer = document.getElementById('step-dots-container');

  const mediaSlotCard = document.getElementById('media-slot-card');
  const capturePlaceholder = document.getElementById('capture-placeholder');
  const mediaPreviewContainer = document.getElementById('media-preview-container');
  const slotInstructionTitle = document.getElementById('slot-instruction-title');

  const inputCameraPhoto = document.getElementById('input-camera-photo');
  const inputCameraVideo = document.getElementById('input-camera-video');
  const inputGalleryFile = document.getElementById('input-gallery-file');

  const btnTakePhoto = document.getElementById('btn-take-photo');
  const btnTakeVideo = document.getElementById('btn-take-video');
  const btnOpenGallery = document.getElementById('btn-open-gallery');

  const initialCaptureActions = document.getElementById('initial-capture-actions');
  const confirmRetakeActions = document.getElementById('confirm-retake-actions');
  const btnConfirmNext = document.getElementById('btn-confirm-next');
  const btnCancelRetake = document.getElementById('btn-cancel-retake');
  const confirmBtnLabel = document.getElementById('confirm-btn-label');

  const reviewGrid = document.getElementById('review-grid');
  const btnSubmitAll = document.getElementById('btn-submit-all');
  const btnRestart = document.getElementById('btn-restart');

  const uploadingOverlay = document.getElementById('uploading-overlay');
  const uploadStatusText = document.getElementById('upload-status-text');
  const progressFill = document.getElementById('progress-fill');
  const progressPercentage = document.getElementById('progress-percentage');
  const toastNotification = document.getElementById('toast-notification');

  // --- Utility Functions ---

  function showToast(message, duration = 3000) {
    toastNotification.textContent = message;
    toastNotification.classList.add('show');
    setTimeout(() => {
      toastNotification.classList.remove('show');
    }, duration);
  }

  function sanitizeName(name) {
    if (!name) return 'Guest';
    const clean = name.replace(/[^a-zA-Z0-9]/g, '');
    return clean.length > 0 ? clean.substring(0, 40) : 'Guest';
  }

  function getFileExtension(file) {
    if (file.name && file.name.includes('.')) {
      return file.name.split('.').pop().toLowerCase();
    }
    if (file.type === 'video/mp4') return 'mp4';
    if (file.type === 'video/quicktime') return 'mov';
    if (file.type === 'image/jpeg') return 'jpg';
    if (file.type === 'image/png') return 'png';
    return 'bin';
  }

  function switchScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    if (screens[screenName]) {
      screens[screenName].classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- Step & UI Management ---

  function updateStepIndicator() {
    stepLabel.textContent = `Photo / Video ${state.currentSlot + 1} of ${CONFIG.TOTAL_ITEMS}`;
    slotInstructionTitle.textContent = `Capture or Select Item #${state.currentSlot + 1}`;
    
    // Update dots
    const dots = stepDotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].className = 'step-dot';
      if (i < state.currentSlot) {
        dots[i].classList.add('completed');
      } else if (i === state.currentSlot) {
        dots[i].classList.add('active');
      }
    }

    if (state.currentSlot === CONFIG.TOTAL_ITEMS - 1) {
      confirmBtnLabel.textContent = 'Save & Review All 5 Items';
    } else {
      confirmBtnLabel.textContent = `Looks Good! Proceed to #${state.currentSlot + 2}`;
    }
  }

  function renderSlotUI() {
    updateStepIndicator();
    // Check if slot already has committed media or a draft
    const existing = state.activeSlotDraft || state.slots[state.currentSlot];
    if (existing) {
      displayPreview(existing);
    } else {
      clearPreview();
    }
  }

  function displayPreview(mediaItem) {
    mediaPreviewContainer.innerHTML = '';
    
    if (mediaItem.type === 'image') {
      const img = document.createElement('img');
      img.src = mediaItem.previewUrl;
      img.className = 'preview-media-element';
      img.alt = `Item ${state.currentSlot + 1}`;
      mediaPreviewContainer.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = mediaItem.previewUrl;
      video.className = 'preview-media-element';
      video.controls = true;
      video.autoplay = false;
      video.playsInline = true;
      mediaPreviewContainer.appendChild(video);
    }

    mediaSlotCard.classList.add('has-media');
    capturePlaceholder.style.display = 'none';
    mediaPreviewContainer.style.display = 'flex';

    initialCaptureActions.style.display = 'none';
    confirmRetakeActions.style.display = 'flex';
  }

  function clearPreview() {
    mediaSlotCard.classList.remove('has-media');
    mediaPreviewContainer.innerHTML = '';
    mediaPreviewContainer.style.display = 'none';
    capturePlaceholder.style.display = 'block';

    initialCaptureActions.style.display = 'flex';
    confirmRetakeActions.style.display = 'none';

    // Clear input values to allow re-selecting identical files
    inputCameraPhoto.value = '';
    inputCameraVideo.value = '';
    inputGalleryFile.value = '';
  }

  function handleFileSelected(file) {
    if (!file) return;

    if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
      showToast(`File is too large. Max size is ${CONFIG.MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|wmv|3gp|webm)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|heif|webp|gif)$/i.test(file.name);

    if (!isVideo && !isImage) {
      showToast('Please select a valid photo or video file.');
      return;
    }

    const type = isVideo ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);

    // Stage draft
    state.activeSlotDraft = {
      file: file,
      previewUrl: previewUrl,
      type: type
    };

    displayPreview(state.activeSlotDraft);
  }

  // --- Review Screen Rendering ---

  function renderReviewScreen() {
    reviewGrid.innerHTML = '';
    state.slots.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = `review-item ${index === 0 ? 'span-2' : ''}`;

      if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.previewUrl;
        img.className = 'review-thumbnail';
        img.alt = `Memory #${index + 1}`;
        card.appendChild(img);
      } else {
        const video = document.createElement('video');
        video.src = item.previewUrl;
        video.className = 'review-thumbnail';
        video.muted = true;
        video.playsInline = true;
        video.controls = true;
        card.appendChild(video);
      }

      const badge = document.createElement('div');
      badge.className = 'review-badge';
      badge.textContent = `#${index + 1}`;
      card.appendChild(badge);

      const retakeBtn = document.createElement('button');
      retakeBtn.type = 'button';
      retakeBtn.className = 'review-retake-btn';
      retakeBtn.textContent = 'Retake';
      retakeBtn.addEventListener('click', () => {
        state.currentSlot = index;
        state.activeSlotDraft = null;
        switchScreen('capture');
        renderSlotUI();
      });
      card.appendChild(retakeBtn);

      reviewGrid.appendChild(card);
    });
  }

  // --- S3 Direct Upload Flow ---

  async function requestPresignedUrls() {
    const payload = {
      name: sanitizeName(state.guestName),
      files: state.slots.map(item => ({
        type: item.file.type || (item.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        extension: getFileExtension(item.file)
      }))
    };

    const response = await fetch(CONFIG.API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server responded with status ${response.status}`);
    }

    return await response.json();
  }

  // Fallback simulator for offline preview / demo testing
  async function simulateUploadProgress(statusCallback) {
    for (let i = 1; i <= CONFIG.TOTAL_ITEMS; i++) {
      statusCallback(`Uploading item ${i} of ${CONFIG.TOTAL_ITEMS}...`, (i / CONFIG.TOTAL_ITEMS) * 90);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    statusCallback('Finalizing uploads...', 100);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  async function uploadItemToS3(uploadUrl, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(e.loaded / e.total);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload returned HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error uploading to S3. Check S3 CORS configuration.'));
      xhr.send(file);
    });
  }

  async function handleSubmitAll() {
    uploadingOverlay.classList.add('active');
    uploadStatusText.textContent = 'Requesting secure upload authorization...';
    progressFill.style.width = '10%';
    progressPercentage.textContent = '10%';

    const isPlaceholderEndpoint = CONFIG.API_ENDPOINT.includes('your-api-id');

    try {
      if (isPlaceholderEndpoint) {
        // Run demo simulation when API Gateway is not yet linked
        uploadStatusText.textContent = 'Demo Mode: Simulating direct S3 upload...';
        await simulateUploadProgress((msg, pct) => {
          uploadStatusText.textContent = msg;
          progressFill.style.width = `${pct}%`;
          progressPercentage.textContent = `${Math.round(pct)}%`;
        });
      } else {
        // Live AWS Upload Flow
        const urlData = await requestPresignedUrls();
        const items = urlData.items;

        for (let i = 0; i < state.slots.length; i++) {
          const item = state.slots[i];
          const uploadInfo = items[i];

          uploadStatusText.textContent = `Uploading memory ${i + 1} of ${CONFIG.TOTAL_ITEMS}...`;

          await uploadItemToS3(uploadInfo.uploadUrl, item.file, (fileRatio) => {
            const overallPct = Math.round(((i + fileRatio) / CONFIG.TOTAL_ITEMS) * 100);
            progressFill.style.width = `${overallPct}%`;
            progressPercentage.textContent = `${overallPct}%`;
          });
        }
      }

      // Upload Successful
      uploadStatusText.textContent = 'Complete!';
      progressFill.style.width = '100%';
      progressPercentage.textContent = '100%';

      setTimeout(() => {
        uploadingOverlay.classList.remove('active');
        switchScreen('success');
      }, 600);

    } catch (err) {
      console.error('Upload Error:', err);
      uploadingOverlay.classList.remove('active');
      showToast(`Upload failed: ${err.message}. Please try again.`);
    }
  }

  // --- Reset & Restart ---

  function resetSession() {
    // Revoke any created Object URLs
    state.slots.forEach(slot => {
      if (slot && slot.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
    });
    if (state.activeSlotDraft && state.activeSlotDraft.previewUrl) {
      URL.revokeObjectURL(state.activeSlotDraft.previewUrl);
    }

    state.guestName = '';
    state.currentSlot = 0;
    state.slots = Array(CONFIG.TOTAL_ITEMS).fill(null);
    state.activeSlotDraft = null;

    guestNameInput.value = '';
    btnStart.disabled = true;
    clearPreview();
    switchScreen('welcome');
  }

  // --- Event Listeners Setup ---

  function initEventListeners() {
    // 1. Welcome Screen
    guestNameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      state.guestName = val;
      btnStart.disabled = val.length < 2;
    });

    guestNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btnStart.disabled) {
        btnStart.click();
      }
    });

    btnStart.addEventListener('click', () => {
      guestBadgeName.textContent = state.guestName;
      state.currentSlot = 0;
      switchScreen('capture');
      renderSlotUI();
    });

    // 2. Capture Actions
    btnTakePhoto.addEventListener('click', () => inputCameraPhoto.click());
    btnTakeVideo.addEventListener('click', () => inputCameraVideo.click());
    btnOpenGallery.addEventListener('click', () => inputGalleryFile.click());

    [inputCameraPhoto, inputCameraVideo, inputGalleryFile].forEach(input => {
      input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelected(e.target.files[0]);
        }
      });
    });

    // 3. Cancel / Retake Action
    btnCancelRetake.addEventListener('click', () => {
      if (state.activeSlotDraft && state.activeSlotDraft.previewUrl) {
        URL.revokeObjectURL(state.activeSlotDraft.previewUrl);
      }
      state.activeSlotDraft = null;
      clearPreview();
      showToast('Item discarded. You can retake or choose another.');
    });

    // 4. Confirm / Proceed Action
    btnConfirmNext.addEventListener('click', () => {
      if (!state.activeSlotDraft && !state.slots[state.currentSlot]) {
        showToast('Please capture or select a photo/video first.');
        return;
      }

      if (state.activeSlotDraft) {
        // Save draft to committed slots
        state.slots[state.currentSlot] = state.activeSlotDraft;
        state.activeSlotDraft = null;
      }

      if (state.currentSlot < CONFIG.TOTAL_ITEMS - 1) {
        // Advance to next slot
        state.currentSlot++;
        clearPreview();
        renderSlotUI();
      } else {
        // All 5 items captured, advance to review screen
        renderReviewScreen();
        switchScreen('review');
      }
    });

    // 5. Submit All
    btnSubmitAll.addEventListener('click', handleSubmitAll);

    // 6. Restart
    btnRestart.addEventListener('click', resetSession);
  }

  // Initialize
  initEventListeners();

})();
