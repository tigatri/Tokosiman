/**
 * TOKO SIMAN - PROFESSIONAL POS BACKEND (GOOGLE APPS SCRIPT)
 * Fully Optimized, Handled JSON Parsing, Fixed Data Persistence, and Secured with API Secret Key
 */

// Kunci rahasia untuk memastikan hanya aplikasi Anda yang dapat menulis/mengubah data
var API_SECRET_KEY = "TokoSimanRahasia2026"; 

function doGet(e) {
  try {
    var action = (e && e.parameter) ? e.parameter.action : '';
    if (action === 'getInitialData') {
      var result = getInitialData();
      return createJsonResponse(result);
    }
    return HtmlService.createHtmlOutputFromFile('index')
        .setTitle('Toko Siman - Professional POS')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  } catch (err) {
    return createJsonResponse({ 
      success: false, 
      message: "Error Server: " + err.toString() 
    });
  }
}

function doPost(e) {
  var response = { success: false, message: "" };
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Payload request kosong atau tidak valid.");
    }
    var contents = JSON.parse(e.postData.contents);
    
    // --- VALIDASI KEAMANAN & FITUR RESET PIN AMAN ---
    var action = contents.action;
    var data = contents.data || contents; // Fallback jika data berada di tingkat atas

    if (action === 'resetPinSecure') {
      response = resetPinSecure(data.token || contents.token, data.newPin || contents.newPin);
      return createJsonResponse(response);
    }

    var clientKey = contents.secretKey || (contents.data ? contents.data.secretKey : '');
    if (clientKey !== API_SECRET_KEY) {
      return createJsonResponse({ 
        success: false, 
        message: "Akses Ditolak: Kunci keamanan API tidak valid!" 
      });
    }
    // ------------------------------------------------------------------------

    switch (action) {
      case 'getInitialData':
        response = getInitialData();
        break;
      case 'simpanTransaksi':
        response = simpanTransaksi(data);
        break;
      case 'hapusTransaksi':
        response = hapusTransaksi(contents.id || (data ? data.id : ''));
        break;
      case 'simpanProduk':
        response = simpanProduk(data);
        break;
      case 'hapusProduk':
        response = hapusProduk(contents.id || (data ? data.id : ''));
        break;
      case 'simpanKategoriObj':
        response = simpanKategoriObj(data.categories || contents.categories || data);
        break;
      case 'simpanPin':
        response = simpanPin(data.pin || contents.pin);
        break;
      default:
        response = { success: false, message: "Action POST tidak dikenal: " + action };
    }
  } catch (err) {
    response = { success: false, message: err.toString() };
  }
  return createJsonResponse(response);
}

/** Helper untuk format output JSON */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

/** Helper pembersih angka safe */
function parseNum(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  var cleaned = val.toString().replace(/[^0-9.-]/g, '');
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}

  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID');

  if (ssId) {
    try {
      var ssExist = SpreadsheetApp.openById(ssId);
      if (ssExist) return ssExist;
    } catch (e) {}
  }

  try {
    var newSs = SpreadsheetApp.create("Database Toko Siman POS");
    props.setProperty('SPREADSHEET_ID', newSs.getId());
    return newSs;
  } catch (e) {
    return null;
  }
}

/** Helper untuk mendapatkan atau membuat sheet secara otomatis */
function getOrCreateSheet(ss, sheetName, defaultHeaders) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
    }
  }
  return sheet;
}

/** Helper universal untuk mencari nomor baris berdasarkan ID kolom pertama */
function findRowIndex(sheet, targetId) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    if (ids[i][0] && ids[i][0].toString() === targetId.toString()) {
      return i + 1; // Indeks baris spreadsheet (1-based)
    }
  }
  return -1;
}

