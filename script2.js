 let GOOGLE_APPS_SCRIPT_URL = localStorage.getItem('tokosiman_gas_url') || "https://script.google.com/macros/s/AKfycbzx9p6K-DBXFgNhTvA-xiVIGmBa6IR8hb3qLIih5b9avnicKgKQhLiNS8FFw4cv9Jyi/exec"; 

if (GOOGLE_APPS_SCRIPT_URL) {
  localStorage.setItem('tokosiman_gas_url', GOOGLE_APPS_SCRIPT_URL);
}

let isAutoSyncEnabled = localStorage.getItem('tokosiman_autosync') !== 'false';

let appData = {
  transactions: JSON.parse(localStorage.getItem('tokosiman_local_tx') || '[]'),
  products: JSON.parse(localStorage.getItem('tokosiman_local_prd') || '[]'),
  categories: JSON.parse(localStorage.getItem('tokosiman_local_cat') || '{}'),
  appPin: localStorage.getItem('tokosiman_app_pin') || '1234'
};

let AppState = {
  isSubmitting: false
};

let currentFormType = 'pemasukan';
let currentStatus = 'Lunas';
let kasirStatus = 'Lunas';
let diskonType = 'rp'; 
let activeTxFilter = 'semua';
let activeHpFilter = 'belum_lunas';
let activeAnFilter = 'tahun_ini';
let cart = [];
let kasirCart = [];
let activeTab = 'beranda';
let currentDetailItem = null;
let lastCheckoutData = null;
let currentPinInput = "";

let searchKasirDebounceTimeout = null;
let searchHutangDebounceTimeout = null;
let searchProdukTabDebounceTimeout = null;
let searchProdukDebounceTimeout = null;

let pendingConfirmAction = null;

const ITEMS_PER_PAGE = 10;
const BERANDA_ITEMS_PER_PAGE = 30;
let berandaPage = 1;
let kasirPage = 1;
let produkPageLainnya = 1;
let produkPageFavorit = 1;
let produkTabSubActive = 'lainnya';
let modalProdukPage = 1;

function safeStringId(id) {
  return String(id || '');
}

function saveLocalState() {
  localStorage.setItem('tokosiman_local_tx', JSON.stringify(appData.transactions));
  localStorage.setItem('tokosiman_local_prd', JSON.stringify(appData.products));
  localStorage.setItem('tokosiman_local_cat', JSON.stringify(appData.categories));
}

