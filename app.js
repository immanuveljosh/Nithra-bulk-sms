/**
 * Bulk SMS - Production Engine
 * Zero Demo / Zero Simulation Data
 * Real Device Contacts, Real Excel File Upload, Real Native Carrier SMS Dispatch
 */

// Global State - Pure Real Data
const state = {
  theme: 'light',
  currentView: 'single', // 'single' or 'showcase'
  activeScreen: 'contacts', // 'home', 'contacts', 'excel-import', 'phone-import', 'create-campaign', 'bulk-sending', 'progress', 'settings'
  selectedSim: 1, // 1 for SIM 1, 2 for SIM 2
  simCards: { sim1: 'No SIM (Absent)', sim2: 'No SIM (Absent)', count: 0, hasSim: false, hasSim1: false, hasSim2: false, selected: 1 },
  permissions: { sms: false, contacts: false, storage: false, phoneState: false, allGranted: false },

  // Real Contacts Database (Persisted to localStorage)
  contacts: [],
  campaigns: [],

  // Real Excel Import Flow State (Zero demo data, populated from actual file)
  excelState: {
    step: 1, // 1: Upload, 2: Mapping & Preview, 3: Progress, 4: Success
    maxUploadLimit: 100, // STRICT: 100 contacts limit per upload
    file: null, // null until file is selected
    rawRows: [],
    columns: [],
    mapping: {
      nameCol: '',
      phoneCol: ''
    },
    counts: {
      total: 0,
      valid: 0,
      duplicates: 0,
      invalid: 0
    },
    duplicateHandling: 'skip', // 'skip', 'update', 'import-all'
    progress: 0,
    progressStatus: '',
    previewTab: 'all', // 'all', 'valid', 'duplicates', 'invalid'
    previewRows: [],
    errorReport: []
  },

  // Phone Contacts Import State (Live from Android device)
  phoneState: {
    permissionGranted: false,
    searchQuery: '',
    selectedIds: [],
    showPreviewSheet: false,
    phoneList: []
  },

  // Contacts Screen Filter
  contactFilter: 'all', // 'all', 'friends', 'customers', 'excel', 'phone'
  contactSearch: '',

  // Campaign Builder Recipient Selection State
  campaignState: {
    name: '',
    message: '',
    selectedSources: {
      excelImported: false,
      phoneImported: false,
      pastedContacts: false,
      allContacts: false,
      customers: false,
      friends: false
    },
    individualSelectedIds: [],
    showRecipientPreview: false
  },

  // Settings State
  settingsState: {
    appearance: 'light', // 'light', 'dark', 'system'
    defaultMessage: '',
    editingDefaultMessage: false,
    notifications: {
      campaignUpdates: true,
      deliveryReports: true
    },
    version: 'v1.0.0'
  },

  // Add / Paste Contact Modal State
  addContactModal: {
    open: false,
    mode: 'single', // 'single' or 'bulk'
    name: '',
    phone: '',
    bulkText: '',
    group: 'General'
  },

  // Campaign Progress State
  progressStats: {
    percent: 0,
    sent: 0,
    pending: 0,
    failed: 0,
    estimatedMinutes: 0,
    status: 'idle',
    timeline: []
  }
};