function getInitialData() {
  try {
    var ss = getSpreadsheet();
    if (!ss) {
      return { success: false, message: "Tidak dapat menghubungkan Google Sheets." };
    }

    // 1. Transaksi (ditambah kolom RiwayatBayarJson pada indeks ke-13)
    var headersTx = ['ID', 'Tanggal', 'Jenis', 'Catatan', 'Pemasukan', 'Pengeluaran', 'Modal', 'Untung', 'Status', 'NamaPelanggan', 'ModeBayar', 'Kategori', 'ItemsJson', 'RiwayatBayarJson'];
    var sheetTx = getOrCreateSheet(ss, 'Transaksi', headersTx);
    var transactions = [];
    var lastRowTx = sheetTx.getLastRow();
    
    if (lastRowTx > 1) {
      var dataTx = sheetTx.getRange(1, 1, lastRowTx, headersTx.length).getValues();
      for (var i = 1; i < dataTx.length; i++) {
        var row = dataTx[i];
        if (row[0]) {
          var tglStr = row[1];
          try {
            if (tglStr instanceof Date) {
              tglStr = tglStr.toISOString();
            } else if (tglStr) {
              var parsedD = new Date(tglStr);
              tglStr = isNaN(parsedD.getTime()) ? new Date().toISOString() : parsedD.toISOString();
            } else {
              tglStr = new Date().toISOString();
            }
          } catch(e) {
            tglStr = new Date().toISOString();
          }

          var itemsArr = [];
          try {
            if (row[12]) itemsArr = JSON.parse(row[12]);
          } catch(err) {}

          var riwayatArr = [];
          try {
            if (row[13]) riwayatArr = JSON.parse(row[13]);
          } catch(err) {}

          transactions.push({
            id: row[0].toString(),
            tanggal: tglStr,
            jenis: row[2] || 'pemasukan',
            catatan: row[3] || '',
            pemasukan: parseNum(row[4]),
            pengeluaran: parseNum(row[5]),
            modal: parseNum(row[6]),
            untung: parseNum(row[7]),
            status: row[8] || 'Lunas',
            namaPelanggan: row[9] || '',
            modeBayar: row[10] || 'Tunai',
            kategori: row[11] || '',
            items: itemsArr,
            riwayatBayar: riwayatArr
          });
        }
      }
    }

    // 2. Produk
    var headersPrd = ['ID', 'Nama', 'Kategori', 'SubKategori', 'HargaJual', 'HargaBeli', 'Favorit'];
    var sheetPrd = getOrCreateSheet(ss, 'Produk', headersPrd);
    var products = [];
    var lastRowPrd = sheetPrd.getLastRow();

    if (lastRowPrd <= 1) {
      var sampleProducts = [
        ['PRD-101', 'Pulsa Telkomsel Rp10.000', 'Pulsa / Paket Data', 'Telkomsel', 12000, 10200, true],
        ['PRD-102', 'Pulsa Telkomsel Rp20.000', 'Pulsa / Paket Data', 'Telkomsel', 22000, 20200, false],
        ['PRD-103', 'Token PLN Rp50.000', 'Token Listrik', 'PLN', 52000, 50200, true],
        ['PRD-104', 'Paket Data Axis 5GB', 'Pulsa / Paket Data', 'Axis', 25000, 21000, false]
      ];
      sampleProducts.forEach(function(sp) { sheetPrd.appendRow(sp); });
      lastRowPrd = sheetPrd.getLastRow();
    }

    if (lastRowPrd > 1) {
      var dataPrd = sheetPrd.getRange(1, 1, lastRowPrd, headersPrd.length).getValues();
      for (var j = 1; j < dataPrd.length; j++) {
        var pRow = dataPrd[j];
        if (pRow[0]) {
          var hj = parseNum(pRow[4]);
          var hb = parseNum(pRow[5]);
          products.push({
            id: pRow[0].toString(),
            nama: pRow[1] || '',
            kategori: pRow[2] || '',
            subKategori: pRow[3] || '',
            hargaJual: hj,
            hargaBeli: hb,
            harga: hj, // Fallback properti untuk frontend
            modal: hb, // Fallback properti untuk frontend
            favorit: pRow[6] === true || pRow[6] === 'TRUE' || pRow[6] === 'true'
          });
        }
      }
    }

    // 3. Config (Categories & PIN)
    var sheetConfig = getOrCreateSheet(ss, 'Config', ['Key', 'Value']);
    var categories = {};
    var appPin = '1234';
    
    var cfgValues = sheetConfig.getDataRange().getValues();
    for (var c = 1; c < cfgValues.length; c++) {
      if (cfgValues[c][0] === 'CATEGORIES_JSON' && cfgValues[c][1]) {
        try { categories = JSON.parse(cfgValues[c][1]); } catch(e) {}
      }
      if (cfgValues[c][0] === 'APP_PIN' && cfgValues[c][1]) {
        appPin = cfgValues[c][1].toString();
      }
    }

    if (Object.keys(categories).length === 0) {
      categories = {
        "Pulsa / Paket Data": ["Telkomsel", "Indosat", "XL", "Axis", "Tri"],
        "Token Listrik": ["PLN"],
        "Voucher Belanja": ["Indomaret", "Alfamart"]
      };
      sheetConfig.appendRow(['CATEGORIES_JSON', JSON.stringify(categories)]);
    }

    var pinExists = cfgValues.some(function(row) { return row[0] === 'APP_PIN'; });
    if (!pinExists) {
      sheetConfig.appendRow(['APP_PIN', '1234']);
    }

    return {
      success: true,
      message: "Data berhasil disinkronkan dari Google Sheets!",
      spreadsheetUrl: ss.getUrl(),
      data: {
        transactions: transactions,
        products: products,
        categories: categories,
        appPin: appPin
      }
    };
  } catch (err) {
    return { success: false, message: "Gagal mengambil data awal: " + err.toString() };
  }
}