function getLocalDateString(d = new Date()) {
  let year = d.getFullYear();
  let month = String(d.getMonth() + 1).padStart(2, '0');
  let day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) return;

  let toast = document.createElement('div');
  let bgClass = "bg-white/90 backdrop-blur-md border border-slate-200 text-slate-800 shadow-xl";
  let icon = '<i class="fa-solid fa-circle-info text-indigo-600"></i>';

  if (type === 'success') {
    bgClass = "bg-emerald-50/90 backdrop-blur-md border border-emerald-200 text-emerald-800 shadow-xl";
    icon = '<i class="fa-solid fa-circle-check text-emerald-600"></i>';
  } else if (type === 'error') {
    bgClass = "bg-rose-50/90 backdrop-blur-md border border-rose-200 text-rose-800 shadow-xl";
    icon = '<i class="fa-solid fa-circle-xmark text-rose-600"></i>';
  }

  toast.className = `px-4 py-3 rounded-2xl flex items-center gap-3 text-xs font-semibold toast-animate-in pointer-events-none ${bgClass}`;
  toast.innerHTML = `${icon}<span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('toast-animate-in');
    toast.classList.add('toast-animate-out');
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

function openModal(id) {
  let modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.remove('overlay-leave');
    modal.classList.add('overlay-enter');
    
    let modalInner = modal.querySelector('.modern-modal');
    if (modalInner) {
      modalInner.classList.remove('modal-leave');
      modalInner.classList.add('modal-enter');
    }
  }
}

function closeModal(id) {
  let modal = document.getElementById(id);
  if (modal && !modal.classList.contains('hidden')) {
    modal.classList.remove('overlay-enter');
    modal.classList.add('overlay-leave');
    
    let modalInner = modal.querySelector('.modern-modal');
    if (modalInner) {
      modalInner.classList.remove('modal-enter');
      modalInner.classList.add('modal-leave');
    }

    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('overlay-leave');
      if (modalInner) modalInner.classList.remove('modal-leave');
    }, 200);
  }
}

function showLoading(text = "Menyinkronkan Cloud", subText = "Menghubungkan ke Google Sheets...") {
  let el = document.getElementById('loadingText');
  let subEl = document.getElementById('loadingSubText');
  if (el) el.innerText = text;
  if (subEl) subEl.innerText = subText;
  let overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    overlay.classList.remove('overlay-leave');
    overlay.classList.add('overlay-enter');
    let modalInner = overlay.querySelector('.modern-modal');
    if (modalInner) {
      modalInner.classList.remove('modal-leave');
      modalInner.classList.add('modal-enter');
    }
  }

  let syncIcon = document.getElementById('syncCloudIconSpin');
  let btnSyncIcon = document.getElementById('btnSyncIcon');
  if (syncIcon) syncIcon.classList.add('fa-spin');
  if (btnSyncIcon) btnSyncIcon.classList.add('fa-spin');
}

function updateLoadingProgress(progress, subText) {
  let progEl = document.getElementById('loadingProgressBar');
  let subEl = document.getElementById('loadingSubText');
  if (progEl) progEl.style.width = progress + "%";
  if (subEl && subText) subEl.innerText = subText;
}

function hideLoading() {
  let overlay = document.getElementById('loadingOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    overlay.classList.remove('overlay-enter');
    overlay.classList.add('overlay-leave');
    let modalInner = overlay.querySelector('.modern-modal');
    if (modalInner) {
      modalInner.classList.remove('modal-enter');
      modalInner.classList.add('modal-leave');
    }
    setTimeout(() => {
      overlay.classList.add('hidden');
      overlay.classList.remove('overlay-leave', 'overlay-enter');
      if (modalInner) modalInner.classList.remove('modal-leave');
    }, 200);
  }

  let syncIcon = document.getElementById('syncCloudIconSpin');
  let btnSyncIcon = document.getElementById('btnSyncIcon');
  if (syncIcon) syncIcon.classList.remove('fa-spin');
  if (btnSyncIcon) btnSyncIcon.classList.remove('fa-spin');
}

function showConfirm(title, message, onOk) {
  let modal = document.getElementById('modalConfirm');
  if (!modal) return;
  document.getElementById('confirmTitle').innerText = title;
  document.getElementById('confirmMessage').innerText = message;
  pendingConfirmAction = onOk;
  openModal('modalConfirm');
}

function executeConfirmAction() {
  closeModal('modalConfirm');
  if (typeof pendingConfirmAction === 'function') {
    pendingConfirmAction();
    pendingConfirmAction = null;
  }
}

function formatRp(num) {
  let val = Number(num) || 0;
  let isNegative = val < 0;
  let formatted = Math.abs(val).toLocaleString('id-ID');
  return isNegative ? "-Rp" + formatted : "Rp" + formatted;
}

function parseNumber(str) {
  if (!str) return 0;
  let cleaned = String(str).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function formatFormattedDate(dateStr) {
  if (!dateStr) return "-";
  try {
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

function formatInputRupiah(input) {
  let val = parseNumber(input.value);
  input.value = val ? val.toLocaleString('id-ID') : "";
}

function debouncedSearchKasir() {
  clearTimeout(searchKasirDebounceTimeout);
  searchKasirDebounceTimeout = setTimeout(() => {
    kasirPage = 1;
    renderKasirProdukList();
  }, 200);
}

function debouncedSearchHutang() {
  clearTimeout(searchHutangDebounceTimeout);
  searchHutangDebounceTimeout = setTimeout(() => {
    renderHutang();
  }, 200);
}

function debouncedSearchProdukTab() {
  clearTimeout(searchProdukTabDebounceTimeout);
  searchProdukTabDebounceTimeout = setTimeout(() => {
    if (produkTabSubActive === 'lainnya') {
      produkPageLainnya = 1;
    } else {
      produkPageFavorit = 1;
    }
    renderProdukTabList();
  }, 200);
}

function debouncedSearchProduk() {
  clearTimeout(searchProdukDebounceTimeout);
  searchProdukDebounceTimeout = setTimeout(() => {
    modalProdukPage = 1;
    renderProdukList();
  }, 200);
}

function getCategoryIcon(catName) {
  let name = (catName || '').toLowerCase();
  if (name.includes('pulsa') || name.includes('paket') || name.includes('data')) return 'fa-mobile-screen-button';
  if (name.includes('listrik') || name.includes('token') || name.includes('pln')) return 'fa-bolt';
  if (name.includes('voucher') || name.includes('belanja')) return 'fa-ticket';
  if (name.includes('makanan') || name.includes('kuliner') || name.includes('snack')) return 'fa-utensils';
  if (name.includes('minuman')) return 'fa-glass-water';
  return 'fa-folder-open';
}

function clearSearchInput(inputId, callback) {
  let input = document.getElementById(inputId);
  if (input) {
    input.value = "";
    if (typeof callback === 'function') callback();
  }
}

function pressPin(digit) {
  if (currentPinInput.length < 4) {
    currentPinInput += digit;
    updatePinDots();
    if (currentPinInput.length === 4) {
      setTimeout(verifyPin, 100);
    }
  }
}

function clearPin() {
  currentPinInput = "";
  updatePinDots();
}

function backspacePin() {
  if (currentPinInput.length > 0) {
    currentPinInput = currentPinInput.slice(0, -1);
    updatePinDots();
  }
}

function updatePinDots() {
  for (let i = 1; i <= 4; i++) {
    let dot = document.getElementById('dot' + i);
    if (dot) {
      if (i <= currentPinInput.length) {
        dot.className = "w-4 h-4 rounded-full bg-indigo-600 border-2 border-indigo-600 transition-all scale-110 shadow-sm";
      } else {
        dot.className = "w-4 h-4 rounded-full border-2 border-slate-300 bg-white transition-all";
      }
    }
  }
}

function hideSplashLogin() {
  let splash = document.getElementById('splashLoginScreen');
  if (splash) {
    splash.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
      splash.classList.add('hidden');
    }, 300);
  }
}

function lockApp() {
  currentPinInput = "";
  updatePinDots();
  let errorInfo = document.getElementById('pinErrorInfo');
  if (errorInfo) errorInfo.classList.add('hidden');

  localStorage.removeItem('tokosiman_remember_pin');
  let rememberCheckbox = document.getElementById('rememberPin');
  if (rememberCheckbox) rememberCheckbox.checked = false;

  let splash = document.getElementById('splashLoginScreen');
  if (splash) {
    splash.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    let form = document.getElementById('loginFormContainer');
    let splashContent = document.getElementById('splashContent');
    if (form) form.classList.remove('hidden');
    if (splashContent) splashContent.classList.remove('hidden');
  }
  showToast("Aplikasi terkunci", "info");
}

async function verifyPin() {
  let inputPin = currentPinInput;
  let storedPin = appData.appPin || localStorage.getItem('tokosiman_app_pin') || '1234';
  let rememberCheckbox = document.getElementById('rememberPin');
  
  let loadingState = document.getElementById('pinLoadingState');
  let keypadGrid = document.getElementById('pinKeypadGrid');
  let errorInfo = document.getElementById('pinErrorInfo');
  let errorText = document.getElementById('pinErrorText');
  let dotsWrapper = document.getElementById('pinDotsWrapper');

  if (loadingState) loadingState.classList.remove('hidden');
  if (keypadGrid) keypadGrid.classList.add('opacity-40', 'pointer-events-none');

  setTimeout(() => {
    if (loadingState) loadingState.classList.add('hidden');
    if (keypadGrid) keypadGrid.classList.remove('opacity-40', 'pointer-events-none');

    if (inputPin === storedPin) {
      if (errorInfo) errorInfo.classList.add('hidden');

      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem('tokosiman_remember_pin', 'true');
      } else {
        localStorage.removeItem('tokosiman_remember_pin');
      }
      hideSplashLogin();
      loadData(true);
    } else {
      if (errorText) errorText.innerText = "PIN Salah! Periksa kembali PIN Anda";
      if (errorInfo) errorInfo.classList.remove('hidden');

      if (dotsWrapper) {
        dotsWrapper.classList.add('shake-anim');
        setTimeout(() => dotsWrapper.classList.remove('shake-anim'), 400);
      }

      showToast("PIN Keamanan Salah!", "error");
      clearPin();
    }
  }, 300);
}

function openResetPinModal() {
  let inputCode = document.getElementById('inputResetCode');
  let inputNew = document.getElementById('inputNewPinReset');
  if (inputCode) inputCode.value = "";
  if (inputNew) inputNew.value = "";
  openModal('modalResetPin');
}

async function executeResetPin() {
  let resetCode = document.getElementById('inputResetCode').value.trim();
  let newPinInput = document.getElementById('inputNewPinReset').value.trim();

  if (!resetCode || !newPinInput) {
    showToast("Kode reset dan PIN baru wajib diisi!", "error");
    return;
  }

  if (resetCode !== '8080' && resetCode !== 'TOKOSIMAN2026') {
    showToast("Kode reset verifikasi salah!", "error");
    return;
  }

  if (!/^\d{4}$/.test(newPinInput)) {
    showToast("PIN baru harus tepat 4 digit angka!", "error");
    return;
  }

  showLoading("Mereset PIN...", "Memperbarui PIN baru ke Cloud");

  await callGasApi('simpanPin', { pin: newPinInput });
  hideLoading();

  appData.appPin = newPinInput;
  localStorage.setItem('tokosiman_app_pin', newPinInput);

  closeModal('modalResetPin');
  clearPin();

  setTimeout(() => {
    showToast("PIN berhasil diganti! Silakan masukkan PIN baru Anda.", "success");
  }, 300);
}

async function changeAppPin() {
  let oldPinInput = document.getElementById('inputOldPin').value.trim();
  let newPinInput = document.getElementById('inputNewPin').value.trim();
  let storedPin = appData.appPin || localStorage.getItem('tokosiman_app_pin') || '1234';

  if (!oldPinInput || !newPinInput) {
    showToast("PIN lama dan PIN baru wajib diisi!", "error");
    return;
  }

  if (oldPinInput !== storedPin) {
    showToast("PIN lama tidak sesuai!", "error");
    return;
  }

  if (!/^\d{4}$/.test(newPinInput)) {
    showToast("PIN baru harus tepat 4 digit angka!", "error");
    return;
  }

  showLoading("Menyimpan PIN ke Cloud...", "Memperbarui PIN di Google Sheets");

  let res = await callGasApi('simpanPin', { pin: newPinInput });
  hideLoading();

  appData.appPin = newPinInput;
  localStorage.setItem('tokosiman_app_pin', newPinInput);

  if (res && res.success) {
    document.getElementById('inputOldPin').value = "";
    document.getElementById('inputNewPin').value = "";
    showToast("PIN berhasil diperbarui dan disinkronkan ke Cloud!", "success");
  } else {
    showToast("PIN disimpan lokal (Gagal sync Cloud)", "info");
  }
}

function updateDbStatusBadge() {
  let badge = document.getElementById('syncStatusBadge');
  let setelanBadge = document.getElementById('setelanDbStatus');
  let gasUrlInput = document.getElementById('inputGasUrl');
  let autoSyncToggle = document.getElementById('autoSyncToggle');
  
  if (gasUrlInput && GOOGLE_APPS_SCRIPT_URL) {
    gasUrlInput.value = GOOGLE_APPS_SCRIPT_URL;
  }
  if (autoSyncToggle) {
    autoSyncToggle.checked = isAutoSyncEnabled;
  }

  if (!GOOGLE_APPS_SCRIPT_URL) {
    if (badge) {
      badge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span> Belum Terhubung Cloud`;
      badge.className = "text-amber-600 font-semibold flex items-center gap-2";
    }
    if (setelanBadge) {
      setelanBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span> Offline (LocalStorage Mode)`;
      setelanBadge.className = "font-bold text-amber-600 flex items-center gap-1.5";
    }
  } else {
    let syncModeText = isAutoSyncEnabled ? "Google Sheets (Auto-Sync Aktif)" : "Google Sheets (Manual Sync)";
    if (badge) {
      badge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> ${syncModeText}`;
      badge.className = "text-emerald-700 font-semibold flex items-center gap-2";
    }
    if (setelanBadge) {
      setelanBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> ${syncModeText}`;
      setelanBadge.className = "font-bold text-emerald-700 flex items-center gap-1.5";
    }
  }
}

function toggleAutoSyncSetting(isChecked) {
  isAutoSyncEnabled = isChecked;
  localStorage.setItem('tokosiman_autosync', isChecked ? 'true' : 'false');
  updateDbStatusBadge();
  showToast(isChecked ? "Auto-sync otomatis diaktifkan" : "Auto-sync dinonaktifkan", "success");
}

async function loadData(showInitialLoading = false) {
  if (showInitialLoading) {
    showLoading("Menyinkronkan Data Cloud", "Mengunduh pembaruan terbaru dari Google Sheets");
    updateLoadingProgress(30, "Menghubungkan ke server...");
  }

  if (!GOOGLE_APPS_SCRIPT_URL) {
    if (showInitialLoading) hideLoading();
    updateDbStatusBadge();
    renderAll();
    return;
  }

  try {
    if (showInitialLoading) updateLoadingProgress(60, "Mengunduh data transaksi & produk...");
    let response = await fetch(GOOGLE_APPS_SCRIPT_URL + "?action=getInitialData", { redirect: 'follow' });
    
    let textResult = await response.text();
    let result;
    try {
      result = JSON.parse(textResult);
    } catch(e) {
      throw new Error("Respons Cloud bukan format JSON yang valid. Pastikan deployment Apps Script diatur ke 'Anyone'.");
    }

    if (result && result.success && result.data) {
      if (showInitialLoading) updateLoadingProgress(90, "Memproses data lokal...");
      appData.transactions = Array.isArray(result.data.transactions) ? result.data.transactions.map(t => { t.id = safeStringId(t.id); return t; }) : [];
      appData.products = Array.isArray(result.data.products) ? result.data.products.map(p => { 
        p.id = safeStringId(p.id); 
        p.hargaJual = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
        p.hargaBeli = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));
        return p; 
      }) : [];
      appData.categories = (result.data.categories && typeof result.data.categories === 'object') ? result.data.categories : {};
      
      if (result.data.appPin) {
        appData.appPin = result.data.appPin;
        localStorage.setItem('tokosiman_app_pin', result.data.appPin);
      }

      saveLocalState();
      renderAll();
      updateDbStatusBadge();
      if (showInitialLoading) {
        updateLoadingProgress(100, "Selesai!");
        setTimeout(hideLoading, 300);
        showToast("Berhasil tersinkronisasi dengan Google Sheets!", "success");
      }
    } else {
      throw new Error(result.message || "Gagal sinkronisasi data");
    }
  } catch (err) {
    if (showInitialLoading) hideLoading();
    showToast("Gagal terhubung ke Cloud: Menggunakan data lokal", "info");
    renderAll();
  }
}

async function callGasApi(action, dataObj) {
  if (!GOOGLE_APPS_SCRIPT_URL) {
    return { success: false, message: "URL Google Apps Script belum diatur." };
  }

  let maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let payload = { action: action, data: dataObj, id: dataObj ? dataObj.id : undefined };
      let response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      let textRes = await response.text();
      return JSON.parse(textRes);
    } catch (err) {
      if (attempt === maxRetries) {
        return { success: false, message: err.toString() };
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function dbSaveTransaction(payload) {
  payload.id = safeStringId(payload.id || ('TX-' + Date.now()));
  
  let idx = appData.transactions.findIndex(t => safeStringId(t.id) === payload.id);
  if (idx !== -1) {
    appData.transactions[idx] = payload;
  } else {
    appData.transactions.unshift(payload);
  }
  saveLocalState();
  renderAll();

  if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
    let res = await callGasApi('simpanTransaksi', payload);
    if (!res || !res.success) {
      showToast("Disimpan lokal (Gagal sync Cloud)", "info");
    }
  }
  return { success: true };
}

async function dbDeleteTransaction(id) {
  let targetId = safeStringId(id);
  appData.transactions = appData.transactions.filter(t => safeStringId(t.id) !== targetId);
  saveLocalState();
  renderAll();

  if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
    let res = await callGasApi('hapusTransaksi', { id: targetId });
    if (!res || !res.success) showToast("Peringatan: Gagal hapus di Google Sheets", "error");
  }
  return { success: true };
}

async function dbSaveProduct(payload) {
  payload.id = safeStringId(payload.id || ('PRD-' + Date.now()));
  payload.hargaJual = Number(payload.hargaJual || 0);
  payload.hargaBeli = Number(payload.hargaBeli || 0);

  let idx = appData.products.findIndex(p => safeStringId(p.id) === payload.id);
  if (idx !== -1) {
    appData.products[idx] = payload;
  } else {
    appData.products.push(payload);
  }
  saveLocalState();
  renderAll();

  if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
    let res = await callGasApi('simpanProduk', payload);
    if (!res || !res.success) showToast("Peringatan: Gagal sync produk ke Google Sheets", "error");
  }
  return { success: true };
}

async function dbDeleteProduct(id) {
  let targetId = safeStringId(id);
  appData.products = appData.products.filter(p => safeStringId(p.id) !== targetId);
  saveLocalState();
  renderAll();

  if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
    let res = await callGasApi('hapusProduk', { id: targetId });
    if (!res || !res.success) showToast("Peringatan: Gagal hapus produk di Google Sheets", "error");
  }
  return { success: true };
}

async function dbSaveCategories(categories) {
  appData.categories = categories;
  saveLocalState();
  renderAll();

  if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
    let res = await callGasApi('simpanKategoriObj', categories);
    if (!res || !res.success) showToast("Peringatan: Gagal sync kategori ke Google Sheets", "error");
  }
  return { success: true };
}

function saveCategoriesData() {
  showLoading("Menyimpan kategori...", "Memperbarui struktur kategori ke Google Sheets");
  updateLoadingProgress(50, "Menyimpan ke server...");
  dbSaveCategories(appData.categories).then(() => {
    updateLoadingProgress(100, "Selesai!");
    setTimeout(hideLoading, 300);
    closeModal('modalFormKategori');
    showToast("Kategori berhasil disimpan", "success");
  });
}

function syncDataWithLoading() {
  if (!GOOGLE_APPS_SCRIPT_URL) {
    showToast("Masukkan URL Google Apps Script terlebih dahulu di menu Setelan", "error");
    return;
  }
  showLoading("Menyinkronkan Data Cloud", "Mengunduh pembaruan terbaru dari Google Sheets");
  updateLoadingProgress(40, "Mengambil data dari Google Sheets...");
  loadData(false);
  setTimeout(() => {
    updateLoadingProgress(100, "Sinkronisasi Berhasil!");
    setTimeout(hideLoading, 400);
    showToast("Data berhasil disinkronkan secara real-time!", "success");
  }, 800);
}

function saveGasUrlSetting() {
  let urlInput = document.getElementById('inputGasUrl').value.trim();
  GOOGLE_APPS_SCRIPT_URL = urlInput;
  localStorage.setItem('tokosiman_gas_url', urlInput);

  showLoading("Menghubungkan ke Google Sheets", "Memeriksa koneksi database baru...");
  updateLoadingProgress(50, "Melakukan tes koneksi...");
  loadData(false);
  setTimeout(() => {
    updateLoadingProgress(100, "Terhubung!");
    setTimeout(hideLoading, 300);
    if (urlInput) {
      showToast("URL Google Apps Script berhasil disimpan!", "success");
    } else {
      showToast("URL dikosongkan (Menggunakan mode penyimpanan lokal)", "info");
    }
  }, 600);
}

function renderAll() {
  renderTransaksi();
  renderHutang();
  renderProdukList();
  renderProdukTabList();
  renderKasirProdukList();
  renderAnalisis();
  renderKategoriDropdown();
  renderKategoriList();
  updateProductCategoryStats();
}

function updateProductCategoryStats() {
  let totalProd = appData.products ? appData.products.length : 0;
  let totalKat = appData.categories ? Object.keys(appData.categories).length : 0;
  
  let textProd = totalProd + " Produk";
  let textKat = totalKat + " Kategori";

  let el1 = document.getElementById('infoTotalProduk');
  let el2 = document.getElementById('infoTotalKategori');
  let el3 = document.getElementById('infoTotalProdukKat');
  let el4 = document.getElementById('infoTotalKategoriKat');

  if(el1) el1.innerText = textProd;
  if(el2) el2.innerText = textKat;
  if(el3) el3.innerText = textProd;
  if(el4) el4.innerText = textKat;
}

function switchTab(tab, pushHistory = true) {
  activeTab = tab;
  let pages = ['beranda', 'kasir', 'produk', 'laporan', 'setelan'];
  
  requestAnimationFrame(() => {
    pages.forEach(p => {
      let el = document.getElementById('page' + p.charAt(0).toUpperCase() + p.slice(1));
      let nav = document.getElementById('nav' + p.charAt(0).toUpperCase() + p.slice(1));
      let desktopNav = document.getElementById('desktopNav' + p.charAt(0).toUpperCase() + p.slice(1));

      if (p === tab) {
        if (el) el.classList.remove('hidden');
        if (nav) nav.className = "flex flex-col items-center justify-center flex-1 py-1 text-indigo-700 font-bold text-[9px] gap-0.5 transition-all no-std-btn";
        if (desktopNav) desktopNav.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-700 bg-indigo-50/90 backdrop-blur-md border border-indigo-100 transition-all text-xs font-bold shadow-xs";
      } else {
        if (el) el.classList.add('hidden');
        if (nav) nav.className = "flex flex-col items-center justify-center flex-1 py-1 text-slate-700 font-medium text-[9px] gap-0.5 transition-all hover:text-indigo-700 no-std-btn";
        if (desktopNav) desktopNav.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-white/60 backdrop-blur-sm transition-all text-xs font-semibold no-std-btn border border-transparent";
      }
    });
  });

  if (pushHistory) {
    window.history.pushState({ tab: tab }, "", "#" + tab);
  }
}

function switchSubTxTab(sub) {
  if (sub === 'tx') {
    document.getElementById('subContentTransaksi').classList.remove('hidden');
    document.getElementById('subContentHutang').classList.add('hidden');
    document.getElementById('subTabTxBtn').className = "w-1/2 pb-2 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
    document.getElementById('subTabHpBtn').className = "w-1/2 pb-2 text-slate-500 hover:text-slate-900 font-medium transition-all text-xs no-std-btn";
  } else {
    document.getElementById('subContentTransaksi').classList.add('hidden');
    document.getElementById('subContentHutang').classList.remove('hidden');
    document.getElementById('subTabHpBtn').className = "w-1/2 pb-2 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
    document.getElementById('subTabTxBtn').className = "w-1/2 pb-2 text-slate-500 hover:text-slate-900 font-medium transition-all text-xs no-std-btn";
  }
}

function switchSubProdukTab(sub) {
  if (sub === 'produk') {
    document.getElementById('subContentDaftarProduk').classList.remove('hidden');
    document.getElementById('subContentKelolaKategori').classList.add('hidden');
    document.getElementById('subTabProdukBtn').className = "w-1/2 pb-2 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
    document.getElementById('subTabKategoriBtn').className = "w-1/2 pb-2 text-slate-500 hover:text-slate-900 font-semibold transition-all text-xs no-std-btn";
  } else {
    document.getElementById('subContentDaftarProduk').classList.add('hidden');
    document.getElementById('subContentKelolaKategori').classList.remove('hidden');
    document.getElementById('subTabKategoriBtn').className = "w-1/2 pb-2 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
    document.getElementById('subTabProdukBtn').className = "w-1/2 pb-2 text-slate-500 hover:text-slate-900 font-semibold transition-all text-xs no-std-btn";
    renderKategoriList();
  }
}

function switchProductSubTab(sub) {
  produkTabSubActive = sub;
  let favWrapper = document.getElementById('tabListProdukFavoritWrapper');
  let lainWrapper = document.getElementById('tabListProdukLainnyaWrapper');
  let btnFav = document.getElementById('subTabFavBtn');
  let btnLain = document.getElementById('subTabLainBtn');

  if (sub === 'favorit') {
    favWrapper.classList.remove('hidden');
    lainWrapper.classList.add('hidden');
    btnFav.className = "w-1/2 pb-2 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
    btnLain.className = "w-1/2 pb-2 text-slate-500 hover:text-slate-900 font-medium transition-all text-xs no-std-btn";
  } else {
    favWrapper.classList.add('hidden');
    lainWrapper.classList.remove('hidden');
    btnLain.className = "w-1/2 pb-2 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
    btnFav.className = "w-1/2 pb-2 text-slate-500 hover:text-slate-900 font-medium transition-all text-xs no-std-btn";
  }
  renderProdukTabList();
}

function isDateInPeriod(dateStr, period) {
  if (period === 'semua' || !period) return true;
  if (!dateStr) return false;
  
  let d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  
  d = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  let now = new Date();
  let startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === 'hari_ini') return d.getTime() === startOfToday.getTime();
  
  if (period === 'minggu_ini') {
    let startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    let endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return d >= startOfWeek && d <= endOfWeek;
  }
  
  if (period === 'minggu_lalu') {
    let startOfThisWeek = new Date(startOfToday);
    startOfThisWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    let startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
    let endOfLastWeek = new Date(startOfThisWeek);
    endOfLastWeek.setDate(startOfThisWeek.getDate() - 1);
    return d >= startOfLastWeek && d <= endOfLastWeek;
  }
  
  if (period === 'bulan_ini') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  
  if (period === 'bulan_lalu') {
    let prevMonth = now.getMonth() - 1;
    let year = now.getFullYear();
    if (prevMonth < 0) { prevMonth = 11; year--; }
    return d.getMonth() === prevMonth && d.getFullYear() === year;
  }
  
  if (period === 'tahun_ini') return d.getFullYear() === now.getFullYear();
  if (period === 'tahun_lalu') return d.getFullYear() === (now.getFullYear() - 1);
  
  return true;
}

function setTxFilter(filter) {
  activeTxFilter = filter;
  berandaPage = 1;
  document.querySelectorAll('.tx-filter-btn').forEach(btn => {
    btn.className = btn.dataset.filter === filter ? 
      "tx-filter-btn bg-indigo-600 border border-indigo-600 text-white px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-[10px] shadow-xs" : 
      "tx-filter-btn bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md whitespace-nowrap hover:bg-slate-50 text-[10px] shadow-xs";
  });
  renderTransaksi();
}

function renderTransaksi() {
  let totPemasukan = 0, totModal = 0, totUntung = 0;
  
  let now = new Date();
  let thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  let labelTxTitle = document.getElementById('txHistoryTitle');
  if (labelTxTitle) {
    let titleMap = {
      'semua': 'Riwayat Transaksi (30 Hari Terakhir)',
      'bulan_ini': 'Riwayat Transaksi (Bulan ini)',
      'bulan_lalu': 'Riwayat Transaksi (Bulan Lalu)',
      'minggu_ini': 'Riwayat Transaksi (Minggu ini)',
      'minggu_lalu': 'Riwayat Transaksi (Minggu Lalu)',
      'hari_ini': 'Riwayat Transaksi (Hari ini)'
    };
    labelTxTitle.innerText = titleMap[activeTxFilter] || 'Riwayat Transaksi';
  }

  let filteredTx = (appData.transactions || []).filter(t => {
    if (!t.tanggal) return false;
    let d = new Date(t.tanggal);
    if (isNaN(d.getTime())) return true;
    let isWithin30Days = d >= thirtyDaysAgo;
    
    if (activeTxFilter === 'semua') {
      return isWithin30Days;
    }
    return isDateInPeriod(t.tanggal, activeTxFilter);
  });

  filteredTx.forEach(t => {
    totPemasukan += (t.pemasukan || 0);
    totModal += (t.modal || 0);
    totUntung += (t.untung || 0);
  });

  let persenUntung = totModal > 0 
    ? ((totUntung / totModal) * 100).toFixed(1) 
    : (totUntung > 0 ? "100.0" : "0.0");
  let txCopy = [...filteredTx].reverse();

  let totalPagesBeranda = Math.ceil(txCopy.length / BERANDA_ITEMS_PER_PAGE) || 1;
  if (berandaPage > totalPagesBeranda) berandaPage = totalPagesBeranda;
  if (berandaPage < 1) berandaPage = 1;

  let startIdx = (berandaPage - 1) * BERANDA_ITEMS_PER_PAGE;
  let paginatedTx = txCopy.slice(startIdx, startIdx + BERANDA_ITEMS_PER_PAGE);

  let grouped = {};
  paginatedTx.forEach(t => {
    let dateStr = t.tanggal ? t.tanggal.split('T')[0] : '';
    if (!grouped[dateStr]) grouped[dateStr] = { items: [], dayUntung: 0 };
    grouped[dateStr].items.push(t);
    grouped[dateStr].dayUntung += (t.untung || 0);
  });

  let sumUntungEl = document.getElementById('summaryUntung');
  let sumPersenEl = document.getElementById('summaryPersenUntung');
  let sumPemEl = document.getElementById('summaryPemasukan');
  let sumModEl = document.getElementById('summaryModal');
  
  if(sumUntungEl) sumUntungEl.innerText = formatRp(totUntung);
  if(sumPersenEl) sumPersenEl.innerText = `${persenUntung}%`;
  if(sumPemEl) sumPemEl.innerText = formatRp(totPemasukan);
  if(sumModEl) sumModEl.innerText = "-" + formatRp(totModal);

  let container = document.getElementById('listTransaksiContainer');
  let berandaInfo = document.getElementById('berandaPaginationInfo');
  let berandaPrev = document.getElementById('berandaPrevBtn');
  let berandaNext = document.getElementById('berandaNextBtn');

  if(!container) return;
  container.innerHTML = "";

  let groupKeys = Object.keys(grouped);
  if (groupKeys.length === 0) {
    let emptyText = activeTxFilter === 'semua' 
      ? 'Tidak ada catatan transaksi dalam 30 hari terakhir' 
      : 'Tidak ada catatan transaksi pada periode ini';
    container.innerHTML = `<div class="text-center py-6 modern-card text-slate-500 text-xs">${emptyText}</div>`;
    if(berandaInfo) berandaInfo.innerText = "Hal 1 dari 1";
    if(berandaPrev) berandaPrev.disabled = true;
    if(berandaNext) berandaNext.disabled = true;
    return;
  }

  groupKeys.sort((a, b) => new Date(b) - new Date(a));

  groupKeys.forEach(date => {
    let group = grouped[date];
    let section = document.createElement('div');
    section.className = "modern-card overflow-hidden shadow-xs";
    
    let header = document.createElement('div');
    header.className = "bg-white/60 backdrop-blur-md px-3 py-2 text-xs flex justify-between font-bold border-b border-slate-200 text-slate-900";
    
    let titleSpan = document.createElement('span');
    titleSpan.textContent = formatFormattedDate(date);
    
    let untungSpan = document.createElement('span');
    untungSpan.className = "text-emerald-700 font-black";
    untungSpan.textContent = `Untung ${formatRp(group.dayUntung)}`;
    
    header.appendChild(titleSpan);
    header.appendChild(untungSpan);
    section.appendChild(header);

    group.items.forEach(item => {
      let itemDiv = document.createElement('div');
      itemDiv.className = "p-3 border-b border-slate-200 last:border-b-0 flex justify-between items-start text-xs cursor-pointer hover:bg-white/50 backdrop-blur-sm transition-colors";
      itemDiv.onclick = () => openDetailCatatanById(item.id);

      let leftDiv = document.createElement('div');
      let titleDiv = document.createElement('div');
      titleDiv.className = "font-bold text-slate-900 text-xs";
      titleDiv.textContent = item.catatan || item.kategori;

      let descDiv = document.createElement('div');
      descDiv.className = "text-slate-600 text-[10px] mt-0.5 flex items-center gap-1 flex-wrap";
      
      let spanKat = document.createElement('span');
      spanKat.textContent = `${item.kategori \vert{}\vert{} 'Umum'}${item.subKategori ? '• ' + item.subKategori : ''}`;
      descDiv.appendChild(spanKat);

      if (item.status === 'Belum Lunas') {
        let badgeSpan = document.createElement('span');
        badgeSpan.className = "bg-rose-50/90 backdrop-blur-sm text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[9px] font-bold";
        badgeSpan.textContent = "Belum lunas";
        descDiv.appendChild(badgeSpan);
      }

      leftDiv.appendChild(titleDiv);
      leftDiv.appendChild(descDiv);

      let rightDiv = document.createElement('div');
      rightDiv.className = "text-right";

      if (item.pemasukan > 0) {
        let pemDiv = document.createElement('div');
        pemDiv.className = "font-bold text-emerald-700 text-xs";
        pemDiv.textContent = `+${formatRp(item.pemasukan)}`;
        rightDiv.appendChild(pemDiv);
      }
      if (item.pengeluaran > 0) {
        let pengDiv = document.createElement('div');
        pengDiv.className = "font-bold text-rose-600 text-xs";
        pengDiv.textContent = `-${formatRp(item.pengeluaran)}`;
        rightDiv.appendChild(pengDiv);
      }

      itemDiv.appendChild(leftDiv);
      itemDiv.appendChild(rightDiv);
      section.appendChild(itemDiv);
    });

    container.appendChild(section);
  });

  if(berandaInfo) berandaInfo.innerText = `Hal ${berandaPage} dari${totalPagesBeranda}`;
  if(berandaPrev) berandaPrev.disabled = (berandaPage <= 1);
  if(berandaNext) berandaNext.disabled = (berandaPage >= totalPagesBeranda);
}

function changeBerandaPage(delta) {
  let now = new Date();
  let thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  let filteredTx = (appData.transactions || []).filter(t => {
    if (!t.tanggal) return false;
    let d = new Date(t.tanggal);
    if (isNaN(d.getTime())) return true;
    let isWithin30Days = d >= thirtyDaysAgo;
    
    if (activeTxFilter === 'semua') {
      return isWithin30Days;
    }
    return isDateInPeriod(t.tanggal, activeTxFilter);
  });

  let totalPagesBeranda = Math.ceil(filteredTx.length / BERANDA_ITEMS_PER_PAGE) || 1;
  berandaPage += delta;
  if (berandaPage < 1) berandaPage = 1;
  if (berandaPage > totalPagesBeranda) berandaPage = totalPagesBeranda;
  renderTransaksi();
}

function openDetailCatatanById(id) {
  let targetId = safeStringId(id);
  let item = (appData.transactions || []).find(t => safeStringId(t.id) === targetId);
  if (item) openDetailCatatan(item);
}

function setHpFilter(filter) {
  activeHpFilter = filter;
  document.querySelectorAll('.hp-filter-btn').forEach(btn => {
    btn.className = btn.dataset.hpfilter === filter ? 
      "hp-filter-btn bg-indigo-600 border border-indigo-600 text-white px-2.5 py-1 rounded-md font-bold whitespace-nowrap text-[10px] shadow-xs" : 
      "hp-filter-btn bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md whitespace-nowrap hover:bg-slate-50 text-[10px] shadow-xs";
  });
  renderHutang();
}

function renderHutang() {
  let searchQuery = document.getElementById('searchHutangInput') ? document.getElementById('searchHutangInput').value.toLowerCase() : '';
  let hpMap = {};

  let totalGlobalHutang = 0;
  let totalGlobalLunas = 0;
  let totalGlobalBelumLunas = 0;

  (appData.transactions || []).forEach(t => {
    if (t.namaPelanggan || t.jenis === 'hutang_saya') {
      let nominal = (t.pemasukan || t.pengeluaran || t.modal || 0);
      totalGlobalHutang += nominal;
      if (t.status === 'Lunas') {
        totalGlobalLunas += nominal;
      } else {
        totalGlobalBelumLunas += nominal;
      }
    }
  });

  let elTotal = document.getElementById('summaryTotalHutang');
  let elLunas = document.getElementById('summaryHutangLunas');
  let elBelumLunas = document.getElementById('summaryHutangBelumLunas');

  if (elTotal) elTotal.innerText = formatRp(totalGlobalHutang);
  if (elLunas) elLunas.innerText = formatRp(totalGlobalLunas);
  if (elBelumLunas) elBelumLunas.innerText = formatRp(totalGlobalBelumLunas);

  (appData.transactions || []).forEach(t => {
    let matchFilter = (activeHpFilter === 'semua') || 
                      (activeHpFilter === 'belum_lunas' && t.status === 'Belum Lunas') || 
                      (activeHpFilter === 'sudah_lunas' && t.status === 'Lunas');

    if (matchFilter && (t.namaPelanggan || t.jenis === 'hutang_saya')) {
      let pihak = t.namaPelanggan || "Hutang Saya (" + (t.catatan || "Umum") + ")";
      
      if (pihak.toLowerCase().includes(searchQuery)) {
        if (!hpMap[pihak]) hpMap[pihak] = { total: 0, items: [] };
        let nominal = (t.pemasukan || t.pengeluaran || t.modal || 0);
        hpMap[pihak].total += nominal;
        hpMap[pihak].items.push(t);
      }
    }
  });

  let container = document.getElementById('listHutangContainer');
  if(!container) return;
  let names = Object.keys(hpMap);
  names.sort((a,b) => a.localeCompare(b));

  if (names.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-slate-500 text-xs">Tidak ada data hutang/piutang</div>`;
    return;
  }

  let htmlContent = "";
  names.forEach(nama => {
    let record = hpMap[nama];
    let firstItem = record.items[0];
    let initial = (nama && nama.length > 0) ? nama.charAt(0).toUpperCase() : '?';
    let safeNama = nama.replace(/'/g, "\\'");
    
    htmlContent += `
      <div onclick="bukaHutangPelangganOtomatis('${safeNama}')" class="p-3 flex justify-between items-center text-xs cursor-pointer hover:bg-slate-50/80 backdrop-blur-sm transition-colors">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg ${firstItem.jenis === 'hutang_saya' ? 'bg-amber-50/90 backdrop-blur-sm text-amber-700 border border-amber-200' : 'bg-rose-50/90 backdrop-blur-sm text-rose-700 border border-rose-200'} font-bold flex items-center justify-center text-xs shadow-xs">${initial}</div>
          <div>
            <div class="font-bold text-slate-900 text-xs">${nama}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">${firstItem.jenis === 'hutang_saya' ? 'Hutang Saya' : 'Hutang Pelanggan'} •${record.items.length} transaksi</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-black text-slate-900 text-xs">${formatRp(record.total)}</div>
          <div class="text-[9px] ${firstItem.status === 'Belum Lunas' ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'} mt-0.5">${firstItem.status}</div>
        </div>
      </div>
    `;
  });
  container.innerHTML = htmlContent;
}

