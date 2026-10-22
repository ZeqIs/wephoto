/**
 * Wedding Photo & Video Booth Frontend Logic (Supabase Version)
 * Theme: "Share the Love" - Is and Mimi (24.10.2026)
 */

(() => {
  'use strict';

  // --- Configuration ---
  const CONFIG = {
    TOTAL_ITEMS: 5,
    // Supabase project settings: replace with your actual Supabase URL and Anon/Public Key
    SUPABASE_URL: 'https://xyzcompany.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-anon-key',
    SUPABASE_BUCKET: 'wedding-photos',
    // Max size per file (in MB)
    MAX_FILE_SIZE_MB: 100
  };

  // Initialize Supabase Client
  const isPlaceholderConfig = 
    CONFIG.SUPABASE_URL.includes('xyzcompany') || 
    CONFIG.SUPABASE_ANON_KEY.includes('placeholder');

  let supabase = null;
  if (typeof window !== 'undefined' && window.supabase && !isPlaceholderConfig) {
    try {
      supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } catch (err) {
      console.warn('Could not initialize Supabase client:', err);
    }
  }

  // --- Application State ---
  const state = {
    guestName: '',
    currentSlot: 0, // 0 to 4 (representing items 1 to 5)
    slots: Array(CONFIG.TOTAL_ITEMS).fill(null), // Array of objects: { file: File, previewUrl: string, type: 'image'|'video' }
    activeSlotDraft: null // Holds file staged for confirmation in current step
  };

  // --- DOM Elements ---
  const screens = (typeof document !== 'undefined') ? {
    welcome: document.getElementById('screen-welcome'),
    capture: document.getElementById('screen-capture'),
    review: document.getElementById('screen-review'),
    success: document.getElementById('screen-success')
  } : {};

  // Inputs & buttons
  const getEl = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : null);

  const guestNameInput = getEl('guest-name-input');
  const btnStart = getEl('btn-start');
  const guestBadgeName = getEl('guest-badge-name');
  const stepLabel = getEl('step-label');
  const stepDotsContainer = getEl('step-dots-container');

  const mediaSlotCard = getEl('media-slot-card');
  const capturePlaceholder = getEl('capture-placeholder');
  const mediaPreviewContainer = getEl('media-preview-container');
  const slotInstructionTitle = getEl('slot-instruction-title');

  const inputCameraPhoto = getEl('input-camera-photo');
  const inputCameraVideo = getEl('input-camera-video');
  const inputGalleryFile = getEl('input-gallery-file');

  const btnTakePhoto = getEl('btn-take-photo');
  const btnTakeVideo = getEl('btn-take-video');
  const btnOpenGallery = getEl('btn-open-gallery');

  const initialCaptureActions = getEl('initial-capture-actions');
  const confirmRetakeActions = getEl('confirm-retake-actions');
  const btnConfirmNext = getEl('btn-confirm-next');
  const btnCancelRetake = getEl('btn-cancel-retake');
  const confirmBtnLabel = getEl('confirm-btn-label');

  const reviewGrid = getEl('review-grid');
  const btnSubmitAll = getEl('btn-submit-all');
  const btnRestart = getEl('btn-restart');

  const uploadingOverlay = getEl('uploading-overlay');
  const uploadStatusText = getEl('upload-status-text');
  const progressFill = getEl('progress-fill');
  const progressPercentage = getEl('progress-percentage');
  const toastNotification = getEl('toast-notification');

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

  function generateSessionCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const values = new Uint8Array(length);
      window.crypto.getRandomValues(values);
      for (let i = 0; i < length; i++) {
        result += chars[values[i] % chars.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return result;
  }

  function getFileExtension(file) {
    if (file.name && file.name.includes('.')) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
    }
    if (file.type === 'video/mp4') return 'mp4';
    if (file.type === 'video/quicktime') return 'mov';
    if (file.type === 'video/webm') return 'webm';
    if (file.type === 'video/3gpp') return '3gp';
    if (file.type === 'image/jpeg') return 'jpg';
    if (file.type === 'image/png') return 'png';
    if (file.type === 'image/webp') return 'webp';
    if (file.type === 'image/heic') return 'heic';
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

  // --- Upload Handlers ---

  // Demo fallback simulation when testing without live Supabase credentials
  async function simulateUploadProgress(statusCallback) {
    for (let i = 1; i <= CONFIG.TOTAL_ITEMS; i++) {
      statusCallback(`Demo Mode: Uploading item ${i} of ${CONFIG.TOTAL_ITEMS}...`, (i / CONFIG.TOTAL_ITEMS) * 90);
      await new Promise(resolve => setTimeout(resolve, 450));
    }
    statusCallback('Finalizing uploads...', 100);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  async function uploadItemToSupabase(fileName, file) {
    if (!supabase) {
      throw new Error('Supabase client is not initialized. Please verify your SUPABASE_URL and SUPABASE_ANON_KEY.');
    }

    const { data, error } = await supabase.storage
      .from(CONFIG.SUPABASE_BUCKET)
      .upload(fileName, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (error) {
      throw error;
    }

    return data;
  }

  async function handleSubmitAll() {
    uploadingOverlay.classList.add('active');
    uploadStatusText.textContent = 'Preparing uploads...';
    progressFill.style.width = '10%';
    progressPercentage.textContent = '10%';

    const sanitizedName = sanitizeName(state.guestName);
    const sessionCode = generateSessionCode(8);

    try {
      if (isPlaceholderConfig) {
        // Run demo simulation mode if real Supabase keys aren't configured yet
        await simulateUploadProgress((msg, pct) => {
          uploadStatusText.textContent = msg;
          progressFill.style.width = `${pct}%`;
          progressPercentage.textContent = `${Math.round(pct)}%`;
        });
      } else {
        // Direct upload to Supabase Storage
        for (let i = 0; i < state.slots.length; i++) {
          const item = state.slots[i];
          const ext = getFileExtension(item.file);
          // Strict naming convention: [SanitizedUserName]_[8-Char-Alphanumerical-Code]_[Counter].[ext]
          const fileName = `${sanitizedName}_${sessionCode}_${i + 1}.${ext}`;

          uploadStatusText.textContent = `Uploading memory ${i + 1} of ${CONFIG.TOTAL_ITEMS}...`;

          await uploadItemToSupabase(fileName, item.file);

          const overallPct = Math.round(((i + 1) / CONFIG.TOTAL_ITEMS) * 100);
          progressFill.style.width = `${overallPct}%`;
          progressPercentage.textContent = `${overallPct}%`;
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
      showToast(`Upload failed: ${err.message || err}. Please try again.`);
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

  // Initialize in browser
  if (typeof document !== 'undefined') {
    initEventListeners();
  }

  // Export helpers for unit testing if running in Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      sanitizeName,
      generateSessionCode,
      getFileExtension,
      CONFIG
    };
  }

})();
