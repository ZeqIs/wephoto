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
    SUPABASE_URL: 'https://urhyswacrvdesurdjvos.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaHlzd2FjcnZkZXN1cmRqdm9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODcwOTUsImV4cCI6MjEwODI2MzA5NX0.6hKIfXSdebKyBoe4MlIbak2kEM5Xvgf_W6nwlUXOhUg',
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
    lang: (typeof localStorage !== 'undefined' && localStorage.getItem('wephoto_lang')) || 'en',
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

  // Language toggle elements
  const btnLangToggle = getEl('btn-lang-toggle');
  const langPillEn = getEl('lang-pill-en');
  const langPillBm = getEl('lang-pill-bm');
  const headerSubheading = getEl('header-subheading');
  const headerTitle = getEl('header-title');
  const slotInstructionDesc = (typeof document !== 'undefined') ? document.querySelector('#capture-placeholder p') : null;
  const btnPhotoLabel = getEl('btn-photo-label');
  const btnVideoLabel = getEl('btn-video-label');
  const btnGalleryLabel = getEl('btn-gallery-label');
  const cancelRetakeLabel = getEl('cancel-retake-label');
  const reviewSubtitle = getEl('review-subtitle');
  const successHeading = getEl('success-heading');
  const successLoveTitle = getEl('success-love-title');
  const successMessage = getEl('success-message');
  const btnRestartLabel = getEl('btn-restart-label');
  const uploadModalHeading = getEl('upload-modal-heading');

  // --- Multi-language Dictionary ---
  const I18N = {
    en: {
      heroSubheading: 'SHARE THE',
      heroTitle: 'love',
      nameLabel: 'YOUR NAME',
      namePlaceholder: 'e.g. Sarah & John',
      nameHint: 'Let Is & Mimi know who captured these moments!',
      btnStart: 'Start Capturing (Up to 5 Items)',
      stepPrefix: 'Photo / Video',
      stepOf: 'of',
      slotInstructionTitle: (num) => `Capture or Select Item #${num}`,
      slotInstructionDesc: 'Take a new photo/video or choose from your phone library.',
      btnPhoto: 'Photo',
      btnVideo: 'Video',
      btnGallery: 'Choose from Gallery / Files',
      saveAndContinue: (num) => `Save & Continue to #${num}`,
      saveAllSelected: 'Save & Review (All 5 Selected)',
      finishEarly: (num) => `Done! Review & Submit (${num} of 5)`,
      cancelRetake: 'Cancel & Retake',
      reviewTitle: (count) => `Review Your ${count} ${count === 1 ? 'Memory' : 'Memories'}`,
      reviewSubtitle: 'Ready to send to the bride and groom! You can tap retake or remove any item, or add more up to 5.',
      submitAll: (count) => `Send ${count} ${count === 1 ? 'Memory' : 'Memories'} to Is & Mimi`,
      addMore: (count) => `+ Add Another Photo/Video (${count}/${CONFIG.TOTAL_ITEMS})`,
      retake: 'Retake',
      remove: 'Remove',
      successHeading: 'Thank You!',
      successLoveTitle: 'love',
      successMessage: 'Your photos & videos have been safely delivered to <strong>Is & Mimi</strong>. Thank you for making our special day unforgettable!',
      btnRestart: 'Capture Another Set',
      modalHeading: 'Uploading to Memories...',
      modalPreparing: 'Preparing your media...',
      modalUploadingItem: (curr, total) => `Uploading memory ${curr} of ${total}...`,
      modalComplete: 'Complete!',
      toastDiscarded: 'Item discarded. You can retake or choose another.',
      toastRemoved: 'Item removed.',
      toastNoMedia: 'Please capture or select a photo/video first.',
      toastAtLeastOne: 'Please capture or select at least 1 photo or video.',
      toastInvalidFile: 'Please select a valid photo or video file.',
      toastFileTooLarge: (max) => `File is too large. Max size is ${max}MB.`,
      toastMaxItems: 'You already have all 5 items!'
    },
    bm: {
      heroSubheading: 'RAIKAN',
      heroTitle: 'cinta',
      nameLabel: 'NAMA ANDA',
      namePlaceholder: 'cth. Siti & Arif',
      nameHint: 'Kongsi memori indah bersama pasangan pengantin Is & Mimi!',
      btnStart: 'Mula Rakam (Sehingga 5 Gambar/Video)',
      stepPrefix: 'Gambar / Video',
      stepOf: 'daripada',
      slotInstructionTitle: (num) => `Rakam atau Pilih Item #${num}`,
      slotInstructionDesc: 'Ambil gambar/video baharu atau pilih dari galeri telefon anda.',
      btnPhoto: 'Gambar',
      btnVideo: 'Video',
      btnGallery: 'Pilih dari Galeri / Fail',
      saveAndContinue: (num) => `Simpan & Teruskan ke #${num}`,
      saveAllSelected: 'Simpan & Semak (Semua 5 Dipilih)',
      finishEarly: (num) => `Selesai! Semak & Hantar (${num} daripada 5)`,
      cancelRetake: 'Batal & Rakam Semula',
      reviewTitle: (count) => `Semak ${count} Memori Anda`,
      reviewSubtitle: 'Sedia untuk dihantar kepada pengantin! Anda boleh rakam semula, padam, atau tambah lagi sehingga 5.',
      submitAll: (count) => `Hantar ${count} Memori kepada Is & Mimi`,
      addMore: (count) => `+ Tambah Gambar/Video (${count}/${CONFIG.TOTAL_ITEMS})`,
      retake: 'Rakam Semula',
      remove: 'Padam',
      successHeading: 'Terima Kasih!',
      successLoveTitle: 'cinta',
      successMessage: 'Gambar & video anda telah selamat dihantar kepada <strong>Is & Mimi</strong>. Terima kasih kerana memeriahkan hari bahagia kami!',
      btnRestart: 'Rakam Set Baharu',
      modalHeading: 'Sedang Memuat Naik...',
      modalPreparing: 'Menyediakan media anda...',
      modalUploadingItem: (curr, total) => `Memuat naik memori ${curr} daripada ${total}...`,
      modalComplete: 'Selesai!',
      toastDiscarded: 'Item dibatalkan. Sila rakam atau pilih semula.',
      toastRemoved: 'Item telah dipadam.',
      toastNoMedia: 'Sila rakam atau pilih gambar/video terlebih dahulu.',
      toastAtLeastOne: 'Sila rakam sekurang-kurangnya 1 gambar atau video.',
      toastInvalidFile: 'Sila pilih fail gambar atau video yang sah.',
      toastFileTooLarge: (max) => `Saiz fail terlalu besar. Had maksimum ialah ${max}MB.`,
      toastMaxItems: 'Anda telah memilih kesemua 5 item!'
    }
  };

  function t(key, ...args) {
    const lang = state.lang || 'en';
    const dict = I18N[lang] || I18N.en;
    const val = dict[key] || I18N.en[key];
    if (typeof val === 'function') {
      return val(...args);
    }
    return val || '';
  }

  function applyLanguage(lang) {
    state.lang = lang;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('wephoto_lang', lang);
    }

    if (langPillEn && langPillBm) {
      if (lang === 'bm') {
        langPillBm.classList.add('active');
        langPillEn.classList.remove('active');
      } else {
        langPillEn.classList.add('active');
        langPillBm.classList.remove('active');
      }
    }

    // Header title
    if (headerSubheading) headerSubheading.textContent = t('heroSubheading');
    if (headerTitle) headerTitle.textContent = t('heroTitle');

    // Welcome screen
    const nameLabel = document.querySelector('label[for="guest-name-input"]');
    if (nameLabel) nameLabel.textContent = t('nameLabel');
    if (guestNameInput) guestNameInput.placeholder = t('namePlaceholder');
    const nameHint = document.querySelector('.form-hint');
    if (nameHint) nameHint.textContent = t('nameHint');
    const btnStartSpan = btnStart ? btnStart.querySelector('span') : null;
    if (btnStartSpan) btnStartSpan.textContent = t('btnStart');

    // Capture screen static labels
    if (btnPhotoLabel) btnPhotoLabel.textContent = t('btnPhoto');
    if (btnVideoLabel) btnVideoLabel.textContent = t('btnVideo');
    if (btnGalleryLabel) btnGalleryLabel.textContent = t('btnGallery');
    if (cancelRetakeLabel) cancelRetakeLabel.textContent = t('cancelRetake');
    if (slotInstructionDesc) slotInstructionDesc.textContent = t('slotInstructionDesc');

    // Success screen
    if (successHeading) successHeading.textContent = t('successHeading');
    if (successLoveTitle) successLoveTitle.textContent = t('successLoveTitle');
    if (successMessage) successMessage.innerHTML = t('successMessage');
    if (btnRestartLabel) btnRestartLabel.textContent = t('btnRestart');

    // Upload Modal Heading
    if (uploadModalHeading) uploadModalHeading.textContent = t('modalHeading');

    // Update active screen dynamic elements
    updateStepIndicator();
    if (screens.review && screens.review.classList.contains('active')) {
      renderReviewScreen();
    }
  }

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
  const btnFinishEarly = getEl('btn-finish-early');
  const btnCancelRetake = getEl('btn-cancel-retake');
  const confirmBtnLabel = getEl('confirm-btn-label');
  const finishEarlyBtnLabel = getEl('finish-early-btn-label');

  const reviewGrid = getEl('review-grid');
  const reviewTitle = getEl('review-title');
  const btnSubmitAll = getEl('btn-submit-all');
  const submitAllLabel = getEl('submit-all-label');
  const btnAddMoreSlots = getEl('btn-add-more-slots');
  const addMoreLabel = getEl('add-more-label');
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
    const activeCount = state.slots.filter(Boolean).length;
    stepLabel.textContent = `${t('stepPrefix')} ${state.currentSlot + 1} ${t('stepOf')} ${CONFIG.TOTAL_ITEMS}`;
    slotInstructionTitle.textContent = t('slotInstructionTitle', state.currentSlot + 1);
    if (slotInstructionDesc) slotInstructionDesc.textContent = t('slotInstructionDesc');
    
    // Update dots
    const dots = stepDotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].className = 'step-dot';
      if (state.slots[i]) {
        dots[i].classList.add('completed');
      } else if (i === state.currentSlot) {
        dots[i].classList.add('active');
      }
    }

    if (state.currentSlot === CONFIG.TOTAL_ITEMS - 1) {
      confirmBtnLabel.textContent = t('saveAllSelected');
      if (btnFinishEarly) btnFinishEarly.style.display = 'none';
    } else {
      confirmBtnLabel.textContent = t('saveAndContinue', state.currentSlot + 2);
      if (btnFinishEarly) {
        btnFinishEarly.style.display = 'inline-flex';
        const projectedCount = state.activeSlotDraft ? (state.slots[state.currentSlot] ? activeCount : activeCount + 1) : activeCount;
        finishEarlyBtnLabel.textContent = t('finishEarly', projectedCount || 1);
      }
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
      showToast(t('toastFileTooLarge', CONFIG.MAX_FILE_SIZE_MB));
      return;
    }

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|wmv|3gp|webm)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|heif|webp|gif)$/i.test(file.name);

    if (!isVideo && !isImage) {
      showToast(t('toastInvalidFile'));
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

  function getValidSlots() {
    return state.slots.filter(Boolean);
  }

  function renderReviewScreen() {
    reviewGrid.innerHTML = '';
    const committedItems = [];
    
    // Collect non-empty slots with their original index
    state.slots.forEach((item, index) => {
      if (item) {
        committedItems.push({ item, index });
      }
    });

    const totalCount = committedItems.length;
    if (reviewTitle) {
      reviewTitle.textContent = t('reviewTitle', totalCount);
    }
    if (reviewSubtitle) {
      reviewSubtitle.textContent = t('reviewSubtitle');
    }
    if (submitAllLabel) {
      submitAllLabel.textContent = t('submitAll', totalCount);
    }

    if (btnAddMoreSlots) {
      if (totalCount < CONFIG.TOTAL_ITEMS) {
        btnAddMoreSlots.style.display = 'inline-flex';
        addMoreLabel.textContent = t('addMore', totalCount);
      } else {
        btnAddMoreSlots.style.display = 'none';
      }
    }

    committedItems.forEach(({ item, index }, displayIndex) => {
      const card = document.createElement('div');
      card.className = `review-item ${displayIndex === 0 && totalCount > 1 ? 'span-2' : ''}`;

      if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.previewUrl;
        img.className = 'review-thumbnail';
        img.alt = `Memory #${displayIndex + 1}`;
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
      badge.textContent = `#${displayIndex + 1}`;
      card.appendChild(badge);

      const buttonContainer = document.createElement('div');
      buttonContainer.style.position = 'absolute';
      buttonContainer.style.bottom = '8px';
      buttonContainer.style.right = '8px';
      buttonContainer.style.display = 'flex';
      buttonContainer.style.gap = '6px';

      const retakeBtn = document.createElement('button');
      retakeBtn.type = 'button';
      retakeBtn.className = 'review-retake-btn';
      retakeBtn.style.position = 'static';
      retakeBtn.textContent = t('retake');
      retakeBtn.addEventListener('click', () => {
        state.currentSlot = index;
        state.activeSlotDraft = null;
        switchScreen('capture');
        renderSlotUI();
      });
      buttonContainer.appendChild(retakeBtn);

      // Allow deleting/removing an item from the review screen if more than 1 item exists
      if (totalCount > 1) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'review-retake-btn';
        removeBtn.style.position = 'static';
        removeBtn.style.background = 'rgba(253, 237, 237, 0.95)';
        removeBtn.style.color = '#B23B3B';
        removeBtn.textContent = t('remove');
        removeBtn.addEventListener('click', () => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          // Shift remaining items so slots stay compact
          const remaining = state.slots.filter((_, i) => i !== index);
          while (remaining.length < CONFIG.TOTAL_ITEMS) {
            remaining.push(null);
          }
          state.slots = remaining;
          renderReviewScreen();
          showToast(t('toastRemoved'));
        });
        buttonContainer.appendChild(removeBtn);
      }

      card.appendChild(buttonContainer);
      reviewGrid.appendChild(card);
    });
  }

  // --- Upload Handlers ---

  // Demo fallback simulation when testing without live Supabase credentials
  async function simulateUploadProgress(validSlotsCount, statusCallback) {
    for (let i = 1; i <= validSlotsCount; i++) {
      statusCallback(`Demo Mode: Uploading item ${i} of ${validSlotsCount}...`, (i / validSlotsCount) * 90);
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
    const validItems = getValidSlots();
    if (validItems.length === 0) {
      showToast(t('toastAtLeastOne'));
      return;
    }

    uploadingOverlay.classList.add('active');
    if (uploadModalHeading) uploadModalHeading.textContent = t('modalHeading');
    uploadStatusText.textContent = t('modalPreparing');
    progressFill.style.width = '10%';
    progressPercentage.textContent = '10%';

    const sanitizedName = sanitizeName(state.guestName);
    const sessionCode = generateSessionCode(8);
    const totalToUpload = validItems.length;

    try {
      if (isPlaceholderConfig) {
        // Run demo simulation mode if real Supabase keys aren't configured yet
        await simulateUploadProgress(totalToUpload, (msg, pct) => {
          uploadStatusText.textContent = msg;
          progressFill.style.width = `${pct}%`;
          progressPercentage.textContent = `${Math.round(pct)}%`;
        });
      } else {
        // Direct upload to Supabase Storage
        for (let i = 0; i < validItems.length; i++) {
          const item = validItems[i];
          const ext = getFileExtension(item.file);
          // Strict naming convention: [SanitizedUserName]_[8-Char-Alphanumerical-Code]_[Counter].[ext]
          const fileName = `${sanitizedName}_${sessionCode}_${i + 1}.${ext}`;

          uploadStatusText.textContent = t('modalUploadingItem', i + 1, totalToUpload);

          await uploadItemToSupabase(fileName, item.file);

          const overallPct = Math.round(((i + 1) / totalToUpload) * 100);
          progressFill.style.width = `${overallPct}%`;
          progressPercentage.textContent = `${overallPct}%`;
        }
      }

      // Upload Successful
      uploadStatusText.textContent = t('modalComplete');
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
    // Language Toggle Click
    if (btnLangToggle) {
      btnLangToggle.addEventListener('click', () => {
        const nextLang = (state.lang === 'bm') ? 'en' : 'bm';
        applyLanguage(nextLang);
      });
    }

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
      showToast(t('toastDiscarded'));
    });

    // 4. Confirm / Proceed Action
    btnConfirmNext.addEventListener('click', () => {
      if (!state.activeSlotDraft && !state.slots[state.currentSlot]) {
        showToast(t('toastNoMedia'));
        return;
      }

      if (state.activeSlotDraft) {
        state.slots[state.currentSlot] = state.activeSlotDraft;
        state.activeSlotDraft = null;
      }

      if (state.currentSlot < CONFIG.TOTAL_ITEMS - 1) {
        // Find next empty slot or advance by 1
        const nextEmpty = state.slots.findIndex((slot, idx) => idx > state.currentSlot && !slot);
        state.currentSlot = (nextEmpty !== -1) ? nextEmpty : state.currentSlot + 1;
        clearPreview();
        renderSlotUI();
      } else {
        // Reached item 5, go to review
        renderReviewScreen();
        switchScreen('review');
      }
    });

    // 4b. Finish Early Action (submit less than 5 items)
    if (btnFinishEarly) {
      btnFinishEarly.addEventListener('click', () => {
        if (state.activeSlotDraft) {
          state.slots[state.currentSlot] = state.activeSlotDraft;
          state.activeSlotDraft = null;
        }

        const validCount = getValidSlots().length;
        if (validCount === 0) {
          showToast(t('toastAtLeastOne'));
          return;
        }

        renderReviewScreen();
        switchScreen('review');
      });
    }

    // 4c. Add More Slots from Review screen
    if (btnAddMoreSlots) {
      btnAddMoreSlots.addEventListener('click', () => {
        // Find the first empty slot
        const emptyIndex = state.slots.findIndex(slot => !slot);
        if (emptyIndex !== -1) {
          state.currentSlot = emptyIndex;
          state.activeSlotDraft = null;
          switchScreen('capture');
          renderSlotUI();
        } else {
          showToast(t('toastMaxItems'));
        }
      });
    }

    // 5. Submit All
    btnSubmitAll.addEventListener('click', handleSubmitAll);

    // 6. Restart
    btnRestart.addEventListener('click', resetSession);
  }

  // Initialize in browser
  if (typeof document !== 'undefined') {
    initEventListeners();
    applyLanguage(state.lang);
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