function bukaHutangPelangganOtomatis(namaPelanggan) {
  if (!namaPelanggan) return;

  let matchingTx = (appData.transactions || []).filter(t => {
    let pihak = t.namaPelanggan || "Hutang Saya (" + (t.catatan || "Umum") + ")";
    return pihak.toLowerCase() === namaPelanggan.toLowerCase();
  });

  if (matchingTx.length === 0) {
    showToast("Tidak ada riwayat transaksi ditemukan", "error");
    return;
  }

  let titleEl = document.getElementById('titleDaftarTxPelanggan');
  let subTitleEl = document.getElementById('subtitleDaftarTxPelanggan');
  if (titleEl) titleEl.innerText = namaPelanggan;
  if (subTitleEl) subTitleEl.innerText = `${matchingTx.length} riwayat transaksi terkait`;

  let totalNominal = 0;
  let sisaHutang = 0;

  matchingTx.forEach(t => {
    let nominal = (t.pemasukan || t.pengeluaran || t.modal || 0);
    totalNominal += nominal;
    
    if (t.status === 'Belum Lunas') {
      let riwayat = t.riwayatBayar || [];
      let sudahBayar = riwayat.reduce((acc, r) => acc + (r.nominal || 0), 0) + (t.bayarAwal || t.bayar || 0);
      sisaHutang += Math.max(0, nominal - sudahBayar);
    }
  });

  let totalNominalEl = document.getElementById('dtPelangganTotalNominal');
  if (totalNominalEl) totalNominalEl.innerText = formatRp(totalNominal);
  
  let statusAkhirEl = document.getElementById('dtPelangganStatusAkhir');
  if (statusAkhirEl) {
    if (sisaHutang > 0) {
      statusAkhirEl.innerText = `${formatRp(sisaHutang)}`;
      statusAkhirEl.className = "font-bold text-rose-600 text-xs mt-0.5";
    } else {
      statusAkhirEl.innerText = "Lunas";
      statusAkhirEl.className = "font-bold text-emerald-700 text-xs mt-0.5";
    }
  }

  let container = document.getElementById('listTransaksiPelangganContainer');
  if (container) {
    let htmlContent = "";
    matchingTx.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    matchingTx.forEach(t => {
      let nominal = t.pemasukan || t.pengeluaran || t.modal || 0;
      let riwayat = t.riwayatBayar || [];
      let totalBayar = riwayat.reduce((acc, r) => acc + (r.nominal || 0), 0) + (t.bayarAwal || t.bayar || 0);
      let riwayatText = riwayat.length > 0 ? `<div class="text-[9px] text-indigo-600 mt-0.5">${riwayat.length}x dicicil (Total:${formatRp(totalBayar)})</div>` : '';

      htmlContent += `
        <div onclick="pilihTransaksiDariDaftarPelanggan('${t.id}')" class="py-2 border-b border-slate-100 last:border-b-0 text-xs flex justify-between items-center hover:bg-slate-50/80 cursor-pointer transition-colors px-1 rounded-lg">
          <div class="flex-1 pr-2">
            <div class="font-bold text-slate-900">${t.catatan || t.kategori}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">${formatFormattedDate(t.tanggal)} • <span class="${t.status === 'Belum Lunas' ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'}">${t.status}</span></div>${riwayatText}
          </div>
          <div class="text-right flex flex-col items-end gap-0.5">
            <div class="font-black text-slate-900">${formatRp(nominal)}</div>${t.status === 'Belum Lunas' ? `
              <button onclick="event.stopPropagation(); prosesBayarHutangSatuanDirect('${t.id}')" class="no-std-btn px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[8px] transition-all shadow-xs leading-none">
                Bayar / Cicil
              </button>
            ` : ''}
          </div>
        </div>
      `;
    });
    container.innerHTML = htmlContent;
  }

  openModal('modalDaftarTransaksiPelanggan');
}

