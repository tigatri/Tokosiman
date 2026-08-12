    let GOOGLE_APPS_SCRIPT_URL = localStorage.getItem('tokosiman_gas_url') || "https://script.google.com/macros/s/AKfycbzx9p6K-DBXFgNhTvA-xiVIGmBa6IR8hb3qLIih5b9avnicKgKQhLiNS8FFw4cv9Jyi/exec"; 

    if (!localStorage.getItem('tokosiman_gas_url')) {
      localStorage.setItem('tokosiman_gas_url', GOOGLE_APPS_SCRIPT_URL);
    }

    let isAutoSyncEnabled = localStorage.getItem('tokosiman_autosync') !== 'false';

    let appData = {
      transactions: [],
      products: [],
      categories: {},
      appPin: localStorage.getItem('tokosiman_app_pin') || '1234'
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

    const ITEMS_PER_PAGE = 10;
    const BERANDA_ITEMS_PER_PAGE = 30;
    let berandaPage = 1;
    let kasirPage = 1;
    let produkPageLainnya = 1;
    let produkPageFavorit = 1;
    let produkTabSubActive = 'lainnya';
    let modalProdukPage = 1;

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

    function showLoading(text = "Menyinkronkan Data Cloud...", subText = "Mengunduh pembaharuan terbaru dari Google Sheets") {
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
          overlay.classList.remove('overlay-leave');
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
      
      let okBtn = document.getElementById('confirmOkBtn');
      if (okBtn) {
        let newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        
        newOkBtn.onclick = function() {
          closeModal('modalConfirm');
          if (typeof onOk === 'function') {
            onOk();
          }
        };
      }

      openModal('modalConfirm');
    }

    function formatRp(num) {
      let val = Number(num) || 0;
      return "Rp" + val.toLocaleString('id-ID');
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

      if (resetCode !== '8080') {
        showToast("Kode reset salah!", "error");
        return;
      }

      if (newPinInput.length !== 4 || isNaN(newPinInput)) {
        showToast("PIN baru harus berupa 4 digit angka!", "error");
        return;
      }

      showLoading("Mereset PIN...", "Memperbarui PIN baru ke Cloud");

      let res = await callGasApi('simpanPin', { pin: newPinInput });
      hideLoading();

      if (res && res.success) {
        appData.appPin = newPinInput;
        localStorage.setItem('tokosiman_app_pin', newPinInput);
      } else {
        appData.appPin = newPinInput;
        localStorage.setItem('tokosiman_app_pin', newPinInput);
      }

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

      if (newPinInput.length !== 4 || isNaN(newPinInput)) {
        showToast("PIN baru harus berupa 4 digit angka!", "error");
        return;
      }

      showLoading("Menyimpan PIN ke Cloud...", "Memperbarui PIN di Google Sheets");

      let res = await callGasApi('simpanPin', { pin: newPinInput });
      hideLoading();

      if (res && res.success) {
        appData.appPin = newPinInput;
        localStorage.setItem('tokosiman_app_pin', newPinInput);
        
        document.getElementById('inputOldPin').value = "";
        document.getElementById('inputNewPin').value = "";
        showToast("PIN berhasil diperbarui dan disinkronkan ke Cloud!", "success");
      } else {
        showToast("Gagal menyimpan PIN ke Cloud: " + (res ? res.message : ""), "error");
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
          setelanBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span> Belum Terhubung URL Google Apps Script`;
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
        showLoading("Menyinkronkan Data Cloud...", "Mengunduh pembaharuan terbaru dari Google Sheets");
      }

      if (!GOOGLE_APPS_SCRIPT_URL) {
        if (showInitialLoading) hideLoading();
        updateDbStatusBadge();
        showToast("Mohon masukkan URL Google Apps Script di menu Setelan", "error");
        return;
      }

      try {
        let response = await fetch(GOOGLE_APPS_SCRIPT_URL + "?action=getInitialData", { redirect: 'follow' });
        let result = await response.json();

        if (result && result.success && result.data) {
          appData.transactions = Array.isArray(result.data.transactions) ? result.data.transactions : [];
          appData.products = Array.isArray(result.data.products) ? result.data.products : [];
          appData.categories = (result.data.categories && typeof result.data.categories === 'object') ? result.data.categories : {};
          
          if (result.data.appPin) {
            appData.appPin = result.data.appPin;
            localStorage.setItem('tokosiman_app_pin', result.data.appPin);
          }

          renderAll();
          updateDbStatusBadge();
          if (showInitialLoading) showToast("Berhasil tersinkronisasi dengan Google Sheets!", "success");
        } else {
          throw new Error(result.message || "Gagal sinkronisasi data");
        }
      } catch (err) {
        showToast("Gagal terhubung ke Google Sheets: " + err.message, "error");
      } finally {
        if (showInitialLoading) hideLoading();
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
          return await response.json();
        } catch (err) {
          if (attempt === maxRetries) {
            return { success: false, message: err.toString() };
          }
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    async function dbSaveTransaction(payload) {
      if (!payload.id) {
        payload.id = 'TX-' + Date.now();
      }
      
      let idx = appData.transactions.findIndex(t => t.id.toString() === payload.id.toString());
      if (idx !== -1) {
        appData.transactions[idx] = payload;
      } else {
        appData.transactions.unshift(payload);
      }
      renderAll();

      if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
        let res = await callGasApi('simpanTransaksi', payload);
        if (!res.success) {
          showToast("Gagal simpan ke Google Sheets: " + res.message, "error");
        }
      }
      return { success: true };
    }

    async function dbDeleteTransaction(id) {
      appData.transactions = appData.transactions.filter(t => t.id.toString() !== id.toString());
      renderAll();

      if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
        let res = await callGasApi('hapusTransaksi', { id: id });
        if (!res.success) showToast("Peringatan: Gagal hapus di Google Sheets", "error");
      }
      return { success: true };
    }

    async function dbSaveProduct(payload) {
      if (!payload.id) {
        payload.id = 'PRD-' + Date.now();
      }
      let idx = appData.products.findIndex(p => p.id.toString() === payload.id.toString());
      if (idx !== -1) {
        appData.products[idx] = payload;
      } else {
        appData.products.push(payload);
      }
      renderAll();

      if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
        let res = await callGasApi('simpanProduk', payload);
        if (!res.success) showToast("Peringatan: Gagal sync produk ke Google Sheets", "error");
      }
      return { success: true };
    }

    async function dbDeleteProduct(id) {
      appData.products = appData.products.filter(p => p.id.toString() !== id.toString());
      renderAll();

      if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
        let res = await callGasApi('hapusProduk', { id: id });
        if (!res.success) showToast("Peringatan: Gagal hapus produk di Google Sheets", "error");
      }
      return { success: true };
    }

    async function dbSaveCategories(categories) {
      appData.categories = categories;
      renderAll();

      if (GOOGLE_APPS_SCRIPT_URL && isAutoSyncEnabled) {
        let res = await callGasApi('simpanKategoriObj', categories);
        if (!res.success) showToast("Peringatan: Gagal sync kategori ke Google Sheets", "error");
      }
      return { success: true };
    }

    function saveCategoriesData() {
      showLoading("Menyimpan kategori...", "Memperbarui struktur kategori ke Google Sheets");
      dbSaveCategories(appData.categories).then(() => {
        hideLoading();
        closeModal('modalFormKategori');
        showToast("Kategori berhasil disimpan", "success");
      });
    }

    function syncDataWithLoading() {
      if (!GOOGLE_APPS_SCRIPT_URL) {
        showToast("Masukkan URL Google Apps Script terlebih dahulu di menu Setelan", "error");
        return;
      }
      showLoading("Menyinkronkan Data Cloud...", "Mengunduh pembaharuan terbaru dari Google Sheets");
      loadData(false);
      setTimeout(() => {
        hideLoading();
        showToast("Data berhasil disinkronkan secara real-time!", "success");
      }, 700);
    }

    function saveGasUrlSetting() {
      let urlInput = document.getElementById('inputGasUrl').value.trim();
      GOOGLE_APPS_SCRIPT_URL = urlInput;
      localStorage.setItem('tokosiman_gas_url', urlInput);

      showLoading("Menghubungkan ke Google Sheets...", "Memeriksa koneksi database baru");
      loadData(false);
      setTimeout(() => {
        hideLoading();
        if (urlInput) {
          showToast("URL Google Apps Script berhasil disimpan!", "success");
        } else {
          showToast("URL dikosongkan", "info");
        }
      }, 500);
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
            if (nav) nav.className = "flex flex-col items-center justify-center flex-1 py-1.5 text-indigo-700 font-bold text-[10px] gap-1 transition-all no-std-btn";
            if (desktopNav) desktopNav.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-700 bg-indigo-50/90 backdrop-blur-md border border-indigo-100 transition-all text-xs font-bold shadow-xs";
          } else {
            if (el) el.classList.add('hidden');
            if (nav) nav.className = "flex flex-col items-center justify-center flex-1 py-1.5 text-slate-700 font-medium text-[10px] gap-1 transition-all hover:text-indigo-700 no-std-btn";
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
        document.getElementById('subTabTxBtn').className = "w-1/2 pb-2.5 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
        document.getElementById('subTabHpBtn').className = "w-1/2 pb-2.5 text-slate-500 hover:text-slate-900 font-medium transition-all text-xs no-std-btn";
      } else {
        document.getElementById('subContentTransaksi').classList.add('hidden');
        document.getElementById('subContentHutang').classList.remove('hidden');
        document.getElementById('subTabHpBtn').className = "w-1/2 pb-2.5 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
        document.getElementById('subTabTxBtn').className = "w-1/2 pb-2.5 text-slate-500 hover:text-slate-900 font-medium transition-all text-xs no-std-btn";
      }
    }

    function switchSubProdukTab(sub) {
      if (sub === 'produk') {
        document.getElementById('subContentDaftarProduk').classList.remove('hidden');
        document.getElementById('subContentKelolaKategori').classList.add('hidden');
        document.getElementById('subTabProdukBtn').className = "w-1/2 pb-3 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
        document.getElementById('subTabKategoriBtn').className = "w-1/2 pb-3 text-slate-500 hover:text-slate-900 font-semibold transition-all text-xs no-std-btn";
      } else {
        document.getElementById('subContentDaftarProduk').classList.add('hidden');
        document.getElementById('subContentKelolaKategori').classList.remove('hidden');
        document.getElementById('subTabKategoriBtn').className = "w-1/2 pb-3 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
        document.getElementById('subTabProdukBtn').className = "w-1/2 pb-3 text-slate-500 hover:text-slate-900 font-semibold transition-all text-xs no-std-btn";
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
        btnFav.className = "w-1/2 pb-2.5 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
        btnLain.className = "w-1/2 pb-2.5 text-slate-500 hover:text-slate-900 font-medium transition-all text-xs no-std-btn";
      } else {
        favWrapper.classList.add('hidden');
        lainWrapper.classList.remove('hidden');
        btnLain.className = "w-1/2 pb-2.5 text-indigo-700 border-b-2 border-indigo-600 font-bold transition-all text-xs no-std-btn";
        btnFav.className = "w-1/2 pb-2.5 text-slate-500 hover:text-slate-900 font-medium transition-all text-xs no-std-btn";
      }
      renderProdukTabList();
    }

    function isDateInPeriod(dateStr, period) {
      if (period === 'semua' || !period) return true;
      if (!dateStr) return false;
      let d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;

      let now = new Date();
      let startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      if (period === 'hari_ini') return d >= startOfToday && d <= endOfToday;
      if (period === 'minggu_ini') {
        let startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(now.getDate() - now.getDay());
        let endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return d >= startOfWeek && d <= endOfWeek;
      }
      if (period === 'minggu_lalu') {
        let startOfThisWeek = new Date(startOfToday);
        startOfThisWeek.setDate(now.getDate() - now.getDay());
        let startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
        let endOfLastWeek = new Date(startOfThisWeek);
        endOfLastWeek.setMilliseconds(-1);
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
          "tx-filter-btn bg-indigo-600 border border-indigo-600 text-white px-4 py-2 rounded-xl font-bold whitespace-nowrap text-xs shadow-md shadow-indigo-600/20" : 
          "tx-filter-btn bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 px-4 py-2 rounded-xl whitespace-nowrap hover:bg-slate-50 text-xs shadow-xs";
      });
      renderTransaksi();
    }

    function renderTransaksi() {
      let totPemasukan = 0, totModal = 0, totUntung = 0;
      
      let now = new Date();
      let thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

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
        totPemasukan += t.pemasukan;
        totModal += (t.modal || 0);
        totUntung += t.untung;
      });

      let persenUntung = totModal > 0 ? ((totUntung / totModal) * 100).toFixed(1) : (totPemasukan > 0 ? "100.0" : "0.0");
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
        grouped[dateStr].dayUntung += t.untung;
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
        container.innerHTML = `<div class="text-center py-8 modern-card text-slate-500 text-xs">${emptyText}</div>`;
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
        let header = `<div class="bg-white/60 backdrop-blur-md px-4 py-2.5 text-xs flex justify-between font-bold border-b border-slate-200 text-slate-900"><span>${formatFormattedDate(date)}</span><span class="text-emerald-700 font-black">Untung ${formatRp(group.dayUntung)}</span></div>`;
        
        let itemsHtml = group.items.map(item => `
          <div onclick="openDetailCatatanById('${item.id}')" class="p-3.5 border-b border-slate-200 last:border-b-0 flex justify-between items-start text-xs cursor-pointer hover:bg-white/50 backdrop-blur-sm transition-colors">
            <div>
              <div class="font-bold text-slate-900 text-xs">${item.catatan || item.kategori}</div>
              <div class="text-slate-600 text-[11px] mt-1 flex items-center gap-1.5 flex-wrap">
                <span>${item.kategori || 'Umum'} ${item.subKategori ? '• ' + item.subKategori : ''}</span>
                ${item.status === 'Belum Lunas' ? '<span class="bg-rose-50/90 backdrop-blur-sm text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md text-[10px] font-bold">Belum lunas</span>' : ''}
              </div>
            </div>
            <div class="text-right">
              ${item.pemasukan > 0 ? `<div class="font-bold text-emerald-700 text-xs">+${formatRp(item.pemasukan)}</div>` : ''}
              ${item.pengeluaran > 0 ? `<div class="font-bold text-rose-600 text-xs">-${formatRp(item.pengeluaran)}</div>` : ''}
            </div>
          </div>
        `).join('');
        section.innerHTML = header + itemsHtml;
        container.appendChild(section);
      });

      if(berandaInfo) berandaInfo.innerText = `Hal ${berandaPage} dari ${totalPagesBeranda}`;
      if(berandaPrev) berandaPrev.disabled = (berandaPage <= 1);
      if(berandaNext) berandaNext.disabled = (berandaPage >= totalPagesBeranda);
    }

    function changeBerandaPage(delta) {
      let now = new Date();
      let thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

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
      let item = (appData.transactions || []).find(t => t.id.toString() === id.toString());
      if (item) openDetailCatatan(item);
    }

    function setHpFilter(filter) {
      activeHpFilter = filter;
      document.querySelectorAll('.hp-filter-btn').forEach(btn => {
        btn.className = btn.dataset.hpfilter === filter ? 
          "hp-filter-btn bg-indigo-600 border border-indigo-600 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs" : 
          "hp-filter-btn bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl font-medium hover:bg-slate-50 text-xs shadow-xs";
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
      container.innerHTML = "";
      let names = Object.keys(hpMap);
      names.sort((a,b) => a.localeCompare(b));

      if (names.length === 0) {
        container.innerHTML = `<div class="text-center py-8 text-slate-500 text-xs">Tidak ada data hutang/piutang</div>`;
        return;
      }

      names.forEach(nama => {
        let record = hpMap[nama];
        let firstItem = record.items[0];
        let initial = (nama && nama.length > 0) ? nama.charAt(0).toUpperCase() : '?';
        
        container.innerHTML += `
          <div onclick="openDetailCatatanById('${firstItem.id}')" class="p-3.5 flex justify-between items-center text-xs cursor-pointer hover:bg-white/50 backdrop-blur-sm transition-colors">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl ${firstItem.jenis === 'hutang_saya' ? 'bg-amber-50/90 backdrop-blur-sm text-amber-700 border border-amber-200' : 'bg-rose-50/90 backdrop-blur-sm text-rose-700 border border-rose-200'} font-bold flex items-center justify-center text-xs shadow-xs">${initial}</div>
              <div>
                <div class="font-bold text-slate-900 text-xs">${nama}</div>
                <div class="text-[11px] text-slate-500 mt-0.5">${firstItem.jenis === 'hutang_saya' ? 'Hutang Saya' : 'Hutang Pelanggan'}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-black text-slate-900 text-xs">${formatRp(record.total)}</div>
              <div class="text-[10px] ${firstItem.status === 'Belum Lunas' ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'} mt-0.5">${firstItem.status}</div>
            </div>
          </div>
        `;
      });
    }

    function setAnFilter(filter) {
      activeAnFilter = filter;
      document.querySelectorAll('.an-filter-btn').forEach(btn => {
        btn.className = btn.dataset.anfilter === filter ? 
          "an-filter-btn bg-indigo-600 border border-indigo-600 text-white px-4 py-2 rounded-xl font-bold whitespace-nowrap shrink-0 text-xs shadow-md shadow-indigo-600/20" : 
          "an-filter-btn bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 px-4 py-2 rounded-xl whitespace-nowrap hover:bg-slate-50 shrink-0 text-xs shadow-xs";
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
      let totUntung = filtered.reduce((acc, t) => acc + t.untung, 0);
      let totalTxCount = filtered.length;

      let prevFilter = '';
      if (activeAnFilter === 'tahun_ini') prevFilter = 'tahun_lalu';
      else if (activeAnFilter === 'bulan_ini') prevFilter = 'bulan_lalu';

      let prevUntung = 0;
      let prevTxCount = 0;

      if (prevFilter) {
        let filteredPrev = (appData.transactions || []).filter(t => isDateInPeriod(t.tanggal, prevFilter));
        prevUntung = filteredPrev.reduce((acc, t) => acc + t.untung, 0);
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
        dayGroup[d].untung += t.untung;
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
        catMap[katName].untung += t.untung;
      });

      let sortedCats = Object.keys(catMap).map(k => ({ name: k, ...catMap[k] })).sort((a,b) => b.untung - a.untung).slice(0, 3);
      let catContainer = document.getElementById('anTopKategori');
      if(!catContainer) return;
      catContainer.innerHTML = "";

      if (sortedCats.length === 0) {
        catContainer.innerHTML = `<div class="py-3 text-center text-slate-500">Belum ada data</div>`;
        return;
      }

      sortedCats.forEach(c => {
        catContainer.innerHTML += `
          <div class="py-3 flex justify-between items-center text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span class="text-slate-900 font-medium">${c.name}</span>
            </div>
            <div class="text-right">
              <span class="text-slate-600 mr-2 text-[11px]">${Number(c.count).toLocaleString('id-ID')}x</span>
              <span class="font-bold text-emerald-700">${formatRp(c.untung)}</span>
            </div>
          </div>
        `;
      });
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

      let subs = (appData.categories && appData.categories[selectedMainKat]) ? appData.categories[selectedMainKat] : [];
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
      container.innerHTML = "";
      let categories = (appData.categories && typeof appData.categories === 'object') ? appData.categories : {};
      let mainKeys = Object.keys(categories).sort((a, b) => a.localeCompare(b));

      if (mainKeys.length === 0) {
        container.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">Belum ada kategori</div>`;
        return;
      }

      mainKeys.forEach(mainKat => {
        let subs = categories[mainKat] || [];
        let iconClass = getCategoryIcon(mainKat);
        let safeId = mainKat.replace(/[^a-zA-Z0-9]/g, '_');
        
        let subsHtml = subs.map(sub => `
          <div class="py-2.5 pl-10 pr-3 flex justify-between items-center text-xs text-slate-700 hover:bg-slate-100/85 border-t border-slate-200">
            <span class="flex items-center gap-2"><i class="fa-solid fa-angle-right text-[10px] text-indigo-600"></i> ${sub}</span>
            <div class="flex items-center gap-1.5">
              <button onclick="openFormKategoriEditSub('${mainKat}', '${sub}')" class="w-6 h-6 bg-white/80 backdrop-blur-sm text-indigo-700 rounded-lg flex items-center justify-center border border-slate-200 hover:bg-slate-100 transition-all no-std-btn shadow-xs" title="Edit Sub">
                <i class="fa-solid fa-pen text-[9px]"></i>
              </button>
              <button onclick="hapusSubKategori('${mainKat}', '${sub}')" class="w-6 h-6 bg-rose-50/90 backdrop-blur-sm text-rose-600 rounded-lg flex items-center justify-center border border-rose-200 hover:bg-rose-100 transition-all no-std-btn shadow-xs" title="Hapus Sub">
                <i class="fa-solid fa-trash text-[9px]"></i>
              </button>
            </div>
          </div>
        `).join('');

        container.innerHTML += `
          <div class="py-3 border-b border-slate-200 last:border-b-0">
            <div class="flex justify-between items-center">
              <div class="flex items-center gap-3 cursor-pointer select-none flex-1" onclick="toggleSubKategori('${safeId}')">
                <div class="w-8 h-8 rounded-xl bg-white/80 backdrop-blur-sm text-indigo-700 flex items-center justify-center text-xs border border-slate-200 shadow-xs">
                  <i class="fa-solid ${iconClass} text-xs"></i>
                </div>
                <div>
                  <span class="font-bold text-slate-900 text-xs">${mainKat}</span>
                  <div class="text-[10px] text-slate-600 font-medium">${subs.length} sub-kategori (Ketuk untuk lihat)</div>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <button onclick="openFormKategoriTambahSub('${mainKat}')" class="px-2.5 py-1.5 bg-emerald-50/90 backdrop-blur-sm text-emerald-700 rounded-xl font-semibold text-[10px] border border-emerald-200 hover:bg-emerald-100 transition-all no-std-btn shadow-xs" title="Tambah Sub">
                  <i class="fa-solid fa-plus text-[9px]"></i> Sub
                </button>
                <button onclick="openFormKategoriEditUtama('${mainKat}')" class="w-7 h-7 bg-white/80 backdrop-blur-sm text-indigo-700 rounded-xl flex items-center justify-center border border-slate-200 hover:bg-slate-100 transition-all no-std-btn shadow-xs" title="Edit">
                  <i class="fa-solid fa-pen text-xs"></i>
                </button>
                <button onclick="hapusKategoriUtama('${mainKat}')" class="w-7 h-7 bg-rose-50/90 backdrop-blur-sm text-rose-600 rounded-xl flex items-center justify-center border border-rose-200 hover:bg-slate-100 transition-all no-std-btn shadow-xs" title="Hapus">
                  <i class="fa-solid fa-trash text-xs"></i>
                </button>
              </div>
            </div>
            <div id="subContainer_${safeId}" class="mt-2.5 bg-white/50 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-200 hidden shadow-xs">${subsHtml}</div>
          </div>
        `;
      });
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
      statusEl.innerText = item.status;
      statusEl.className = item.status === 'Belum Lunas' ? 
        "bg-rose-50/90 backdrop-blur-sm text-rose-700 border border-rose-200 text-xs font-bold px-2.5 py-0.5 rounded-lg" : 
        "bg-emerald-50/90 backdrop-blur-sm text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-lg";

      let nominal = item.pemasukan || item.pengeluaran || item.modal || 0;
      document.getElementById('dtPemasukan').innerText = formatRp(nominal);
      document.getElementById('dtModal').innerText = "-" + formatRp(item.modal);
      document.getElementById('dtUntung').innerText = formatRp(item.untung);

      if (item.jenis === 'hutang_saya') {
        document.getElementById('dtLabelNominal').innerHTML = `<i class="fa-solid fa-hand-holding-dollar text-amber-600 text-xs"></i> Jumlah Hutang Saya`;
        document.getElementById('dtRowUntung').classList.add('hidden');
        document.getElementById('dtRowModal').classList.add('hidden');
        document.getElementById('dtLabelOrang').innerText = "Pemberi Hutang / Pihak";
      } else {
        document.getElementById('dtLabelNominal').innerHTML = `<i class="fa-solid fa-caret-down text-emerald-600 text-xs"></i> Pemasukan`;
        document.getElementById('dtRowUntung').classList.remove('hidden');
        document.getElementById('dtRowModal').classList.remove('hidden');
        document.getElementById('dtLabelOrang').innerText = "Nama pelanggan";
      }

      if (item.namaPelanggan) {
        document.getElementById('dtRowPelanggan').classList.remove('hidden');
        document.getElementById('dtNamaPelanggan').innerText = item.namaPelanggan;
      } else {
        document.getElementById('dtRowPelanggan').classList.add('hidden');
      }

      document.getElementById('dtCatatan').innerText = item.catatan || "-";
      document.getElementById('dtKategori').innerText = (item.kategori || "Umum") + (item.subKategori ? " • " + item.subKategori : "");
      document.getElementById('dtTanggalTx').innerText = formatFormattedDate(item.tanggal);

      let btnUbah = document.getElementById('btnUbahCatatan');
      btnUbah.onclick = function() {
        closeModal('modalDetailCatatan');
        openFormEdit(item);
      };

      document.getElementById('btnHapusCatatan').onclick = function() {
        showConfirm("Hapus Catatan", "Apakah Anda yakin ingin menghapus catatan ini?", function() {
          showLoading("Menghapus catatan...");
          dbDeleteTransaction(item.id).then(() => {
            hideLoading();
            closeModal('modalDetailCatatan');
            showToast("Catatan berhasil dihapus", "success");
          });
        });
      };

      openModal('modalDetailCatatan');
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
      let matchingTx = (appData.transactions || []).filter(t => t.namaPelanggan && t.namaPelanggan.toLowerCase() === namaPelanggan.toLowerCase());
      
      document.getElementById('titleDaftarTxPelanggan').innerText = namaPelanggan;
      document.getElementById('subtitleDaftarTxPelanggan').innerText = `${matchingTx.length} riwayat transaksi terkait`;

      let totalNominal = 0;
      let hasBelumLunas = false;
      matchingTx.forEach(t => {
        totalNominal += (t.pemasukan || t.pengeluaran || t.modal || 0);
        if (t.status === 'Belum Lunas') hasBelumLunas = true;
      });

      document.getElementById('dtPelangganTotalNominal').innerText = formatRp(totalNominal);
      let statusAkhirEl = document.getElementById('dtPelangganStatusAkhir');
      if (hasBelumLunas) {
        statusAkhirEl.innerText = "Belum Lunas";
        statusAkhirEl.className = "font-bold text-rose-600 text-xs mt-1";
      } else {
        statusAkhirEl.innerText = "Lunas";
        statusAkhirEl.className = "font-bold text-emerald-700 text-xs mt-1";
      }

      let container = document.getElementById('listTransaksiPelangganContainer');
      container.innerHTML = "";
      if (matchingTx.length === 0) {
        container.innerHTML = `<div class="py-3 text-center text-slate-500">Tidak ada transaksi</div>`;
      } else {
        matchingTx.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
        matchingTx.forEach(t => {
          let nominal = t.pemasukan || t.pengeluaran || t.modal || 0;
          container.innerHTML += `
            <div class="py-3 flex justify-between items-center text-xs">
              <div>
                <div class="font-bold text-slate-900">${t.catatan || t.kategori}</div>
                <div class="text-[11px] text-slate-600 mt-0.5">${formatFormattedDate(t.tanggal)} • <span class="${t.status === 'Belum Lunas' ? 'text-rose-600 font-bold' : 'text-emerald-700 font-semibold'}">${t.status}</span></div>
              </div>
              <div class="text-right">
                <div class="font-bold text-slate-900">${formatRp(nominal)}</div>
              </div>
            </div>
          `;
        });
      }

      openModal('modalDaftarTransaksiPelanggan');
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
          "ID Transaksi": t.id,
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
      items.forEach(i => {
        let harga = i.harga || i.hargaJual || 0;
        let qty = i.qty || 1;
        itemsContainer.innerHTML += `
          <div style="display: flex; justify-content: space-between;">
            <span>${i.nama || i.catatan || 'Produk'} x${qty}</span>
            <span>${formatRp(harga * qty)}</span>
          </div>
        `;
      });

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
      itemsContainer.innerHTML = "";
      let items = (data.items && data.items.length > 0) ? data.items : [{ nama: data.catatan || 'Transaksi', harga: data.pemasukan || 0, qty: 1 }];
      items.forEach(i => {
        let harga = i.harga || i.hargaJual || 0;
        let qty = i.qty || 1;
        itemsContainer.innerHTML += `
          <div class="flex justify-between">
            <span>${i.nama || i.catatan || 'Produk'} x${qty}</span>
            <span>${formatRp(harga * qty)}</span>
          </div>
        `;
      });

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
        badge.className = "bg-rose-50/90 backdrop-blur-sm text-rose-700 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] border border-rose-200";
        iconBg.className = "w-12 h-12 rounded-full bg-rose-100 border-2 border-rose-200 text-rose-600 flex items-center justify-center text-base shadow-inner";
        icon.className = "fa-solid fa-clock";
      } else {
        title.innerText = "Pembayaran Berhasil!";
        subTitle.innerText = "Transaksi telah selesai diproses";
        footerMsg.innerText = "Transaksi berhasil 🎉";
        badge.innerText = "Lunas";
        badge.className = "bg-emerald-50/90 backdrop-blur-sm text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] border border-emerald-200";
        iconBg.className = "w-12 h-12 rounded-full bg-emerald-100 border-2 border-emerald-200 text-emerald-600 flex items-center justify-center text-base shadow-inner";
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
      document.getElementById('formJumlah').value = "";
      document.getElementById('formModal').value = "";
      document.getElementById('formCatatan').value = "";
      document.getElementById('formNamaPelanggan').value = "";
      
      let dateInput = document.getElementById('formTanggal');
      if(dateInput) dateInput.value = getLocalDateString();

      cart = [];
      renderCart();
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
        if(dtInput) dtInput.value = item.tanggal.split('T')[0];
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
        if(el) el.className = "w-1/3 py-2.5 text-slate-500 font-medium transition-all text-xs no-std-btn";
      });

      let lbl = "Jumlah pemasukan";
      if (type === 'pemasukan') {
        let el = document.getElementById('ftPemasukan');
        if(el) el.className = "w-1/3 py-2.5 border-b-2 border-indigo-600 text-indigo-700 font-bold transition-all text-xs no-std-btn";
        document.getElementById('groupModal').classList.remove('hidden');
        document.getElementById('groupUntung').classList.remove('hidden');
        document.getElementById('groupPilihProduk').classList.remove('hidden');
        document.getElementById('lblInfoHutang').innerText = "Akan tercatat sebagai hutang pelanggan.";
        document.getElementById('lblNamaPihak').innerText = "Nama pelanggan";
      } else if (type === 'pengeluaran') {
        let el = document.getElementById('ftPengeluaran');
        if(el) el.className = "w-1/3 py-2.5 border-b-2 border-indigo-600 text-indigo-700 font-bold transition-all text-xs no-std-btn";
        lbl = "Jumlah pengeluaran";
        document.getElementById('groupModal').classList.add('hidden');
        document.getElementById('groupUntung').classList.add('hidden');
        document.getElementById('groupPilihProduk').classList.add('hidden');
      } else if (type === 'hutang_saya') {
        let el = document.getElementById('ftHutangSaya');
        if(el) el.className = "w-1/3 py-2.5 border-b-2 border-indigo-600 text-indigo-700 font-bold transition-all text-xs no-std-btn";
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
      if (status === 'Lunas') {
        document.getElementById('btnStatusLunas').className = "py-2.5 border border-indigo-600 rounded-xl font-semibold text-xs bg-indigo-600 text-white shadow-md no-std-btn";
        document.getElementById('btnStatusBelumLunas').className = "py-2.5 border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 bg-white/80 backdrop-blur-sm hover:bg-slate-50 no-std-btn shadow-xs";
        if (currentFormType !== 'hutang_saya') {
          document.getElementById('groupPelanggan').classList.add('hidden');
        }
      } else {
        document.getElementById('btnStatusBelumLunas').className = "py-2.5 border border-indigo-600 rounded-xl font-semibold text-xs bg-indigo-600 text-white shadow-md no-std-btn";
        document.getElementById('btnStatusLunas').className = "py-2.5 border border-slate-200 rounded-xl font-semibold text-xs text-slate-700 bg-white/80 backdrop-blur-sm hover:bg-slate-50 no-std-btn shadow-xs";
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
      let existing = cart.find(item => item.id.toString() === p.id.toString());
      let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
      let beliVal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));

      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ id: p.id, nama: p.nama, harga: jualVal, modal: beliVal, kategori: p.kategori, subKategori: p.subKategori, qty: 1 });
      }
      
      renderCart();
      showToast(p.nama + " ditambahkan ke keranjang", "success");
    }

    function updateCartQty(id, delta) {
      let item = cart.find(i => i.id.toString() === id.toString());
      if (item) {
        item.qty += delta;
        if (item.qty <= 0) {
          cart = cart.filter(i => i.id.toString() !== id.toString());
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
      container.innerHTML = "";

      let totalJual = 0;
      let totalModal = 0;
      let namaCatatanList = [];
      let categoryCounts = {};

      cart.forEach(item => {
        let subJual = item.harga * item.qty;
        let subModal = item.modal * item.qty;
        totalJual += subJual;
        totalModal += subModal;
        namaCatatanList.push(`${item.nama} (${item.qty}x)`);

        let cat = item.kategori || '';
        if (cat) {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + item.qty;
        }

        container.innerHTML += `
          <div class="py-2.5 flex justify-between items-center text-xs">
            <div>
              <div class="font-bold text-slate-900">${item.nama}</div>
              <div class="text-[11px] text-slate-600 mt-0.5"><span class="text-emerald-700 font-semibold">${formatRp(item.harga)}</span> x ${item.qty} = <span class="text-emerald-700 font-bold">${formatRp(subJual)}</span></div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="updateCartQty('${item.id}', -1)" class="w-6 h-6 bg-white/80 backdrop-blur-sm rounded-lg font-bold text-slate-700 flex items-center justify-center hover:bg-slate-100 no-std-btn border border-slate-200 shadow-xs">-</button>
              <span class="font-bold w-5 text-center text-slate-900">${Number(item.qty).toLocaleString('id-ID')}</span>
              <button type="button" onclick="updateCartQty('${item.id}', 1)" class="w-6 h-6 bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center shadow-md no-std-btn">+</button>
            </div>
          </div>
        `;
      });

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
      let existing = kasirCart.find(item => item.id.toString() === p.id.toString());
      let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
      let beliVal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));

      if (existing) {
        existing.qty += 1;
      } else {
        kasirCart.push({ id: p.id, nama: p.nama, harga: jualVal, modal: beliVal, kategori: p.kategori, subKategori: p.subKategori, qty: 1 });
      }
      renderKasirCart();
      showToast(p.nama + " masuk keranjang kasir", "success");
    }

    function updateKasirQty(id, delta) {
      let item = kasirCart.find(i => i.id.toString() === id.toString());
      if (item) {
        item.qty += delta;
        if (item.qty <= 0) {
          kasirCart = kasirCart.filter(i => i.id.toString() !== id.toString());
        }
      }
      renderKasirCart();
    }

    function renderKasirCart() {
      let container = document.getElementById('kasirCartContainer');
      if (kasirCart.length === 0) {
        container.innerHTML = `<div class="text-slate-500 py-4 text-center text-xs">Keranjang kasir masih kosong. Pilih produk di bawah.</div>`;
        let katSelect = document.getElementById('kasirKategoriSelect');
        if(katSelect) katSelect.value = "Penjualan Kasir";
        calcKasirTotals();
        return;
      }

      container.innerHTML = "";
      kasirCart.forEach(item => {
        let subJual = item.harga * item.qty;
        container.innerHTML += `
          <div class="py-2.5 flex justify-between items-center text-xs">
            <div>
              <div class="font-bold text-slate-900">${item.nama}</div>
              <div class="text-[11px] text-slate-600 mt-0.5"><span class="text-emerald-700 font-semibold">${formatRp(item.harga)}</span> x ${item.qty} = <span class="text-emerald-700 font-bold">${formatRp(subJual)}</span></div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="updateKasirQty('${item.id}', -1)" class="w-6 h-6 bg-white/80 backdrop-blur-sm rounded-lg font-bold text-slate-700 flex items-center justify-center hover:bg-slate-100 no-std-btn border border-slate-200 shadow-xs">-</button>
              <span class="font-bold w-5 text-center text-slate-900">${Number(item.qty).toLocaleString('id-ID')}</span>
              <button type="button" onclick="updateKasirQty('${item.id}', 1)" class="w-6 h-6 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center shadow-md no-std-btn">+</button>
            </div>
          </div>
        `;
      });

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
        } else if (dominantCategory !== "Penjualan Kasir") {
          let opt = document.createElement('option');
          opt.value = dominantCategory;
          opt.innerText = dominantCategory;
          katSelect.appendChild(opt);
          katSelect.value = dominantCategory;
        }
      }

      calcKasirTotals();
    }

    function calcKasirTotals() {
      let subtotal = kasirCart.reduce((acc, i) => acc + (i.harga * i.qty), 0);
      let totalModal = kasirCart.reduce((acc, i) => acc + (i.modal * i.qty), 0);
      let rawDiskonInput = parseNumber(document.getElementById('kasirDiskon').value);
      let bayar = parseNumber(document.getElementById('kasirBayar').value);

      let diskonNominal = 0;
      if (diskonType === 'rp') {
        diskonNominal = rawDiskonInput;
      } else {
        let persen = Math.min(100, Math.max(0, rawDiskonInput));
        diskonNominal = Math.round((persen / 100) * subtotal);
      }

      let totalAkhir = Math.max(0, subtotal - diskonNominal);
      let untungBersih = Math.max(0, totalAkhir - totalModal);

      document.getElementById('kasirTotalAkhir').innerText = formatRp(totalAkhir);
      document.getElementById('kasirTotalUntung').innerText = formatRp(untungBersih);

      let labelKembalian = document.getElementById('kasirLabelKembalian');
      let valKembalian = document.getElementById('kasirKembalian');

      if (kasirStatus === 'Belum Lunas') {
        labelKembalian.innerText = "Sisa Kurang / Hutang:";
        let sisaKurang = Math.max(0, totalAkhir - bayar);
        valKembalian.innerText = formatRp(sisaKurang);
        valKembalian.className = "text-rose-600 font-extrabold text-xs";
      } else {
        labelKembalian.innerText = "Kembalian:";
        let kembalian = Math.max(0, bayar - totalAkhir);
        valKembalian.innerText = formatRp(kembalian);
        valKembalian.className = "text-indigo-700 font-extrabold text-xs";
      }
    }

    function setQuickCash(val) {
      let totalAkhirText = document.getElementById('kasirTotalAkhir').innerText;
      let totalAkhir = parseNumber(totalAkhirText);
      let bayarInput = document.getElementById('kasirBayar');

      if (val === 'pas') {
        bayarInput.value = totalAkhir ? totalAkhir.toLocaleString('id-ID') : "0";
      } else {
        bayarInput.value = Number(val).toLocaleString('id-ID');
      }
      calcKasirTotals();
    }

    function onDiskonTypeChange(type) {
      diskonType = type;
      let diskonInput = document.getElementById('kasirDiskon');
      diskonInput.value = "";
    }

    function onDiskonInput(input) {
      if (diskonType === 'persen') {
        let val = parseNumber(input.value);
        if (val > 100) val = 100;
        input.value = val ? val.toString() : "";
      } else {
        formatInputRupiah(input);
      }
    }

    async function checkoutKasir() {
      if (kasirCart.length === 0) {
        showToast("Keranjang kasir masih kosong!", "error");
        return;
      }

      showLoading("Menyelesaikan transaksi...", "Menghitung total, diskon & stok produk");

      setTimeout(async () => {
        let subtotal = kasirCart.reduce((acc, i) => acc + (i.harga * i.qty), 0);
        let totalModal = kasirCart.reduce((acc, i) => acc + (i.modal * i.qty), 0);
        let rawDiskonInput = parseNumber(document.getElementById('kasirDiskon').value);
        let bayar = parseNumber(document.getElementById('kasirBayar').value);
        
        let diskonNominal = 0;
        if (diskonType === 'rp') {
          diskonNominal = rawDiskonInput;
        } else {
          let persen = Math.min(100, Math.max(0, rawDiskonInput));
          diskonNominal = Math.round((persen / 100) * subtotal);
        }

        let totalAkhir = Math.max(0, subtotal - diskonNominal);
        let untungBersih = Math.max(0, totalAkhir - totalModal);

        let catatanList = kasirCart.map(i => `${i.nama} (${i.qty}x)`).join(', ');
        let namaPelanggan = document.getElementById('kasirPelanggan').value.trim() || 'Pelanggan Kasir';
        let modeBayar = document.getElementById('kasirModeBayar').value;
        let kategoriSelectEl = document.getElementById('kasirKategoriSelect');
        let kategoriTransaksi = (kategoriSelectEl && kategoriSelectEl.value) ? kategoriSelectEl.value : 'Penjualan Kasir';
        
        let dateObj = new Date();
        let dateString = dateObj.toISOString();

        let orderId = 'TRX-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        let hitungKembalian = 0;
        if (kasirStatus !== 'Belum Lunas') {
          hitungKembalian = bayar > totalAkhir ? (bayar - totalAkhir) : 0;
        }

        let payload = {
          id: 'TX-' + Date.now(),
          orderId: orderId,
          tanggal: dateString,
          jenis: 'pemasukan',
          catatan: catatanList,
          pemasukan: totalAkhir,
          subtotal: subtotal,
          diskonNominal: diskonNominal,
          bayar: bayar ? bayar : totalAkhir,
          kembalian: hitungKembalian,
          pengeluaran: 0,
          modal: totalModal,
          untung: untungBersih,
          status: kasirStatus,
          namaPelanggan: namaPelanggan,
          modeBayar: modeBayar,
          kategori: kategoriTransaksi,
          items: [...kasirCart]
        };

        await dbSaveTransaction(payload);

        kasirCart = [];
        document.getElementById('kasirPelanggan').value = "";
        document.getElementById('kasirDiskon').value = "";
        document.getElementById('kasirBayar').value = "";
        renderKasirCart();

        hideLoading();
        showPaymentSuccessModal(payload);
      }, 50);
    }

    function renderKasirProdukList() {
      let queryInput = document.getElementById('searchKasirProduk');
      let container = document.getElementById('kasirProdukGrid');
      let infoEl = document.getElementById('kasirPaginationInfo');
      let prevBtn = document.getElementById('kasirPrevBtn');
      let nextBtn = document.getElementById('kasirNextBtn');
      if (!queryInput || !container) return;

      let query = queryInput.value.toLowerCase();
      
      let sortedProducts = [...(appData.products || [])].sort((a, b) => {
        if (a.favorit && !b.favorit) return -1;
        if (!a.favorit && b.favorit) return 1;
        return (a.nama || "").localeCompare(b.nama || "");
      });

      let filtered = sortedProducts.filter(p => (p.nama || "").toLowerCase().includes(query));

      let totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
      if (kasirPage > totalPages) kasirPage = totalPages;
      if (kasirPage < 1) kasirPage = 1;

      let startIndex = (kasirPage - 1) * ITEMS_PER_PAGE;
      let paginatedItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      container.innerHTML = "";
      if (paginatedItems.length === 0) {
        container.innerHTML = `<div class="col-span-2 text-center py-8 text-slate-500 text-xs">Tidak ada produk</div>`;
      } else {
        paginatedItems.forEach(p => {
          let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
          let favBadge = p.favorit ? '<span class="text-[10px] text-pink-600 bg-pink-50/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-pink-200 font-bold ml-1">★ Fav</span>' : '';
          container.innerHTML += `
            <div onclick="addToKasirCartById('${p.id}')" class="modern-card p-3 flex flex-col justify-between cursor-pointer border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all">
              <div>
                <div class="text-xs font-bold text-slate-900 line-clamp-2">${p.nama} ${favBadge}</div>
              </div>
              <div class="pt-2 flex justify-between items-end">
                <span class="text-emerald-700 font-black text-xs">${formatRp(jualVal)}</span>
                <span class="w-5 h-5 bg-emerald-50/90 backdrop-blur-sm text-emerald-700 border border-emerald-200 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-xs"><i class="fa-solid fa-cart-shopping"></i></span>
              </div>
            </div>
          `;
        });
      }

      if (infoEl) infoEl.innerText = `Hal ${kasirPage} dari ${totalPages}`;
      if (prevBtn) prevBtn.disabled = (kasirPage <= 1);
      if (nextBtn) nextBtn.disabled = (kasirPage >= totalPages);
    }

    function changeKasirPage(delta) {
      let queryInput = document.getElementById('searchKasirProduk');
      let query = queryInput ? queryInput.value.toLowerCase() : '';
      let sortedProducts = [...(appData.products || [])].sort((a, b) => {
        if (a.favorit && !b.favorit) return -1;
        if (!a.favorit && b.favorit) return 1;
        return (a.nama || "").localeCompare(b.nama || "");
      });
      let filtered = sortedProducts.filter(p => (p.nama || "").toLowerCase().includes(query));
      let totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;

      kasirPage += delta;
      if (kasirPage < 1) kasirPage = 1;
      if (kasirPage > totalPages) kasirPage = totalPages;
      renderKasirProdukList();
    }

    function renderProdukList() {
      let queryInput = document.getElementById('searchProduk');
      let favContainer = document.getElementById('listProdukFavorit');
      let otherContainer = document.getElementById('listProdukLainnya');
      let pageInfo = document.getElementById('modalProdukPageInfo');
      let prevBtn = document.getElementById('modalProdPrevBtn');
      let nextBtn = document.getElementById('modalProdNextBtn');
      if (!queryInput || !favContainer || !otherContainer) return;

      let query = queryInput.value.toLowerCase();
      favContainer.innerHTML = ""; otherContainer.innerHTML = "";

      let sortedProducts = [...(appData.products || [])].sort((a, b) => {
        if (a.favorit && !b.favorit) return -1;
        if (!a.favorit && b.favorit) return 1;
        return (a.nama || "").localeCompare(b.nama || "");
      });
      let filtered = sortedProducts.filter(p => (p.nama || "").toLowerCase().includes(query));

      let favItems = filtered.filter(p => p.favorit);
      let nonFavItems = filtered.filter(p => !p.favorit);

      if (favItems.length === 0) {
        favContainer.innerHTML = `<div class="py-3 text-center text-slate-500 text-xs">Tidak ada produk favorit</div>`;
      } else {
        favItems.forEach(p => {
          let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
          favContainer.innerHTML += `
            <div onclick="addToCartViaListById('${p.id}')" class="py-2.5 flex justify-between items-center hover:bg-slate-50/80 backdrop-blur-sm cursor-pointer transition-colors px-2 text-xs">
              <div>
                <div class="font-bold text-slate-900">${p.nama} <span class="text-[10px] text-pink-600 bg-pink-50/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-pink-200 font-bold ml-1">★ Fav</span></div>
                <div class="text-[11px] text-slate-600 mt-0.5">${p.kategori || 'Umum'}</div>
              </div>
              <div class="text-right font-bold text-emerald-700">${formatRp(jualVal)}</div>
            </div>
          `;
        });
      }

      let totalPages = Math.ceil(nonFavItems.length / ITEMS_PER_PAGE) || 1;
      if (modalProdukPage > totalPages) modalProdukPage = totalPages;
      if (modalProdukPage < 1) modalProdukPage = 1;

      let startIndex = (modalProdukPage - 1) * ITEMS_PER_PAGE;
      let paginatedItems = nonFavItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      if (paginatedItems.length === 0) {
        otherContainer.innerHTML = `<div class="py-4 text-center text-slate-500 text-xs">Tidak ada produk lainnya</div>`;
      } else {
        paginatedItems.forEach(p => {
          let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
          otherContainer.innerHTML += `
            <div onclick="addToCartViaListById('${p.id}')" class="py-2.5 flex justify-between items-center hover:bg-slate-50/80 backdrop-blur-sm cursor-pointer transition-colors px-2 text-xs">
              <div>
                <div class="font-bold text-slate-900">${p.nama}</div>
                <div class="text-[11px] text-slate-600 mt-0.5">${p.kategori || 'Umum'}</div>
              </div>
              <div class="text-right font-bold text-emerald-700">${formatRp(jualVal)}</div>
            </div>
          `;
        });
      }

      if (pageInfo) pageInfo.innerText = `Hal ${modalProdukPage} dari ${totalPages}`;
      if (prevBtn) prevBtn.disabled = (modalProdukPage <= 1);
      if (nextBtn) nextBtn.disabled = (modalProdukPage >= totalPages);
    }

    function changeModalProdukPage(delta) {
      let queryInput = document.getElementById('searchProduk');
      let query = queryInput ? queryInput.value.toLowerCase() : '';
      let nonFavItems = (appData.products || []).filter(p => !p.favorit && (p.nama || "").toLowerCase().includes(query));
      let totalPages = Math.ceil(nonFavItems.length / ITEMS_PER_PAGE) || 1;

      modalProdukPage += delta;
      if (modalProdukPage < 1) modalProdukPage = 1;
      if (modalProdukPage > totalPages) modalProdukPage = totalPages;
      renderProdukList();
    }

    function renderProdukTabList() {
      let queryInput = document.getElementById('searchProdukTab');
      let favContainer = document.getElementById('tabListProdukFavorit');
      let otherContainer = document.getElementById('tabListProdukLainnya');
      
      let infoLainnya = document.getElementById('infoPaginationLainnya');
      let prevLainnya = document.getElementById('btnPrevLainnya');
      let nextLainnya = document.getElementById('btnNextLainnya');

      let infoFavorit = document.getElementById('infoPaginationFavorit');
      let prevFavorit = document.getElementById('btnPrevFavorit');
      let nextFavorit = document.getElementById('btnNextFavorit');

      if (!queryInput || !favContainer || !otherContainer) return;

      let query = queryInput.value.toLowerCase();
      let sortedProducts = [...(appData.products || [])].sort((a, b) => {
        if (a.favorit && !b.favorit) return -1;
        if (!a.favorit && b.favorit) return 1;
        return (a.nama || "").localeCompare(b.nama || "");
      });
      let filtered = sortedProducts.filter(p => (p.nama || "").toLowerCase().includes(query));

      let totalPagesLainnya = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
      if (produkPageLainnya > totalPagesLainnya) produkPageLainnya = totalPagesLainnya;
      if (produkPageLainnya < 1) produkPageLainnya = 1;

      let startLainnya = (produkPageLainnya - 1) * ITEMS_PER_PAGE;
      let paginatedLainnya = filtered.slice(startLainnya, startLainnya + ITEMS_PER_PAGE);

      otherContainer.innerHTML = "";
      if (paginatedLainnya.length === 0) {
        otherContainer.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">Tidak ada produk</div>`;
      } else {
        paginatedLainnya.forEach(p => {
          let kat = p.kategori || 'Umum';
          let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
          let beliVal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));
          let jual = formatRp(jualVal);
          let mdl = formatRp(beliVal);
          let favBadge = p.favorit ? '<span class="text-[10px] text-pink-600 bg-pink-50/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-pink-200 font-bold ml-1">★ Fav</span>' : '';

          otherContainer.innerHTML += `
            <div class="py-3 flex justify-between items-center hover:bg-white/50 backdrop-blur-sm transition-colors px-2">
              <div class="flex-1">
                <div class="text-xs font-bold text-slate-900">${p.nama} ${favBadge}</div>
                <div class="text-[11px] text-slate-600 mt-0.5">${kat}</div>
                <div class="text-[11px] text-slate-600 mt-0.5">Jual: <span class="text-emerald-700 font-bold">${jual}</span> | Modal: <span class="text-rose-600 font-bold">${mdl}</span></div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="addToCartViaListById('${p.id}')" class="px-3 py-1.5 bg-emerald-50/90 backdrop-blur-sm text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all no-std-btn shadow-xs flex items-center gap-1" title="Tambah ke Keranjang">
                  <i class="fa-solid fa-cart-shopping text-xs"></i><span>Beli</span>
                </button>
                <button onclick="editProdukById('${p.id}')" class="w-8 h-8 bg-white/80 backdrop-blur-sm text-indigo-700 rounded-xl flex items-center justify-center border border-slate-200 hover:bg-slate-50 transition-all no-std-btn shadow-xs" title="Ubah">
                  <i class="fa-solid fa-pen text-xs"></i>
                </button>
              </div>
            </div>
          `;
        });
      }
      if (infoLainnya) infoLainnya.innerText = `Hal ${produkPageLainnya} dari ${totalPagesLainnya}`;
      if (prevLainnya) prevLainnya.disabled = (produkPageLainnya <= 1);
      if (nextLainnya) nextLainnya.disabled = (produkPageLainnya >= totalPagesLainnya);

      let favFiltered = filtered.filter(p => p.favorit);
      let totalPagesFavorit = Math.ceil(favFiltered.length / ITEMS_PER_PAGE) || 1;
      if (produkPageFavorit > totalPagesFavorit) produkPageFavorit = totalPagesFavorit;
      if (produkPageFavorit < 1) produkPageFavorit = 1;

      let startFavorit = (produkPageFavorit - 1) * ITEMS_PER_PAGE;
      let paginatedFavorit = favFiltered.slice(startFavorit, startFavorit + ITEMS_PER_PAGE);

      favContainer.innerHTML = "";
      if (paginatedFavorit.length === 0) {
        favContainer.innerHTML = `<div class="py-6 text-center text-slate-500 text-xs">Tidak ada produk favorit</div>`;
      } else {
        paginatedFavorit.forEach(p => {
          let kat = p.kategori || 'Umum';
          let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
          let beliVal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));
          let jual = formatRp(jualVal);
          let mdl = formatRp(beliVal);

          favContainer.innerHTML += `
            <div class="py-3 flex justify-between items-center hover:bg-white/50 backdrop-blur-sm transition-colors px-2">
              <div class="flex-1">
                <div class="text-xs font-bold text-slate-900">${p.nama} <span class="text-[10px] text-pink-600 bg-pink-50/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-pink-200 font-bold ml-1">★ Fav</span></div>
                <div class="text-[11px] text-slate-600 mt-0.5">${kat}</div>
                <div class="text-[11px] text-slate-600 mt-0.5">Jual: <span class="text-emerald-700 font-bold">${jual}</span> | Modal: <span class="text-rose-600 font-bold">${mdl}</span></div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="addToCartViaListById('${p.id}')" class="px-3 py-1.5 bg-emerald-50/90 backdrop-blur-sm text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all no-std-btn shadow-xs flex items-center gap-1" title="Tambah ke Keranjang">
                  <i class="fa-solid fa-cart-shopping text-xs"></i><span>Beli</span>
                </button>
                <button onclick="editProdukById('${p.id}')" class="w-8 h-8 bg-white/80 backdrop-blur-sm text-indigo-700 rounded-xl flex items-center justify-center border border-slate-200 hover:bg-slate-50 transition-all no-std-btn shadow-xs" title="Ubah">
                  <i class="fa-solid fa-pen text-xs"></i>
                </button>
              </div>
            </div>
          `;
        });
      }
      if (infoFavorit) infoFavorit.innerText = `Hal ${produkPageFavorit} dari ${totalPagesFavorit}`;
      if (prevFavorit) prevFavorit.disabled = (produkPageFavorit <= 1);
      if (nextFavorit) nextFavorit.disabled = (produkPageFavorit >= totalPagesFavorit);

      updateProductCategoryStats();
    }

    function changeProdukPageLainnya(delta) {
      let queryInput = document.getElementById('searchProdukTab');
      let query = queryInput ? queryInput.value.toLowerCase() : '';
      let sortedProducts = [...(appData.products || [])].sort((a, b) => {
        if (a.favorit && !b.favorit) return -1;
        if (!a.favorit && b.favorit) return 1;
        return (a.nama || "").localeCompare(b.nama || "");
      });
      let filtered = sortedProducts.filter(p => (p.nama || "").toLowerCase().includes(query));
      let totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;

      produkPageLainnya += delta;
      if (produkPageLainnya < 1) produkPageLainnya = 1;
      if (produkPageLainnya > totalPages) produkPageLainnya = totalPages;
      renderProdukTabList();
    }

    function changeProdukPageFavorit(delta) {
      let queryInput = document.getElementById('searchProdukTab');
      let query = queryInput ? queryInput.value.toLowerCase() : '';
      let filtered = (appData.products || []).filter(p => p.favorit && (p.nama || "").toLowerCase().includes(query));
      let totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;

      produkPageFavorit += delta;
      if (produkPageFavorit < 1) produkPageFavorit = 1;
      if (produkPageFavorit > totalPages) produkPageFavorit = totalPages;
      renderProdukTabList();
    }

    function addToCartViaListById(id) {
      let p = (appData.products || []).find(prod => prod.id.toString() === id.toString());
      if (p) addToCartViaList(p);
    }

    function editProdukById(id) {
      let p = (appData.products || []).find(prod => prod.id.toString() === id.toString());
      if (p) editProduk(p);
    }

    function addToKasirCartById(id) {
      let p = (appData.products || []).find(prod => prod.id.toString() === id.toString());
      if (p) addToKasirCart(p);
    }

    function addToCartViaList(p) {
      closeModal('modalProduk');
      openFormTambah();
      setFormType('pemasukan');
      addToCart(p);
    }

    function openFormProduk() {
      document.getElementById('titleFormProduk').innerText = "Tambah produk";
      document.getElementById('prodId').value = "";
      document.getElementById('prodNama').value = "";
      document.getElementById('prodHarga').value = "";
      document.getElementById('prodModal').value = "";
      document.getElementById('prodFavorit').checked = false;
      document.getElementById('btnHapusProduk').classList.add('hidden');

      renderKategoriDropdown();
      calcFormProdukUntung();
      openModal('modalFormProduk');
    }

    function editProduk(p) {
      if (!p) return;
      document.getElementById('titleFormProduk').innerText = "Edit produk";
      document.getElementById('prodId').value = p.id;
      document.getElementById('prodNama').value = p.nama || "";

      let jualVal = Number(p.hargaJual !== undefined ? p.hargaJual : (p.harga || 0));
      let beliVal = Number(p.hargaBeli !== undefined ? p.hargaBeli : (p.modal || 0));

      document.getElementById('prodHarga').value = jualVal ? jualVal.toLocaleString('id-ID') : "";
      document.getElementById('prodModal').value = beliVal ? beliVal.toLocaleString('id-ID') : "";
      document.getElementById('prodFavorit').checked = !!p.favorit;
      document.getElementById('btnHapusProduk').classList.remove('hidden');

      renderKategoriDropdown();
      if (p.kategori) {
        document.getElementById('prodKategori').value = p.kategori;
        onProdKategoriChange(p.kategori);
      }
      if (p.subKategori) {
        document.getElementById('prodSubKategori').value = p.subKategori;
      }

      calcFormProdukUntung();
      openModal('modalFormProduk');
    }

    async function submitProduk() {
      let id = document.getElementById('prodId').value;
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
        showToast("Harga jual produk wajib diisi!", "error");
        return;
      }

      let payload = {
        id: id ? id : 'PRD-' + Date.now(),
        nama: nama,
        kategori: kategori,
        subKategori: subKategori,
        hargaJual: hargaJual,
        hargaBeli: hargaBeli,
        harga: hargaJual, 
        modal: hargaBeli,
        favorit: favorit
      };

      showLoading("Menyimpan produk...", "Menyinkronkan data produk ke Cloud");
      await dbSaveProduct(payload);
      hideLoading();
      
      closeModal('modalFormProduk');
      showToast("Produk berhasil disimpan!", "success");
    }

    async function hapusProdukAktif() {
      let id = document.getElementById('prodId').value;
      if (!id) return;

      showConfirm("Hapus Produk", "Apakah Anda yakin ingin menghapus produk ini?", function() {
        showLoading("Menghapus produk...");
        dbDeleteProduct(id).then(() => {
          hideLoading();
          closeModal('modalFormProduk');
          showToast("Produk berhasil dihapus", "success");
        });
      });
    }

    async function submitForm() {
      let id = document.getElementById('formEditId').value;
      let jumlah = parseNumber(document.getElementById('formJumlah').value);
      let modal = parseNumber(document.getElementById('formModal').value);
      let catatan = document.getElementById('formCatatan').value.trim();
      let kategori = document.getElementById('formKategori').value;
      let tanggalInput = document.getElementById('formTanggal').value;
      let namaPelanggan = document.getElementById('formNamaPelanggan').value.trim();

      if (jumlah <= 0 && currentFormType !== 'hutang_saya') {
        showToast("Jumlah nominal wajib diisi dengan benar!", "error");
        return;
      }

      if (currentFormType === 'hutang_saya' && jumlah <= 0) {
        showToast("Jumlah hutang wajib diisi!", "error");
        return;
      }

      let untung = Math.max(0, jumlah - modal);
      let dateString = tanggalInput ? new Date(tanggalInput + 'T00:00:00').toISOString() : new Date().toISOString();

      let payload = {
        id: id ? id : 'TX-' + Date.now(),
        tanggal: dateString,
        jenis: currentFormType,
        catatan: catatan || (currentFormType === 'pemasukan' ? 'Pemasukan Tunai' : (currentFormType === 'pengeluaran' ? 'Pengeluaran Toko' : 'Hutang Saya')),
        pemasukan: currentFormType === 'pemasukan' ? jumlah : 0,
        pengeluaran: currentFormType === 'pengeluaran' ? jumlah : 0,
        modal: currentFormType === 'pemasukan' ? modal : 0,
        untung: currentFormType === 'pemasukan' ? untung : 0,
        status: currentStatus,
        namaPelanggan: namaPelanggan,
        kategori: kategori || 'Umum',
        items: [...cart]
      };

      if (currentFormType === 'hutang_saya') {
        payload.pemasukan = 0;
        payload.pengeluaran = 0;
        payload.modal = jumlah;
        payload.untung = 0;
      }

      showLoading("Menyimpan catatan...", "Mengunggah data ke Google Sheets");
      await dbSaveTransaction(payload);
      hideLoading();

      closeModal('modalTambahCatatan');
      showToast("Catatan berhasil disimpan!", "success");
    }

    function initClock() {
      function updateClocks() {
        let now = new Date();
        let timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        ['Beranda', 'Kasir', 'Produk', 'Laporan', 'Setelan'].forEach(tabName => {
          let clockEl = document.getElementById('liveClock' + tabName);
          if (clockEl) clockEl.innerText = timeStr;
        });
      }
      updateClocks();
      setInterval(updateClocks, 1000);
    }

    window.addEventListener('popstate', function(event) {
      if (event.state && event.state.tab) {
        switchTab(event.state.tab, false);
      }
    });

    window.onload = function() {
      initClock();
      
      let remembered = localStorage.getItem('tokosiman_remember_pin');
      if (remembered === 'true') {
        hideSplashLogin();
        loadData(true);
      } else {
        let splash = document.getElementById('splashLoginScreen');
        if (splash) splash.classList.remove('hidden');
      }

      updateDbStatusBadge();
      
      let hash = window.location.hash.replace('#', '');
      if (['beranda', 'kasir', 'produk', 'laporan', 'setelan'].includes(hash)) {
        switchTab(hash, false);
      } else {
        switchTab('beranda', false);
      }
    };