function simpanTransaksi(data) {
  try {
    if (!data) return { success: false, message: "Data transaksi tidak valid" };
    var ss = getSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'Transaksi', ['ID', 'Tanggal', 'Jenis', 'Catatan', 'Pemasukan', 'Pengeluaran', 'Modal', 'Untung', 'Status', 'NamaPelanggan', 'ModeBayar', 'Kategori', 'ItemsJson', 'RiwayatBayarJson']);

    var id = data.id || ('TX-' + new Date().getTime());
    var tanggal = data.tanggal || new Date().toISOString();
    var itemsJsonStr = data.items ? JSON.stringify(data.items) : "[]";
    var riwayatJsonStr = data.riwayatBayar ? JSON.stringify(data.riwayatBayar) : "[]";

    var rowValues = [
      id,
      tanggal,
      data.jenis || 'pemasukan',
      data.catatan || '',
      parseNum(data.pemasukan),
      parseNum(data.pengeluaran),
      parseNum(data.modal),
      parseNum(data.untung),
      data.status || 'Lunas',
      data.namaPelanggan || '',
      data.modeBayar || 'Tunai',
      data.kategori || '',
      itemsJsonStr,
      riwayatJsonStr
    ];

    var rowIndex = findRowIndex(sheet, id);
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return { success: true, message: "Transaksi berhasil disimpan!", id: id };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function hapusTransaksi(id) {
  try {
    if (!id) return { success: false, message: "ID transaksi tidak ditemukan" };
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Transaksi');
    if (!sheet) return { success: false, message: "Sheet Transaksi tidak ditemukan" };

    var rowIndex = findRowIndex(sheet, id);
    if (rowIndex !== -1) {
      sheet.deleteRow(rowIndex);
      return { success: true, message: "Transaksi berhasil dihapus" };
    }
    return { success: false, message: "ID transaksi tidak ditemukan di database" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function simpanProduk(data) {
  try {
    if (!data) return { success: false, message: "Data produk tidak valid" };
    var ss = getSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'Produk', ['ID', 'Nama', 'Kategori', 'SubKategori', 'HargaJual', 'HargaBeli', 'Favorit']);

    var id = data.id || ('PRD-' + new Date().getTime());
    var hargaJual = parseNum(data.hargaJual !== undefined ? data.hargaJual : data.harga);
    var hargaBeli = parseNum(data.hargaBeli !== undefined ? data.hargaBeli : data.modal);

    var rowValues = [
      id,
      data.nama || '',
      data.kategori || '',
      data.subKategori || '',
      hargaJual,
      hargaBeli,
      !!data.favorit
    ];

    var rowIndex = findRowIndex(sheet, id);
    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return { success: true, message: "Data produk berhasil disimpan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function hapusProduk(id) {
  try {
    if (!id) return { success: false, message: "ID produk tidak ditemukan" };
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Produk');
    if (!sheet) return { success: false, message: "Sheet Produk tidak ditemukan" };

    var rowIndex = findRowIndex(sheet, id);
    if (rowIndex !== -1) {
      sheet.deleteRow(rowIndex);
      return { success: true, message: "Produk berhasil dihapus" };
    }
    return { success: false, message: "ID produk tidak ditemukan di database" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function simpanKategoriObj(categories) {
  try {
    if (!categories) return { success: false, message: "Data kategori kosong" };
    var ss = getSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'Config', ['Key', 'Value']);
    var jsonStr = typeof categories === 'string' ? categories : JSON.stringify(categories);

    var rowIndex = -1;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === 'CATEGORIES_JSON') {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 2).setValue(jsonStr);
    } else {
      sheet.appendRow(['CATEGORIES_JSON', jsonStr]);
    }

    return { success: true, message: "Kategori berhasil disimpan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function simpanPin(pin) {
  try {
    if (!pin) return { success: false, message: "PIN tidak valid" };
    var ss = getSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'Config', ['Key', 'Value']);

    var rowIndex = -1;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === 'APP_PIN') {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 2).setValue(pin.toString());
    } else {
      sheet.appendRow(['APP_PIN', pin.toString()]);
    }

    return { success: true, message: "PIN berhasil disimpan ke cloud" };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

function resetPinSecure(token, newPin) {
  try {
    var incomingToken = "";
    var incomingPin = "";

    // Tangkap dari berbagai kemungkinan struktur pengiriman parameter
    if (typeof token === 'object' && token !== null) {
      incomingToken = token.token || token.code || '';
      incomingPin = token.newPin || newPin || '';
    } else {
      incomingToken = token || '';
      incomingPin = newPin || '';
    }

    var MASTER_SECRET_TOKEN = "8080"; 

    // Debugging: Tampilkan nilai yang benar-benar diterima server
    if (incomingToken.toString().trim() !== MASTER_SECRET_TOKEN) {
      return { 
        success: false, 
        message: "Token salah! Server menerima: [" + incomingToken + "]" 
      };
    }

    if (!incomingPin || !/^\d{4}$/.test(incomingPin.toString())) {
      return { success: false, message: "PIN baru harus tepat 4 digit angka!" };
    }

    var ss = getSpreadsheet();
    var sheet = getOrCreateSheet(ss, 'Config', ['Key', 'Value']);

    var rowIndex = -1;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === 'APP_PIN') {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex !== -1) {
      sheet.getRange(rowIndex, 2).setValue(incomingPin.toString());
    } else {
      sheet.appendRow(['APP_PIN', incomingPin.toString()]);
    }

    return { success: true, message: "PIN keamanan berhasil direset dengan aman!" };
  } catch (err) {
    return { success: false, message: "Error reset PIN: " + err.toString() };
  }
}