function setAnFilter(filter) {
  activeAnFilter = filter;
  document.querySelectorAll('.an-filter-btn').forEach(btn => {
    btn.className = btn.dataset.anfilter === filter ? 
      "an-filter-btn bg-indigo-600 border border-indigo-600 text-white px-2.5 py-1 rounded-md font-bold whitespace-nowrap shrink-0 text-[10px] shadow-xs" : 
      "an-filter-btn bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md whitespace-nowrap hover:bg-slate-50 shrink-0 text-[10px] shadow-xs";
  });
  
  let labelMap = {
    'tahun_ini': 'Total transaksi tahun ini',
    'tahun_lalu': 'Total transaksi tahun lalu',
    'bulan_ini': 'Total transaksi bulan ini',
    'bulan_lalu': 'Total transaksi bulan lalu',
    'minggu_ini': 'Total transaksi minggu ini'
  };
  let lblTx = document.getElementById('anLabelTransaksi');
  if(lblTx) lblTx.innerText = labelMap[filter] || 'Total transaksi';

  let titleMap = {
    'tahun_ini': 'Keuntungan tahun ini',
    'tahun_lalu': 'Keuntungan tahun lalu',
    'bulan_ini': 'Keuntungan bulan ini',
    'bulan_lalu': 'Keuntungan bulan lalu',
    'minggu_ini': 'Keuntungan minggu ini'
  };
  let lblKeuntunganJudul = document.getElementById('anLabelKeuntunganJudul');
  if(lblKeuntunganJudul) lblKeuntunganJudul.innerText = titleMap[filter] || 'Keuntungan';

  renderAnalisis();
}

function renderAnalisis() {
  let filtered = (appData.transactions || []).filter(t => isDateInPeriod(t.tanggal, activeAnFilter));
  let totUntung = filtered.reduce((acc, t) => acc + (t.untung || 0), 0);
  let totalTxCount = filtered.length;

  let prevFilter = '';
  if (activeAnFilter === 'tahun_ini') prevFilter = 'tahun_lalu';
  else if (activeAnFilter === 'bulan_ini') prevFilter = 'bulan_lalu';

  let prevUntung = 0;
  let prevTxCount = 0;

  if (prevFilter) {
    let filteredPrev = (appData.transactions || []).filter(t => isDateInPeriod(t.tanggal, prevFilter));
    prevUntung = filteredPrev.reduce((acc, t) => acc + (t.untung || 0), 0);
    prevTxCount = filteredPrev.length;
  }

  let selisihNominal = totUntung - prevUntung;
  let persentase = prevUntung > 0 ? ((selisihNominal / prevUntung) * 100).toFixed(1) : (totUntung > 0 ? "100" : "0");
  
  let selisihEl = document.getElementById('anSelisihVal');
  let iconEl = document.getElementById('anSelisihIcon');
  let isNaik = selisihNominal >= 0;
  let tanda = isNaik ? "+" : "";

  if(selisihEl) selisihEl.innerText = `${tanda}${persentase}% (${tanda}${formatRp(selisihNominal)})`;
  
  if (isNaik) {
    if(iconEl) iconEl.innerHTML = '<i class="fa-solid fa-arrow-up text-emerald-700 font-bold"></i>';
    if(selisihEl) selisihEl.className = "font-bold text-emerald-700 text-xs";
  } else {
    if(iconEl) iconEl.innerHTML = '<i class="fa-solid fa-arrow-down text-rose-600 font-bold"></i>';
    if(selisihEl) selisihEl.className = "font-bold text-rose-600 text-xs";
  }

  let selisihTx = totalTxCount - prevTxCount;
  let persentaseTx = prevTxCount > 0 ? ((selisihTx / prevTxCount) * 100).toFixed(1) : (totalTxCount > 0 ? "100" : "0");
  
  let selisihTxEl = document.getElementById('anTxSelisihVal');
  let iconTxEl = document.getElementById('anTxSelisihIcon');
  let isTxNaik = selisihTx >= 0;
  let tandaTx = isTxNaik ? "+" : "";

  if(selisihTxEl) selisihTxEl.innerText = `${tandaTx}${persentaseTx}% (${tandaTx}${Number(selisihTx).toLocaleString('id-ID')} Transaksi)`;
  
  if (isTxNaik) {
    if(iconTxEl) iconTxEl.innerHTML = '<i class="fa-solid fa-arrow-up text-emerald-700 font-bold"></i>';
    if(selisihTxEl) selisihTxEl.className = "font-bold text-emerald-700 text-xs";
  } else {
    if(iconTxEl) iconTxEl.innerHTML = '<i class="fa-solid fa-arrow-down text-rose-600 font-bold"></i>';
    if(selisihTxEl) selisihTxEl.className = "font-bold text-rose-600 text-xs";
  }

  let anUnt = document.getElementById('anTotalUntung');
  let anTx = document.getElementById('anTotalTx');
  if(anUnt) anUnt.innerText = formatRp(totUntung);
  if(anTx) anTx.innerText = Number(totalTxCount).toLocaleString('id-ID') + " Transaksi";

  let dayGroup = {};
  filtered.forEach(t => {
    let d = t.tanggal ? t.tanggal.split('T')[0] : '';
    if (!dayGroup[d]) dayGroup[d] = { untung: 0, count: 0 };
    dayGroup[d].untung += (t.untung || 0);
    dayGroup[d].count += 1;
  });

  let days = Object.keys(dayGroup);
  if (days.length > 0) {
    let maxUntungDay = days.reduce((a, b) => dayGroup[a].untung >= dayGroup[b].untung ? a : b);
    let minUntungDay = days.reduce((a, b) => dayGroup[a].untung <= dayGroup[b].untung ? a : b);
    document.getElementById('anUntungTinggiHari').innerText = formatFormattedDate(maxUntungDay);
    document.getElementById('anUntungTinggiVal').innerText = formatRp(dayGroup[maxUntungDay].untung);
    document.getElementById('anUntungRendahHari').innerText = formatFormattedDate(minUntungDay);
    document.getElementById('anUntungRendahVal').innerText = formatRp(dayGroup[minUntungDay].untung);

    let maxTxDay = days.reduce((a, b) => dayGroup[a].count >= dayGroup[b].count ? a : b);
    let minTxDay = days.reduce((a, b) => dayGroup[a].count <= dayGroup[b].count ? a : b);
    document.getElementById('anTxTinggiHari').innerText = formatFormattedDate(maxTxDay);
    document.getElementById('anTxTinggiVal').innerText = Number(dayGroup[maxTxDay].count).toLocaleString('id-ID') + " Transaksi";
    document.getElementById('anTxRendahHari').innerText = formatFormattedDate(minTxDay);
    document.getElementById('anTxRendahVal').innerText = Number(dayGroup[minTxDay].count).toLocaleString('id-ID') + " Transaksi";
  } else {
    document.getElementById('anUntungTinggiHari').innerText = "-";
    document.getElementById('anUntungTinggiVal').innerText = "Rp0";
    document.getElementById('anUntungRendahHari').innerText = "-";
    document.getElementById('anUntungRendahVal').innerText = "Rp0";
    document.getElementById('anTxTinggiHari').innerText = "-";
    document.getElementById('anTxTinggiVal').innerText = "0 Transaksi";
    document.getElementById('anTxRendahHari').innerText = "-";
    document.getElementById('anTxRendahVal').innerText = "0 Transaksi";
  }

  let catMap = {};
  filtered.forEach(t => {
    let katName = t.kategori || 'Umum';
    if (!catMap[katName]) catMap[katName] = { count: 0, untung: 0 };
    catMap[katName].count++;
    catMap[katName].untung += (t.untung || 0);
  });

  let sortedCats = Object.keys(catMap).map(k => ({ name: k, ...catMap[k] })).sort((a,b) => b.untung - a.untung).slice(0, 3);
  let catContainer = document.getElementById('anTopKategori');
  if(!catContainer) return;

  if (sortedCats.length === 0) {
    catContainer.innerHTML = `<div class="py-2.5 text-center text-slate-500">Belum ada data</div>`;
    return;
  }

  let htmlContent = "";
  sortedCats.forEach(c => {
    htmlContent += `
      <div class="py-2 flex justify-between items-center text-xs">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="text-slate-900 font-medium">${c.name}</span>
        </div>
        <div class="text-right">
          <span class="text-slate-600 mr-1.5 text-[10px]">${Number(c.count).toLocaleString('id-ID')}x</span>
          <span class="font-bold text-emerald-700">${formatRp(c.untung)}</span>
        </div>
      </div>
    `;
  });
  catContainer.innerHTML = htmlContent;
}

function renderKategoriDropdown() {
  let categories = (appData.categories && typeof appData.categories === 'object') ? appData.categories : {};
  let mainKeys = Object.keys(categories).sort((a,b) => a.localeCompare(b));

  let selectTx = document.getElementById('formKategori');
  if (selectTx) {
    let currentTxVal = selectTx.value;
    selectTx.innerHTML = "";
    mainKeys.forEach(cat => {
      let opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      selectTx.appendChild(opt);
    });
    if (mainKeys.includes(currentTxVal)) selectTx.value = currentTxVal;
  }

  let selectProdKat = document.getElementById('prodKategori');
  if (selectProdKat) {
    let currentProdKat = selectProdKat.value;
    selectProdKat.innerHTML = "";
    mainKeys.forEach(cat => {
      let opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      selectProdKat.appendChild(opt);
    });
    if (mainKeys.includes(currentProdKat)) {
      selectProdKat.value = currentProdKat;
    } else if (mainKeys.length > 0) {
      selectProdKat.selectedIndex = 0;
    }
    onProdKategoriChange(selectProdKat.value);
  }

  let selectKasirKat = document.getElementById('kasirKategoriSelect');
  if (selectKasirKat) {
    let currentKasirKatVal = selectKasirKat.value;
    selectKasirKat.innerHTML = "";
    
    let optDef = document.createElement('option');
    optDef.value = "Penjualan Kasir";
    optDef.innerText = "Penjualan Kasir";
    selectKasirKat.appendChild(optDef);

    mainKeys.forEach(cat => {
      let opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      selectKasirKat.appendChild(opt);
    });

    if (currentKasirKatVal && mainKeys.includes(currentKasirKatVal)) {
      selectKasirKat.value = currentKasirKatVal;
    }
  }

  let selectParentKat = document.getElementById('katParentSelect');
  if (selectParentKat) {
    selectParentKat.innerHTML = "";
    mainKeys.forEach(cat => {
      let opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      selectParentKat.appendChild(opt);
    });
  }
}

function onProdKategoriChange(selectedMainKat) {
  let selectSub = document.getElementById('prodSubKategori');
  if (!selectSub) return;
  let currentSubVal = selectSub.value;
  selectSub.innerHTML = "";

  let subs = (appData.categories && appData.categories[selectedMainKat] && Array.isArray(appData.categories[selectedMainKat])) ? appData.categories[selectedMainKat] : [];
  subs.sort((a,b) => a.localeCompare(b));

  subs.forEach(sub => {
    let opt = document.createElement('option');
    opt.value = sub;
    opt.innerText = sub;
    selectSub.appendChild(opt);
  });

  if (subs.includes(currentSubVal)) {
    selectSub.value = currentSubVal;
  }
}

function renderKategoriList() {
  let container = document.getElementById('listKategoriContainer');
  if (!container) return;
  
  let categories = (appData.categories && typeof appData.categories === 'object') ? appData.categories : {};
  let mainKeys = Object.keys(categories).sort((a, b) => a.localeCompare(b));

  if (mainKeys.length === 0) {
    container.innerHTML = `<div class="py-5 text-center text-slate-500 text-xs">Belum ada kategori</div>`;
    return;
  }

  let htmlContent = "";
  mainKeys.forEach(mainKat => {
    let subs = Array.isArray(categories[mainKat]) ? categories[mainKat] : [];
    let iconClass = getCategoryIcon(mainKat);
    let safeId = mainKat.replace(/[^a-zA-Z0-9]/g, '_');
    
    let subsHtml = subs.map(sub => `
      <div class="py-2 pl-8 pr-2.5 flex justify-between items-center text-xs text-slate-700 hover:bg-slate-100/85 border-t border-slate-200">
        <span class="flex items-center gap-1.5"><i class="fa-solid fa-angle-right text-[9px] text-indigo-600"></i> ${sub}</span>
        <div class="flex items-center gap-1">
          <button onclick="openFormKategoriEditSub('${mainKat}', '${sub}')" class="w-5 h-5 bg-white/80 backdrop-blur-sm text-indigo-700 rounded flex items-center justify-center border border-slate-200 hover:bg-slate-100 transition-all no-std-btn shadow-xs" title="Edit Sub">
            <i class="fa-solid fa-pen text-[8px]"></i>
          </button>
          <button onclick="hapusSubKategori('${mainKat}', '${sub}')" class="w-5 h-5 bg-rose-50/90 backdrop-blur-sm text-rose-600 rounded flex items-center justify-center border border-rose-200 hover:bg-rose-100 transition-all no-std-btn shadow-xs" title="Hapus Sub">
            <i class="fa-solid fa-trash text-[8px]"></i>
          </button>
        </div>
      </div>
    `).join('');

    htmlContent += `
      <div class="py-2.5 border-b border-slate-200 last:border-b-0">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2.5 cursor-pointer select-none flex-1" onclick="toggleSubKategori('${safeId}')">
            <div class="w-7 h-7 rounded-lg bg-white/80 backdrop-blur-sm text-indigo-700 flex items-center justify-center text-xs border border-slate-200 shadow-xs">
              <i class="fa-solid ${iconClass} text-[10px]"></i>
            </div>
            <div>
              <span class="font-bold text-slate-900 text-xs">${mainKat}</span>
              <div class="text-[9px] text-slate-600 font-medium">${subs.length} sub-kategori (Ketuk untuk lihat)</div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="openFormKategoriTambahSub('${mainKat}')" class="px-2 py-1 bg-emerald-50/90 backdrop-blur-sm text-emerald-700 rounded-lg font-semibold text-[9px] border border-emerald-200 hover:bg-emerald-100 transition-all no-std-btn shadow-xs" title="Tambah Sub">
              <i class="fa-solid fa-plus text-[8px]"></i> Sub
            </button>
            <button onclick="openFormKategoriEditUtama('${mainKat}')" class="w-6 h-6 bg-white/80 backdrop-blur-sm text-indigo-700 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-100 transition-all no-std-btn shadow-xs" title="Edit">
              <i class="fa-solid fa-pen text-[10px]"></i>
            </button>
            <button onclick="hapusKategoriUtama('${mainKat}')" class="w-6 h-6 bg-rose-50/90 backdrop-blur-sm text-rose-600 rounded-lg flex items-center justify-center border border-rose-200 hover:bg-slate-100 transition-all no-std-btn shadow-xs" title="Hapus">
              <i class="fa-solid fa-trash text-[10px]"></i>
            </button>
          </div>
        </div>
        <div id="subContainer_${safeId}" class="mt-2 bg-white/50 backdrop-blur-md rounded-xl overflow-hidden border border-slate-200 hidden shadow-xs">${subsHtml}</div>
      </div>
    `;
  });
  container.innerHTML = htmlContent;
  updateProductCategoryStats();
}