const app = {
  init() {
    this.loadStoredData();
    this.updatePermissionsStatus();
    this.loadSimCards();
    this.checkPhonePermission();
    this.bindGlobalEvents();
    this.render();
  },

  updatePermissionsStatus() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.getPermissionsStatusJson) {
      try {
        const json = window.AndroidSmsBridge.getPermissionsStatusJson();
        state.permissions = JSON.parse(json);
        state.phoneState.permissionGranted = !!state.permissions.contacts;
      } catch (e) {
        console.error('Failed to parse permissions status:', e);
      }
    }
  },

  requestAllPermissions() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.requestAllPermissions) {
      window.AndroidSmsBridge.requestAllPermissions();
    } else {
      this.showToast('📱 Permissions requested');
    }
  },

  requestSmsPermission() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.requestSmsPermission) {
      window.AndroidSmsBridge.requestSmsPermission();
    }
  },

  requestContactsPermission() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.requestContactsPermission) {
      window.AndroidSmsBridge.requestContactsPermission();
    }
  },

  requestStoragePermission() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.requestStoragePermission) {
      window.AndroidSmsBridge.requestStoragePermission();
    }
  },

  onPermissionsUpdated() {
    this.updatePermissionsStatus();
    this.loadSimCards();
    if (state.permissions.contacts) {
      this.loadDeviceContacts();
    }
    this.render();
  },

  openAppSettings() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.openAppSettings) {
      window.AndroidSmsBridge.openAppSettings();
    } else {
      this.showToast('ℹ️ Open Settings > Apps > Bulk SMS on your phone');
    }
  },

  showNoSimAlert() {
    this.showToast('❌ Cannot send SMS: No active SIM card inserted in your device!');
  },

  renderPermissionBanner() {
    if (!window.AndroidSmsBridge) return '';
    const p = state.permissions;
    if (p.allGranted) return '';

    const missing = [];
    if (!p.sms) missing.push('SMS');
    if (!p.phoneState || p.phoneNumbers === false) missing.push('Phone / SIM');
    if (!p.contacts) missing.push('Contacts');
    if (missing.length === 0) return '';

    return `
      <div class="ui-card" style="padding: 12px 14px; background: rgba(245, 158, 11, 0.1); border: 1.5px solid #F59E0B; border-radius: 14px; margin-bottom: 12px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 20px;">⚠️</div>
            <div>
              <div style="font-size: 12px; font-weight: 800; color: #D97706;">Permissions Required</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">Grant <b>${missing.join(', ')}</b> for SMS & contacts</div>
            </div>
          </div>
          <button class="btn-primary" style="width: auto; padding: 6px 14px; font-size: 11px; background: #F59E0B;" onclick="app.requestAllPermissions()">
            Grant
          </button>
        </div>
        ${!p.sms ? `
          <div style="margin-top: 10px; padding: 10px 12px; background: rgba(239, 68, 68, 0.08); border-radius: 10px; border: 1px solid rgba(239, 68, 68, 0.25);">
            <div style="font-size: 11px; font-weight: 800; color: #DC2626; margin-bottom: 4px;">⚠️ Is "Allow" greyed out on Android 13/14/15?</div>
            <div style="font-size: 10px; color: var(--text-muted); line-height: 1.4;">
              Android restricts sideloaded APKs by default. To unlock:<br>
              1. Tap <b>Open App Info</b> below.<br>
              2. Tap the <b>3 dots (⋮)</b> in top right.<br>
              3. Select <b>Allow restricted settings</b> (enter PIN/fingerprint).<br>
              4. Tap <b>Permissions → SMS → Allow</b>.
            </div>
            <button class="btn-primary" style="margin-top: 8px; width: 100%; font-size: 11px; padding: 6px 10px; background: #DC2626;" onclick="app.openAppSettings()">
              Open App Info (Tap 3 Dots to Unlock)
            </button>
          </div>
        ` : ''}
      </div>
    `;
  },

  loadStoredData() {
    try {
      const savedContacts = localStorage.getItem('bm_contacts');
      if (savedContacts) {
        state.contacts = JSON.parse(savedContacts);
      } else {
        state.contacts = [];
      }

      const savedCampaigns = localStorage.getItem('bm_campaigns');
      if (savedCampaigns) {
        state.campaigns = JSON.parse(savedCampaigns);
      } else {
        state.campaigns = [];
      }

      const savedSim = localStorage.getItem('selected_sim_slot');
      if (savedSim) {
        state.selectedSim = parseInt(savedSim, 10) || 1;
      }
    } catch (e) {
      console.error('Error loading stored data:', e);
    }
  },

  saveContacts() {
    try {
      localStorage.setItem('bm_contacts', JSON.stringify(state.contacts));
    } catch (e) { }
  },

  saveCampaigns() {
    try {
      localStorage.setItem('bm_campaigns', JSON.stringify(state.campaigns));
    } catch (e) { }
  },

  setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
      themeIcon.innerHTML = theme === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  },

  setViewMode(mode) {
    state.currentView = mode;
    document.getElementById('btn-view-single')?.classList.toggle('active', mode === 'single');
    document.getElementById('btn-view-showcase')?.classList.toggle('active', mode === 'showcase');
    this.render();
  },

  switchScreen(screenName) {
    state.activeScreen = screenName;
    document.querySelectorAll('.nav-pill').forEach(p => p.classList.remove('active'));
    document.querySelector(`.nav-pill[data-screen="${screenName}"]`)?.classList.add('active');
    this.render();
  },

  bindGlobalEvents() {
    document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
      this.setTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    document.getElementById('btn-view-single')?.addEventListener('click', () => this.setViewMode('single'));
    document.getElementById('btn-view-showcase')?.addEventListener('click', () => this.setViewMode('showcase'));

    document.querySelectorAll('.nav-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const targetScreen = pill.getAttribute('data-screen');
        if (targetScreen) this.switchScreen(targetScreen);
      });
    });
  },

  getDailySentCount(slot) {
    const target = (slot === 1 || slot === 2) ? slot : (state.selectedSim || 1);
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.getDailySentCountForSim) {
      return window.AndroidSmsBridge.getDailySentCountForSim(target);
    }
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    return parseInt(localStorage.getItem(`sms_sent_sim${target}_` + todayKey) || '0', 10);
  },

  getDailyLimit(slot) {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.getDailyLimit) {
      return window.AndroidSmsBridge.getDailyLimit();
    }
    return 100;
  },

  getRemainingSms(slot) {
    const target = (slot === 1 || slot === 2) ? slot : (state.selectedSim || 1);
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.getRemainingSmsForSim) {
      return window.AndroidSmsBridge.getRemainingSmsForSim(target);
    }
    return Math.max(0, this.getDailyLimit(target) - this.getDailySentCount(target));
  },

  incrementDailySentCount(slot) {
    const target = (slot === 1 || slot === 2) ? slot : (state.selectedSim || 1);
    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const current = parseInt(localStorage.getItem(`sms_sent_sim${target}_` + todayKey) || '0', 10);
    localStorage.setItem(`sms_sent_sim${target}_` + todayKey, String(current + 1));
    const total = parseInt(localStorage.getItem('sms_sent_' + todayKey) || '0', 10);
    localStorage.setItem('sms_sent_' + todayKey, String(total + 1));
  },

  // Calculate real recipients based purely on user selections
  calculateCampaignRecipients() {
    const set = new Map();

    // Excel imported
    if (state.campaignState.selectedSources.excelImported) {
      state.contacts.filter(c => c.source === 'excel' || c.group === 'Excel Imports').forEach(c => set.set(c.phone.replace(/[^0-9+]/g, ''), c));
    }
    // Phone imported
    if (state.campaignState.selectedSources.phoneImported) {
      state.contacts.filter(c => c.source === 'phone' || c.group === 'Phone Imports').forEach(c => set.set(c.phone.replace(/[^0-9+]/g, ''), c));
    }
    // Pasted contacts
    if (state.campaignState.selectedSources.pastedContacts) {
      state.contacts.filter(c => c.source === 'bulk-paste' || c.group === 'Pasted Contacts').forEach(c => set.set(c.phone.replace(/[^0-9+]/g, ''), c));
    }
    // All contacts
    if (state.campaignState.selectedSources.allContacts) {
      state.contacts.forEach(c => set.set(c.phone.replace(/[^0-9+]/g, ''), c));
    }
    // Customers
    if (state.campaignState.selectedSources.customers) {
      state.contacts.filter(c => c.group === 'Customers').forEach(c => set.set(c.phone.replace(/[^0-9+]/g, ''), c));
    }
    // Friends
    if (state.campaignState.selectedSources.friends) {
      state.contacts.filter(c => c.group === 'Friends').forEach(c => set.set(c.phone.replace(/[^0-9+]/g, ''), c));
    }
    // Individual selection
    state.campaignState.individualSelectedIds.forEach(id => {
      const c = state.contacts.find(x => x.id === id);
      if (c) set.set(c.phone.replace(/[^0-9+]/g, ''), c);
    });

    const list = Array.from(set.values());
    return {
      uniqueRecipients: list.length,
      totalSelectedSources: list.length,
      resolvedList: list
    };
  },

  getAggregatedRecipients() {
    return this.calculateCampaignRecipients().resolvedList;
  },

  // Download Sample Excel Template
  downloadSampleTemplate() {
    const rawCsv = "Full Name,Mobile Number,Group / Tag\n"
      + "Sample Customer 1,9876543210,VIP Customers\n"
      + "Sample Customer 2,9876543211,Retailers\n";

    if (window.AndroidSmsBridge && window.AndroidSmsBridge.saveCsvFile) {
      window.AndroidSmsBridge.saveCsvFile('contacts_template.csv', rawCsv);
      return;
    }

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + rawCsv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "contacts_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('📥 Sample template downloaded');
  },

  showToast(message) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  render() {
    const container = document.getElementById('main-workspace');
    if (!container) return;

    if (state.currentView === 'single') {
      container.innerHTML = `
        <div class="screen-card-wrapper">
          <div class="screen-title-tag">
            <span class="dot"></span> ${this.getScreenTitle(state.activeScreen)}
          </div>
          <div class="device-frame">
            <div class="camera-notch"></div>
            ${this.renderStatusBar()}
            ${this.renderScreenByTag(state.activeScreen)}
            ${this.renderBottomNav(state.activeScreen)}
            ${this.renderAddContactModal()}
          </div>
        </div>
      `;
    } else {
      const screensToShow = [
        { id: 'contacts', title: '1. Contacts Screen (Import Hub)' },
        { id: 'excel-import', title: '2. Excel File & Mapping UI' },
        { id: 'excel-progress', title: '3. Excel Import Progress' },
        { id: 'excel-success', title: '4. Excel Success & Error Report' },
        { id: 'phone-permission', title: '5. Phone Contacts Permission' },
        { id: 'phone-import', title: '6. Phone Contacts Multi-Select' },
        { id: 'create-campaign', title: '7. Campaign Recipient Engine' },
        { id: 'bulk-sending', title: '8. Bulk Sending Review' }
      ];

      container.innerHTML = `
        <div class="showcase-grid">
          ${screensToShow.map(s => `
            <div class="screen-card-wrapper">
              <div class="screen-title-tag">
                <span class="dot"></span> ${s.title}
              </div>
              <div class="device-frame">
                <div class="camera-notch"></div>
                ${this.renderStatusBar()}
                ${this.renderScreenByTag(s.id)}
                ${this.renderBottomNav(s.id)}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    this.attachDynamicListeners();
  },

  getScreenTitle(tag) {
    const map = {
      'home': 'Home Dashboard',
      'contacts': 'Contacts Management',
      'excel-import': 'Excel Contacts Import Flow',
      'phone-import': 'Mobile Saved Contacts Import Flow',
      'create-campaign': 'Create Campaign - Recipient Selection',
      'bulk-sending': 'Bulk Sending & Review',
      'progress': 'Campaign Progress & Dispatch',
      'settings': 'Settings & Active SIM Configuration'
    };
    return map[tag] || 'Bulk SMS';
  },

  renderStatusBar() {
    return `
      <div class="status-bar">
        <span>9:41</span>
        <div class="status-icons">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
          <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>
        </div>
      </div>
    `;
  },

  renderScreenByTag(tag) {
    if (tag === 'home') return this.renderHomeScreen();
    if (tag === 'contacts') return this.renderContactsScreen();
    if (tag === 'create-campaign' || tag === 'campaigns') return this.renderCreateCampaignScreen();
    if (tag === 'bulk-sending') return this.renderBulkSendingScreen();
    if (tag === 'progress') return this.renderProgressScreen();
    if (tag === 'settings') return this.renderSettingsScreen();
    if (tag === 'excel-import') return this.renderExcelImportScreen();
    if (tag === 'phone-permission') return this.renderPhonePermissionScreen();
    if (tag === 'phone-import') return this.renderPhoneContactsScreen();
    return this.renderContactsScreen();
  },

  // 1. Contacts Screen
  renderContactsScreen() {
    const filtered = state.contacts.filter(c => {
      const query = (state.contactSearch || '').toLowerCase();
      const rawCleanQuery = query.replace(/[^0-9]/g, '');
      const rawCleanContact = c.phone.replace(/[^0-9]/g, '');
      const matchesSearch = c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        (rawCleanQuery.length >= 3 && rawCleanContact.includes(rawCleanQuery));
      if (!matchesSearch) return false;
      if (state.contactFilter === 'friends') return c.group === 'Friends';
      if (state.contactFilter === 'customers') return c.group === 'Customers';
      if (state.contactFilter === 'pasted') return c.source === 'bulk-paste' || c.group === 'Pasted Contacts';
      if (state.contactFilter === 'excel') return c.source === 'excel' || c.group === 'Excel Imports';
      if (state.contactFilter === 'phone') return c.source === 'phone' || c.group === 'Phone Imports';
      return true;
    });

    const selectedCount = state.contacts.filter(c => c.selected).length;

    return `
      <div class="screen-header">
        <div class="header-top-row">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="header-action-btn" onclick="app.switchScreen('home')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <div class="header-title-text">Contacts</div>
              <div class="header-subtitle">${state.contacts.length} Total Contacts</div>
            </div>
          </div>
          <button class="header-action-btn" onclick="app.showAddContactModal('single')" title="Add / Paste Contact">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="search-box" style="margin-top: 8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Search contacts..." value="${state.contactSearch}" oninput="app.handleContactSearch(this.value)" />
          ${state.contactSearch ? `<span style="cursor:pointer;" onclick="app.handleContactSearch('')">✕</span>` : ''}
        </div>
      </div>

      <div class="screen-content">
        ${this.renderPermissionBanner()}

        <!-- Import Action Bar -->
        <div class="ui-card ui-card-highlight" style="padding: 12px; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">Import Contacts</span>
            <span style="font-size: 11px; color: var(--text-muted);">Max 100 per import</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
            <button class="btn-secondary" style="background: var(--bg-card); padding: 8px 6px; border-radius: 12px; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;" onclick="app.switchScreen('excel-import')">
              <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 22px; height: 22px; border-radius: 6px; background: #10B98122; color: #10B981; display:flex; align-items:center; justify-content:center;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <span style="font-size: 11px; font-weight: 700;">Excel</span>
              </div>
              <span style="font-size: 9px; color: var(--text-muted);">.xlsx / .xls</span>
            </button>

            <button class="btn-secondary" style="background: var(--bg-card); padding: 8px 6px; border-radius: 12px; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;" onclick="app.switchScreen('phone-import')">
              <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 22px; height: 22px; border-radius: 6px; background: #6366F122; color: #6366F1; display:flex; align-items:center; justify-content:center;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <span style="font-size: 11px; font-weight: 700;">Phonebook</span>
              </div>
              <span style="font-size: 9px; color: var(--text-muted);">From Device</span>
            </button>

            <button class="btn-secondary" style="background: var(--bg-card); padding: 8px 6px; border-radius: 12px; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left;" onclick="app.showAddContactModal('bulk')">
              <div style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 22px; height: 22px; border-radius: 6px; background: #EC489922; color: #EC4899; display:flex; align-items:center; justify-content:center;">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                </div>
                <span style="font-size: 11px; font-weight: 700;">Paste</span>
              </div>
              <span style="font-size: 9px; color: #10B981; font-weight: 700;">+91 Auto-Add</span>
            </button>
          </div>
        </div>

        <!-- Filter Chips (Visible, never partially hidden) -->
        <div class="chips-container" style="flex-shrink: 0; min-height: 48px; height: 48px; margin: 4px 0 6px 0;">
          <button class="chip ${state.contactFilter === 'all' ? 'active' : ''}" onclick="app.setContactFilter('all')">
            All (${state.contacts.length})
          </button>
          <button class="chip ${state.contactFilter === 'pasted' ? 'active' : ''}" onclick="app.setContactFilter('pasted')">
            Pasted (${state.contacts.filter(c => c.source === 'bulk-paste' || c.group === 'Pasted Contacts').length})
          </button>
          <button class="chip ${state.contactFilter === 'excel' ? 'active' : ''}" onclick="app.setContactFilter('excel')">
            Excel (${state.contacts.filter(c => c.source === 'excel' || c.group === 'Excel Imports').length})
          </button>
          <button class="chip ${state.contactFilter === 'phone' ? 'active' : ''}" onclick="app.setContactFilter('phone')">
            Phone (${state.contacts.filter(c => c.source === 'phone' || c.group === 'Phone Imports').length})
          </button>
          <button class="chip ${state.contactFilter === 'customers' ? 'active' : ''}" onclick="app.setContactFilter('customers')">
            Customers (${state.contacts.filter(c => c.group === 'Customers').length})
          </button>
          <button class="chip ${state.contactFilter === 'friends' ? 'active' : ''}" onclick="app.setContactFilter('friends')">
            Friends (${state.contacts.filter(c => c.group === 'Friends').length})
          </button>
        </div>

        <!-- Contacts Content Area -->
        ${state.contacts.length === 0 ? `
          <div style="text-align: center; padding: 22px 16px; margin: 4px 0; background: var(--bg-card); border-radius: 16px; border: 1px dashed var(--border-color); flex-shrink: 0;">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(99, 102, 241, 0.1); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">No Contacts Yet</div>
            <div style="font-size: 11px; color: var(--text-muted); max-width: 250px; margin: 0 auto 12px auto; line-height: 1.5;">Paste comma-separated numbers, import from device phonebook, or upload an Excel sheet (up to 100 contacts).</div>
            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
              <button class="btn-primary" style="width: auto; padding: 8px 14px; font-size: 11px; background: #EC4899;" onclick="app.showAddContactModal('bulk')">📋 Paste Numbers</button>
              <button class="btn-primary" style="width: auto; padding: 8px 14px; font-size: 11px;" onclick="app.switchScreen('excel-import')">Import Excel</button>
              <button class="btn-secondary" style="width: auto; padding: 8px 14px; font-size: 11px;" onclick="app.switchScreen('phone-import')">Phone Contacts</button>
            </div>
          </div>
        ` : `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 4px; margin-bottom: 6px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted);">Showing ${filtered.length} Contacts</span>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn-text" style="font-size: 11px;" onclick="app.toggleSelectAllContacts()">
                ${filtered.every(c => c.selected) ? 'Deselect All' : 'Select All'}
              </button>
              <button class="btn-text" style="font-size: 11px; color: #EF4444; font-weight: 700;" onclick="app.confirmClearAllContacts()">
                🗑️ Clear All
              </button>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 95px;">
            ${filtered.map(contact => `
              <div class="ui-card contact-item-row" style="padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; border-radius: 14px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div class="avatar avatar-${contact.avatarColor || 'blue'}" style="width: 38px; height: 38px; font-size: 13px;">
                    ${contact.initials || 'C'}
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${contact.name}</span>
                      <span class="badge-pill badge-source" style="font-size: 9px; padding: 1px 6px;">${contact.group || 'General'}</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted);">${contact.phone}</div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                  <button class="btn-text" style="color: #EF4444; padding: 4px 6px; font-size: 12px; font-weight: 700;" onclick="event.stopPropagation(); app.deleteSingleContact(${contact.id})" title="Clear this number">
                    ✕
                  </button>
                  <div class="custom-checkbox ${contact.selected ? 'checked' : ''}" onclick="app.toggleContactSelection(${contact.id})">
                    ${contact.selected ? `
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    ` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Floating Campaign Action Bar -->
      ${selectedCount > 0 ? `
        <div class="floating-bottom-bar" style="bottom: 74px;">
          <div class="info-col">
            <div class="count">${selectedCount} Selected</div>
            <div class="sub">Direct recipient list</div>
          </div>
          <button class="btn-action" onclick="app.startCampaignWithSelected()">
            <span>Create Campaign</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      ` : ''}
    `;
  },

  // 2. Real Excel Import Screen
  renderExcelImportScreen() {
    const step = state.excelState.step;

    return `
      <div class="screen-header">
        <div class="header-top-row">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="header-action-btn" onclick="app.switchScreen('contacts')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <div class="header-title-text">Import from Excel</div>
              <div class="header-subtitle">Step ${step} of 4 • .xlsx / .xls / .csv</div>
            </div>
          </div>
          <button class="header-action-btn" onclick="app.downloadSampleTemplate()" title="Download Sample Excel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>

        <!-- Step Indicator -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 0 8px;">
          ${['File', 'Mapping', 'Progress', 'Finish'].map((label, idx) => `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: ${idx + 1 === step ? 1 : 0.6};">
              <div style="width: 22px; height: 22px; border-radius: 50%; background: ${idx + 1 <= step ? '#FFFFFF' : 'rgba(255,255,255,0.2)'}; color: ${idx + 1 <= step ? 'var(--primary)' : '#FFFFFF'}; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">
                ${idx + 1 < step ? '✓' : idx + 1}
              </div>
              <span style="font-size: 10px; font-weight: 600;">${label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="screen-content" style="padding-bottom: 95px;">
        ${step === 1 ? this.renderExcelStep1() : ''}
        ${step === 2 ? this.renderExcelStep2() : ''}
        ${step === 3 ? this.renderExcelStep3() : ''}
        ${step === 4 ? this.renderExcelStep4() : ''}
      </div>
    `;
  },

  renderExcelStep1() {
    return `
      <!-- Strict Upload Limit Badge Card -->
      <div class="ui-card" style="border-left: 4px solid var(--primary); background: rgba(99, 102, 241, 0.08); display: flex; align-items: center; justify-content: space-between; padding: 12px 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 34px; height: 34px; border-radius: 8px; background: var(--primary); color: #fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px;">
            100
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">Upload Limit: 100 Contacts</div>
            <div style="font-size: 11px; color: var(--text-muted);">Maximum 100 contacts per upload file</div>
          </div>
        </div>
        <span class="badge badge-success" style="font-size: 10px; font-weight: 700;">STRICT CAP</span>
      </div>

      <!-- Hidden Native File Input -->
      <input type="file" id="real-excel-file-input" accept=".xlsx, .xls, .csv" style="display:none;" onchange="app.handleRealExcelUpload(event)">

      <!-- Drag-Free Mobile File Picker Dropzone -->
      <div class="upload-dropzone" onclick="document.getElementById('real-excel-file-input').click()">
        <div class="upload-icon-circle">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/></svg>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">Tap to Select Excel File</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Choose from device storage (.xlsx, .xls, .csv)</div>
        </div>
        <div style="display:flex; gap:6px;">
          <span style="font-size: 11px; background: rgba(99, 102, 241, 0.1); color: var(--primary); padding: 4px 10px; border-radius: 999px; font-weight: 600;">
            ⚡ Limit: 100 Contacts Max
          </span>
          <span style="font-size: 11px; background: rgba(16, 185, 129, 0.1); color: #10B981; padding: 4px 10px; border-radius: 999px; font-weight: 600;">
            Local Parsing
          </span>
        </div>
      </div>

      <!-- Download Sample Template Card -->
      <div class="ui-card" style="display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #10B98115; color: #10B981; display:flex; align-items:center; justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700;">Sample Template</div>
            <div style="font-size: 11px; color: var(--text-muted);">Standardized columns: Name, Mobile Number</div>
          </div>
        </div>
        <button class="btn-secondary" style="padding: 6px 12px; font-size: 11px;" onclick="app.downloadSampleTemplate()">
          Download
        </button>
      </div>

      <!-- Format Guidelines -->
      <div class="ui-card" style="background: var(--bg-card-secondary); border: none;">
        <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">Format Guidelines:</div>
        <ul style="font-size: 11px; color: var(--text-muted); line-height: 1.6; padding-left: 18px;">
          <li>First row must contain column header names</li>
          <li>Mobile numbers must have 10 digits (with or without +91)</li>
          <li>Files with > 100 contacts are automatically capped to the first 100 rows</li>
        </ul>
      </div>

      <!-- Action Button -->
      <div style="margin-top: auto; padding-top: 16px;">
        <button class="btn-primary" onclick="document.getElementById('real-excel-file-input').click()">
          <span>Select File from Device</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    `;
  },

  handleRealExcelUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (typeof XLSX === 'undefined') {
      this.showToast('❌ Excel library loading... please retry in a moment');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        let rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
          this.showToast('⚠️ Selected spreadsheet is empty');
          return;
        }

        let wasCapped = false;
        if (rows.length > 100) {
          wasCapped = true;
          rows = rows.slice(0, 100);
        }

        const keys = Object.keys(rows[0] || {});
        state.excelState.columns = keys;

        const findCol = (terms) => keys.find(k => terms.some(t => k.toLowerCase().includes(t))) || keys[0] || '';
        state.excelState.mapping.nameCol = findCol(['name', 'full name', 'contact']);
        state.excelState.mapping.phoneCol = findCol(['phone', 'mobile', 'cell', 'number', 'whatsapp']);


        state.excelState.rawRows = rows;
        state.excelState.file = {
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          totalRecords: rows.length
        };

        this.processExcelRows();
        state.excelState.step = 2;
        this.render();

        if (wasCapped) {
          this.showToast(`⚠️ Exceeded 100 limit. Capped to first 100 contacts.`);
        } else {
          this.showToast(`📄 "${file.name}" loaded (${rows.length} contacts)`);
        }
      } catch (err) {
        console.error(err);
        this.showToast('❌ Error parsing file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  },

  processExcelRows() {
    const { rawRows, mapping } = state.excelState;
    const nameKey = mapping.nameCol;
    const phoneKey = mapping.phoneCol;


    const previewRows = [];
    const errorReport = [];
    const seenInFile = new Set();
    const existingPhones = new Set(state.contacts.map(c => c.phone.replace(/[^0-9+]/g, '')));

    let validCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    rawRows.forEach((r, idx) => {
      const name = String(r[nameKey] || '').trim();
      const rawPhone = String(r[phoneKey] || '').trim();

      const cleanPhone = this.formatIndianPhone(rawPhone);

      let status = 'valid';
      let note = 'Valid contact';

      if (!name || !cleanPhone || cleanPhone.length < 8) {
        status = 'invalid';
        note = !cleanPhone ? 'Missing phone number' : 'Incomplete phone format';
        invalidCount++;
        errorReport.push({ row: idx + 2, name: name || 'Unnamed', phone: rawPhone || 'Empty', error: note });
      } else if (seenInFile.has(cleanPhone) || existingPhones.has(cleanPhone)) {
        status = 'duplicate';
        note = seenInFile.has(cleanPhone) ? 'Duplicate in spreadsheet' : 'Already in contacts';
        duplicateCount++;
      } else {
        seenInFile.add(cleanPhone);
        validCount++;
      }

      previewRows.push({
        id: idx + 1,
        name: name || 'Unnamed',
        phone: cleanPhone,

        status: status,
        note: note
      });
    });

    state.excelState.previewRows = previewRows;
    state.excelState.errorReport = errorReport;
    state.excelState.counts = {
      total: rawRows.length,
      valid: validCount,
      duplicates: duplicateCount,
      invalid: invalidCount
    };
  },

  onColumnMappingChanged(field, colName) {
    state.excelState.mapping[field] = colName;
    this.processExcelRows();
    this.render();
  },

  renderExcelStep2() {
    const { file, mapping, counts, duplicateHandling, previewTab, previewRows, columns } = state.excelState;
    if (!file) {
      return `
        <div style="text-align:center; padding: 40px 16px;">
          <p style="color:var(--text-muted); font-size:13px;">No file loaded.</p>
          <button class="btn-primary" style="margin-top:12px;" onclick="app.resetExcelFile()">Select File</button>
        </div>
      `;
    }

    const filteredRows = previewRows.filter(r => previewTab === 'all' ? true : r.status === previewTab);

    return `
      <!-- Selected File Card Preview -->
      <div class="ui-card" style="padding: 12px; border-left: 4px solid var(--primary); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 34px; height: 34px; border-radius: 8px; background: #10B98122; color: #10B981; display:flex; align-items:center; justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">${file.name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${file.size} • ${counts.total} Rows (Max Limit: 100)</div>
          </div>
        </div>
        <button class="btn-text" style="font-size: 11px;" onclick="app.resetExcelFile()">Change</button>
      </div>

      <!-- Column Mapping Section -->
      <div class="ui-card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">Excel Column Mapping</span>
          <span class="badge-pill badge-valid">Auto-Matched</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- Name Column -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Name *</span>
            <select onchange="app.onColumnMappingChanged('nameCol', this.value)" style="background: var(--bg-card-secondary); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px; font-size: 12px; outline: none;">
              ${columns.map(c => `<option value="${c}" ${mapping.nameCol === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>

          <!-- Mobile Column -->
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Mobile Number *</span>
            <select onchange="app.onColumnMappingChanged('phoneCol', this.value)" style="background: var(--bg-card-secondary); color: var(--text-main); border: 1px solid var(--border-color); border-radius: 8px; padding: 6px 10px; font-size: 12px; outline: none;">
              ${columns.map(c => `<option value="${c}" ${mapping.phoneCol === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>


        </div>
      </div>

      <!-- Verification & Detected Counts Grid -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--text-main);">Upload Verification</span>
        <span class="badge badge-success" style="font-size: 10px; font-weight: 700;">Max 100 Limit Enforced</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
        <div class="ui-card" style="padding: 8px 4px; text-align: center;">
          <div style="font-size: 15px; font-weight: 800; color: var(--text-main);">${counts.total}</div>
          <div style="font-size: 9px; color: var(--text-muted); text-transform: uppercase;">Total</div>
        </div>
        <div class="ui-card" style="padding: 8px 4px; text-align: center; border-color: rgba(16,185,129,0.3); background: var(--success-bg);">
          <div style="font-size: 15px; font-weight: 800; color: var(--success);">${counts.valid}</div>
          <div style="font-size: 9px; color: var(--success); text-transform: uppercase; font-weight:700;">Valid</div>
        </div>
        <div class="ui-card" style="padding: 8px 4px; text-align: center; border-color: rgba(245,158,11,0.3); background: var(--warning-bg);">
          <div style="font-size: 15px; font-weight: 800; color: var(--warning);">${counts.duplicates}</div>
          <div style="font-size: 9px; color: var(--warning); text-transform: uppercase; font-weight:700;">Duplicate</div>
        </div>
        <div class="ui-card" style="padding: 8px 4px; text-align: center; border-color: rgba(239,68,68,0.3); background: var(--danger-bg);">
          <div style="font-size: 15px; font-weight: 800; color: var(--danger);">${counts.invalid}</div>
          <div style="font-size: 9px; color: var(--danger); text-transform: uppercase; font-weight:700;">Invalid</div>
        </div>
      </div>

      <!-- Duplicate Handling Options -->
      <div class="ui-card">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
          Duplicate Handling Option
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="radio-card ${duplicateHandling === 'skip' ? 'selected' : ''}" onclick="app.setDuplicateHandling('skip')">
            <div class="radio-circle"></div>
            <div>
              <div style="font-size: 12px; font-weight: 700;">Skip duplicates (Recommended)</div>
              <div style="font-size: 10px; color: var(--text-muted);">Only import new unique numbers; ignore duplicates</div>
            </div>
          </div>

          <div class="radio-card ${duplicateHandling === 'update' ? 'selected' : ''}" onclick="app.setDuplicateHandling('update')">
            <div class="radio-circle"></div>
            <div>
              <div style="font-size: 12px; font-weight: 700;">Update existing contacts</div>
              <div style="font-size: 10px; color: var(--text-muted);">Update contact names for matching numbers</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Preview Table -->
      <div class="ui-card" style="padding: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 12px; font-weight: 700;">Data Preview (${filteredRows.length})</span>
          <div style="display: flex; gap: 4px;">
            <button class="badge-pill ${previewTab === 'all' ? 'badge-valid' : ''}" style="cursor:pointer;" onclick="app.setExcelPreviewTab('all')">All</button>
            <button class="badge-pill ${previewTab === 'valid' ? 'badge-valid' : ''}" style="cursor:pointer;" onclick="app.setExcelPreviewTab('valid')">Valid</button>
            <button class="badge-pill ${previewTab === 'duplicates' ? 'badge-duplicate' : ''}" style="cursor:pointer;" onclick="app.setExcelPreviewTab('duplicates')">Dupes</button>
            <button class="badge-pill ${previewTab === 'invalid' ? 'badge-invalid' : ''}" style="cursor:pointer;" onclick="app.setExcelPreviewTab('invalid')">Errors</button>
          </div>
        </div>

        <div style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
          ${filteredRows.length === 0 ? '<div style="font-size:11px; color:var(--text-muted); text-align:center; padding:12px;">No rows in this filter</div>' : ''}
          ${filteredRows.slice(0, 10).map(r => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: var(--bg-card-secondary); border-radius: 8px; font-size: 11px;">
              <div>
                <div style="font-weight: 700; color: var(--text-main);">${r.name}</div>
                <div style="color: var(--text-muted); font-size: 10px;">${r.phone}</div>
              </div>
              <div>
                ${r.status === 'valid' ? `<span class="badge-pill badge-valid">✓ Valid</span>` : ''}
                ${r.status === 'duplicate' ? `<span class="badge-pill badge-duplicate">⚠️ Duplicate</span>` : ''}
                ${r.status === 'invalid' ? `<span class="badge-pill badge-invalid">✕ ${r.note}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Confirm CTA -->
      <div style="padding-top: 8px;">
        <button class="btn-primary" onclick="app.startExcelImportProgress()">
          <span>Confirm & Import Contacts</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    `;
  },

  startExcelImportProgress() {
    const { previewRows, duplicateHandling } = state.excelState;
    if (!previewRows || previewRows.length === 0) {
      this.showToast('⚠️ No contacts to import');
      return;
    }

    state.excelState.step = 3;
    state.excelState.progress = 0;
    this.render();

    let toImport = [];
    if (duplicateHandling === 'skip') {
      toImport = previewRows.filter(r => r.status === 'valid');
    } else {
      toImport = previewRows.filter(r => r.status !== 'invalid');
    }

    toImport = toImport.slice(0, 100);

    const statuses = [
      { pct: 25, msg: 'Validating rows against 100 upload limit...' },
      { pct: 50, msg: `Applying duplicate rules [${duplicateHandling}]...` },
      { pct: 75, msg: `Writing ${toImport.length} contacts to storage...` },
      { pct: 100, msg: 'Import completed successfully!' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < statuses.length) {
        state.excelState.progress = statuses[currentStep].pct;
        state.excelState.progressStatus = statuses[currentStep].msg;
        currentStep++;
        this.render();
      } else {
        clearInterval(interval);
        toImport.forEach(item => {
          const initials = (item.name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'C';
          const colors = ['blue', 'purple', 'teal', 'emerald', 'amber', 'pink', 'indigo'];
          const avatarColor = colors[Math.floor(Math.random() * colors.length)];
          state.contacts.push({
            id: Date.now() + Math.random(),
            name: item.name,
            phone: this.formatIndianPhone(item.phone),

            group: 'Excel Imports',
            source: 'excel',
            avatarColor: avatarColor,
            initials: initials,
            selected: true
          });
        });
        this.saveContacts();
        setTimeout(() => {
          state.excelState.step = 4;
          this.render();
        }, 300);
      }
    }, 350);
  },

  renderExcelStep3() {
    const { progress, progressStatus } = state.excelState;

    return `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 16px; text-align: center; gap: 20px;">
        <div style="position: relative; width: 140px; height: 140px;">
          <svg width="140" height="140" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-color)" stroke-width="8" />
            <circle class="progress-ring-circle" cx="50" cy="50" r="42" fill="none" stroke="url(#purpleGrad)" stroke-width="8" stroke-dasharray="264" stroke-dashoffset="${264 - (264 * progress) / 100}" stroke-linecap="round" />
            <defs>
              <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#4F46E5" />
                <stop offset="100%" stop-color="#7C3AED" />
              </linearGradient>
            </defs>
          </svg>
          <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <span style="font-size: 26px; font-weight: 800; color: var(--primary);">${progress}%</span>
            <span style="font-size: 10px; color: var(--text-muted);">PROCESSED</span>
          </div>
        </div>

        <div>
          <div style="font-size: 16px; font-weight: 700; color: var(--text-main);">Importing Contacts...</div>
          <div style="font-size: 12px; color: var(--primary); margin-top: 4px; font-weight: 600;">${progressStatus}</div>
        </div>
      </div>
    `;
  },

  renderExcelStep4() {
    const { counts } = state.excelState;

    return `
      <div style="display: flex; flex-direction: column; gap: 14px; padding-top: 10px;">
        <div style="text-align: center; padding: 16px 0;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #10B981, #059669); color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 10px 24px rgba(16,185,129,0.3); margin-bottom: 12px;">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style="font-size: 18px; font-weight: 800; color: var(--text-main);">${counts.valid} Contacts Added!</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Contacts are now categorized under <b>Excel Imports</b></div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div class="ui-card" style="padding: 10px; text-align: center; border-color: rgba(16,185,129,0.3); background: var(--success-bg);">
            <div style="font-size: 18px; font-weight: 800; color: var(--success);">${counts.valid}</div>
            <div style="font-size: 10px; color: var(--success); font-weight: 700;">Added</div>
          </div>
          <div class="ui-card" style="padding: 10px; text-align: center; border-color: rgba(245,158,11,0.3); background: var(--warning-bg);">
            <div style="font-size: 18px; font-weight: 800; color: var(--warning);">${counts.duplicates}</div>
            <div style="font-size: 10px; color: var(--warning); font-weight: 700;">Skipped</div>
          </div>
          <div class="ui-card" style="padding: 10px; text-align: center; border-color: rgba(239,68,68,0.3); background: var(--danger-bg);">
            <div style="font-size: 18px; font-weight: 800; color: var(--danger);">${counts.invalid}</div>
            <div style="font-size: 10px; color: var(--danger); font-weight: 700;">Invalid</div>
          </div>
        </div>

        <div style="padding-top: 14px; display: flex; flex-direction: column; gap: 8px;">
          <button class="btn-primary" onclick="app.switchScreen('contacts')">
            <span>View Contacts</span>
          </button>
          <button class="btn-secondary" onclick="app.resetExcelFile()">
            <span>Import Another File</span>
          </button>
        </div>
      </div>
    `;
  },

  resetExcelFile() {
    state.excelState.step = 1;
    state.excelState.file = null;
    state.excelState.rawRows = [];
    state.excelState.previewRows = [];
    state.excelState.counts = { total: 0, valid: 0, duplicates: 0, invalid: 0 };
    this.render();
  },

  setDuplicateHandling(option) {
    state.excelState.duplicateHandling = option;
    this.processExcelRows();
    this.render();
  },

  setExcelPreviewTab(tab) {
    state.excelState.previewTab = tab;
    this.render();
  },

  // 3. Real Phone Contacts Screen
  checkPhonePermission() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.hasContactsPermission) {
      state.phoneState.permissionGranted = window.AndroidSmsBridge.hasContactsPermission();
      if (state.phoneState.permissionGranted) {
        this.loadDeviceContacts();
      }
    }
  },

  grantPhonePermission() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.requestContactsPermission) {
      window.AndroidSmsBridge.requestContactsPermission();
      setTimeout(() => {
        if (window.AndroidSmsBridge.hasContactsPermission && window.AndroidSmsBridge.hasContactsPermission()) {
          this.onContactsPermissionGranted();
        }
      }, 1200);
    } else {
      state.phoneState.permissionGranted = true;
      this.render();
    }
  },

  onContactsPermissionGranted() {
    state.phoneState.permissionGranted = true;
    this.loadDeviceContacts();
    this.showToast('✅ Contacts permission granted!');
    this.render();
  },

  loadDeviceContacts() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.getDeviceContactsJson) {
      try {
        const rawJson = window.AndroidSmsBridge.getDeviceContactsJson();
        const list = JSON.parse(rawJson || '[]');
        const existingPhones = new Set(state.contacts.map(c => c.phone.replace(/[^0-9+]/g, '')));
        const colors = ['blue', 'pink', 'purple', 'amber', 'teal', 'emerald', 'indigo'];

        state.phoneState.phoneList = list.map((item, idx) => {
          const initials = (item.name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'P';
          const cleanPhone = this.formatIndianPhone(item.phone || '');
          return {
            id: item.id || idx + 1,
            name: item.name || cleanPhone,
            phone: cleanPhone,
            initials: initials,
            avatarColor: colors[idx % colors.length],
            isDuplicate: existingPhones.has(cleanPhone)
          };
        });
        this.render();
      } catch (e) {
        console.error('Failed to load device contacts:', e);
      }
    }
  },

  renderPhoneContactsScreen() {
    const { permissionGranted, searchQuery, selectedIds, phoneList } = state.phoneState;

    if (!permissionGranted) {
      return this.renderPhonePermissionScreen();
    }

    const filtered = phoneList.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery));
    const allSelected = filtered.length > 0 && selectedIds.length >= Math.min(filtered.length, 100);

    return `
      <div class="screen-header">
        <div class="header-top-row">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="header-action-btn" onclick="app.switchScreen('contacts')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <div class="header-title-text">Phone Contacts</div>
              <div class="header-subtitle">${phoneList.length} Contacts on Device</div>
            </div>
          </div>
          <button class="header-action-btn" onclick="app.loadDeviceContacts()" title="Refresh Contacts">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>

        <div class="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" placeholder="Search phone contacts..." value="${searchQuery}" oninput="app.handlePhoneSearch(this.value)" />
          ${searchQuery ? `<span style="cursor:pointer;" onclick="app.handlePhoneSearch('')">✕</span>` : ''}
        </div>
      </div>

      <div class="screen-content" style="padding-bottom: 95px;">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 2px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge-pill badge-valid" style="font-size: 12px; padding: 4px 10px;">
              ${selectedIds.length} / 100 Selected
            </span>
            <span style="font-size: 11px; color: var(--text-muted);">Max Limit: 100</span>
          </div>

          <div style="display: flex; gap: 6px;">
            <button class="btn-text" style="font-size: 11px;" onclick="app.togglePhoneSelectAll()">
              ${allSelected ? 'Deselect All' : 'Select Top 100'}
            </button>
          </div>
        </div>

        ${phoneList.length === 0 ? `
          <div style="text-align: center; padding: 40px 16px; color: var(--text-muted); font-size: 12px;">
            No contacts found in device address book.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 95px;">
            ${filtered.map(contact => {
      const isSelected = selectedIds.includes(contact.id);
      return `
                <div class="ui-card" style="padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; border-radius: 14px;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="avatar avatar-${contact.avatarColor}" style="width: 38px; height: 38px; font-size: 13px;">
                      ${contact.initials}
                    </div>
                    <div>
                      <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${contact.name}</span>
                        ${contact.isDuplicate ? `<span class="badge-pill badge-duplicate" style="font-size: 9px; padding: 1px 6px;">In App</span>` : ''}
                      </div>
                      <div style="font-size: 11px; color: var(--text-muted);">${contact.phone}</div>
                    </div>
                  </div>

                  <div class="custom-checkbox ${isSelected ? 'checked' : ''}" onclick="app.togglePhoneContactItem(${contact.id})">
                    ${isSelected ? `
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    ` : ''}
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `}
      </div>

      ${selectedIds.length > 0 ? `
        <div class="floating-bottom-bar" style="bottom: 74px;">
          <div class="info-col">
            <div class="count">${selectedIds.length} / 100 Selected</div>
            <div class="sub">Upload limit: 100 contacts max</div>
          </div>
          <button class="btn-action" onclick="app.importSelectedPhoneContacts()">
            <span>Import Selected</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      ` : ''}
    `;
  },

  renderPhonePermissionScreen() {
    return `
      <div class="screen-header">
        <div class="header-top-row">
          <button class="header-action-btn" onclick="app.switchScreen('contacts')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="header-title-text">Permission Required</div>
          <div style="width:36px;"></div>
        </div>
      </div>

      <div class="screen-content" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding: 36px 20px;">
        <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(99, 102, 241, 0.12); color: var(--primary); display:flex; align-items:center; justify-content:center; margin-bottom: 20px;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>

        <div style="font-size: 18px; font-weight: 800; color: var(--text-main); margin-bottom: 8px;">
          Access Phone Contacts
        </div>
        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.6; max-width: 280px; margin-bottom: 24px;">
          Bulk SMS needs permission to read your saved phone contacts so you can select and import them directly into campaigns.
        </div>

        <button class="btn-primary" onclick="app.grantPhonePermission()" style="margin-bottom: 12px;">
          <span>Allow Contacts Access</span>
        </button>
        <button class="btn-secondary" onclick="app.switchScreen('contacts')">
          <span>Not Now</span>
        </button>
      </div>
    `;
  },

  handlePhoneSearch(query) {
    state.phoneState.searchQuery = query;
    this.render();
  },

  togglePhoneContactItem(id) {
    const idx = state.phoneState.selectedIds.indexOf(id);
    if (idx > -1) {
      state.phoneState.selectedIds.splice(idx, 1);
    } else {
      if (state.phoneState.selectedIds.length >= 100) {
        this.showToast('⚠️ Contact upload limit reached: Maximum 100 contacts allowed!');
        return;
      }
      state.phoneState.selectedIds.push(id);
    }
    this.render();
  },

  togglePhoneSelectAll() {
    const list = state.phoneState.phoneList;
    const maxAllowed = 100;
    if (state.phoneState.selectedIds.length >= Math.min(list.length, maxAllowed)) {
      state.phoneState.selectedIds = [];
    } else {
      state.phoneState.selectedIds = list.slice(0, maxAllowed).map(p => p.id);
      if (list.length > maxAllowed) {
        this.showToast('ℹ️ Selected first 100 contacts (Maximum upload limit: 100)');
      }
    }
    this.render();
  },

  importSelectedPhoneContacts() {
    const selected = state.phoneState.phoneList.filter(p => state.phoneState.selectedIds.includes(p.id));
    if (selected.length === 0) {
      this.showToast('⚠️ Please select at least one contact');
      return;
    }
    if (selected.length > 100) {
      this.showToast('⚠️ Contact upload limit is 100 contacts per import.');
      return;
    }

    selected.forEach(item => {
      state.contacts.push({
        id: Date.now() + Math.random(),
        name: item.name,
        phone: item.phone,

        group: 'Phone Imports',
        source: 'phone',
        avatarColor: item.avatarColor,
        initials: item.initials,
        selected: true
      });
    });

    this.saveContacts();
    state.phoneState.selectedIds = [];
    this.showToast(`🎉 Imported ${selected.length} contacts into 'Phone Imports'!`);
    this.switchScreen('contacts');
    state.contactFilter = 'phone';
  },

  // 4. Create Campaign Screen
  renderCreateCampaignScreen() {
    const { uniqueRecipients } = this.calculateCampaignRecipients();
    const currentChars = this.countGraphemes(state.campaignState.message);

    const excelCount = state.contacts.filter(c => c.source === 'excel' || c.group === 'Excel Imports').length;
    const phoneCount = state.contacts.filter(c => c.source === 'phone' || c.group === 'Phone Imports').length;
    const pastedCount = state.contacts.filter(c => c.source === 'bulk-paste' || c.group === 'Pasted Contacts').length;
    const custCount = state.contacts.filter(c => c.group === 'Customers').length;
    const friendsCount = state.contacts.filter(c => c.group === 'Friends').length;

    return `
      <div class="screen-header">
        <div class="header-top-row">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="header-action-btn" onclick="app.switchScreen('contacts')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div>
              <div class="header-title-text">Create Campaign</div>
              <div class="header-subtitle">Audience & Message Setup</div>
            </div>
          </div>
          <button class="header-action-btn" onclick="app.switchScreen('bulk-sending')" title="Review Campaign">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <div class="screen-content" style="padding-bottom: 80px;">
        <!-- Campaign Name -->
        <div class="ui-card" style="padding: 12px; display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Campaign Name *</label>
          <input type="text" placeholder="e.g. Festival Greetings" value="${state.campaignState.name}" oninput="state.campaignState.name = this.value" style="width: 100%; border: none; outline: none; background: transparent; font-size: 14px; font-weight: 700; color: var(--text-main);" />
        </div>

        <!-- Message Box with 55 Character Counter (Shows corner count for any pasted text) -->
        <div class="ui-card" style="padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Message *</label>
            <span style="font-size: 10px; color: var(--text-muted);">Max 55 Characters</span>
          </div>

          <div id="message-container" style="position: relative; border: 1.5px solid ${currentChars > 55 ? '#EF4444' : 'var(--border-color)'}; border-radius: 12px; background: var(--bg-card-secondary); padding: 10px 12px 30px 12px; transition: border-color 0.2s;">
            <textarea id="campaign-message-input" oninput="app.handleMessageInput(this)" onpaste="app.handleMessagePaste(event, this)" onkeyup="app.handleMessageInput(this)" onchange="app.handleMessageInput(this)" style="width: 100%; height: 75px; border: none; outline: none; background: transparent; resize: none; font-size: 13px; color: var(--text-main); font-family: inherit; line-height: 1.4;" placeholder="Type or paste SMS message (Max 55 characters in all languages)...">${state.campaignState.message}</textarea>
            
            <!-- Corner Floating Character Counter Badge -->
            <div id="corner-char-badge" style="position: absolute; bottom: 6px; right: 8px; display: flex; align-items: center; gap: 6px; z-index: 2;">
              <span id="corner-trim-btn" style="display: ${currentChars > 55 ? 'inline-block' : 'none'}; font-size: 10px; font-weight: 700; color: #DC2626; background: rgba(239, 68, 68, 0.12); padding: 2px 6px; border-radius: 6px; cursor: pointer;" onclick="app.trimMessageTo55()">Trim to 55</span>
              <span id="campaign-char-counter" style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 8px; background: ${currentChars > 55 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.1)'}; color: ${currentChars > 55 ? '#DC2626' : 'var(--primary)'}; transition: all 0.2s;">
                ${currentChars} / 55
              </span>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: flex-start; padding-top: 6px; border-top: 1px solid var(--border-light);">
            <div style="display: flex; gap: 6px;">
              <span class="badge-pill badge-source" style="cursor: pointer;" onclick="app.insertPlaceholder('{name}')">{name}</span>
              <span class="badge-pill badge-source" style="cursor: pointer;" onclick="app.insertPlaceholder('{phone}')">{phone}</span>
            </div>
          </div>
        </div>

        <!-- Recipient Source Selection -->
        <div class="ui-card" style="padding: 14px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">Choose Recipient Sources</span>
            <span style="font-size: 11px; color: var(--text-muted);">${uniqueRecipients} selected</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Excel Imported -->
            <div class="radio-card ${state.campaignState.selectedSources.excelImported ? 'selected' : ''}" onclick="app.toggleCampaignSource('excelImported')">
              <div class="custom-checkbox ${state.campaignState.selectedSources.excelImported ? 'checked' : ''}">
                ${state.campaignState.selectedSources.excelImported ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
              </div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-size: 12px; font-weight: 700;">📊 Excel Imported Contacts</span>
                  <span class="badge-pill badge-valid" style="font-size: 10px;">${excelCount} Contacts</span>
                </div>
              </div>
            </div>

            <!-- Phone Imported -->
            <div class="radio-card ${state.campaignState.selectedSources.phoneImported ? 'selected' : ''}" onclick="app.toggleCampaignSource('phoneImported')">
              <div class="custom-checkbox ${state.campaignState.selectedSources.phoneImported ? 'checked' : ''}">
                ${state.campaignState.selectedSources.phoneImported ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
              </div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-size: 12px; font-weight: 700;">📱 Mobile Saved Contacts</span>
                  <span class="badge-pill badge-valid" style="font-size: 10px;">${phoneCount} Contacts</span>
                </div>
              </div>
            </div>

            <!-- Pasted Contacts -->
            <div class="radio-card ${state.campaignState.selectedSources.pastedContacts ? 'selected' : ''}" onclick="app.toggleCampaignSource('pastedContacts')">
              <div class="custom-checkbox ${state.campaignState.selectedSources.pastedContacts ? 'checked' : ''}">
                ${state.campaignState.selectedSources.pastedContacts ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
              </div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-size: 12px; font-weight: 700;">📋 Pasted Mobile Numbers</span>
                  <span class="badge-pill badge-valid" style="font-size: 10px;">${pastedCount} Contacts</span>
                </div>
              </div>
            </div>

            <!-- All Contacts -->
            <div class="radio-card ${state.campaignState.selectedSources.allContacts ? 'selected' : ''}" onclick="app.toggleCampaignSource('allContacts')">
              <div class="custom-checkbox ${state.campaignState.selectedSources.allContacts ? 'checked' : ''}">
                ${state.campaignState.selectedSources.allContacts ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
              </div>
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="font-size: 12px; font-weight: 700;">👥 All Contacts</span>
                  <span class="badge-pill badge-valid" style="font-size: 10px;">${state.contacts.length} Contacts</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Total Recipient Summary -->
          <div style="padding: 10px 12px; background: rgba(99,102,241,0.06); border: 1px dashed var(--primary); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Total Resolved Recipients</div>
              <div style="font-size: 16px; font-weight: 800; color: var(--primary);">${uniqueRecipients} Unique Numbers</div>
            </div>
            <span class="badge badge-success" style="font-size: 10px;">Deduplicated</span>
          </div>
        </div>

        <!-- Next CTA -->
        <div style="padding-top: 10px;">
          <button class="btn-primary" onclick="app.switchScreen('bulk-sending')">
            <span>Next: Review (${uniqueRecipients})</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    `;
  },

  countGraphemes(text) {
    if (!text) return 0;
    try {
      return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(String(text))].length;
    } catch (e) {
      return text.length;
    }
  },

  handleMessageInput(textarea) {
    if (!textarea) return;
    const val = textarea.value;
    state.campaignState.message = val;
    const c = this.countGraphemes(val);
    const max = 55;

    const counter = document.getElementById('campaign-char-counter');
    const container = document.getElementById('message-container');
    const trimBtn = document.getElementById('corner-trim-btn');
    const previewCounter = document.getElementById('preview-char-counter');
    const previewBubble = document.getElementById('campaign-preview-bubble');

    if (counter) {
      if (c > max) {
        counter.textContent = `${c} / ${max} (${c - max} over)`;
        counter.style.background = 'rgba(239, 68, 68, 0.15)';
        counter.style.color = '#DC2626';
      } else {
        counter.textContent = `${c} / ${max}`;
        counter.style.background = 'rgba(99, 102, 241, 0.1)';
        counter.style.color = 'var(--primary)';
      }
    }

    if (container) {
      container.style.borderColor = c > max ? '#EF4444' : 'var(--border-color)';
    }

    if (trimBtn) {
      trimBtn.style.display = c > max ? 'inline-block' : 'none';
    }

    if (previewCounter) {
      previewCounter.textContent = `${c} / ${max} Chars`;
      previewCounter.style.color = c > max ? '#EF4444' : 'var(--text-muted)';
    }

    if (previewBubble) {
      const rendered = val
        .replace(/\{name\}/gi, 'Ramesh Kumar')
        .replace(/\{phone\}/gi, '+91 98765 43210');
      previewBubble.textContent = rendered || 'Type a message to see the preview...';
    }
  },

  trimMessageTo55() {
    const val = state.campaignState.message || '';
    try {
      const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(val)];
      const trimmed = segments.slice(0, 55).map(s => s.segment).join('');
      state.campaignState.message = trimmed;
      const textarea = document.getElementById('campaign-message-input');
      if (textarea) {
        textarea.value = trimmed;
        this.handleMessageInput(textarea);
      } else {
        this.render();
      }
      this.showToast('✂️ Trimmed message to exactly 55 characters!');
    } catch (e) {
      state.campaignState.message = val.slice(0, 55);
      this.render();
    }
  },

  insertPlaceholder(tag) {
    const textarea = document.getElementById('campaign-message-input');
    if (textarea) {
      const start = textarea.selectionStart || textarea.value.length;
      const end = textarea.selectionEnd || textarea.value.length;
      const val = textarea.value;
      textarea.value = val.substring(0, start) + tag + val.substring(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      this.handleMessageInput(textarea);
    } else {
      state.campaignState.message = (state.campaignState.message || '') + tag;
      this.render();
    }
  },

  toggleCampaignSource(sourceKey) {
    state.campaignState.selectedSources[sourceKey] = !state.campaignState.selectedSources[sourceKey];
    this.render();
  },

  // 5. Bulk Sending & Review Screen
  renderBulkSendingScreen() {
    const { uniqueRecipients } = this.calculateCampaignRecipients();
    const currentChars = this.countGraphemes(state.campaignState.message);
    const hasActiveSim = !window.AndroidSmsBridge || (window.AndroidSmsBridge.hasActiveSim ? window.AndroidSmsBridge.hasActiveSim() : (state.simCards.hasSim || state.simCards.count > 0));

    return `
      <div class="screen-header">
        <div class="header-top-row">
          <div style="display:flex; align-items:center; gap:12px;">
            <button class="header-action-btn" onclick="app.switchScreen('create-campaign')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div class="header-title-text">Bulk Sending</div>
          </div>
          <div style="width: 36px;"></div>
        </div>
      </div>

      <div class="screen-content" style="padding-bottom: 95px;">
        ${this.renderPermissionBanner()}

        ${!hasActiveSim ? `
          <!-- No SIM Card Detected Alert -->
          <div class="ui-card" style="padding: 14px 16px; background: rgba(239, 68, 68, 0.08); border: 1.5px solid #EF4444; border-radius: 14px; margin-bottom: 12px;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <div style="font-size: 24px; line-height: 1;">🚫</div>
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #EF4444;">No Physical SIM Card Detected</div>
                <div style="font-size: 11px; color: var(--text-main); margin-top: 3px; line-height: 1.4;">
                  SIM 1: <b>${state.simCards.sim1}</b><br>
                  SIM 2: <b>${state.simCards.sim2}</b>
                </div>
                <div style="font-size: 10px; color: #DC2626; font-weight: 600; margin-top: 5px;">
                  SMS dispatch is strictly blocked until an active SIM card is inserted. Simulation is completely disabled.
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Recipient Count Banner -->
        <div class="ui-card" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #EEF2FF, #E0E7FF); color: var(--primary); display:flex; align-items:center; justify-content:center;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <div style="font-size: 20px; font-weight: 800; color: var(--text-main);">${uniqueRecipients}</div>
              <div style="font-size: 11px; color: var(--text-muted);">Verified Recipients</div>
            </div>
          </div>
          <span class="badge-pill badge-valid">Deduplicated</span>
        </div>

        <!-- Message Preview Card -->
        <div class="ui-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Message Preview</span>
            <span style="font-size: 10px; font-weight: 700; color: ${currentChars > 55 ? '#EF4444' : 'var(--text-muted)'};">${currentChars} / 55 Chars</span>
          </div>
          <div style="font-size: 13px; color: var(--text-main); line-height: 1.5; padding: 10px; background: var(--bg-card-secondary); border-radius: 10px;">
            ${state.campaignState.message || '<i style="color:var(--text-muted);">No message entered yet</i>'}
          </div>
        </div>

        <!-- Choose Sending SIM Card -->
        <div class="ui-card" style="padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.5px;">Choose Sending SIM</span>
            <span class="badge-pill ${hasActiveSim ? 'badge-source' : 'badge-invalid'}" style="font-size: 10px;">${hasActiveSim ? 'Dual SIM' : 'No SIM'}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="radio-card ${state.selectedSim === 1 ? 'selected' : ''}" style="margin: 0; padding: 10px; cursor: pointer;" onclick="app.setSimCard(1)">
              <div class="radio-circle"></div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                  <span style="font-size: 12px; font-weight: 700;">SIM 1</span>
                  ${state.simCards.hasSim1 ? '<span style="font-size: 9px; color: var(--success); font-weight: 700;">• Active</span>' : '<span style="font-size: 9px; color: #EF4444; font-weight: 700;">• Absent</span>'}
                </div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${state.simCards.sim1Number ? state.simCards.sim1Number : (state.simCards.sim1 || 'No SIM')}</div>
                <div style="font-size: 10px; font-weight: 700; color: ${this.getRemainingSms(1) > 0 ? '#10B981' : '#EF4444'}; margin-top: 2px;">${this.getDailySentCount(1)}/100 (${this.getRemainingSms(1)} left)</div>
              </div>
            </div>

            <div class="radio-card ${state.selectedSim === 2 ? 'selected' : ''}" style="margin: 0; padding: 10px; cursor: pointer;" onclick="app.setSimCard(2)">
              <div class="radio-circle"></div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                  <span style="font-size: 12px; font-weight: 700;">SIM 2</span>
                  ${state.simCards.hasSim2 ? '<span style="font-size: 9px; color: var(--success); font-weight: 700;">• Active</span>' : '<span style="font-size: 9px; color: #EF4444; font-weight: 700;">• Absent</span>'}
                </div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${state.simCards.sim2Number ? state.simCards.sim2Number : (state.simCards.sim2 || 'No SIM')}</div>
                <div style="font-size: 10px; font-weight: 700; color: ${this.getRemainingSms(2) > 0 ? '#10B981' : '#EF4444'}; margin-top: 2px;">${this.getDailySentCount(2)}/100 (${this.getRemainingSms(2)} left)</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Daily Quota Info -->
        <div class="ui-card" style="padding: 10px 14px; background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.3); display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 11px; color: var(--text-main);">
            <b>Active SIM ${state.selectedSim} Quota:</b> ${this.getDailySentCount()} / 100 Sent Today (${this.getRemainingSms()} Left)
          </div>
          <span style="font-size: 11px; font-weight: 700; color: #10B981;">100 / SIM Limit</span>
        </div>

        <!-- Start CTA -->
        <div style="padding-top: 14px;">
          ${hasActiveSim ? `
            <button class="btn-primary" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%);" onclick="app.startCampaign()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Start Campaign (${uniqueRecipients} SMS)</span>
            </button>
          ` : `
            <button class="btn-primary" style="background: #9CA3AF; box-shadow: none;" onclick="app.showNoSimAlert()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <span>Cannot Send (No SIM Inserted)</span>
            </button>
          `}
        </div>
      </div>
    `;
  },

  startCampaign() {
    const rawMsg = state.campaignState.message || '';
    const countChars = (text) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(String(text || ''))].length;
    const chars = countChars(rawMsg);

    // 1. STRICT PHYSICAL SIM CHECK - ZERO SIMULATION
    if (window.AndroidSmsBridge) {
      if (!window.AndroidSmsBridge.hasActiveSim || !window.AndroidSmsBridge.hasActiveSim()) {
        this.showToast('❌ Cannot send SMS: No active SIM card inserted in your device!');
        return;
      }
      if (!window.AndroidSmsBridge.hasSmsPermission || !window.AndroidSmsBridge.hasSmsPermission()) {
        window.AndroidSmsBridge.requestSmsPermission();
        this.showToast('📱 SMS Permission required to send mobile SMS.');
        return;
      }
    } else {
      this.showToast('❌ Physical SIM required: Cannot send carrier SMS without Android device.');
      return;
    }

    // 2. RULE 2: STRICT 55 CHARACTERS
    if (chars === 0) {
      this.showToast('⚠️ Please enter a message to send.');
      return;
    }
    if (chars > 55) {
      this.showToast(`❌ Message cannot exceed 55 characters (current: ${chars}/55)`);
      return;
    }

    // 3. RULE 1: STRICT 100 SMS PER DAY PER SIM / MOBILE NUMBER
    const currentSlot = state.selectedSim || 1;
    let usedToday = this.getDailySentCount(currentSlot);
    let limit = this.getDailyLimit(currentSlot);

    const remaining = Math.max(0, limit - usedToday);
    if (remaining <= 0) {
      const altSlot = currentSlot === 1 ? 2 : 1;
      const altRemaining = this.getRemainingSms(altSlot);
      if (altRemaining > 0 && state.simCards['hasSim' + altSlot]) {
        this.showToast(`⚠️ SIM ${currentSlot} limit reached (100/100)! Switch to SIM ${altSlot} (has ${altRemaining} SMS left).`);
      } else {
        this.showToast(`⚠️ SIM ${currentSlot} daily limit reached (${limit}/${limit}). Resets at 12:00 AM IST.`);
      }
      return;
    }

    const recipients = this.getAggregatedRecipients();
    if (!recipients.length) {
      this.showToast('⚠️ No recipients selected. Please choose contacts first.');
      return;
    }

    // Validate rendered message for every recipient
    const exceeding = [];
    for (const r of recipients) {
      const rendered = rawMsg.replace(/\{name\}/gi, r.name || '').replace(/\{phone\}/gi, r.phone || '');
      const rChars = countChars(rendered);
      if (rChars > 55) {
        exceeding.push({ name: r.name, phone: r.phone, chars: rChars });
      }
    }
    if (exceeding.length > 0) {
      this.showToast(`❌ Exceeds 55 characters for ${exceeding[0].name} (${exceeding[0].chars}/55)`);
      return;
    }

    const willSendToday = Math.min(recipients.length, remaining);
    const willWait = recipients.length - willSendToday;

    if (willWait > 0) {
      const altSlot = currentSlot === 1 ? 2 : 1;
      const altRemaining = this.getRemainingSms(altSlot);
      const hint = (altRemaining > 0 && state.simCards['hasSim' + altSlot]) ? ` Switch to SIM ${altSlot} for remaining!` : '';
      this.showToast(`ℹ️ ${willSendToday} SMS sending on SIM ${currentSlot}. ${willWait} will wait (100 SMS/SIM limit).${hint}`);
    } else {
      this.showToast(`🚀 Sending ${willSendToday} normal SMS via SIM ${currentSlot}...`);
    }

    state.progressStats = {
      percent: 0,
      sent: 0,
      pending: recipients.length,
      failed: 0,
      status: 'running',
      timeline: [
        { label: 'Campaign Started', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'active' }
      ]
    };

    state.activeScreen = 'progress';
    this.render();

    let currentIndex = 0;
    let sentCount = 0;
    let failedCount = 0;

    const sendLoop = () => {
      if (currentIndex >= willSendToday) {
        state.progressStats.status = 'completed';
        state.progressStats.percent = 100;
        state.campaigns.push({
          id: Date.now(),
          name: state.campaignState.name || 'Quick Campaign',
          sentCount: sentCount,
          total: recipients.length,
          date: new Date().toLocaleDateString()
        });
        this.saveCampaigns();
        this.render();
        if (failedCount === 0) {
          this.showToast(`🎉 All ${sentCount} SMS dispatched successfully via carrier!`);
        } else {
          this.showToast(`⚠️ Dispatched ${sentCount} SMS (${failedCount} failed via carrier).`);
        }
        return;
      }

      const contact = recipients[currentIndex];
      const finalMsg = rawMsg.replace(/\{name\}/gi, contact.name || '').replace(/\{phone\}/gi, contact.phone || '');

      let success = false;
      if (window.AndroidSmsBridge) {
        success = window.AndroidSmsBridge.sendNativeSmsWithSlot
          ? window.AndroidSmsBridge.sendNativeSmsWithSlot(contact.phone, finalMsg, state.selectedSim)
          : window.AndroidSmsBridge.sendNativeSms(contact.phone, finalMsg);
      } else {
        success = true;
        this.incrementDailySentCount(state.selectedSim);
      }

      if (success) {
        sentCount++;
      } else {
        failedCount++;
      }
      currentIndex++;

      state.progressStats.sent = sentCount;
      state.progressStats.failed = failedCount;
      state.progressStats.pending = Math.max(0, recipients.length - currentIndex);
      state.progressStats.percent = Math.round((currentIndex / recipients.length) * 100);
      this.render();

      if (currentIndex < willSendToday) {
        setTimeout(sendLoop, 1500); // 1.5s pacing
      } else {
        state.progressStats.status = 'completed';
        state.progressStats.percent = 100;
        state.campaigns.push({
          id: Date.now(),
          name: state.campaignState.name || 'Quick Campaign',
          sentCount: sentCount,
          total: recipients.length,
          date: new Date().toLocaleDateString()
        });
        this.saveCampaigns();
        this.render();
        if (failedCount === 0) {
          this.showToast(`🎉 All ${sentCount} SMS dispatched successfully via carrier!`);
        } else {
          this.showToast(`⚠️ Dispatched ${sentCount} SMS (${failedCount} failed via carrier).`);
        }
      }
    };

    setTimeout(sendLoop, 600);
  },

  // 6. Real Progress Screen
  renderProgressScreen() {
    const p = state.progressStats;

    return `
      <div class="screen-header">
        <div class="header-top-row">
          <button class="header-action-btn" onclick="app.switchScreen('contacts')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="header-title-text">Campaign Progress</div>
          <div style="width:36px;"></div>
        </div>
      </div>

      <div class="screen-content" style="text-align: center;">
        <div style="margin: 20px auto; width: 140px; height: 140px; border-radius: 50%; border: 10px solid #10B981; display:flex; align-items:center; justify-content:center; flex-direction:column;">
          <span style="font-size: 26px; font-weight: 800; color: var(--text-main);">${p.percent}%</span>
          <span style="font-size: 10px; color: var(--text-muted); font-weight:700;">${p.status.toUpperCase()}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 20px 0;">
          <div class="ui-card" style="padding: 10px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #10B981;">${p.sent}</div>
            <div style="font-size: 10px; color: var(--text-muted);">Sent</div>
          </div>
          <div class="ui-card" style="padding: 10px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #F59E0B;">${p.pending}</div>
            <div style="font-size: 10px; color: var(--text-muted);">Pending</div>
          </div>
          <div class="ui-card" style="padding: 10px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #EF4444;">${p.failed}</div>
            <div style="font-size: 10px; color: var(--text-muted);">Failed</div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 16px;">
          <button class="btn-primary" onclick="app.switchScreen('contacts')">
            <span>Back to Contacts</span>
          </button>
          <button class="btn-secondary" onclick="app.switchScreen('home')">
            <span>Go to Home Dashboard</span>
          </button>
        </div>
      </div>
    `;
  },

  // 7. Home Screen (Clean Real Data)
  renderHomeScreen() {
    const sentSim1 = this.getDailySentCount(1);
    const sentSim2 = this.getDailySentCount(2);
    const sentTotal = sentSim1 + sentSim2;
    const remSim1 = this.getRemainingSms(1);
    const remSim2 = this.getRemainingSms(2);
    const activeSlot = state.selectedSim || 1;

    return `
      <div class="screen-header">
        <div class="header-top-row">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="header-title-text">Bulk SMS</div>
          </div>
          <div style="display:flex; gap:6px;">
            <span class="badge badge-success" style="font-size:10px;">Carrier Normal SMS</span>
          </div>
        </div>
      </div>

      <div class="screen-content">
        ${this.renderPermissionBanner()}

        ${!state.simCards.hasSim ? `
          <div class="ui-card" style="padding: 10px 14px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">🚫</span>
              <span style="font-size: 11px; font-weight: 700; color: #EF4444;">No Physical SIM Inserted</span>
            </div>
            <button class="btn-text" style="font-size: 10px; color: #EF4444;" onclick="app.switchScreen('settings')">View SIMs</button>
          </div>
        ` : ''}

        <!-- Hero Card -->
        <div style="background: linear-gradient(135deg, #4338CA 0%, #6366F1 50%, #7C3AED 100%); border-radius: 20px; padding: 18px; color: #FFFFFF; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 25px rgba(79,70,229,0.3);">
          <div>
            <div style="font-size: 16px; font-weight: 800;">Welcome!</div>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 4px; max-width: 180px;">Send bulk normal SMS directly via your mobile carrier SIM.</div>
          </div>
          <div style="font-size: 38px;">📢</div>
        </div>

        <!-- Real Metrics Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div class="ui-card" style="padding: 12px; text-align: center; cursor: pointer;" onclick="app.switchScreen('contacts')">
            <div style="font-size: 18px; font-weight: 800; color: var(--primary);">${state.contacts.length}</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Contacts</div>
          </div>
          <div class="ui-card" style="padding: 12px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #F59E0B;">${state.campaigns.length}</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Campaigns</div>
          </div>
          <div class="ui-card" style="padding: 12px; text-align: center;">
            <div style="font-size: 18px; font-weight: 800; color: #10B981;">${sentTotal}</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Sent Today</div>
          </div>
        </div>

        <!-- Quota Status (Per SIM Limit: 100 per SIM) -->
        <div class="ui-card" style="padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 12px; font-weight: 700; color: var(--text-main);">Daily Quota (100 / SIM)</div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">Limit based on SIM / Mobile Number</div>
            </div>
            <span class="badge badge-primary" style="font-size: 10px;">Resets 12 AM IST</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 2px;">
            <div style="padding: 8px 10px; background: var(--bg-card-secondary); border-radius: 10px; border: 1.5px solid ${activeSlot === 1 ? 'var(--primary)' : 'var(--border-light)'}; cursor: pointer;" onclick="app.setSimCard(1)">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700;">SIM 1 ${activeSlot === 1 ? '<span style="color:var(--primary); font-size:9px;">(Active)</span>' : ''}</span>
                <span style="font-size: 10px; font-weight: 700; color: ${remSim1 > 0 ? '#10B981' : '#EF4444'};">${sentSim1} / 100</span>
              </div>
              <div style="font-size: 9px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${state.simCards.sim1Number ? state.simCards.sim1Number : (state.simCards.sim1 || 'SIM 1')}</div>
              <div style="font-size: 9px; color: ${remSim1 > 0 ? 'var(--primary)' : '#EF4444'}; font-weight: 600; margin-top: 2px;">${remSim1} left today</div>
            </div>

            <div style="padding: 8px 10px; background: var(--bg-card-secondary); border-radius: 10px; border: 1.5px solid ${activeSlot === 2 ? 'var(--primary)' : 'var(--border-light)'}; cursor: pointer;" onclick="app.setSimCard(2)">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 700;">SIM 2 ${activeSlot === 2 ? '<span style="color:var(--primary); font-size:9px;">(Active)</span>' : ''}</span>
                <span style="font-size: 10px; font-weight: 700; color: ${remSim2 > 0 ? '#10B981' : '#EF4444'};">${sentSim2} / 100</span>
              </div>
              <div style="font-size: 9px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${state.simCards.sim2Number ? state.simCards.sim2Number : (state.simCards.sim2 || 'SIM 2')}</div>
              <div style="font-size: 9px; color: ${remSim2 > 0 ? 'var(--primary)' : '#EF4444'}; font-weight: 600; margin-top: 2px;">${remSim2} left today</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 8. Settings Screen
  renderSettingsScreen() {
    const sentToday = this.getDailySentCount();
    const limit = this.getDailyLimit();
    const remaining = Math.max(0, limit - sentToday);

    return `
      <div class="screen-header">
        <div class="header-top-row">
          <button class="header-action-btn" onclick="app.switchScreen('home')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div style="text-align: center;">
            <div class="header-title-text">Settings</div>
            <div class="header-subtitle">Preferences & Configuration</div>
          </div>
          <div style="width: 36px;"></div>
        </div>
      </div>

      <div class="screen-content" style="padding-bottom: 90px;">
        ${this.renderPermissionBanner()}

        <!-- System Permissions Status -->
        <div class="section-title">SYSTEM PERMISSIONS</div>
        <div class="ui-card" style="padding: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">SMS Sending Permission</div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">Required to dispatch native carrier SMS</div>
            </div>
            ${state.permissions.sms ? '<span class="badge badge-success" style="font-size:10px;">✓ Granted</span>' : '<button class="btn-text" style="color:#EF4444; font-size:11px; font-weight:700;" onclick="app.requestSmsPermission()">Grant</button>'}
          </div>

          ${!state.permissions.sms ? `
            <div style="margin-top: 4px; padding: 10px 12px; background: rgba(239, 68, 68, 0.08); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: 10px;">
              <div style="font-size: 11px; font-weight: 800; color: #DC2626; display: flex; align-items: center; gap: 4px;">
                <span>⚠️</span> If "Allow" is Greyed Out (Android 13, 14 & 15):
              </div>
              <div style="font-size: 10px; color: var(--text-main); margin-top: 4px; line-height: 1.5;">
                Android protects sideloaded APKs under <b>Restricted Settings</b>.
                <ol style="margin: 4px 0 0 16px; padding: 0;">
                  <li>Tap <b>Open App Info</b> below</li>
                  <li>Tap the <b>3 vertical dots (⋮)</b> in the top right corner</li>
                  <li>Tap <b>"Allow restricted settings"</b> (verify PIN/fingerprint)</li>
                  <li>Go to <b>Permissions &gt; SMS &gt; Allow</b></li>
                </ol>
              </div>
              <button class="btn-primary" style="margin-top: 8px; width: 100%; font-size: 11px; padding: 7px 10px; background: #DC2626;" onclick="app.openAppSettings()">
                Open App Info (3 Dots to Unlock)
              </button>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-light);">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">Contacts Access</div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">Required to import phone contacts</div>
            </div>
            ${state.permissions.contacts ? '<span class="badge badge-success" style="font-size:10px;">✓ Granted</span>' : '<button class="btn-text" style="color:#EF4444; font-size:11px; font-weight:700;" onclick="app.requestContactsPermission()">Grant</button>'}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-light);">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">File Picker (Excel / CSV)</div>
              <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">Uses Android System Picker (no permission needed)</div>
            </div>
            <span class="badge badge-success" style="font-size:10px;">✓ Ready</span>
          </div>

          ${!state.permissions.allGranted ? `
            <div style="padding-top: 8px; border-top: 1px solid var(--border-light);">
              <button class="btn-primary" style="font-size: 11px; padding: 8px 12px; background: #4F46E5;" onclick="app.requestAllPermissions()">
                Grant All Required Permissions
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Appearance Card -->
        <div class="section-title">APPEARANCE</div>
        <div class="ui-card" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="radio-card ${state.theme === 'light' ? 'selected' : ''}" onclick="app.setTheme('light')">
            <div class="radio-circle"></div>
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 700;">Light Mode</div>
            </div>
          </div>
          <div class="radio-card ${state.theme === 'dark' ? 'selected' : ''}" onclick="app.setTheme('dark')">
            <div class="radio-circle"></div>
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 700;">Dark Mode</div>
            </div>
          </div>
        </div>

        <!-- SIM Card Selection & Quotas -->
        <div class="section-title">MOBILE SMS DISPATCH ROUTE & PER-SIM LIMITS</div>
        <div class="ui-card" style="padding: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 12px; font-weight: 700;">DEFAULT ACTIVE CARRIER SIM</span>
            <span class="badge ${state.simCards.hasSim ? 'badge-success' : 'badge-danger'}" style="font-size: 10px;">${state.simCards.hasSim ? `SIM ${state.selectedSim} Active` : 'No SIM Inserted'}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="radio-card ${state.selectedSim === 1 ? 'selected' : ''}" style="margin: 0; padding: 10px; cursor: pointer;" onclick="app.setSimCard(1)">
              <div class="radio-circle"></div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                  <span style="font-size: 12px; font-weight: 700;">SIM 1</span>
                  ${state.simCards.hasSim1 ? '<span style="font-size: 9px; color: var(--success); font-weight: 700;">• Active</span>' : '<span style="font-size: 9px; color: #EF4444; font-weight: 700;">• Absent</span>'}
                </div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${state.simCards.sim1Number ? state.simCards.sim1Number : (state.simCards.sim1 || 'No SIM')}</div>
                <div style="font-size: 10px; font-weight: 700; color: ${this.getRemainingSms(1) > 0 ? '#10B981' : '#EF4444'}; margin-top: 2px;">${this.getDailySentCount(1)} / 100 (${this.getRemainingSms(1)} left)</div>
              </div>
            </div>

            <div class="radio-card ${state.selectedSim === 2 ? 'selected' : ''}" style="margin: 0; padding: 10px; cursor: pointer;" onclick="app.setSimCard(2)">
              <div class="radio-circle"></div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                  <span style="font-size: 12px; font-weight: 700;">SIM 2</span>
                  ${state.simCards.hasSim2 ? '<span style="font-size: 9px; color: var(--success); font-weight: 700;">• Active</span>' : '<span style="font-size: 9px; color: #EF4444; font-weight: 700;">• Absent</span>'}
                </div>
                <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${state.simCards.sim2Number ? state.simCards.sim2Number : (state.simCards.sim2 || 'No SIM')}</div>
                <div style="font-size: 10px; font-weight: 700; color: ${this.getRemainingSms(2) > 0 ? '#10B981' : '#EF4444'}; margin-top: 2px;">${this.getDailySentCount(2)} / 100 (${this.getRemainingSms(2)} left)</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quota Card -->
        <div class="section-title">DAILY LIMIT RULES</div>
        <div class="ui-card" style="display: flex; flex-direction: column; gap: 8px; padding: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 13px; font-weight: 700;">100 SMS / Day Per SIM</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Each mobile number can send up to 100 SMS per day</div>
            </div>
            <span class="badge badge-success" style="font-weight: 700;">${this.getRemainingSms(1) + this.getRemainingSms(2)} / 200 Total Left</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4; border-top: 1px solid var(--border-light); padding-top: 6px;">
            • <b>SIM 1:</b> ${this.getDailySentCount(1)} / 100 sent today (${this.getRemainingSms(1)} remaining)<br>
            • <b>SIM 2:</b> ${this.getDailySentCount(2)} / 100 sent today (${this.getRemainingSms(2)} remaining)<br>
            • Resets automatically at <b>12:00 AM IST (Asia/Kolkata)</b>
          </div>
        </div>

        <!-- App Version -->
        <div class="section-title">ABOUT</div>
        <div class="ui-card" style="padding: 14px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 13px; font-weight: 700;">Bulk SMS Mobile</div>
            <div style="font-size: 11px; color: var(--text-muted);">Carrier Normal SMS Edition</div>
          </div>
          <span style="font-size: 11px; color: var(--text-muted);">v1.0.0</span>
        </div>
      </div>
    `;
  },

  // 9. Bottom Navigation
  renderBottomNav(currentScreen) {
    const navItems = [
      { id: 'home', label: 'Home', icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
      { id: 'contacts', label: 'Contacts', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
      { id: 'create-campaign', label: 'Campaigns', icon: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' },
      { id: 'settings', label: 'Settings', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>' }
    ];

    return `
      <div class="bottom-nav">
        ${navItems.map(item => `
          <button class="nav-item ${currentScreen === item.id ? 'active' : ''}" onclick="app.switchScreen('${item.id}')">
            <div class="nav-icon-wrapper">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.icon}</svg>
            </div>
            <span>${item.label}</span>
          </button>
        `).join('')}
      </div>
    `;
  },

  // Handlers
  handleContactSearch(val) {
    state.contactSearch = val;
    this.render();
  },

  setContactFilter(group) {
    state.contactFilter = group;
    this.render();
  },

  toggleContactSelection(id) {
    const c = state.contacts.find(x => x.id === id);
    if (c) c.selected = !c.selected;
    this.saveContacts();
    this.render();
  },

  toggleSelectAllContacts() {
    const allSelected = state.contacts.every(c => c.selected);
    state.contacts.forEach(c => c.selected = !allSelected);
    this.saveContacts();
    this.render();
  },

  startCampaignWithSelected() {
    const selected = state.contacts.filter(c => c.selected);
    if (selected.length === 0) {
      this.showToast('⚠️ No contacts selected');
      return;
    }
    state.campaignState.individualSelectedIds = selected.map(c => c.id);
    this.switchScreen('create-campaign');
    this.showToast(`🎯 Preloaded ${selected.length} contacts into campaign!`);
  },

  formatIndianPhone(phone) {
    if (!phone) return '';
    let str = String(phone).trim();
    let clean = str.replace(/[^0-9+]/g, '');

    // If starts with +91
    if (clean.startsWith('+91')) {
      return clean;
    }
    // If starts with 91 and has 12 digits (e.g. 919876543210)
    if (clean.startsWith('91') && clean.length === 12) {
      return '+' + clean;
    }
    // If starts with 0 and has 11 digits (e.g. 09876543210)
    if (clean.startsWith('0') && clean.length === 11) {
      return '+91' + clean.slice(1);
    }
    // If exactly 10 digits (e.g. 9876543210)
    if (clean.length === 10) {
      return '+91' + clean;
    }
    // If typed with leading + but no 91 (e.g. +9876543210)
    if (clean.startsWith('+') && clean.length === 11 && !clean.startsWith('+91')) {
      const digits = clean.slice(1);
      if (digits.length === 10) {
        return '+91' + digits;
      }
    }
    return clean;
  },

  formatMessageWithIndianPhones(text) {
    if (!text) return '';
    // 1. Replace 0-prefixed 10-digit Indian mobile: 09876543210 -> +919876543210
    let res = String(text).replace(/(?<!\d|\+91)0([6-9]\d{9})(?!\d)/g, '+91$1');
    // 2. Replace 10-digit Indian mobile: 9876543210 -> +919876543210
    res = res.replace(/(?<!\d|\+91|\+)([6-9]\d{9})(?!\d)/g, '+91$1');
    return res;
  },

  parseBulkNumbersDetailed(text, maxLimit = 100) {
    if (!text) {
      return {
        valid: [],
        invalid: [],
        duplicates: [],
        totalTokens: 0,
        capped: false,
        totalValidBeforeCap: 0
      };
    }

    // Split by commas, newlines, carriage returns, semicolons, or tabs
    const tokens = String(text).split(/[\n\r,;\t]+/);
    const valid = [];
    const invalid = [];
    const duplicates = [];
    const seenInInput = new Set();
    let totalTokens = 0;

    for (const raw of tokens) {
      const trimmed = raw.trim();
      if (!trimmed) continue; // Ignore empty entries and whitespace around commas
      totalTokens++;

      // Clean non-digit characters
      const digits = trimmed.replace(/\D/g, '');
      let num10 = null;

      // Extract 10-digit mobile number according to Indian mobile standards:
      // 1) Explicit +91 with 10 digits (+91XXXXXXXXXX)
      if (trimmed.startsWith('+91') && digits.startsWith('91') && digits.length === 12) {
        num10 = digits.slice(2);
      }
      // 2) 91XXXXXXXXXX (12 digits starting with 91)
      else if (digits.length === 12 && digits.startsWith('91')) {
        num10 = digits.slice(2);
      }
      // 3) 0XXXXXXXXXX (11 digits starting with 0)
      else if (digits.length === 11 && digits.startsWith('0')) {
        num10 = digits.slice(1);
      }
      // 4) Exactly 10 digits
      else if (digits.length === 10) {
        num10 = digits;
      }

      // Validate that each entry is a valid 10-digit mobile number
      if (num10 && num10.length === 10) {
        const formatted = '+91' + num10;
        if (seenInInput.has(formatted)) {
          duplicates.push(trimmed);
        } else {
          seenInInput.add(formatted);
          valid.push(formatted);
        }
      } else {
        // Flag/filter out invalid numbers that are not 10 digits
        invalid.push(trimmed);
      }
    }

    const totalValidBeforeCap = valid.length;
    const capped = valid.length > maxLimit;
    const finalValid = capped ? valid.slice(0, maxLimit) : valid;

    return {
      valid: finalValid,
      invalid: invalid,
      duplicates: duplicates,
      totalTokens: totalTokens,
      capped: capped,
      totalValidBeforeCap: totalValidBeforeCap
    };
  },

  parseBulkNumbers(text, maxLimit = 100) {
    return this.parseBulkNumbersDetailed(text, maxLimit).valid;
  },

  handleMessagePaste(event, textarea) {
    const clip = (event.clipboardData || window.clipboardData)?.getData('text');
    if (!clip) return;

    const formatted = this.formatMessageWithIndianPhones(clip);
    if (formatted !== clip) {
      event.preventDefault();
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const text = textarea.value || '';
      textarea.value = text.substring(0, start) + formatted + text.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + formatted.length;
      this.handleMessageInput(textarea);
      this.showToast('🇮🇳 Auto-added +91 to pasted mobile number');
    } else {
      setTimeout(() => this.handleMessageInput(textarea), 10);
    }
  },

  showAddContactModal(mode = 'single') {
    state.addContactModal.open = true;
    state.addContactModal.mode = mode;
    state.addContactModal.phone = '';
    state.addContactModal.name = '';
    state.addContactModal.bulkText = '';
    state.addContactModal.group = mode === 'bulk' ? 'Pasted Contacts' : 'General';
    this.render();
  },

  closeAddContactModal() {
    state.addContactModal.open = false;
    this.render();
  },

  setAddContactMode(mode) {
    state.addContactModal.mode = mode;
    this.render();
  },

  handleSinglePhonePaste(event, input) {
    event.preventDefault();
    const clip = (event.clipboardData || window.clipboardData)?.getData('text') || '';
    if (!clip.trim()) return;

    // Detect if user pasted multiple comma-separated or newline-separated numbers
    if (clip.includes(',') || clip.includes(';') || clip.includes('\n')) {
      const stats = this.parseBulkNumbersDetailed(clip);
      if (stats.valid.length > 1) {
        state.addContactModal.mode = 'bulk';
        state.addContactModal.bulkText = clip;
        this.render();
        const textarea = document.getElementById('bulk-paste-input');
        if (textarea) textarea.value = clip;
        this.updateBulkFeedback(stats);
        this.showToast(`📋 Detected ${stats.valid.length} comma-separated numbers! Switched to Bulk Import.`);
        return;
      }
    }

    const formatted = this.formatIndianPhone(clip);
    input.value = formatted;
    state.addContactModal.phone = formatted;
    this.updateSinglePhoneFeedback(formatted);
    const btn = document.getElementById('clear-single-phone-btn');
    if (btn) btn.style.display = formatted ? 'inline-flex' : 'none';
    this.showToast('🇮🇳 Auto-added +91 to pasted mobile number');
  },

  handleSinglePhoneInput(input) {
    let val = input.value;
    const cleanDigits = val.replace(/[^0-9]/g, '');
    if (!val.startsWith('+91') && cleanDigits.length === 10 && /^[6-9]/.test(cleanDigits)) {
      val = '+91' + cleanDigits;
      input.value = val;
    } else if (val.startsWith('0') && cleanDigits.length === 11) {
      val = '+91' + cleanDigits.slice(1);
      input.value = val;
    }
    state.addContactModal.phone = val;
    this.updateSinglePhoneFeedback(val);
    const btn = document.getElementById('clear-single-phone-btn');
    if (btn) btn.style.display = val ? 'inline-flex' : 'none';
  },

  clearSinglePhoneInput() {
    state.addContactModal.phone = '';
    const input = document.getElementById('new-contact-phone');
    if (input) {
      input.value = '';
      input.focus();
    }
    const btn = document.getElementById('clear-single-phone-btn');
    if (btn) btn.style.display = 'none';
    const fb = document.getElementById('phone-feedback');
    if (fb) {
      fb.innerHTML = 'Paste 10-digit number; +91 adds automatically';
      fb.style.color = '#10B981';
    }
  },

  clearBulkNumbersInput() {
    state.addContactModal.bulkText = '';
    const textarea = document.getElementById('bulk-paste-input');
    if (textarea) {
      textarea.value = '';
      textarea.focus();
    }
    const counter = document.getElementById('bulk-paste-counter');
    if (counter) {
      counter.innerHTML = 'Paste from WhatsApp, Call Logs, or Notes';
      counter.style.color = 'var(--text-muted)';
    }
    this.showToast('🗑️ Cleared pasted numbers');
  },

  deleteSingleContact(id) {
    const contact = state.contacts.find(c => c.id === id);
    state.contacts = state.contacts.filter(c => c.id !== id);
    this.saveContacts();
    this.render();
    this.showToast(`🗑️ Cleared ${contact ? contact.phone : 'number'}`);
  },

  confirmClearAllContacts() {
    if (state.contacts.length === 0) {
      this.showToast('ℹ️ No contacts to clear');
      return;
    }
    if (confirm(`Are you sure you want to clear all ${state.contacts.length} numbers?`)) {
      state.contacts = [];
      this.saveContacts();
      this.render();
      this.showToast('🗑️ All numbers cleared successfully');
    }
  },

  updateSinglePhoneFeedback(val) {
    const fb = document.getElementById('phone-feedback');
    if (!fb) return;
    const clean = this.formatIndianPhone(val);
    const digits = clean.replace(/[^0-9]/g, '');
    if (digits.length >= 10 && clean.startsWith('+91')) {
      fb.innerHTML = `✓ Formatted Indian Number: <b>${clean}</b>`;
      fb.style.color = '#10B981';
    } else if (val) {
      fb.innerHTML = `Enter or paste 10-digit number (+91 auto-adds)`;
      fb.style.color = 'var(--text-muted)';
    } else {
      fb.innerHTML = `Paste 10-digit number; +91 adds automatically`;
      fb.style.color = '#10B981';
    }
  },

  saveSingleContactFromModal() {
    let phone = state.addContactModal.phone || '';
    if (!phone) {
      const input = document.getElementById('new-contact-phone');
      if (input) phone = input.value;
    }
    phone = this.formatIndianPhone(phone);
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 10) {
      this.showToast('⚠️ Please enter a valid 10-digit mobile number');
      return;
    }

    const name = (state.addContactModal.name || '').trim() || `Contact ${phone.slice(-4)}`;
    const group = state.addContactModal.group || 'General';
    const initials = (name.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'C';
    const colors = ['blue', 'purple', 'teal', 'emerald', 'amber', 'pink'];

    const existing = state.contacts.find(c => c.phone.replace(/[^0-9]/g, '') === digits);
    if (existing) {
      this.showToast(`⚠️ Mobile number already exists as "${existing.name}"`);
      return;
    }

    state.contacts.unshift({
      id: Date.now(),
      name: name,
      phone: phone,
      group: group,
      source: 'manual',
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
      initials: initials,
      selected: true
    });
    this.saveContacts();
    this.closeAddContactModal();
    this.showToast(`✅ Added ${name} (${phone})`);
  },

  handleBulkPaste(event, textarea) {
    event.preventDefault();
    const clip = (event.clipboardData || window.clipboardData)?.getData('text') || '';
    if (!clip.trim()) return;

    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const currentVal = textarea.value || '';
    const newVal = currentVal.substring(0, start) + clip + currentVal.substring(end);

    textarea.value = newVal;
    state.addContactModal.bulkText = newVal;

    const stats = this.parseBulkNumbersDetailed(newVal);
    this.updateBulkFeedback(stats);

    if (stats.valid.length > 0) {
      if (stats.capped) {
        this.showToast(`🇮🇳 Extracted ${stats.valid.length} numbers (capped at max 100 limit)`);
      } else {
        this.showToast(`🇮🇳 Extracted ${stats.valid.length} numbers (+91 ready)!`);
      }
    } else if (stats.invalid.length > 0) {
      this.showToast(`⚠️ Pasted ${stats.invalid.length} entries, but none were valid 10-digit numbers`);
    }
  },

  handleBulkInputChange(textarea) {
    state.addContactModal.bulkText = textarea.value;
    const stats = this.parseBulkNumbersDetailed(textarea.value);
    this.updateBulkFeedback(stats);
  },

  renderBulkFeedbackHtml(stats) {
    if (!stats || (stats.valid.length === 0 && stats.invalid.length === 0)) {
      return '<span style="color: var(--text-muted); font-size: 11px;">Paste numbers separated by comma (e.g. 9876543210, 9123456789)</span>';
    }
    let html = '<div style="display:flex; flex-direction:column; gap:3px;">';
    if (stats.valid.length > 0) {
      html += `<div style="color: #10B981; font-weight: 800; font-size: 11px; display:flex; align-items:center; gap:4px;">
        <span>✓</span> <span>${stats.valid.length} valid 10-digit mobile numbers (+91 ready)</span>
      </div>`;
    }
    if (stats.invalid.length > 0) {
      html += `<div style="color: #EF4444; font-size: 10px; font-weight: 700;">
        ⚠️ ${stats.invalid.length} invalid entries skipped (must be 10 digits)
      </div>`;
    }
    if (stats.duplicates.length > 0) {
      html += `<div style="color: #6366F1; font-size: 10px; font-weight: 600;">
        ℹ️ ${stats.duplicates.length} duplicate numbers ignored
      </div>`;
    }
    if (stats.capped) {
      html += `<div style="color: #F59E0B; font-size: 10px; font-weight: 700;">
        ⚠️ Capped at max 100 contacts (from ${stats.totalValidBeforeCap} valid)
      </div>`;
    }
    html += '</div>';
    return html;
  },

  updateBulkFeedback(stats) {
    if (!stats) stats = this.parseBulkNumbersDetailed(state.addContactModal.bulkText);
    const counter = document.getElementById('bulk-paste-counter');
    const importBtn = document.getElementById('bulk-import-submit-btn');

    if (counter) {
      counter.innerHTML = this.renderBulkFeedbackHtml(stats);
    }

    if (importBtn) {
      if (stats.valid.length > 0) {
        importBtn.disabled = false;
        importBtn.style.opacity = '1';
        importBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Import ${stats.valid.length} Mobile Numbers (+91)</span>
        `;
      } else {
        importBtn.disabled = false;
        importBtn.style.opacity = '0.7';
        importBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Import Numbers (+91 Auto)</span>
        `;
      }
    }
  },

  clearBulkNumbersInput() {
    state.addContactModal.bulkText = '';
    const textarea = document.getElementById('bulk-paste-input');
    if (textarea) {
      textarea.value = '';
      textarea.focus();
    }
    const stats = this.parseBulkNumbersDetailed('');
    this.updateBulkFeedback(stats);
    this.showToast('🗑️ Cleared pasted numbers');
  },

  saveBulkContactsFromModal() {
    const text = state.addContactModal.bulkText || '';
    const stats = this.parseBulkNumbersDetailed(text);

    if (stats.valid.length === 0) {
      if (stats.invalid.length > 0) {
        this.showToast(`⚠️ None of the ${stats.invalid.length} entries were valid 10-digit mobile numbers`);
      } else {
        this.showToast('⚠️ Please paste comma-separated mobile numbers first');
      }
      return;
    }

    const group = 'Pasted Contacts';
    const colors = ['blue', 'purple', 'teal', 'emerald', 'amber', 'pink'];
    let added = 0;
    let alreadyExisted = 0;
    const existingPhones = new Set(state.contacts.map(c => c.phone.replace(/[^0-9]/g, '')));

    for (const num of stats.valid) {
      const cleanDigits = num.replace(/[^0-9]/g, '');
      if (existingPhones.has(cleanDigits)) {
        alreadyExisted++;
        continue;
      }
      existingPhones.add(cleanDigits);

      state.contacts.unshift({
        id: Date.now() + Math.random(),
        name: `Contact ${num.slice(-4)}`,
        phone: num,
        group: group,
        source: 'bulk-paste',
        avatarColor: colors[Math.floor(Math.random() * colors.length)],
        initials: 'P',
        selected: true
      });
      added++;
    }

    this.saveContacts();
    this.closeAddContactModal();

    let toastMsg = `✅ Successfully imported ${added} contacts with +91!`;
    if (alreadyExisted > 0) {
      toastMsg += ` (${alreadyExisted} already in list)`;
    }
    if (stats.invalid.length > 0) {
      toastMsg += ` • ${stats.invalid.length} invalid skipped`;
    }
    if (stats.capped) {
      toastMsg += ` • Capped at max 100`;
    }
    this.showToast(toastMsg);
  },

  renderAddContactModal() {
    if (!state.addContactModal || !state.addContactModal.open) return '';
    const m = state.addContactModal;
    const isSingle = m.mode === 'single';
    const bulkStats = this.parseBulkNumbersDetailed(m.bulkText);

    return `
      <div class="modal-overlay" onclick="if(event.target === this) app.closeAddContactModal()">
        <div class="bottom-sheet" style="max-height: 85vh; padding: 18px;">
          <div class="sheet-handle"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">📱</span>
              <div>
                <div style="font-size: 15px; font-weight: 800; color: var(--text-main);">Add Mobile Numbers</div>
                <div style="font-size: 11px; color: #10B981; font-weight: 700;">+91 is automatically added on paste</div>
              </div>
            </div>
            <button class="header-action-btn" onclick="app.closeAddContactModal()" style="width: 32px; height: 32px; font-size: 16px;">✕</button>
          </div>

          <!-- Mode Toggle -->
          <div style="display: flex; background: var(--bg-card-secondary); border-radius: 12px; padding: 4px; gap: 4px;">
            <button onclick="app.setAddContactMode('single')" style="flex: 1; padding: 8px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: ${isSingle ? 'var(--primary)' : 'transparent'}; color: ${isSingle ? '#FFFFFF' : 'var(--text-muted)'}; box-shadow: ${isSingle ? '0 2px 6px rgba(99, 102, 241, 0.3)' : 'none'};">
              Single Number
            </button>
            <button onclick="app.setAddContactMode('bulk')" style="flex: 1; padding: 8px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: ${!isSingle ? 'var(--primary)' : 'transparent'}; color: ${!isSingle ? '#FFFFFF' : 'var(--text-muted)'}; box-shadow: ${!isSingle ? '0 2px 6px rgba(99, 102, 241, 0.3)' : 'none'};">
              Bulk Paste Numbers
            </button>
          </div>

          ${isSingle ? `
            <!-- Single Contact Form -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Mobile Number *</label>
                  <span style="font-size: 10px; color: #10B981; font-weight: 700;">Auto +91</span>
                </div>
                <div style="display: flex; align-items: center; border: 1.5px solid var(--border-color); border-radius: 12px; background: var(--bg-card-secondary); overflow: hidden; padding: 0 10px;">
                  <span style="font-size: 13px; font-weight: 800; color: var(--primary); padding-right: 8px; border-right: 1.5px solid var(--border-color); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                    🇮🇳 +91
                  </span>
                  <input type="tel" id="new-contact-phone" placeholder="Paste number (e.g. 9876543210)" value="${m.phone}" onpaste="app.handleSinglePhonePaste(event, this)" oninput="app.handleSinglePhoneInput(this)" style="width: 100%; border: none; outline: none; background: transparent; padding: 12px 8px; font-size: 14px; font-weight: 700; color: var(--text-main);" />
                  <button id="clear-single-phone-btn" type="button" class="btn-text" style="padding: 4px 6px; font-size: 11px; font-weight: 800; color: #EF4444; cursor: pointer; display: ${m.phone ? 'inline-flex' : 'none'}; align-items: center; gap: 2px; white-space: nowrap;" onclick="app.clearSinglePhoneInput()" title="Clear number">
                    ✕ Clear
                  </button>
                </div>
                <div id="phone-feedback" style="font-size: 10px; color: #10B981; min-height: 14px; padding-left: 2px;">
                  ${m.phone ? `✓ Ready: <b>${this.formatIndianPhone(m.phone)}</b>` : 'Paste 10-digit number; +91 adds automatically'}
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Contact Name (Optional)</label>
                <input type="text" placeholder="e.g. Rahul Sharma" value="${m.name}" oninput="state.addContactModal.name = this.value" style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 12px; background: var(--bg-card-secondary); padding: 11px 12px; font-size: 13px; color: var(--text-main); outline: none;" />
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px;">
                <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Group / Tag</label>
                <select onchange="state.addContactModal.group = this.value" style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 12px; background: var(--bg-card-secondary); padding: 11px 12px; font-size: 13px; color: var(--text-main); outline: none;">
                  <option value="General" ${m.group === 'General' ? 'selected' : ''}>General</option>
                  <option value="Customers" ${m.group === 'Customers' ? 'selected' : ''}>Customers</option>
                  <option value="Friends" ${m.group === 'Friends' ? 'selected' : ''}>Friends</option>
                  <option value="VIP" ${m.group === 'VIP' ? 'selected' : ''}>VIP</option>
                </select>
              </div>

              <div style="padding-top: 6px;">
                <button class="btn-primary" onclick="app.saveSingleContactFromModal()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Save Contact (+91)</span>
                </button>
              </div>
            </div>
          ` : `
            <!-- Bulk Paste Form -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <label style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Paste Comma-Separated Numbers</label>
                    <div style="font-size: 10px; color: var(--text-muted);">Up to 100 numbers • Auto +91</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" class="btn-text" style="color: #EF4444; font-size: 11px; font-weight: 800; padding: 4px 6px; cursor: pointer; display: flex; align-items: center; gap: 2px;" onclick="app.clearBulkNumbersInput()" title="Clear pasted numbers">
                      ✕ Clear Numbers
                    </button>
                  </div>
                </div>
                <textarea id="bulk-paste-input" placeholder="Paste numbers separated by comma (up to 100)&#10;e.g.&#10;9876543210, 9123456789, 9840123456&#10;or paste one number per line" onpaste="app.handleBulkPaste(event, this)" oninput="app.handleBulkInputChange(this)" style="width: 100%; height: 125px; border: 1.5px solid var(--border-color); border-radius: 12px; background: var(--bg-card-secondary); padding: 10px 12px; font-size: 12px; color: var(--text-main); outline: none; resize: none; font-family: monospace; line-height: 1.4;">${m.bulkText}</textarea>
                <div id="bulk-paste-counter" style="font-size: 11px; font-weight: 600; padding: 4px 2px;">
                  ${this.renderBulkFeedbackHtml(bulkStats)}
                </div>
              </div>

              <div style="padding-top: 6px;">
                <button id="bulk-import-submit-btn" class="btn-primary" onclick="app.saveBulkContactsFromModal()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>${bulkStats.valid.length > 0 ? `Import ${bulkStats.valid.length} Mobile Numbers (+91)` : 'Import Numbers (+91 Auto)'}</span>
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  },

  setSimCard(slot) {
    state.selectedSim = slot <= 1 ? 1 : 2;
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.setSelectedSim) {
      window.AndroidSmsBridge.setSelectedSim(state.selectedSim);
    } else {
      localStorage.setItem('selected_sim_slot', String(state.selectedSim));
    }
    this.showToast(`📱 Active carrier SIM switched to SIM ${state.selectedSim}`);
    this.render();
  },

  loadSimCards() {
    if (window.AndroidSmsBridge && window.AndroidSmsBridge.getSimCardsJson) {
      try {
        const json = window.AndroidSmsBridge.getSimCardsJson();
        const data = JSON.parse(json);
        state.simCards = data;
        state.selectedSim = data.selected || 1;
      } catch (e) {
        console.error('Failed to parse SIM cards json:', e);
      }
    } else {
      state.simCards = {
        sim1: 'No SIM (Absent)',
        sim2: 'No SIM (Absent)',
        hasSim1: false,
        hasSim2: false,
        count: 0,
        hasSim: false,
        selected: 1
      };
    }
  },

  handleAndroidBack() {
    if (state.addContactModal && state.addContactModal.open) {
      this.closeAddContactModal();
      return true;
    }
    if (state.activeScreen && state.activeScreen !== 'home') {
      this.switchScreen('home');
      return true;
    }
    return false;
  },

  attachDynamicListeners() { }
};

// Start application
window.app = app;
window.state = state;
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