function toggleSubKategori(safeId) {
  let el = document.getElementById('subContainer_' + safeId);
  if (el) el.classList.toggle('hidden');
}

function openFormKategori(utamaName = "") {
  document.getElementById('katOldName').value = utamaName;
  document.getElementById('katParentOld').value = "";
  document.getElementById('katNama').value = utamaName;
  document.getElementById('katTipe').value = "utama";
  onKatTipeChange("utama");
  document.getElementById('titleFormKategori').innerText = utamaName ? "Edit Kategori Utama" : "Tambah Kategori";
  openModal('modalFormKategori');
}

function openFormKategoriTambahSub(utamaName) {
  document.getElementById('katOldName').value = "";
  document.getElementById('katParentOld').value = utamaName;
  document.getElementById('katNama').value = "";
  document.getElementById('katTipe').value = "sub";
  onKatTipeChange("sub");
  document.getElementById('katParentSelect').value = utamaName;
  document.getElementById('titleFormKategori').innerText = `Tambah Sub Kategori ke "${utamaName}"`;
  openModal('modalFormKategori');
}

function openFormKategoriEditUtama(utamaName) {
  openFormKategori(utamaName);
}

function openFormKategoriEditSub(utamaName, subName) {
  document.getElementById('katOldName').value = subName;
  document.getElementById('katParentOld').value = utamaName;
  document.getElementById('katNama').value = subName;
  document.getElementById('katTipe').value = "sub";
  onKatTipeChange("sub");
  document.getElementById('katParentSelect').value = utamaName;
  document.getElementById('titleFormKategori').innerText = `Edit Sub Kategori (${utamaName})`;
  openModal('modalFormKategori');
}

function onKatTipeChange(val) {
  let groupParent = document.getElementById('groupParentKat');
  let labelTarget = document.getElementById('labelNamaKatTarget');
  if (val === 'sub') {
    groupParent.classList.remove('hidden');
    labelTarget.innerText = "Sub Kategori";
  } else {
    groupParent.classList.add('hidden');
    labelTarget.innerText = "Kategori Utama";
  }
}

function submitKategori() {
  let tipe = document.getElementById('katTipe').value;
  let oldName = document.getElementById('katOldName').value;
  let newName = document.getElementById('katNama').value.trim();

  if (!newName) {
    showToast("Nama kategori/sub wajib diisi!", "error");
    return;
  }

  if (!appData.categories || typeof appData.categories !== 'object') appData.categories = {};

  if (tipe === 'utama') {
    if (oldName && oldName !== newName) {
      appData.categories[newName] = appData.categories[oldName] || [];
      delete appData.categories[oldName];

      (appData.products || []).forEach(p => {
        if (p.kategori === oldName) p.kategori = newName;
      });
      (appData.transactions || []).forEach(t => {
        if (t.kategori === oldName) t.kategori = newName;
      });
    } else if (!oldName) {
      if (appData.categories[newName]) {
        showToast("Kategori sudah ada!", "error");
        return;
      }
      appData.categories[newName] = [];
    }
  } else {
    let newParentKat = document.getElementById('katParentSelect').value;
    let oldParentKat = document.getElementById('katParentOld').value;

    if (!appData.categories[newParentKat]) appData.categories[newParentKat] = [];

    if (oldParentKat && oldParentKat !== newParentKat && oldName) {
      if (appData.categories[oldParentKat]) {
        appData.categories[oldParentKat] = appData.categories[oldParentKat].filter(s => s !== oldName);
      }
      if (!appData.categories[newParentKat].includes(newName)) {
        appData.categories[newParentKat].push(newName);
      }
    } else if (oldName) {
      let idx = appData.categories[newParentKat].indexOf(oldName);
      if (idx !== -1) appData.categories[newParentKat][idx] = newName;
    } else {
      if (appData.categories[newParentKat].includes(newName)) {
        showToast("Sub kategori sudah ada di kategori ini!", "error");
        return;
      }
      appData.categories[newParentKat].push(newName);
    }
  }

  saveCategoriesData();
}

function hapusKategoriUtama(catName) {
  showConfirm("Hapus Kategori Utama", `Apakah Anda yakin ingin menghapus kategori "${catName}" beserta seluruh sub kategorinya?`, function() {
    delete appData.categories[catName];
    saveCategoriesData();
  });
}

function hapusSubKategori(mainKat, subName) {
  showConfirm("Hapus Sub Kategori", `Apakah Anda yakin ingin menghapus sub kategori "${subName}"?`, function() {
    if (appData.categories[mainKat]) {
      appData.categories[mainKat] = appData.categories[mainKat].filter(s => s !== subName);
    }
    saveCategoriesData();
  });
}

function openDetailCatatan(item) {
  currentDetailItem = item;
  let statusEl = document.getElementById('dtStatus');
  if (statusEl) {
    statusEl.innerText = item.status;
    statusEl.className = item.status === 'Belum Lunas' ? 
      "bg-rose-50/90 backdrop-blur-sm text-rose-700 border border-rose-200 text-xs font-bold px-2 py-0.5 rounded-md" : 
      "bg-emerald-50/90 backdrop-blur-sm text-emerald-700 border border-emerald-200 text-xs font-bold px-2 py-0.5 rounded-md";
  }

  let nominal = item.pemasukan || item.pengeluaran || item.modal || 0;

  if (document.getElementById('dtPemasukan')) document.getElementById('dtPemasukan').innerText = formatRp(nominal);
  if (document.getElementById('dtModal')) document.getElementById('dtModal').innerText = "-" + formatRp(item.modal || 0);
  if (document.getElementById('dtUntung')) document.getElementById('dtUntung').innerText = formatRp(item.untung || 0);

  let containerRiwayat = document.getElementById('dtRiwayatBayarContainer');
  if (containerRiwayat) {
    if (item.riwayatBayar && item.riwayatBayar.length > 0) {
      containerRiwayat.classList.remove('hidden');
      let listHtml = item.riwayatBayar.map((r, i) => `
        <div class="py-1.5 border-b border-slate-100 last:border-b-0 flex justify-between items-center text-xs">
          <div>
            <div class="font-semibold text-slate-800">Cicilan ke-${i + 1} (${formatFormattedDate(r.tanggal)})</div>
            <div class="text-[9px] text-slate-500">${r.catatan || 'Pembayaran Hutang'}</div>
          </div>
          <div class="font-bold text-emerald-700">+${formatRp(r.nominal)}</div>
        </div>
      `).join('');
      containerRiwayat.innerHTML = `<div class="font-bold text-slate-900 mb-1 text-xs">Riwayat Pembayaran Cicilan:</div>` + listHtml;
    } else {
      containerRiwayat.classList.add('hidden');
      containerRiwayat.innerHTML = "";
    }
  }

  let btnBayarHutang = document.getElementById('btnBayarHutang');
  if (btnBayarHutang) {
    if (item.status === 'Belum Lunas') {
      btnBayarHutang.classList.remove('hidden');
      btnBayarHutang.onclick = function() {
        closeModal('modalDetailCatatan');
        prosesBayarHutangSatuan(item);
      };
    } else {
      btnBayarHutang.classList.add('hidden');
    }
  }

  if (item.jenis === 'hutang_saya') {
    if (document.getElementById('dtLabelNominal')) document.getElementById('dtLabelNominal').innerHTML = `<i class="fa-solid fa-hand-holding-dollar text-amber-600 text-xs"></i> Jumlah Hutang Saya`;
    if (document.getElementById('dtRowUntung')) document.getElementById('dtRowUntung').classList.add('hidden');
    if (document.getElementById('dtRowModal')) document.getElementById('dtRowModal').classList.add('hidden');
    if (document.getElementById('dtLabelOrang')) document.getElementById('dtLabelOrang').innerText = "Pemberi Hutang / Pihak";
  } else {
    if (document.getElementById('dtLabelNominal')) document.getElementById('dtLabelNominal').innerHTML = `<i class="fa-solid fa-caret-down text-emerald-600 text-xs"></i> Pemasukan`;
    if (document.getElementById('dtRowUntung')) document.getElementById('dtRowUntung').classList.remove('hidden');
    if (document.getElementById('dtRowModal')) document.getElementById('dtRowModal').classList.remove('hidden');
    if (document.getElementById('dtLabelOrang')) document.getElementById('dtLabelOrang').innerText = "Nama pelanggan";
  }

  if (item.namaPelanggan) {
    if (document.getElementById('dtRowPelanggan')) document.getElementById('dtRowPelanggan').classList.remove('hidden');
    if (document.getElementById('dtNamaPelanggan')) document.getElementById('dtNamaPelanggan').innerText = item.namaPelanggan;
  } else {
    if (document.getElementById('dtRowPelanggan')) document.getElementById('dtRowPelanggan').classList.add('hidden');
  }

  if (document.getElementById('dtCatatan')) document.getElementById('dtCatatan').innerText = item.catatan || "-";
  if (document.getElementById('dtKategori')) document.getElementById('dtKategori').innerText = (item.kategori || "Umum") + (item.subKategori ? " • " + item.subKategori : "");
  if (document.getElementById('dtTanggalTx')) document.getElementById('dtTanggalTx').innerText = formatFormattedDate(item.tanggal);

  let btnUbah = document.getElementById('btnUbahCatatan');
  if (btnUbah) {
    btnUbah.onclick = function() {
      closeModal('modalDetailCatatan');
      openFormEdit(item);
    };
  }

  let btnHapus = document.getElementById('btnHapusCatatan');
  if (btnHapus) {
    btnHapus.onclick = function() {
      showConfirm("Hapus Catatan", "Apakah Anda yakin ingin menghapus catatan ini?", function() {
        showLoading("Menghapus catatan...");
        dbDeleteTransaction(item.id).then(() => {
          hideLoading();
          closeModal('modalDetailCatatan');
          showToast("Catatan berhasil dihapus", "success");
        });
      });
    };
  }

  openModal('modalDetailCatatan');
}

function prosesBayarHutangSatuan(item) {
  let nominalTotal = item.pemasukan || item.pengeluaran || item.modal || 0;
  let riwayat = item.riwayatBayar || [];
  let totalSudahBayar = riwayat.reduce((acc, r) => acc + (r.nominal || 0), 0) + (item.bayarAwal || 0);
  let sisaHutang = Math.max(0, nominalTotal - totalSudahBayar);

  document.getElementById('modalCicilanSisaHutang').innerText = formatRp(sisaHutang);
  let inputElem = document.getElementById('inputNominalCicilanModal');
  inputElem.value = sisaHutang ? sisaHutang.toLocaleString('id-ID') : "";

  let btnSubmit = document.getElementById('btnSubmitCicilanModal');
  btnSubmit.onclick = async function() {
    let bayarVal = parseNumber(inputElem.value);
    if (bayarVal <= 0) {
      showToast("Nominal pembayaran harus lebih besar dari Rp0", "error");
      return;
    }

    closeModal('modalInputCicilan');

    let tglBayar = new Date().toISOString();
    riwayat.push({
      tanggal: tglBayar,
      nominal: bayarVal,
      catatan: "Cicilan via App"
    });

    let totalTerbayarBaru = totalSudahBayar + bayarVal;
    item.riwayatBayar = riwayat;
    item.bayar = totalTerbayarBaru;

    if (totalTerbayarBaru >= nominalTotal) {
      item.status = 'Lunas';
      showToast("Hutang telah LUNAS sepenuhnya!", "success");
    } else {
      showToast(`Pembayaran ${formatRp(bayarVal)} berhasil dicatat. Sisa hutang: ${formatRp(nominalTotal - totalTerbayarBaru)}`, "info");
    }

    showLoading("Menyimpan Pembayaran Hutang...");
    await dbSaveTransaction(item);
    hideLoading();
    openDetailCatatan(item);
  };

  openModal('modalInputCicilan');
}

function previewDetailReceipt() {
  if (!currentDetailItem) return;
  openReceiptPreview(currentDetailItem);
}

function bukaHutangPelangganDariDetail() {
  if (!currentDetailItem || !currentDetailItem.namaPelanggan) {
    showToast("Nama pelanggan tidak tersedia", "error");
    return;
  }
  let namaPelanggan = currentDetailItem.namaPelanggan;
  bukaHutangPelangganOtomatis(namaPelanggan);
}

function pilihTransaksiDariDaftarPelanggan(id) {
  closeModal('modalDaftarTransaksiPelanggan');
  let targetId = safeStringId(id);
  let item = (appData.transactions || []).find(t => safeStringId(t.id) === targetId);
  if (item) {
    setTimeout(() => {
      openDetailCatatan(item);
    }, 150);
  }
}

async function prosesBayarHutangSatuanDirect(id) {
  let targetId = safeStringId(id);
  let item = (appData.transactions || []).find(t => safeStringId(t.id) === targetId);
  if (item) {
    closeModal('modalDaftarTransaksiPelanggan');
    await prosesBayarHutangSatuan(item);
  }
}

function bagikanBukti() {
  let captureArea = document.getElementById('captureArea');
  showLoading("Menyiapkan gambar...");
  html2canvas(captureArea).then(canvas => {
    canvas.toBlob(blob => {
      hideLoading();
      let file = new File([blob], "bukti_transaksi_tokosiman.png", { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'Bukti Transaksi - Toko Siman',
          text: 'Berikut adalah bukti transaksi dari Toko Siman.'
        }).catch(() => {});
      } else {
        let link = document.createElement('a');
        link.download = 'bukti_transaksi_tokosiman.png';
        link.href = canvas.toDataURL();
        link.click();
        showToast("Bukti transaksi berhasil diunduh", "success");
      }
    });
  });
}

function exportToExcel() {
  if (!appData.transactions || appData.transactions.length === 0) {
    showToast("Tidak ada data transaksi untuk diekspor!", "error");
    return;
  }
  showLoading("Menyiapkan berkas Excel...");
  setTimeout(() => {
    let exportData = appData.transactions.map((t, idx) => ({
      "No": idx + 1,
      "ID Transaksi": t.id || "",
      "Tanggal": formatFormattedDate(t.tanggal),
      "Kategori": t.kategori || "",
      "Sub Kategori": t.subKategori || "",
      "Catatan": t.catatan || "",
      "Pelanggan": t.namaPelanggan || "-",
      "Mode Bayar": t.modeBayar || "Tunai",
      "Status": t.status || "Lunas",
      "Pemasukan (Rp)": t.pemasukan || 0,
      "Modal (Rp)": t.modal || 0,
      "Untung (Rp)": t.untung || 0
    }));

    let worksheet = XLSX.utils.json_to_sheet(exportData);
    let workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Transaksi");

    let todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(workbook, `laporan_transaksi_tokosiman_${todayStr}.xlsx`);
    hideLoading();
    showToast("Laporan Excel berhasil diunduh!", "success");
  }, 300);
}

function exportToPDF() {
  if (!appData.transactions || appData.transactions.length === 0) {
    showToast("Tidak ada data transaksi untuk diekspor!", "error");
    return;
  }
  showLoading("Menyiapkan berkas PDF...");
  setTimeout(() => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("TOKO SIMAN - LAPORAN TRANSAKSI", 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

    let tableBody = appData.transactions.map((t, idx) => [
      idx + 1,
      formatFormattedDate(t.tanggal),
      t.kategori || "-",
      t.catatan || "-",
      t.namaPelanggan || "-",
      t.status || "Lunas",
      formatRp(t.pemasukan || 0),
      formatRp(t.untung || 0)
    ]);

    doc.autoTable({
      startY: 28,
      head: [["No", "Tanggal", "Kategori", "Catatan", "Pelanggan", "Status", "Pemasukan", "Untung"]],
      body: tableBody,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }
    });

    let todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    doc.save(`laporan_transaksi_tokosiman_${todayStr}.pdf`);
    hideLoading();
    showToast("Laporan PDF berhasil diunduh!", "success");
  }, 300);
}

function printSuccessReceipt() {
  if (!lastCheckoutData && !currentDetailItem) return;
  let data = lastCheckoutData || currentDetailItem;

  document.getElementById('printTanggal').innerText = formatFormattedDate(data.tanggal);
  document.getElementById('printPelanggan').innerText = data.namaPelanggan || 'Umum';
  document.getElementById('printMode').innerText = (data.modeBayar || 'Tunai') + " (" + (data.status || 'Lunas') + ")";
  document.getElementById('printSubtotal').innerText = formatRp(data.subtotal || data.pemasukan || 0);
  document.getElementById('printDiskon').innerText = formatRp(data.diskonNominal || 0);
  document.getElementById('printTotal').innerText = formatRp(data.pemasukan || 0);
  document.getElementById('printBayar').innerText = formatRp(data.bayar || data.pemasukan || 0);
  document.getElementById('printKembalian').innerText = formatRp(data.kembalian || 0);

  let itemsContainer = document.getElementById('printItemsList');
  itemsContainer.innerHTML = "";
  let items = (data.items && data.items.length > 0) ? data.items : [{ nama: data.catatan || 'Transaksi', harga: data.pemasukan || 0, qty: 1 }];
  let htmlContent = "";
  items.forEach(i => {
    let harga = i.hargaJual !== undefined ? i.hargaJual : (i.harga || 0);
    let qty = i.qty || 1;
    htmlContent += `
      <div style="display: flex; justify-content: space-between;">
        <span>${i.nama \vert{}\vert{} i.catatan \vert{}\vert{} 'Produk'} x${qty}</span>
        <span>${formatRp(harga * qty)}</span>
      </div>
    `;
  });
  itemsContainer.innerHTML = htmlContent;

  window.print();
}

function openReceiptPreview(data) {
  if (!data) return;
  lastCheckoutData = data;
  document.getElementById('previewTanggal').innerText = formatFormattedDate(data.tanggal);
  document.getElementById('previewPelanggan').innerText = data.namaPelanggan || 'Umum';
  document.getElementById('previewMode').innerText = (data.modeBayar || 'Tunai') + " (" + (data.status || 'Lunas') + ")";
  document.getElementById('previewSubtotal').innerText = formatRp(data.subtotal || data.pemasukan || 0);
  document.getElementById('previewDiskon').innerText = formatRp(data.diskonNominal || 0);
  document.getElementById('previewTotal').innerText = formatRp(data.pemasukan || 0);
  document.getElementById('previewBayar').innerText = formatRp(data.bayar || data.pemasukan || 0);
  document.getElementById('previewKembalian').innerText = formatRp(data.kembalian || 0);

  let itemsContainer = document.getElementById('previewItemsList');
  let items = (data.items && data.items.length > 0) ? data.items : [{ nama: data.catatan || 'Transaksi', harga: data.pemasukan || 0, qty: 1 }];
  let htmlContent = "";
  items.forEach(i => {
    let harga = i.hargaJual !== undefined ? i.hargaJual : (i.harga || 0);
    let qty = i.qty || 1;
    htmlContent += `
      <div class="flex justify-between">
        <span>${i.nama \vert{}\vert{} i.catatan \vert{}\vert{} 'Produk'} x${qty}</span>
        <span>${formatRp(harga * qty)}</span>
      </div>
    `;
  });
  itemsContainer.innerHTML = htmlContent;
  
  openModal('modalReceiptPreview');
}

function showPaymentSuccessModal(data) {
  lastCheckoutData = data;
  document.getElementById('successTotalNominal').innerText = formatRp(data.pemasukan);
  document.getElementById('successModeBayar').innerText = data.modeBayar || 'Tunai';
  document.getElementById('successTotalTagihan').innerText = formatRp(data.pemasukan);
  
  let badge = document.getElementById('successStatusBadge');
  let title = document.getElementById('successTitle');
  let subTitle = document.getElementById('successSubTitle');
  let footerMsg = document.getElementById('successMessageFooter');
  let iconBg = document.getElementById('successStatusIconBg');
  let icon = document.getElementById('successStatusIcon');

  let isBelumLunas = data.status === 'Belum Lunas';

  if (isBelumLunas) {
    title.innerText = "Pembayaran Tertunda!";
    subTitle.innerText = "Transaksi tercatat sebagai hutang";
    footerMsg.innerText = "Transaksi tertunda ⏳";
    badge.innerText = "Belum Lunas";
    badge.className = "bg-rose-50/90 backdrop-blur-sm text-rose-700 font-extrabold px-2 py-0.5 rounded-md text-[9px] border border-rose-200";
    iconBg.className = "w-10 h-10 rounded-full bg-rose-100 border-2 border-rose-200 text-rose-600 flex items-center justify-center text-sm shadow-inner";
    icon.className = "fa-solid fa-clock";
  } else {
    title.innerText = "Pembayaran Berhasil!";
    subTitle.innerText = "Transaksi telah selesai diproses";
    footerMsg.innerText = "Transaksi berhasil 🎉";
    badge.innerText = "Lunas";
    badge.className = "bg-emerald-50/90 backdrop-blur-sm text-emerald-700 font-extrabold px-2 py-0.5 rounded-md text-[9px] border border-emerald-200";
    iconBg.className = "w-10 h-10 rounded-full bg-emerald-100 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center text-sm shadow-inner";
    icon.className = "fa-solid fa-check";
  }

  document.getElementById('successNoOrder').innerText = data.orderId || ('TRX-' + Math.random().toString(36).substr(2, 6).toUpperCase());
  
  let d = new Date(data.tanggal);
  let dateFormatted = isNaN(d.getTime()) ? data.tanggal : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  document.getElementById('successTanggal').innerText = dateFormatted;
  document.getElementById('successPembayaran').innerText = data.modeBayar || 'Tunai';

  openModal('modalPaymentSuccess');
}

function closeSuccessModal() {
  closeModal('modalPaymentSuccess');
  switchTab('beranda');
}

function shareSuccessReceipt() {
  let captureArea = document.getElementById('successCaptureArea');
  showLoading("Menyiapkan struk...");
  html2canvas(captureArea).then(canvas => {
    canvas.toBlob(blob => {
      hideLoading();
      let file = new File([blob], "struk_pembayaran_tokosiman.png", { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: 'Struk Pembayaran - Toko Siman',
          text: 'Berikut adalah struk pembayaran transaksi Toko Siman.'
        }).catch(() => {});
      } else {
        let link = document.createElement('a');
        link.download = 'struk_pembayaran_tokosiman.png';
        link.href = canvas.toDataURL();
        link.click();
        showToast("Struk berhasil diunduh", "success");
      }
    });
  });
}

function previewSuccessReceipt() {
  if (lastCheckoutData) {
    closeModal('modalPaymentSuccess');
    openReceiptPreview(lastCheckoutData);
  }
}

function openFormTambah() {
  document.getElementById('titleFormCatatan').innerText = "Tambah catatan";
  document.getElementById('formEditId').value = "";
  document.getElementById('formCatatan').value = "";
  document.getElementById('formNamaPelanggan').value = "";
  
  let dateInput = document.getElementById('formTanggal');
  if(dateInput) dateInput.value = getLocalDateString();

  cart = [];
  renderCart();
  
  document.getElementById('formJumlah').value = "";
  document.getElementById('formModal').value = "";
  
  renderKategoriDropdown();
  setFormType('pemasukan');
  setStatusTx('Lunas');
  openModal('modalTambahCatatan');
}

function openFormEdit(item) {
  document.getElementById('titleFormCatatan').innerText = "Edit catatan";
  document.getElementById('formEditId').value = item.id;
  
  renderKategoriDropdown();
  setFormType(item.jenis || 'pemasukan');
  setStatusTx(item.status || 'Lunas');

  let nominal = item.pemasukan || item.pengeluaran || item.modal || 0;
  document.getElementById('formJumlah').value = nominal ? nominal.toLocaleString('id-ID') : "";
  document.getElementById('formModal').value = item.modal ? item.modal.toLocaleString('id-ID') : "";
  document.getElementById('formCatatan').value = item.catatan || "";
  document.getElementById('formNamaPelanggan').value = item.namaPelanggan || "";
  document.getElementById('formKategori').value = item.kategori || "";
  
  if (item.tanggal) {
    let dtInput = document.getElementById('formTanggal');
    if (dtInput) {
      try {
        let d = new Date(item.tanggal);
        dtInput.value = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : getLocalDateString();
      } catch(e) {
        dtInput.value = getLocalDateString();
      }
    }
  }

  cart = (item.items && item.items.length > 0) ? JSON.parse(JSON.stringify(item.items)) : [];
  renderCart();
  calcUntung();
  openModal('modalTambahCatatan');
}

function setFormType(type) {
  currentFormType = type;
  ['ftPemasukan', 'ftPengeluaran', 'ftHutangSaya'].forEach(id => {
    let el = document.getElementById(id);
    if(el) el.className = "w-1/3 py-2 text-slate-500 font-medium transition-all text-xs no-std-btn";
  });

  let lbl = "Jumlah pemasukan";
  if (type === 'pemasukan') {
    let el = document.getElementById('ftPemasukan');
    if(el) el.className = "w-1/3 py-2 border-b-2 border-indigo-600 text-indigo-700 font-bold transition-all text-xs no-std-btn";
    document.getElementById('groupModal').classList.remove('hidden');
    document.getElementById('groupUntung').classList.remove('hidden');
    document.getElementById('groupPilihProduk').classList.remove('hidden');
    document.getElementById('lblInfoHutang').innerText = "Akan tercatat sebagai hutang pelanggan.";
    document.getElementById('lblNamaPihak').innerText = "Nama pelanggan";
  } else if (type === 'pengeluaran') {
    let el = document.getElementById('ftPengeluaran');
    if(el) el.className = "w-1/3 py-2 border-b-2 border-indigo-600 text-indigo-700 font-bold transition-all text-xs no-std-btn";
    lbl = "Jumlah pengeluaran";
    document.getElementById('groupModal').classList.add('hidden');
    document.getElementById('groupUntung').classList.add('hidden');
    document.getElementById('groupPilihProduk').classList.add('hidden');
  } else if (type === 'hutang_saya') {
    let el = document.getElementById('ftHutangSaya');
    if(el) el.className = "w-1/3 py-2 border-b-2 border-indigo-600 text-indigo-700 font-bold transition-all text-xs no-std-btn";
    lbl = "Jumlah hutang saya";
    document.getElementById('groupModal').classList.add('hidden');
    document.getElementById('groupUntung').classList.add('hidden');
    document.getElementById('groupPilihProduk').classList.add('hidden');
    document.getElementById('lblInfoHutang').innerText = "Catatan ini akan masuk ke daftar Hutang Saya.";
    document.getElementById('lblNamaPihak').innerText = "Pemberi Hutang / Nama Pihak";
    setStatusTx('Belum Lunas');
  }

  document.getElementById('lblNominal').innerText = lbl;
  calcUntung();
}

function setStatusTx(status) {
  currentStatus = status;
  let btnLunas = document.getElementById('btnStatusLunas');
  let btnBelumLunas = document.getElementById('btnStatusBelumLunas');
  
  if (status === 'Lunas') {
    if (btnLunas) btnLunas.className = "py-1 px-2.5 border border-indigo-600 rounded-md font-bold text-[10px] bg-indigo-600 text-white shadow-xs no-std-btn";
    if (btnBelumLunas) btnBelumLunas.className = "py-1 px-2.5 border border-slate-200 rounded-md font-semibold text-[10px] text-slate-700 bg-white/80 backdrop-blur-sm hover:bg-slate-50 no-std-btn shadow-xs";
    if (currentFormType !== 'hutang_saya') {
      document.getElementById('groupPelanggan').classList.add('hidden');
    }
  } else {
    if (btnBelumLunas) btnBelumLunas.className = "py-1 px-2.5 border border-indigo-600 rounded-md font-bold text-[10px] bg-indigo-600 text-white shadow-xs no-std-btn";
    if (btnLunas) btnLunas.className = "py-1 px-2.5 border border-slate-200 rounded-md font-semibold text-[10px] text-slate-700 bg-white/80 backdrop-blur-sm hover:bg-slate-50 no-std-btn shadow-xs";
    document.getElementById('groupPelanggan').classList.remove('hidden');
  }
}

function setKasirStatusSelect(status) {
  kasirStatus = status;
  let modeBayarSelect = document.getElementById('kasirModeBayar');
  if (status === 'Belum Lunas') {
    modeBayarSelect.value = 'Hutang';
  } else {
    if (modeBayarSelect.value === 'Hutang') {
      modeBayarSelect.value = 'Tunai';
    }
  }
  calcKasirTotals();
}

function setKasirModeBayar(mode) {
  let statusSelect = document.getElementById('kasirStatusSelect');
  if (mode === 'Hutang') {
    statusSelect.value = 'Belum Lunas';
    kasirStatus = 'Belum Lunas';
  } else {
    statusSelect.value = 'Lunas';
    kasirStatus = 'Lunas';
  }
  calcKasirTotals();
}

function calcUntung() {
  let jm = parseNumber(document.getElementById('formJumlah').value);
  let md = parseNumber(document.getElementById('formModal').value);
  document.getElementById('formUntungText').innerText = formatRp(jm - md);
}

function calcFormProdukUntung() {
  let harga = parseNumber(document.getElementById('prodHarga').value);
  let modal = parseNumber(document.getElementById('prodModal').value);
  let untung = harga - modal;
  document.getElementById('prodUntungText').innerText = formatRp(untung);
}

function addToCart(p) {
  if (!p) return;
  let pId = safeStringId(p.id);
  let existing = cart.find(item => safeStringId(item.id) === pId);
  let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
  let beliVal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: pId, nama: p.nama, hargaJual: jualVal, hargaBeli: beliVal, kategori: p.kategori, subKategori: p.subKategori, qty: 1 });
  }
  
  renderCart();
  showToast(p.nama + " ditambahkan ke keranjang", "success");
}

function updateCartQty(id, delta) {
  let targetId = safeStringId(id);
  let item = cart.find(i => safeStringId(i.id) === targetId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(i => safeStringId(i.id) !== targetId);
    }
  }
  renderCart();
}

function renderCart() {
  let container = document.getElementById('cartItemsContainer');
  if (cart.length === 0) {
    container.classList.add('hidden');
    container.innerHTML = "";
    return;
  }

  container.classList.remove('hidden');
  
  let totalJual = 0;
  let totalModal = 0;
  let namaCatatanList = [];
  let categoryCounts = {};
  let htmlContent = "";

  cart.forEach(item => {
    let harga = item.hargaJual !== undefined ? item.hargaJual : (item.harga || 0);
    let modal = item.hargaBeli !== undefined ? item.hargaBeli : (item.modal || 0);
    let subJual = harga * item.qty;
    let subModal = modal * item.qty;
    totalJual += subJual;
    totalModal += subModal;
    namaCatatanList.push(`${item.nama} (${item.qty}x)`);

    let cat = item.kategori || '';
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + item.qty;
    }

    htmlContent += `
      <div class="py-2 flex justify-between items-center text-xs">
        <div>
          <div class="font-bold text-slate-900">${item.nama}</div>
          <div class="text-[10px] text-slate-600 mt-0.5"><span class="text-emerald-700 font-semibold">${formatRp(harga)}</span> x ${item.qty} = <span class="text-emerald-700 font-bold">${formatRp(subJual)}</span></div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" onclick="updateCartQty('${item.id}', -1)" class="w-5 h-5 bg-white/80 backdrop-blur-sm rounded font-bold text-slate-700 flex items-center justify-center hover:bg-slate-100 no-std-btn border border-slate-200 shadow-xs">-</button>
          <span class="font-bold w-4 text-center text-slate-900">${Number(item.qty).toLocaleString('id-ID')}</span>
          <button type="button" onclick="updateCartQty('${item.id}', 1)" class="w-5 h-5 bg-indigo-600 text-white rounded font-bold flex items-center justify-center shadow-md no-std-btn">+</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = htmlContent;

  let dominantCategory = "";
  let maxQty = -1;
  for (let cat in categoryCounts) {
    if (categoryCounts[cat] > maxQty) {
      maxQty = categoryCounts[cat];
      dominantCategory = cat;
    }
  }

  if (dominantCategory) {
    let katSelect = document.getElementById('formKategori');
    if (katSelect) {
      let options = Array.from(katSelect.options).map(opt => opt.value);
      if (options.includes(dominantCategory)) {
        katSelect.value = dominantCategory;
      }
    }
  }

  document.getElementById('formJumlah').value = totalJual ? totalJual.toLocaleString('id-ID') : "";
  document.getElementById('formModal').value = totalModal ? totalModal.toLocaleString('id-ID') : "";
  document.getElementById('formCatatan').value = namaCatatanList.join(', ');
  calcUntung();
}

function addToKasirCart(p) {
  if (!p) return;
  let pId = safeStringId(p.id);
  let existing = kasirCart.find(item => safeStringId(item.id) === pId);
  let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
  let beliVal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));

  if (existing) {
    existing.qty += 1;
  } else {
    kasirCart.push({ id: pId, nama: p.nama, hargaJual: jualVal, hargaBeli: beliVal, kategori: p.kategori, subKategori: p.subKategori, qty: 1 });
  }
  renderKasirCart();
  showToast(p.nama + " masuk keranjang kasir", "success");
}

function updateKasirQty(id, delta) {
  let targetId = safeStringId(id);
  let item = kasirCart.find(i => safeStringId(i.id) === targetId);
  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      kasirCart = kasirCart.filter(i => safeStringId(i.id) !== targetId);
    }
  }
  renderKasirCart();
}

function renderKasirCart() {
  let container = document.getElementById('kasirCartContainer');
  if (kasirCart.length === 0) {
    container.innerHTML = `<div class="text-slate-500 py-3 text-center text-xs">Keranjang kasir masih kosong. Pilih produk di bawah.</div>`;
    let katSelect = document.getElementById('kasirKategoriSelect');
    if(katSelect) katSelect.value = "Penjualan Kasir";
    calcKasirTotals();
    return;
  }

  let htmlContent = "";
  kasirCart.forEach(item => {
    let harga = item.hargaJual !== undefined ? item.hargaJual : (item.harga || 0);
    let subJual = harga * item.qty;
    htmlContent += `
      <div class="py-2 flex justify-between items-center text-xs">
        <div>
          <div class="font-bold text-slate-900">${item.nama}</div>
          <div class="text-[10px] text-slate-600 mt-0.5"><span class="text-emerald-700 font-semibold">${formatRp(harga)}</span> x ${item.qty} = <span class="text-emerald-700 font-bold">${formatRp(subJual)}</span></div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" onclick="updateKasirQty('${item.id}', -1)" class="w-5 h-5 bg-white/80 backdrop-blur-sm rounded font-bold text-slate-700 flex items-center justify-center hover:bg-slate-100 no-std-btn border border-slate-200 shadow-xs">-</button>
          <span class="font-bold w-4 text-center text-slate-900">${Number(item.qty).toLocaleString('id-ID')}</span>
          <button type="button" onclick="updateKasirQty('${item.id}', 1)" class="w-5 h-5 bg-emerald-600 text-white rounded font-bold flex items-center justify-center shadow-md no-std-btn">+</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = htmlContent;

  let categoryCounts = {};
  kasirCart.forEach(item => {
    let cat = item.kategori || 'Penjualan Kasir';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + item.qty;
  });

  let dominantCategory = "Penjualan Kasir";
  let maxQty = -1;
  for (let cat in categoryCounts) {
    if (categoryCounts[cat] > maxQty) {
      maxQty = categoryCounts[cat];
      dominantCategory = cat;
    }
  }

  let katSelect = document.getElementById('kasirKategoriSelect');
  if (katSelect) {
    let options = Array.from(katSelect.options).map(opt => opt.value);
    if (options.includes(dominantCategory)) {
      katSelect.value = dominantCategory;
    }
  }

  calcKasirTotals();
}

function onDiskonInput(input) {
  formatInputRupiah(input);
}

function onDiskonTypeChange(type) {
  diskonType = type;
  let inputDiskon = document.getElementById('kasirDiskon');
  if (inputDiskon) {
    inputDiskon.value = "";
  }
  calcKasirTotals();
}

function setQuickCash(amount) {
  let inputBayar = document.getElementById('kasirBayar');
  if (!inputBayar) return;

  if (amount === 'pas') {
    let total = parseNumber(document.getElementById('kasirTotalAkhir').innerText.replace(/[^\d]/g, ''));
    inputBayar.value = total > 0 ? total.toLocaleString('id-ID') : "";
  } else {
    inputBayar.value = amount.toLocaleString('id-ID');
  }
  calcKasirTotals();
}

function calcKasirTotals() {
  let subtotalJual = 0;
  let subtotalModal = 0;
  let namaCatatanList = [];

  kasirCart.forEach(item => {
    let harga = item.hargaJual !== undefined ? item.hargaJual : (item.harga || 0);
    let modal = item.hargaBeli !== undefined ? item.hargaBeli : (item.modal || 0);
    let subj = harga * item.qty;
    let subm = modal * item.qty;
    subtotalJual += subj;
    subtotalModal += subm;
    namaCatatanList.push(`${item.nama} (${item.qty}x)`);
  });

  let valDiskonInput = parseNumber(document.getElementById('kasirDiskon').value);
  let nominalDiskon = 0;
  if (valDiskonInput > 0) {
    if (diskonType === 'persen') {
      nominalDiskon = (subtotalJual * valDiskonInput) / 100;
    } else {
      nominalDiskon = valDiskonInput;
    }
  }

  let totalAkhir = Math.max(0, subtotalJual - nominalDiskon);
  let totalUntung = totalAkhir - subtotalModal;

  document.getElementById('kasirTotalAkhir').innerText = formatRp(totalAkhir);
  document.getElementById('kasirTotalUntung').innerText = formatRp(totalUntung);

  let valBayar = parseNumber(document.getElementById('kasirBayar').value);
  let kembalian = valBayar - totalAkhir;

  let lblKembalian = document.getElementById('kasirLabelKembalian');
  let elKembalian = document.getElementById('kasirKembalian');

  if (kasirStatus === 'Belum Lunas') {
    lblKembalian.innerText = "Sisa Hutang:";
    elKembalian.innerText = formatRp(Math.max(0, totalAkhir - valBayar));
    elKembalian.className = "text-rose-600 font-extrabold text-xs";
  } else {
    if (kembalian >= 0) {
      lblKembalian.innerText = "Kembalian:";
      elKembalian.innerText = formatRp(kembalian);
      elKembalian.className = "text-indigo-700 font-extrabold text-xs";
    } else {
      lblKembalian.innerText = "Kurang Bayar:";
      elKembalian.innerText = formatRp(Math.abs(kembalian));
      elKembalian.className = "text-rose-600 font-extrabold text-xs";
    }
  }
}

async function checkoutKasir() {
  if (AppState.isSubmitting) return;
  if (kasirCart.length === 0) {
    showToast("Keranjang kasir masih kosong!", "error");
    return;
  }

  let subtotalJual = 0;
  let subtotalModal = 0;
  let rincianProduk = [];
  let namaCatatanList = [];

  kasirCart.forEach(item => {
    let harga = item.hargaJual !== undefined ? item.hargaJual : (item.harga || 0);
    let modal = item.hargaBeli !== undefined ? item.hargaBeli : (item.modal || 0);
    let subj = harga * item.qty;
    let subm = modal * item.qty;
    subtotalJual += subj;
    subtotalModal += subm;
    namaCatatanList.push(`${item.nama} (${item.qty}x)`);
    rincianProduk.push(item);
  });

  let valDiskonInput = parseNumber(document.getElementById('kasirDiskon').value);
  let nominalDiskon = 0;
  if (valDiskonInput > 0) {
    if (diskonType === 'persen') {
      nominalDiskon = (subtotalJual * valDiskonInput) / 100;
    } else {
      nominalDiskon = valDiskonInput;
    }
  }

  let totalAkhir = Math.max(0, subtotalJual - nominalDiskon);
  let valBayar = parseNumber(document.getElementById('kasirBayar').value);

  if (kasirStatus === 'Lunas' && valBayar < totalAkhir) {
    showToast("Uang bayar kurang! Ganti status jadi Belum Lunas atau sesuaikan jumlah bayar.", "error");
    return;
  }

  let payload = {
    jenis: 'pemasukan',
    status: kasirStatus,
    modeBayar: document.getElementById('kasirModeBayar').value,
    catatan: namaCatatanList.join(', '),
    kategori: document.getElementById('kasirKategoriSelect').value || 'Penjualan Kasir',
    subKategori: '',
    namaPelanggan: document.getElementById('kasirPelanggan').value.trim() || 'Umum',
    subtotal: subtotalJual,
    diskonNominal: nominalDiskon,
    pemasukan: totalAkhir,
    modal: subtotalModal,
    untung: totalAkhir - subtotalModal,
    bayar: kasirStatus === 'Belum Lunas' ? valBayar : totalAkhir,
    kembalian: kasirStatus === 'Belum Lunas' ? 0 : Math.max(0, valBayar - totalAkhir),
    bayarAwal: kasirStatus === 'Belum Lunas' ? valBayar : 0,
    tanggal: new Date().toISOString(),
    items: rincianProduk,
    riwayatBayar: []
  };

  AppState.isSubmitting = true;
  let btn = document.querySelector('button[onclick="checkoutKasir()"]');
  let oriText = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...`;
  btn.disabled = true;

  try {
    await dbSaveTransaction(payload);
  
    kasirCart = [];
    document.getElementById('kasirPelanggan').value = "";
    document.getElementById('kasirBayar').value = "";
    document.getElementById('kasirDiskon').value = "";
    document.getElementById('kasirStatusSelect').value = "Lunas";
    document.getElementById('kasirModeBayar').value = "Tunai";
    kasirStatus = 'Lunas';
    diskonType = 'rp';
    renderKasirCart();

    showPaymentSuccessModal(payload);
    showToast("Transaksi kasir berhasil disimpan!", "success");
  } catch(err) {
    showToast("Gagal menyimpan transaksi kasir", "error");
  } finally {
    AppState.isSubmitting = false;
    btn.innerHTML = oriText;
    btn.disabled = false;
  }
}

function renderProdukList() {
  let searchQuery = document.getElementById('searchProduk') ? document.getElementById('searchProduk').value.toLowerCase() : '';
  let filtered = (appData.products || []).filter(p => (p.nama || '').toLowerCase().includes(searchQuery));

  let favs = filtered.filter(p => p.favorit);
  let others = filtered.filter(p => !p.favorit);

  let totalPages = Math.ceil(others.length / ITEMS_PER_PAGE) || 1;
  if (modalProdukPage > totalPages) modalProdukPage = totalPages;
  if (modalProdukPage < 1) modalProdukPage = 1;

  let startIdx = (modalProdukPage - 1) * ITEMS_PER_PAGE;
  let paginatedOthers = others.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  let listFav = document.getElementById('listProdukFavorit');
  let listOth = document.getElementById('listProdukLainnya');
  
  if (!listFav || !listOth) return;

  listFav.innerHTML = favs.length === 0 ? `<div class="py-2 text-slate-400 text-xs text-center">Tidak ada produk favorit</div>` : favs.map(p => {
    let safeId = safeStringId(p.id);
    let jual = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
    let modal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));
    let untung = jual - modal;
    return `
      <div onclick='addToCart(${JSON.stringify(p)})' class="py-2.5 flex justify-between items-center text-xs cursor-pointer hover:bg-slate-50 transition-colors">
        <div>
          <div class="font-bold text-slate-900">${p.nama}</div>
          <div class="text-[10px] text-slate-500 mt-0.5"><span class="text-emerald-700 font-bold">${formatRp(jual)}</span> • Untung ${formatRp(untung(untung)}</div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" onclick="event.stopPropagation(); openEditProduk('${safeId}')" class="w-6 h-6 bg-white/80 backdrop-blur-sm text-indigo-700 rounded flex items-center justify-center border border-slate-200 hover:bg-slate-100 no-std-btn shadow-xs"><i class="fa-solid fa-pen text-[10px]"></i></button>
          <button type="button" onclick="event.stopPropagation(); hapusProduk('${safeId}')" class="w-6 h-6 bg-rose-50/90 backdrop-blur-sm text-rose-600 rounded flex items-center justify-center border border-rose-200 hover:bg-rose-100 no-std-btn shadow-xs"><i class="fa-solid fa-trash text-[10px]"></i></button>
        </div>
      </div>
    `;
  }).join('');

  listOth.innerHTML = paginatedOthers.length === 0 ? `<div class="py-2 text-slate-400 text-xs text-center">Tidak ada produk lainnya</div>` : paginatedOthers.map(p => {
    let safeId = safeStringId(p.id);
    let jual = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
    let modal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));
    let untung = jual - modal;
    return `
      <div onclick='addToCart(${JSON.stringify(p)})' class="py-2.5 flex justify-between items-center text-xs cursor-pointer hover:bg-slate-50 transition-colors">
        <div>
          <div class="font-bold text-slate-900">${p.nama}</div>
          <div class="text-[10px] text-slate-500 mt-0.5"><span class="text-emerald-700 font-bold">${formatRp(jual)}</span> • Untung ${formatRp(untung)}</div>
        </div>
        <div class="flex items-center gap-1">
          <button type="button" onclick="event.stopPropagation(); openEditProduk('${safeId}')" class="w-6 h-6 bg-white/80 backdrop-blur-sm text-indigo-700 rounded flex items-center justify-center border border-slate-200 hover:bg-slate-100 no-std-btn shadow-xs"><i class="fa-solid fa-pen text-[10px]"></i></button>
          <button type="button" onclick="event.stopPropagation(); hapusProduk('${safeId}')" class="w-6 h-6 bg-rose-50/90 backdrop-blur-sm text-rose-600 rounded flex items-center justify-center border border-rose-200 hover:bg-rose-100 no-std-btn shadow-xs"><i class="fa-solid fa-trash text-[10px]"></i></button>
        </div>
      </div>
    `;
  }).join('');

  let infoPage = document.getElementById('modalProdukPaginationInfo');
  let btnPrev = document.getElementById('modalProdukPrevBtn');
  let btnNext = document.getElementById('modalProdukNextBtn');

  if(infoPage) infoPage.innerText = `Hal ${modalProdukPage} dari ${totalPages}`;
  if(btnPrev) btnPrev.disabled = (modalProdukPage <= 1);
  if(btnNext) btnNext.disabled = (modalProdukPage >= totalPages);
}

function changeModalProdukPage(delta) {
  let searchQuery = document.getElementById('searchProduk') ? document.getElementById('searchProduk').value.toLowerCase() : '';
  let filtered = (appData.products || []).filter(p => (p.nama || '').toLowerCase().includes(searchQuery));
  let others = filtered.filter(p => !p.favorit);
  let totalPages = Math.ceil(others.length / ITEMS_PER_PAGE) || 1;

  modalProdukPage += delta;
  if (modalProdukPage < 1) modalProdukPage = 1;
  if (modalProdukPage > totalPages) modalProdukPage = totalPages;
  renderProdukList();
}

function renderProdukTabList() {
  let searchQuery = document.getElementById('searchProdukTab') ? document.getElementById('searchProdukTab').value.toLowerCase() : '';
  let filtered = (appData.products || []).filter(p => (p.nama || '').toLowerCase().includes(searchQuery));

  let favs = filtered.filter(p => p.favorit);
  let others = filtered.filter(p => !p.favorit);

  let totalPagesLainnya = Math.ceil(others.length / ITEMS_PER_PAGE) || 1;
  if (produkPageLainnya > totalPagesLainnya) produkPageLainnya = totalPagesLainnya;
  if (produkPageLainnya < 1) produkPageLainnya = 1;

  let totalPagesFavorit = Math.ceil(favs.length / ITEMS_PER_PAGE) || 1;
  if (produkPageFavorit > totalPagesFavorit) produkPageFavorit = totalPagesFavorit;
  if (produkPageFavorit < 1) produkPageFavorit = 1;

  let startLainnya = (produkPageLainnya - 1) * ITEMS_PER_PAGE;
  let paginatedLainnya = others.slice(startLainnya, startLainnya + ITEMS_PER_PAGE);

  let startFavorit = (produkPageFavorit - 1) * ITEMS_PER_PAGE;
  let paginatedFavorit = favs.slice(startFavorit, startFavorit + ITEMS_PER_PAGE);

  let containerFav = document.getElementById('listTabProdukFavorit');
  let containerLain = document.getElementById('listTabProdukLainnya');
  if(!containerFav || !containerLain) return;

  containerFav.innerHTML = paginatedFavorit.length === 0 ? `<div class="py-6 text-center text-slate-500 text-xs">Belum ada produk favorit</div>` : paginatedFavorit.map(p => {
    let safeId = safeStringId(p.id);
    let jual = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
    let modal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));
    let untung = jual - modal;
    return `
      <div class="py-3 flex justify-between items-center text-xs border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 transition-colors px-1 rounded-lg">
        <div>
          <div class="font-bold text-slate-900">${p.nama}</div>
          <div class="text-[10px] text-slate-500 mt-0.5"><span class="text-emerald-700 font-bold">${formatRp(jual)}</span> • Untung <span class="text-emerald-700 font-bold">${formatRp(untung)}</span> • ${p.kategori || 'Umum'}</div>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="openEditProduk('${safeId}')" class="px-2 py-1 bg-white/80 backdrop-blur-sm text-indigo-700 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all font-bold text-[10px] no-std-btn shadow-xs"><i class="fa-solid fa-pen text-[9px]"></i> Edit</button>
          <button onclick="hapusProduk('${safeId}')" class="px-2 py-1 bg-rose-50/90 backdrop-blur-sm text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-100 transition-all font-bold text-[10px] no-std-btn shadow-xs"><i class="fa-solid fa-trash text-[9px]"></i> Hapus</button>
        </div>
      </div>
    `;
  }).join('');

  containerLain.innerHTML = paginatedLainnya.length === 0 ? `<div class="py-6 text-center text-slate-500 text-xs">Belum ada produk</div>` : paginatedLainnya.map(p => {
    let safeId = safeStringId(p.id);
    let jual = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
    let modal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));
    let untung = jual - modal;
    return `
      <div class="py-3 flex justify-between items-center text-xs border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 transition-colors px-1 rounded-lg">
        <div>
          <div class="font-bold text-slate-900">${p.nama}</div>
          <div class="text-[10px] text-slate-500 mt-0.5"><span class="text-emerald-700 font-bold">${formatRp(jual)}</span> • Untung <span class="text-emerald-700 font-bold">${formatRp(untung)}</span> • ${p.kategori || 'Umum'}</div>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="openEditProduk('${safeId}')" class="px-2 py-1 bg-white/80 backdrop-blur-sm text-indigo-700 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all font-bold text-[10px] no-std-btn shadow-xs"><i class="fa-solid fa-pen text-[9px]"></i> Edit</button>
          <button onclick="hapusProduk('${safeId}')" class="px-2 py-1 bg-rose-50/90 backdrop-blur-sm text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-100 transition-all font-bold text-[10px] no-std-btn shadow-xs"><i class="fa-solid fa-trash text-[9px]"></i> Hapus</button>
        </div>
      </div>
    `;
  }).join('');

  let infoLain = document.getElementById('tabProdukLainnyaPaginationInfo');
  let btnLainPrev = document.getElementById('tabProdukLainnyaPrevBtn');
  let btnLainNext = document.getElementById('tabProdukLainnyaNextBtn');
  if(infoLain) infoLain.innerText = `Hal ${produkPageLainnya} dari ${totalPagesLainnya}`;
  if(btnLainPrev) btnLainPrev.disabled = (produkPageLainnya <= 1);
  if(btnLainNext) btnLainNext.disabled = (produkPageLainnya >= totalPagesLainnya);

  let infoFav = document.getElementById('tabProdukFavoritPaginationInfo');
  let btnFavPrev = document.getElementById('tabProdukFavoritPrevBtn');
  let btnFavNext = document.getElementById('tabProdukFavoritNextBtn');
  if(infoFav) infoFav.innerText = `Hal ${produkPageFavorit} dari ${totalPagesFavorit}`;
  if(btnFavPrev) btnFavPrev.disabled = (produkPageFavorit <= 1);
  if(btnFavNext) btnFavNext.disabled = (produkPageFavorit >= totalPagesFavorit);
}

function changeTabProdukPage(sub, delta) {
  if (sub === 'lainnya') {
    let searchQuery = document.getElementById('searchProdukTab') ? document.getElementById('searchProdukTab').value.toLowerCase() : '';
    let filtered = (appData.products || []).filter(p => (p.nama || '').toLowerCase().includes(searchQuery));
    let others = filtered.filter(p => !p.favorit);
    let totalPagesLainnya = Math.ceil(others.length / ITEMS_PER_PAGE) || 1;
    produkPageLainnya += delta;
    if (produkPageLainnya < 1) produkPageLainnya = 1;
    if (produkPageLainnya > totalPagesLainnya) produkPageLainnya = totalPagesLainnya;
  } else {
    let searchQuery = document.getElementById('searchProdukTab') ? document.getElementById('searchProdukTab').value.toLowerCase() : '';
    let filtered = (appData.products || []).filter(p => (p.nama || '').toLowerCase().includes(searchQuery));
    let favs = filtered.filter(p => p.favorit);
    let totalPagesFavorit = Math.ceil(favs.length / ITEMS_PER_PAGE) || 1;
    produkPageFavorit += delta;
    if (produkPageFavorit < 1) produkPageFavorit = 1;
    if (produkPageFavorit > totalPagesFavorit) produkPageFavorit = totalPagesFavorit;
  }
  renderProdukTabList();
}

function renderKasirProdukList() {
  let searchQuery = document.getElementById('searchKasirProduk') ? document.getElementById('searchKasirProduk').value.toLowerCase() : '';
  let selectedKat = document.getElementById('kasirKategoriSelect') ? document.getElementById('kasirKategoriSelect').value : 'Penjualan Kasir';

  let filtered = (appData.products || []).filter(p => {
    let matchQuery = (p.nama || '').toLowerCase().includes(searchQuery);
    let matchCat = (selectedKat === 'Penjualan Kasir' || p.kategori === selectedKat);
    return matchQuery && matchCat;
  });

  let container = document.getElementById('kasirProdukGrid');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">Tidak ada produk ditemukan</div>`;
    return;
  }

  let htmlContent = "";
  filtered.forEach(p => {
    let jual = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
    htmlContent += `
      <div onclick='addToKasirCart(${JSON.stringify(p)})' class="modern-card p-3 flex flex-col justify-between cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group">
        <div>
          <div class="font-bold text-slate-900 text-xs group-hover:text-indigo-700 transition-colors line-clamp-2">${p.nama}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">${p.kategori || 'Umum'}</div>
        </div>
        <div class="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
          <span class="font-black text-emerald-700 text-xs">${formatRp(jual)}</span>
          <span class="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-[10px] group-hover:bg-emerald-600 group-hover:text-white transition-colors">+</span>
        </div>
      </div>
    `;
  });
  container.innerHTML = htmlContent;
}

function openFormTambahProduk() {
  document.getElementById('titleFormProduk').innerText = "Tambah Produk";
  document.getElementById('prodEditId').value = "";
  document.getElementById('prodNama').value = "";
  document.getElementById('prodHarga').value = "";
  document.getElementById('prodModal').value = "";
  document.getElementById('prodFavorit').checked = false;

  renderKategoriDropdown();
  openModal('modalFormProduk');
}

function openEditProduk(id) {
  let targetId = safeStringId(id);
  let p = (appData.products || []).find(item => safeStringId(item.id) === targetId);
  if (!p) return;

  document.getElementById('titleFormProduk').innerText = "Edit Produk";
  document.getElementById('prodEditId').value = p.id;
  document.getElementById('prodNama').value = p.nama || "";
  
  renderKategoriDropdown();
  document.getElementById('prodKategori').value = p.kategori || "";
  onProdKategoriChange(p.kategori || "");
  document.getElementById('prodSubKategori').value = p.subKategori || "";

  let jual = p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0);
  let modal = p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0);

  document.getElementById('prodHarga').value = jual ? jual.toLocaleString('id-ID') : "";
  document.getElementById('prodModal').value = modal ? modal.toLocaleString('id-ID') : "";
  document.getElementById('prodFavorit').checked = !!p.favorit;
  
  calcFormProdukUntung();
  openModal('modalFormProduk');
}

async function submitProdukForm() {
  let id = document.getElementById('prodEditId').value;
  let nama = document.getElementById('prodNama').value.trim();
  let kategori = document.getElementById('prodKategori').value;
  let subKategori = document.getElementById('prodSubKategori').value;
  let hargaJual = parseNumber(document.getElementById('prodHarga').value);
  let hargaBeli = parseNumber(document.getElementById('prodModal').value);
  let favorit = document.getElementById('prodFavorit').checked;

  if (!nama) {
    showToast("Nama produk wajib diisi!", "error");
    return;
  }
  if (hargaJual <= 0) {
    showToast("Harga jual harus lebih besar dari Rp0!", "error");
    return;
  }

  let payload = {
    id: id || ('PRD-' + Date.now()),
    nama: nama,
    kategori: kategori,
    subKategori: subKategori,
    hargaJual: hargaJual,
    hargaBeli: hargaBeli,
    favorit: favorit
  };

  showLoading("Menyimpan Produk...", "Memperbarui data produk ke Cloud");
  await dbSaveProduct(payload);
  hideLoading();

  closeModal('modalFormProduk');
  showToast("Produk berhasil disimpan!", "success");
}

function hapusProduk(id) {
  let targetId = safeStringId(id);
  showConfirm("Hapus Produk", "Apakah Anda yakin ingin menghapus produk ini dari daftar?", function() {
    showLoading("Menghapus produk...");
    dbDeleteProduct(targetId).then(() => {
      hideLoading();
      showToast("Produk berhasil dihapus", "success");
    });
  });
}

async function submitCatatanForm() {
  let id = document.getElementById('formEditId').value;
  let jenis = currentFormType;
  let status = currentStatus;
  let jumlah = parseNumber(document.getElementById('formJumlah').value);
  let modal = parseNumber(document.getElementById('formModal').value);
  let untung = jumlah - modal;
  let catatan = document.getElementById('formCatatan').value.trim();
  let namaPelanggan = document.getElementById('formNamaPelanggan').value.trim();
  let kategori = document.getElementById('formKategori').value || 'Umum';
  let tanggalInput = document.getElementById('formTanggal').value;
  let tanggal = tanggalInput ? new Date(tanggalInput + 'T' + new Date().toTimeString().split(' ')[0]).toISOString() : new Date().toISOString();

  if (jumlah <= 0) {
    showToast("Nominal jumlah harus lebih besar dari Rp0!", "error");
    return;
  }

  if (jenis === 'hutang_saya' && !namaPelanggan) {
    showToast("Nama pemberi hutang wajib diisi!", "error");
    return;
  }

  if (status === 'Belum Lunas' && !namaPelanggan && jenis !== 'hutang_saya') {
    showToast("Nama pelanggan wajib diisi untuk status Belum Lunas!", "error");
    return;
  }

  let payload = {
    id: id || ('TX-' + Date.now()),
    jenis: jenis,
    status: status,
    pemasukan: jenis === 'pemasukan' ? jumlah : 0,
    pengeluaran: jenis === 'pengeluaran' ? jumlah : 0,
    modal: jenis === 'pemasukan' ? modal : 0,
    untung: jenis === 'pemasukan' ? untung : 0,
    catatan: catatan || (jenis === 'pemasukan' ? 'Pemasukan' : (jenis === 'pengeluaran' ? 'Pengeluaran' : 'Hutang Saya')),
    kategori: kategori,
    subKategori: '',
    namaPelanggan: namaPelanggan,
    tanggal: tanggal,
    items: cart.length > 0 ? cart : [],
    riwayatBayar: []
  };

  showLoading("Menyimpan Catatan...", "Menyinkronkan perubahan ke Google Sheets");
  await dbSaveTransaction(payload);
  hideLoading();

  closeModal('modalTambahCatatan');
  showToast("Catatan berhasil disimpan!", "success");
}

window.addEventListener('DOMContentLoaded', () => {
  let rememberPin = localStorage.getItem('tokosiman_remember_pin');
  if (rememberPin === 'true') {
    hideSplashLogin();
    loadData(true);
  } else {
    let splash = document.getElementById('splashLoginScreen');
    if (splash) splash.classList.remove('hidden');
  }

  updateDbStatusBadge();

  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.tab) {
      switchTab(e.state.tab, false);
    }
  });

  let currentHash = window.location.hash.replace('#', '');
  if (['beranda', 'kasir', 'produk', 'laporan', 'setelan'].includes(currentHash)) {
    switchTab(currentHash, false);
  } else {
    switchTab('beranda', false);
  }
});
