'use strict';

// ============================================
// INDEXEDDB DATABASE MANAGEMENT
// ============================================

const DB_NAME = 'MobileServiceDB';
const DB_VERSION = 1;
const STORE_NAME = 'records';
let db = null;
let cachedRecords = [];
let dbReady = false;

/**
 * Initialize IndexedDB
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('Database error:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      db = request.result;
      dbReady = true;
      console.log('✓ Database opened');
      // Load initial data into cache
      _loadFromDB().then(records => {
        cachedRecords = records;
        console.log('✓ Loaded', records.length, 'records into cache');
        resolve(db);
      }).catch(err => {
        console.error('Error loading from DB:', err);
        cachedRecords = [];
        resolve(db);
      });
    };
    
    request.onupgradeneeded = (event) => {
      db = event.target.result;
      console.log('✓ Database upgrade triggered');
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('record_type', 'record_type', { unique: false });
        objectStore.createIndex('service_id', 'service_id', { unique: false });
        objectStore.createIndex('vendor_id', 'vendor_id', { unique: false });
        objectStore.createIndex('laptop_id', 'laptop_id', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('✓ Object store created with indexes');
      }
    };
  });
}

/**
 * Internal function to load from database
 */
function _loadFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();
    
    request.onsuccess = () => {
      const records = request.result || [];
      resolve(records);
    };
    
    request.onerror = () => {
      console.error('Error loading records:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Internal function to save to database
 */
function _saveToDB(records) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    
    // Clear existing data
    const clearRequest = objectStore.clear();
    
    clearRequest.onsuccess = () => {
      // Add all records
      if (records.length === 0) {
        console.log('✓ Cleared all records from database');
        resolve(true);
        return;
      }
      
      let addedCount = 0;
      let hasError = false;
      
      records.forEach((record, index) => {
        // Remove the auto-increment id if it exists to avoid conflicts
        const recordToSave = {...record};
        delete recordToSave.id;
        
        const addRequest = objectStore.add(recordToSave);
        
        addRequest.onsuccess = () => {
          addedCount++;
          if (addedCount === records.length && !hasError) {
            console.log('✓ Saved', records.length, 'records to database');
            resolve(true);
          }
        };
        
        addRequest.onerror = () => {
          hasError = true;
          console.error(`Error adding record ${index}:`, addRequest.error);
        };
      });
    };
    
    clearRequest.onerror = () => {
      console.error('Error clearing records:', clearRequest.error);
      reject(clearRequest.error);
    };
    
    transaction.onerror = () => {
      console.error('Transaction error:', transaction.error);
      reject(transaction.error);
    };
    
    transaction.oncomplete = () => {
      console.log('✓ Transaction completed successfully');
    };
  });
}

/**
 * Load records (synchronous-looking, uses cache)
 */
function loadRecords() {
  console.log('✓ Loaded', cachedRecords.length, 'records from cache');
  return [...cachedRecords];
}

/**
 * Save records (synchronous, updates cache and DB in background)
 */
function saveRecords(records) {
  cachedRecords = [...records];
  console.log('✓ Cached', records.length, 'records');
  
  // Save to database immediately (non-blocking)
  if (dbReady && db) {
    _saveToDB(records).catch(error => {
      console.error('Background save error:', error);
      alert('Warning: Error saving to database. Data may not persist.');
    });
  } else {
    console.warn('⚠ Database not ready, data only in memory cache');
  }
  
  return true;
}

function generateServiceID(records) {
  const base = 'SRV';
  if (records.length === 0) return base + '001';
  const lastID = records[records.length - 1].service_id || base + '000';
  const num = parseInt(lastID.slice(3)) + 1;
  return base + num.toString().padStart(3, '0');
}

// Generate vendor ID
function generateVendorID(records) {
  const base = 'VND';
  const vendorRecords = records.filter(r => r.record_type === 'vendor');
  if (vendorRecords.length === 0) return base + '001';
  const lastID = vendorRecords[vendorRecords.length - 1].vendor_id || base + '000';
  const num = parseInt(lastID.slice(3)) + 1;
  return base + num.toString().padStart(3, '0');
}

// Generate phone ID for vendor
function generatePhoneID(vendorId, phoneNumber) {
  return `${vendorId}-P${String(phoneNumber).padStart(3, '0')}`;
}

// Generate bill ID for vendor
function generateBillID(vendorId, billNumber) {
  return `${vendorId}-B${String(billNumber).padStart(3, '0')}`;
}

// Generate laptop service ID
function generateLaptopID(records) {
  const base = 'LAP';
  const laptopRecords = records.filter(r => r.record_type === 'laptop');
  if (laptopRecords.length === 0) return base + '001';
  
  // Find highest ID number
  let maxNum = 0;
  laptopRecords.forEach(record => {
    const id = record.laptop_id || '';
    const num = parseInt(id.slice(3));
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  });
  
  return base + String(maxNum + 1).padStart(3, '0');
}

// ============================================
// DOM ELEMENTS
// ============================================

const newServiceBtn = document.getElementById('newServiceBtn');
const billingBtn = document.getElementById('billingBtn');
const recordsBtn = document.getElementById('recordsBtn');
const vendorsBtn = document.getElementById('vendorsBtn');
const laptopServiceBtn = document.getElementById('laptopServiceBtn');
const newServiceSection = document.getElementById('newServiceSection');
const billingSection = document.getElementById('billingSection');
const recordsSection = document.getElementById('recordsSection');
const vendorsSection = document.getElementById('vendorsSection');
const laptopServiceSection = document.getElementById('laptopServiceSection');
const serviceForm = document.getElementById('serviceForm');
const clearFormBtn = document.getElementById('clearFormBtn');
const recentServicesList = document.getElementById('recentServices');
const serviceSearchInput = document.getElementById('serviceSearch');
const searchBillInput = document.getElementById('searchBillInput');
const searchBillBtn = document.getElementById('searchBillBtn');
const recentBillsList = document.getElementById('recentBills');
const billDisplayArea = document.getElementById('billDisplayArea');
const allRecordsList = document.getElementById('allRecordsList');
const allRecordsSearch = document.getElementById('allRecordsSearch');

// ============================================
// TAB NAVIGATION
// ============================================

function showSection(section) {
  // Hide all sections
  newServiceSection.classList.remove('active');
  billingSection.classList.remove('active');
  recordsSection.classList.remove('active');
  vendorsSection.classList.remove('active');
  laptopServiceSection.classList.remove('active');
  
  // Remove active class from all buttons
  newServiceBtn.classList.remove('active');
  billingBtn.classList.remove('active');
  recordsBtn.classList.remove('active');
  vendorsBtn.classList.remove('active');
  laptopServiceBtn.classList.remove('active');

  // Show selected section
  if (section === 'newService') {
    newServiceSection.classList.add('active');
    newServiceBtn.classList.add('active');
    renderRecentServices('');
  } else if (section === 'billing') {
    billingSection.classList.add('active');
    billingBtn.classList.add('active');
    renderRecentBills('');
  } else if (section === 'records') {
    recordsSection.classList.add('active');
    recordsBtn.classList.add('active');
    renderAllRecords('');
  } else if (section === 'vendors') {
    vendorsSection.classList.add('active');
    vendorsBtn.classList.add('active');
    renderRecentVendors('');
  } else if (section === 'laptopService') {
    laptopServiceSection.classList.add('active');
    laptopServiceBtn.classList.add('active');
    renderRecentLaptops('');
  }
  
  console.log(`📑 TAB SWITCHED to ${section} - Filling dates`);
  
  // Fill dates after tab switch (with multiple delays to ensure DOM is ready)
  setTimeout(() => {
    fillAllDateFields();
    // CRITICAL: Clear filter dates when showing All Records tab
    if (section === 'records') {
      ensureFilterDatesEmpty();
    }
  }, 50);
  setTimeout(() => {
    fillAllDateFields();
    if (section === 'records') {
      ensureFilterDatesEmpty();
    }
  }, 100);
  setTimeout(() => {
    fillAllDateFields();
    if (section === 'records') {
      ensureFilterDatesEmpty();
    }
  }, 200);
}

newServiceBtn.addEventListener('click', () => showSection('newService'));
billingBtn.addEventListener('click', () => showSection('billing'));
recordsBtn.addEventListener('click', () => showSection('records'));
vendorsBtn.addEventListener('click', () => showSection('vendors'));
laptopServiceBtn.addEventListener('click', () => showSection('laptopService'));

// ============================================
// SERVICE FORM HANDLING
// ============================================

function handleImageUpload(input, previewId) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById(previewId);
      const img = document.createElement('img');
      img.src = e.target.result;
      preview.innerHTML = '';
      preview.appendChild(img);
      
      // Store image data in the form for later use
      input.dataset.imageData = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

document.getElementById('frontImage').addEventListener('change', (e) => {
  handleImageUpload(e.target, 'frontImagePreview');
});

document.getElementById('backImage').addEventListener('change', (e) => {
  handleImageUpload(e.target, 'backImagePreview');
});

serviceForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Ensure DB is ready
  if (!dbReady) {
    alert('Please wait, database is initializing...');
    return;
  }

  const records = loadRecords();
  const newServiceId = generateServiceID(records);
  const formData = new FormData(serviceForm);

  // Gather service types
  const serviceTypes = formData.getAll('serviceType');
  const otherType = formData.get('otherType').trim();
  if (otherType && !serviceTypes.includes(otherType)) {
    serviceTypes.push(otherType);
  }

  // Gather accessories
  const accessories = formData.getAll('accessories');

  // Get image data
  const frontImageInput = document.getElementById('frontImage');
  const backImageInput = document.getElementById('backImage');
  const frontImageData = frontImageInput.dataset.imageData || null;
  const backImageData = backImageInput.dataset.imageData || null;

  // Create new record
  const record = {
    service_id: newServiceId,
    date: formData.get('serviceDate'),
    customer_name: formData.get('customerName'),
    mobile_number: formData.get('mobileNumber'),
    address: formData.get('address'),
    mobile_brand: formData.get('mobileBrand'),
    model: formData.get('model'),
    imei1: formData.get('imei1'),
    imei2: formData.get('imei2'),
    issue: formData.get('issue'),
    service_type: serviceTypes,
    mobile_condition: formData.get('mobileCondition'),
    accessories: accessories,
    front_image: frontImageData,
    back_image: backImageData,
    received_by: formData.get('receivedBy'),
    estimated_delivery: formData.get('estimatedDelivery'),
    bill: null,
    timestamp: new Date().toISOString()
  };

  // Save to localStorage
  // Add record type for individual services
  record.record_type = 'service';
  records.push(record);
  saveRecords(records);
  
  console.log('✓ Service saved:', newServiceId, 'Total records:', records.length);

  alert(`✓ Service submitted successfully!\n\nService ID: ${newServiceId}\n\nPlease note this ID for billing.`);
  
  // Reset form
  serviceForm.reset();
  document.getElementById('frontImagePreview').innerHTML = '';
  document.getElementById('backImagePreview').innerHTML = '';
  // Clear image data
  document.getElementById('frontImage').dataset.imageData = '';
  document.getElementById('backImage').dataset.imageData = '';
  
  // Fill dates again after reset
  setTimeout(fillAllDateFields, 50);
  
  // Refresh the recent services list
  setTimeout(() => {
    renderRecentServices('');
  }, 100);
});

// ============================================
// VENDOR FORM HANDLING
// ============================================

const createVendorForm = document.getElementById('createVendorForm');
const addPhoneForm = document.getElementById('addPhoneForm');
const selectVendorDropdown = document.getElementById('selectVendor');
const vendorSearchInput = document.getElementById('vendorSearch');
const recentVendorsList = document.getElementById('recentVendors');

// Create vendor form submission
createVendorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ensure DB is ready
  if (!dbReady) {
    alert('Please wait, database is initializing...');
    return;
  }
  
  const records = loadRecords();
  const newVendorId = generateVendorID(records);
  const formData = new FormData(createVendorForm);
  
  const vendorRecord = {
    record_type: 'vendor',
    vendor_id: newVendorId,
    vendor_name: formData.get('newVendorName').trim(),
    mobile_number: formData.get('newVendorMobile').trim(),
    created_date: new Date().toISOString().slice(0, 10),
    phones: [],
    bills: [],
    timestamp: new Date().toISOString()
  };
  
  records.push(vendorRecord);
  saveRecords(records);
  
  alert(`✓ Vendor ${newVendorId} created!\n\nVendor: ${vendorRecord.vendor_name}\nMobile: ${vendorRecord.mobile_number}\n\nNow you can add phones to this vendor.`);
  
  createVendorForm.reset();
  updateVendorDropdown();
  renderRecentVendors('');
});

// Add phone to vendor form submission
addPhoneForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const records = loadRecords();
  const vendorId = document.getElementById('selectVendor').value;
  const vendorIndex = records.findIndex(r => r.vendor_id === vendorId);
  
  if (vendorIndex === -1) {
    alert('Please select a vendor');
    return;
  }
  
  const vendor = records[vendorIndex];
  const phoneNumber = vendor.phones.length + 1;
  const phoneId = generatePhoneID(vendorId, phoneNumber);
  
  const formData = new FormData(addPhoneForm);
  
  const phone = {
    phone_id: phoneId,
    date_received: formData.get('phoneDate'),
    brand: formData.get('phoneBrand').trim(),
    model: formData.get('phoneModel').trim(),
    issue: formData.get('phoneIssue').trim(),
    received_by: formData.get('phoneReceivedBy'),
    status: 'Received',
    completed: false,
    billed: false,
    bill_id: null
  };
  
  vendor.phones.push(phone);
  records[vendorIndex] = vendor;
  saveRecords(records);
  
  alert(`✓ Phone added to ${vendor.vendor_name}!\n\nPhone ID: ${phoneId}\n${phone.brand} ${phone.model}`);
  
  // Clear form except vendor selection
  document.getElementById('phoneBrand').value = '';
  document.getElementById('phoneModel').value = '';
  document.getElementById('phoneIssue').value = '';
  document.getElementById('phoneReceivedBy').value = '';
  
  // Fill dates again after clearing
  setTimeout(fillAllDateFields, 50);
  
  renderRecentVendors('');
});

// Update vendor dropdown
function updateVendorDropdown() {
  const records = loadRecords();
  const vendors = records.filter(r => r.record_type === 'vendor');
  
  selectVendorDropdown.innerHTML = '<option value="">-- Select Vendor --</option>';
  
  vendors.forEach(vendor => {
    const option = document.createElement('option');
    option.value = vendor.vendor_id;
    option.textContent = `${vendor.vendor_name} (${vendor.mobile_number})`;
    selectVendorDropdown.appendChild(option);
  });
}

clearFormBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the form?')) {
    serviceForm.reset();
    document.getElementById('frontImagePreview').innerHTML = '';
    document.getElementById('backImagePreview').innerHTML = '';
    // Clear image data
    document.getElementById('frontImage').dataset.imageData = '';
    document.getElementById('backImage').dataset.imageData = '';
    // Fill dates again after reset
    setTimeout(fillAllDateFields, 50);
  }
});

function calculateWarrantyEndDate(fromDate, warranty) {
  const date = new Date(fromDate);
  const months = warranty === '6' || warranty === '6 months' ? 6 : 3;
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

// Warranty date update function for billing form
function updateWarrantyDates() {
  const warrantyPeriod = document.querySelector('input[name="warrantyPeriod"]:checked')?.value;
  const fromDateInput = document.getElementById('warrantyFromDate');
  const toDateInput = document.getElementById('warrantyToDate');
  
  if (fromDateInput && toDateInput && warrantyPeriod) {
    const fromDate = fromDateInput.value;
    if (fromDate) {
      const toDate = calculateWarrantyEndDate(fromDate, warrantyPeriod);
      toDateInput.value = toDate;
    }
  }
}

// Global function to make it accessible from inline HTML
window.updateWarrantyDates = updateWarrantyDates;

// ============================================
// RECENT SERVICES RENDERING
// ============================================

function renderRecentServices(filter = '') {
  const records = loadRecords();
  console.log('renderRecentServices: Total records:', records.length);
  const serviceRecords = records.filter(rec => rec.record_type === 'service');
  console.log('renderRecentServices: Service records:', serviceRecords.length);
  const filtered = serviceRecords.filter(rec => {
    if (!rec.service_id) return false;
    const serviceIdMatch = rec.service_id.toLowerCase().includes(filter.toLowerCase());
    const mobileMatch = rec.mobile_number && rec.mobile_number.includes(filter);
    const nameMatch = rec.customer_name && rec.customer_name.toLowerCase().includes(filter.toLowerCase());
    return serviceIdMatch || mobileMatch || nameMatch;
  });
  console.log('renderRecentServices: Filtered services:', filtered.length);

  recentServicesList.innerHTML = '';
  
  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = filter ? 'No services found' : 'No services yet. Add your first service!';
    recentServicesList.appendChild(li);
    return;
  }

  // Show in reverse order (most recent first)
  filtered.slice().reverse().forEach(rec => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${rec.service_id}</strong> - ${rec.customer_name} (${rec.mobile_number})<br>
      <small>${rec.mobile_brand} ${rec.model} | ${rec.date}</small>
    `;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      fillServiceForm(rec);
      showSection('newService');
      window.scrollTo(0, 0);
    });
    recentServicesList.appendChild(li);
  });
}

function fillServiceForm(record) {
  document.getElementById('serviceDate').value = record.date || '';
  document.getElementById('customerName').value = record.customer_name || '';
  document.getElementById('mobileNumber').value = record.mobile_number || '';
  document.getElementById('address').value = record.address || '';
  document.getElementById('mobileBrand').value = record.mobile_brand || '';
  document.getElementById('model').value = record.model || '';
  document.getElementById('imei1').value = record.imei1 || '';
  document.getElementById('imei2').value = record.imei2 || '';
  document.getElementById('issue').value = record.issue || '';
  
  // Set service types
  const serviceTypes = record.service_type || [];
  document.querySelectorAll('input[name="serviceType"]').forEach(checkbox => {
    checkbox.checked = serviceTypes.includes(checkbox.value);
  });
  
  // Set other type if exists
  const otherServices = serviceTypes.filter(t => !['Display', 'Battery', 'Charger', 'Motherboard'].includes(t));
  document.getElementById('otherType').value = otherServices.join(', ') || '';
  
  // Set mobile condition
  document.getElementById('mobileCondition').value = record.mobile_condition || '';
  
  // Set accessories
  const accessories = record.accessories || [];
  document.querySelectorAll('input[name="accessories"]').forEach(checkbox => {
    checkbox.checked = accessories.includes(checkbox.value);
  });
  
  // Set received by
  document.getElementById('receivedBy').value = record.received_by || '';
  
  // Set estimated delivery
  document.getElementById('estimatedDelivery').value = record.estimated_delivery || '';
  
  // Load images if they exist
  const frontImagePreview = document.getElementById('frontImagePreview');
  const backImagePreview = document.getElementById('backImagePreview');
  const frontImageInput = document.getElementById('frontImage');
  const backImageInput = document.getElementById('backImage');
  
  if (record.front_image) {
    const frontImg = document.createElement('img');
    frontImg.src = record.front_image;
    frontImagePreview.innerHTML = '';
    frontImagePreview.appendChild(frontImg);
    frontImageInput.dataset.imageData = record.front_image;
  } else {
    frontImagePreview.innerHTML = '';
    frontImageInput.dataset.imageData = '';
  }
  
  if (record.back_image) {
    const backImg = document.createElement('img');
    backImg.src = record.back_image;
    backImagePreview.innerHTML = '';
    backImagePreview.appendChild(backImg);
    backImageInput.dataset.imageData = record.back_image;
  } else {
    backImagePreview.innerHTML = '';
    backImageInput.dataset.imageData = '';
  }
}

serviceSearchInput.addEventListener('input', (e) => {
  renderRecentServices(e.target.value);
});

// ============================================
// RECENT VENDORS RENDERING
// ============================================

function renderRecentVendors(filter = '') {
  const records = loadRecords();
  const vendorRecords = records.filter(r => r.record_type === 'vendor');
  const filtered = vendorRecords.filter(rec => {
    const vendorIdMatch = rec.vendor_id.toLowerCase().includes(filter.toLowerCase());
    const nameMatch = rec.vendor_name.toLowerCase().includes(filter.toLowerCase());
    const mobileMatch = rec.mobile_number.includes(filter);
    return vendorIdMatch || nameMatch || mobileMatch;
  });

  recentVendorsList.innerHTML = '';
  
  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No vendors found';
    recentVendorsList.appendChild(li);
    return;
  }

  // Show in reverse order (most recent first)
  filtered.slice().reverse().forEach(rec => {
    const li = document.createElement('li');
    const totalPhones = rec.phones.length;
    const receivedCount = rec.phones.filter(p => p.status === 'Received').length;
    const inRepairCount = rec.phones.filter(p => p.status === 'In Repair').length;
    const readyCount = rec.phones.filter(p => p.status === 'Ready').length;
    const billedCount = rec.phones.filter(p => p.status === 'Billed').length;
    const billsCount = rec.bills ? rec.bills.length : 0;
    
    li.innerHTML = `
      <strong>${rec.vendor_id}</strong> - ${rec.vendor_name} (${rec.mobile_number})<br>
      <small>${totalPhones} phone(s): 📥 ${receivedCount} Received, 🔧 ${inRepairCount} In Repair, ✅ ${readyCount} Ready, 💰 ${billedCount} Billed | ${billsCount} Bill(s) | Created: ${rec.created_date}</small>
    `;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      openVendorDetailsModal(rec.vendor_id);
    });
    recentVendorsList.appendChild(li);
  });
}

vendorSearchInput.addEventListener('input', (e) => {
  renderRecentVendors(e.target.value);
});

// ============================================
// LAPTOP SERVICE FORM HANDLING
// ============================================

const laptopServiceForm = document.getElementById('laptopServiceForm');
const clearLaptopFormBtn = document.getElementById('clearLaptopFormBtn');
const laptopSearchInput = document.getElementById('laptopSearch');
const recentLaptopsList = document.getElementById('recentLaptops');

laptopServiceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Ensure DB is ready
  if (!dbReady) {
    alert('Please wait, database is initializing...');
    return;
  }
  
  const records = loadRecords();
  const laptopId = generateLaptopID(records);
  const formData = new FormData(laptopServiceForm);
  
  // Get accessories
  const accessories = [];
  document.querySelectorAll('input[name="laptopAccessories"]:checked').forEach(checkbox => {
    accessories.push(checkbox.value);
  });
  
  const laptopData = {
    record_type: 'laptop',
    laptop_id: laptopId,
    date: formData.get('laptopDate'),
    contact_number: formData.get('laptopContact').trim(),
    laptop_brand: formData.get('laptopBrand').trim(),
    model: formData.get('laptopModel').trim(),
    condition: formData.get('laptopCondition'),
    accessories: accessories,
    issue: formData.get('laptopIssue').trim(),
    received_by: formData.get('laptopReceivedBy').trim(),
    bill: null,
    timestamp: new Date().toISOString()
  };
  
  records.push(laptopData);
  saveRecords(records);
  
  alert(`✓ Laptop Service ${laptopId} created successfully!\n\nContact: ${laptopData.contact_number}\nLaptop: ${laptopData.laptop_brand} ${laptopData.model}\n\nPlease note this ID for billing.`);
  
  // Clear form
  laptopServiceForm.reset();
  
  // Update next ID display
  const nextId = generateLaptopID(loadRecords());
  document.getElementById('laptopServiceId').value = nextId;
  
  // Fill dates again after reset
  setTimeout(fillAllDateFields, 50);
  
  renderRecentLaptops('');
});

clearLaptopFormBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the form?')) {
    laptopServiceForm.reset();
    const nextId = generateLaptopID(loadRecords());
    document.getElementById('laptopServiceId').value = nextId;
    // Fill dates again after reset
    setTimeout(fillAllDateFields, 50);
  }
});

function renderRecentLaptops(filter = '') {
  const records = loadRecords();
  const laptopRecords = records.filter(r => r.record_type === 'laptop');
  const filtered = laptopRecords.filter(rec => {
    const laptopIdMatch = rec.laptop_id.toLowerCase().includes(filter.toLowerCase());
    const contactMatch = rec.contact_number.includes(filter);
    const brandMatch = rec.laptop_brand.toLowerCase().includes(filter.toLowerCase());
    return laptopIdMatch || contactMatch || brandMatch;
  });

  recentLaptopsList.innerHTML = '';
  
  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No laptop services found';
    recentLaptopsList.appendChild(li);
    return;
  }

  // Show in reverse order (most recent first)
  filtered.slice().reverse().forEach(rec => {
    const li = document.createElement('li');
    const billStatus = rec.bill ? `✅ Billed (Rs. ${rec.bill.grand_total})` : '⏳ Pending';
    li.innerHTML = `
      <strong>${rec.laptop_id}</strong> - 💻 ${rec.laptop_brand} ${rec.model} (${rec.contact_number})<br>
      <small>${rec.date} | ${rec.condition} | ${billStatus}</small>
    `;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
      viewLaptopDetails(rec.laptop_id);
    });
    recentLaptopsList.appendChild(li);
  });
}

laptopSearchInput.addEventListener('input', (e) => {
  renderRecentLaptops(e.target.value);
});

function viewLaptopDetails(laptopId) {
  createLaptopModal(laptopId);
}

function createLaptopModal(laptopId) {
  const records = loadRecords();
  const laptop = records.find(r => r.laptop_id === laptopId);
  if (!laptop) return;

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  const modalBox = document.createElement('div');
  modalBox.className = 'modal-box';
  modalBox.style.cssText = `
    background-color: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-32);
    max-width: 800px;
    width: 90%;
    max-height: 90%;
    overflow-y: auto;
    position: relative;
    border: 1px solid var(--color-card-border);
    box-shadow: var(--shadow-lg);
    transform: scale(0.95);
    transition: transform 0.3s ease;
  `;

  const modalContent = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-24); padding-bottom: var(--space-16); border-bottom: 2px solid #8b5cf6;">
      <h2 style="color: #8b5cf6; margin: 0; font-size: var(--font-size-2xl);">Laptop Service Details - ${laptop.laptop_id}</h2>
      <button class="modal-close-btn" style="
        background: none;
        border: none;
        font-size: var(--font-size-2xl);
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: var(--space-4);
        border-radius: var(--radius-sm);
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      " onmouseover="this.style.backgroundColor='var(--color-secondary)'" onmouseout="this.style.backgroundColor='transparent'">×</button>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-32); margin-bottom: var(--space-24);">
      <div>
        <h3 style="color: #8b5cf6; margin-bottom: var(--space-12); font-size: var(--font-size-lg);">📞 Contact Information</h3>
        <div style="background-color: var(--color-bg-5); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
          <div><strong>Contact:</strong> ${laptop.contact_number}</div>
          <div><strong>Date:</strong> ${laptop.date}</div>
          <div><strong>Received By:</strong> ${laptop.received_by}</div>
        </div>
      </div>
      
      <div>
        <h3 style="color: #8b5cf6; margin-bottom: var(--space-12); font-size: var(--font-size-lg);">💻 Laptop Information</h3>
        <div style="background-color: var(--color-bg-6); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
          <div><strong>Brand:</strong> ${laptop.laptop_brand}</div>
          <div><strong>Model:</strong> ${laptop.model}</div>
          <div><strong>Condition:</strong> ${laptop.condition}</div>
          <div><strong>Accessories:</strong> ${laptop.accessories.length > 0 ? laptop.accessories.join(', ') : 'None'}</div>
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: var(--space-24);">
      <h3 style="color: #8b5cf6; margin-bottom: var(--space-12); font-size: var(--font-size-lg);">🔧 Issue Description</h3>
      <div style="background-color: var(--color-bg-7); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
        ${laptop.issue}
      </div>
    </div>
    
    ${laptop.bill ? `
    <div style="margin-bottom: var(--space-24);">
      <h3 style="color: #8b5cf6; margin-bottom: var(--space-12); font-size: var(--font-size-lg);">💰 Bill Summary</h3>
      <div style="background-color: var(--color-bg-3); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
        <div><strong>Total Amount:</strong> Rs. ${laptop.bill.grand_total}</div>
        <div><strong>Bill Status:</strong> <span style="color: var(--color-success);">✅ Completed</span></div>
        <div><strong>Warranty:</strong> ${laptop.bill.warranty} months</div>
      </div>
    </div>
    ` : `
    <div style="margin-bottom: var(--space-24);">
      <h3 style="color: #8b5cf6; margin-bottom: var(--space-12); font-size: var(--font-size-lg);">💰 Bill Status</h3>
      <div style="background-color: var(--color-bg-8); padding: var(--space-16); border-radius: var(--radius-base);">
        <div style="color: var(--color-warning);"><strong>⏳ Bill Pending</strong></div>
      </div>
    </div>
    `}
    
    <div style="text-align: center; margin-top: var(--space-24); display: flex; gap: var(--space-12); justify-content: center;">
      ${!laptop.bill ? `<button class="btn btn--primary" onclick="createBillForLaptop('${laptop.laptop_id}')">Create Bill</button>` : ''}
      ${laptop.bill ? `<button class="btn btn--primary" onclick="viewBillForLaptop('${laptop.laptop_id}')">View Bill</button>` : ''}
      ${laptop.bill ? `<button class="btn btn--secondary" onclick="printBillForLaptop('${laptop.laptop_id}')">Print Bill</button>` : ''}
      <button class="btn btn--secondary modal-close-btn">Close</button>
    </div>
  `;

  modalBox.innerHTML = modalContent;
  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  const closeButtons = modalBox.querySelectorAll('.modal-close-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => closeModal(modalOverlay));
  });

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal(modalOverlay);
    }
  });

  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    modalOverlay.style.opacity = '1';
    modalBox.style.transform = 'scale(1)';
  }, 10);
}

function createBillForLaptop(laptopId) {
  const modal = document.querySelector('.modal-overlay');
  if (modal) closeModal(modal);
  
  setTimeout(() => {
    searchBillInput.value = laptopId;
    showSection('billing');
    searchAndLoadRecord();
    window.scrollTo(0, 0);
  }, 150);
}

function viewBillForLaptop(laptopId) {
  const modal = document.querySelector('.modal-overlay');
  if (modal) closeModal(modal);
  
  setTimeout(() => {
    const records = loadRecords();
    const laptop = records.find(r => r.laptop_id === laptopId);
    if (laptop && laptop.bill) {
      showSection('billing');
      displayLaptopBill(laptop);
      window.scrollTo(0, 0);
    }
  }, 150);
}

function printBillForLaptop(laptopId) {
  const modal = document.querySelector('.modal-overlay');
  if (modal) closeModal(modal);
  
  setTimeout(() => {
    const records = loadRecords();
    const laptop = records.find(r => r.laptop_id === laptopId);
    if (laptop && laptop.bill) {
      showSection('billing');
      displayLaptopBill(laptop);
      setTimeout(() => {
        printBill();
      }, 300);
    }
  }, 150);
}

// Make functions globally accessible
window.createBillForLaptop = createBillForLaptop;
window.viewBillForLaptop = viewBillForLaptop;
window.printBillForLaptop = printBillForLaptop;

// ============================================
// BILLING FUNCTIONALITY
// ============================================

function renderRecentBills(filter = '') {
  const records = loadRecords();
  const allBills = [];
  
  // Collect all bills from all records
  records.forEach(rec => {
    if (rec.record_type === 'vendor' && rec.bills && rec.bills.length > 0) {
      // Vendor can have multiple bills
      rec.bills.forEach(bill => {
        allBills.push({
          type: 'vendor',
          vendor_id: rec.vendor_id,
          vendor_name: rec.vendor_name,
          mobile_number: rec.mobile_number,
          bill_id: bill.bill_id,
          bill_number: bill.bill_number,
          date: bill.date,
          grand_total: bill.grand_total,
          phone_count: bill.phone_ids.length
        });
      });
    } else if (rec.record_type === 'laptop' && rec.bill) {
      // Laptop service with single bill
      allBills.push({
        type: 'laptop',
        laptop_id: rec.laptop_id,
        laptop_brand: rec.laptop_brand,
        model: rec.model,
        contact_number: rec.contact_number,
        date: rec.date,
        grand_total: rec.bill.grand_total
      });
    } else if (rec.bill) {
      // Individual service with single bill
      allBills.push({
        type: 'service',
        service_id: rec.service_id,
        customer_name: rec.customer_name,
        mobile_number: rec.mobile_number,
        date: rec.date,
        grand_total: rec.bill.grand_total
      });
    }
  });
  
  // Filter bills
  const filtered = allBills.filter(bill => {
    const filterLower = filter.toLowerCase();
    if (bill.type === 'vendor') {
      return bill.vendor_id.toLowerCase().includes(filterLower) ||
             bill.vendor_name.toLowerCase().includes(filterLower) ||
             bill.mobile_number.includes(filter) ||
             bill.bill_number.toLowerCase().includes(filterLower);
    } else if (bill.type === 'laptop') {
      return bill.laptop_id.toLowerCase().includes(filterLower) ||
             bill.laptop_brand.toLowerCase().includes(filterLower) ||
             bill.model.toLowerCase().includes(filterLower) ||
             bill.contact_number.includes(filter);
    } else {
      return bill.service_id.toLowerCase().includes(filterLower) ||
             bill.customer_name.toLowerCase().includes(filterLower) ||
             bill.mobile_number.includes(filter);
    }
  });

  recentBillsList.innerHTML = '';
  
  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No bills found';
    recentBillsList.appendChild(li);
    return;
  }

  // Sort by date (most recent first)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  filtered.forEach(bill => {
    const li = document.createElement('li');
    
    if (bill.type === 'vendor') {
      li.innerHTML = `
        <strong>${bill.bill_number}</strong> - 🏢 ${bill.vendor_name} (${bill.mobile_number})<br>
        <small>Total: Rs. ${bill.grand_total} | ${bill.phone_count} phone(s) | ${bill.date}</small>
      `;
      li.addEventListener('click', () => {
        displayVendorBillById(bill.vendor_id, bill.bill_id);
        window.scrollTo(0, 0);
      });
    } else if (bill.type === 'laptop') {
      li.innerHTML = `
        <strong>${bill.laptop_id}</strong> - 💻 ${bill.laptop_brand} ${bill.model} (${bill.contact_number})<br>
        <small>Total: Rs. ${bill.grand_total} | ${bill.date}</small>
      `;
      li.addEventListener('click', () => {
        const records = loadRecords();
        const rec = records.find(r => r.laptop_id === bill.laptop_id);
        if (rec) {
          displayLaptopBill(rec);
          window.scrollTo(0, 0);
        }
      });
    } else {
      li.innerHTML = `
        <strong>${bill.service_id}</strong> - ${bill.customer_name} (${bill.mobile_number})<br>
        <small>Total: Rs. ${bill.grand_total} | ${bill.date}</small>
      `;
      li.addEventListener('click', () => {
        const records = loadRecords();
        const rec = records.find(r => r.service_id === bill.service_id);
        if (rec) {
          displayBill(rec);
          window.scrollTo(0, 0);
        }
      });
    }
    
    li.style.cursor = 'pointer';
    recentBillsList.appendChild(li);
  });
}

function searchAndLoadRecord() {
  const searchValue = searchBillInput.value.trim();
  if (!searchValue) {
    alert('Please enter a Service ID, Laptop ID, Vendor ID, or Contact Number');
    return;
  }

  const records = loadRecords();
  const found = records.find(r => {
    // Search for individual services
    if (r.record_type === 'service' || !r.record_type) {
      return r.service_id === searchValue.toUpperCase() || r.mobile_number === searchValue;
    }
    // Search for laptop services
    if (r.record_type === 'laptop') {
      return r.laptop_id === searchValue.toUpperCase() || r.contact_number === searchValue;
    }
    // Search for vendor services
    if (r.record_type === 'vendor') {
      return r.vendor_id === searchValue.toUpperCase() || r.mobile_number === searchValue;
    }
    return false;
  });

  if (!found) {
    alert('Record not found');
    billDisplayArea.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Record not found. Please check the Service ID, Laptop ID, Vendor ID, or Contact Number.</p>';
    return;
  }

  if (found.record_type === 'vendor') {
    displayVendorBillingForm(found);
  } else if (found.record_type === 'laptop') {
    displayLaptopBillingForm(found);
  } else {
    displayBillingForm(found);
  }
}

searchBillBtn.addEventListener('click', searchAndLoadRecord);
searchBillInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchAndLoadRecord();
  }
});

function displayBillingForm(record) {
  const billHTML = `
    <div class="bill-container">
      <div class="bill-business-header">
        <div class="business-name">MYLAVAN MOBILE SERVICE</div>
        <div class="business-info">
          Shop no. 23, New municipality complex<br>
          old bus stand, Vellore 632004<br>
          Contact: +91-7339559582
        </div>
      </div>
      <div class="bill-header">BILL</div>
      
      <div class="bill-info">
        <div>Service ID: <strong>${record.service_id}</strong></div>
        <div>Date: <strong>${record.date}</strong></div>
        <div>Customer: <strong>${record.customer_name}</strong></div>
        <div>Mobile: <strong>${record.mobile_number}</strong></div>
        <div>Address: <strong>${record.address || 'N/A'}</strong></div>
        <div>Device: <strong>${record.mobile_brand} ${record.model}</strong></div>
      </div>

      <div class="bill-section-title">Device Details</div>
      <div style="font-size: 0.9rem; line-height: 1.8;">
        IMEI 1: ${record.imei1}<br>
        ${record.imei2 ? `IMEI 2: ${record.imei2}<br>` : ''}
        Condition: ${record.mobile_condition}<br>
        Issue: ${record.issue}
      </div>

      <div class="bill-section-title">Service Details</div>
      <div style="font-size: 0.9rem; line-height: 1.8;">
        Service Type: ${record.service_type.join(', ')}<br>
        Received By: ${record.received_by}<br>
        Accessories: ${record.accessories.length > 0 ? record.accessories.join(', ') : 'None'}<br>
        Estimated Delivery: ${record.estimated_delivery}
      </div>

      <div class="bill-section-title">WARRANTY PERIOD SELECTION</div>
      <div class="bill-warranty" style="background-color: var(--color-secondary); padding: 15px; border-radius: 6px; margin: 15px 0;">
        <div style="margin-bottom: 15px;">
          <label style="font-weight: bold; display: block; margin-bottom: 10px;">Select Warranty Period:</label>
          <div style="display: flex; gap: 20px; margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="warrantyPeriod" value="3" checked onchange="updateWarrantyDates()"> 3 months
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="warrantyPeriod" value="6" onchange="updateWarrantyDates()"> 6 months
            </label>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem;">
          <div>
            <label style="font-weight: bold;">From Date:</label><br>
            <input type="date" id="warrantyFromDate" value="${new Date().toISOString().slice(0, 10)}" onchange="updateWarrantyDates()" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div>
            <label style="font-weight: bold;">To Date:</label><br>
            <input type="date" id="warrantyToDate" readonly style="padding: 5px; border: 1px solid #ccc; border-radius: 4px; background-color: #f5f5f5;">
          </div>
        </div>
      </div>

      <div class="bill-section-title">Add Items to Bill</div>
      <div id="billItemsForm">
        <form id="itemsForm">
          <table class="bill-items-table" id="itemsTable">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Breakout</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="itemsTableBody">
              <tr class="item-row">
                <td><input type="text" class="item-desc" placeholder="e.g., Combo Display" value=""></td>
                <td><input type="text" class="item-breakout" placeholder="e.g., Original" value=""></td>
                <td><input type="number" class="item-price" placeholder="0" value="0" min="0"></td>
                <td><input type="number" class="item-qty" placeholder="1" value="1" min="1"></td>
                <td class="item-total">0</td>
                <td><button type="button" class="btn btn-danger" onclick="removeItemRow(this)">✕</button></td>
              </tr>
            </tbody>
          </table>
          <button type="button" class="btn btn-secondary mt-10" onclick="addItemRow()">+ Add Item</button>
        </form>
      </div>

      <div class="bill-totals">
        <div>Subtotal: <strong>Rs. <span id="subtotal">0</span></strong></div>
        <div>
          Tax (%) <input type="number" id="taxPercent" value="0" min="0" step="0.01" style="width: 60px; padding: 5px;">
          Tax: <strong>Rs. <span id="taxAmount">0</span></strong>
        </div>
        <div class="bill-grand-total">
          Grand Total: Rs. <span id="grandTotal">0</span>
        </div>
      </div>

      <div class="bill-actions">
        <button class="btn btn-success" onclick="saveBill('${record.service_id}')">✓ Save Bill</button>
        <button class="btn btn-primary" onclick="printBill()">🖨 Print Bill</button>
        <button class="btn btn-secondary" onclick="generatePDF('${record.service_id}')">📄 Export PDF</button>
      </div>
      
      <script>
        // Initialize warranty dates when form loads
        setTimeout(() => {
          updateWarrantyDates();
        }, 100);
      </script>
    </div>
  `;

  billDisplayArea.innerHTML = billHTML;
  attachItemEventListeners();
  // Initialize warranty dates
  setTimeout(() => {
    updateWarrantyDates();
  }, 100);
}

function attachItemEventListeners() {
  const itemsTableBody = document.getElementById('itemsTableBody');
  itemsTableBody.addEventListener('input', (e) => {
    if (e.target.classList.contains('item-price') || e.target.classList.contains('item-qty')) {
      updateItemTotal(e.target);
    }
  });
  document.getElementById('taxPercent').addEventListener('input', updateBillTotals);
  updateBillTotals();
}

function updateItemTotal(input) {
  const row = input.closest('.item-row');
  const price = parseFloat(row.querySelector('.item-price').value) || 0;
  const qty = parseInt(row.querySelector('.item-qty').value) || 1;
  const total = price * qty;
  row.querySelector('.item-total').textContent = total.toFixed(2);
  updateBillTotals();
}

function updateBillTotals() {
  const rows = document.querySelectorAll('.item-row');
  let subtotal = 0;
  
  rows.forEach(row => {
    const total = parseFloat(row.querySelector('.item-total').textContent) || 0;
    subtotal += total;
  });

  const taxPercent = parseFloat(document.getElementById('taxPercent').value) || 0;
  const taxAmount = (subtotal * taxPercent) / 100;
  const grandTotal = subtotal + taxAmount;

  document.getElementById('subtotal').textContent = subtotal.toFixed(2);
  document.getElementById('taxAmount').textContent = taxAmount.toFixed(2);
  document.getElementById('grandTotal').textContent = grandTotal.toFixed(2);
}

function addItemRow() {
  const row = document.createElement('tr');
  row.className = 'item-row';
  row.innerHTML = `
    <td><input type="text" class="item-desc" placeholder="Item description"></td>
    <td><input type="text" class="item-breakout" placeholder="Breakout"></td>
    <td><input type="number" class="item-price" placeholder="0" value="0" min="0"></td>
    <td><input type="number" class="item-qty" placeholder="1" value="1" min="1"></td>
    <td class="item-total">0</td>
    <td><button type="button" class="btn btn-danger" onclick="removeItemRow(this)">✕</button></td>
  `;
  document.getElementById('itemsTableBody').appendChild(row);
  attachItemEventListeners();
}

// Make functions globally accessible for inline HTML
window.addItemRow = addItemRow;

function removeItemRow(btn) {
  if (document.querySelectorAll('.item-row').length > 1) {
    btn.closest('tr').remove();
    updateBillTotals();
  } else {
    alert('At least one item is required');
  }
}

// Make functions globally accessible for inline HTML
window.removeItemRow = removeItemRow;

function saveBill(serviceId) {
  const records = loadRecords();
  const recordIndex = records.findIndex(r => r.service_id === serviceId);
  
  if (recordIndex === -1) {
    alert('Record not found');
    return;
  }

  // Collect bill items
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const item = {
      item: row.querySelector('.item-desc').value,
      breakout: row.querySelector('.item-breakout').value,
      price: parseFloat(row.querySelector('.item-price').value) || 0,
      quantity: parseInt(row.querySelector('.item-qty').value) || 1,
      total: parseFloat(row.querySelector('.item-total').textContent) || 0
    };
    items.push(item);
  });

  const subtotal = parseFloat(document.getElementById('subtotal').textContent);
  const tax = parseFloat(document.getElementById('taxAmount').textContent);
  const grandTotal = parseFloat(document.getElementById('grandTotal').textContent);
  
  // Get warranty information from form
  const warrantyPeriod = document.querySelector('input[name="warrantyPeriod"]:checked')?.value || '3';
  const fromDate = document.getElementById('warrantyFromDate')?.value || new Date().toISOString().slice(0, 10);
  const toDate = document.getElementById('warrantyToDate')?.value || calculateWarrantyEndDate(fromDate, warrantyPeriod);

  records[recordIndex].bill = {
    items: items,
    subtotal: subtotal,
    tax: tax,
    grand_total: grandTotal,
    warranty: warrantyPeriod,
    from_date: fromDate,
    to_date: toDate,
    saved_at: new Date().toISOString()
  };

  saveRecords(records);
  alert('✓ Bill saved successfully!');
  renderRecentBills('');
  displayBill(records[recordIndex]);
}

// Display vendor bill
function displayVendorBill(vendor) {
  if (!vendor.bill) {
    displayVendorBillingForm(vendor);
    return;
  }

  const devicesList = selectedDevices.map((device) => {
    const deviceNum = device.device_id.split('-')[1];
    return `${deviceNum} - ${device.brand} ${device.model} (${device.issue})`;
  }).join('<br>');

  let billHTML = `
    <div class="bill-container">
      <div class="bill-business-header">
        <div class="business-name">MYLAVAN MOBILE SERVICE</div>
        <div class="business-info">
          Shop no. 23, New municipality complex<br>
          old bus stand, Vellore 632004<br>
          Contact: +91-7339559582
        </div>
      </div>
      <div class="bill-header">VENDOR SERVICE BILL</div>
      
      <div class="bill-info">
        <div>Vendor ID: <strong>${vendor.vendor_id}</strong></div>
        <div>Date: <strong>${vendor.date}</strong></div>
        <div>Vendor Name: <strong>${vendor.vendor_name}</strong></div>
        <div>Mobile: <strong>${vendor.mobile_number}</strong></div>
      </div>

      <div class="bill-section-title">Devices in This Bill</div>
      <div style="font-size: 0.9rem; line-height: 1.8; background-color: var(--color-bg-1); padding: var(--space-12); border-radius: var(--radius-base); margin: var(--space-8) 0; border: 2px solid var(--color-primary);">
        <strong style="color: var(--color-primary);">Selected Devices (${selectedDevices.length}):</strong><br>
        ${devicesList}
      </div>

      <table class="bill-items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Breakout</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  vendor.bill.items.forEach(item => {
    billHTML += `
      <tr>
        <td>${item.item}</td>
        <td>${item.breakout}</td>
        <td>Rs. ${item.price}</td>
        <td>${item.quantity}</td>
        <td>Rs. ${item.total}</td>
      </tr>
    `;
  });

  billHTML += `
        </tbody>
      </table>

      <div class="bill-totals">
        <div>Subtotal: Rs. ${vendor.bill.subtotal.toFixed(2)}</div>
        <div>Tax: Rs. ${vendor.bill.tax.toFixed(2)}</div>
        <div class="bill-grand-total">Grand Total: Rs. ${vendor.bill.grand_total.toFixed(2)}</div>
      </div>

      <div class="bill-footer">
        <div class="bill-footer-left">
          <div style="font-weight: bold; margin-bottom: var(--space-8);">Terms &amp; Conditions:</div>
          <div style="line-height: 1.8;">
            1. Warranty void if the device is tampered.<br>
            2. No warranty on water damage.<br>
            3. Goods once sold will not be taken back.
          </div>
        </div>
        <div class="bill-footer-right">
          <div style="font-weight: bold; margin-bottom: var(--space-12);">Authorized Signature</div>
          <div class="signature-container">
            <img src="https://pplx-res.cloudinary.com/image/upload/v1759330125/pplx_project_search_images/6aae375d2d524b360fd03016f7df95541cab5f5f.png" alt="Signature" class="signature-image" />
            <div class="signature-line">Authorized Signatory</div>
          </div>
        </div>
      </div>

      <div class="bill-actions">
        <button class="btn btn-primary" onclick="printBill()">🖨 Print Bill</button>
        <button class="btn btn-secondary" onclick="editVendorBill('${vendor.vendor_id}')">✎ Edit Bill</button>
      </div>
    </div>
  `;

  billDisplayArea.innerHTML = billHTML;
}

function displayBill(record) {
  if (!record.bill) {
    displayBillingForm(record);
    return;
  }

  let billHTML = `
    <div class="bill-container">
      <div class="bill-business-header">
        <div class="business-name">MYLAVAN MOBILE SERVICE</div>
        <div class="business-info">
          Shop no. 23, New municipality complex<br>
          old bus stand, Vellore 632004<br>
          Contact: +91-7339559582
        </div>
      </div>
      <div class="bill-header">BILL</div>
      
      <div class="bill-info">
        <div>Service ID: <strong>${record.service_id}</strong></div>
        <div>Date: <strong>${record.date}</strong></div>
        <div>Customer: <strong>${record.customer_name}</strong></div>
        <div>Mobile: <strong>${record.mobile_number}</strong></div>
      </div>

      <div class="bill-section-title">Device</div>
      <div style="font-size: 0.9rem; line-height: 1.8;">
        ${record.mobile_brand} ${record.model} | IMEI: ${record.imei1}
      </div>

      <table class="bill-items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Breakout</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  record.bill.items.forEach(item => {
    billHTML += `
      <tr>
        <td>${item.item}</td>
        <td>${item.breakout}</td>
        <td>Rs. ${item.price}</td>
        <td>${item.quantity}</td>
        <td>Rs. ${item.total}</td>
      </tr>
    `;
  });

  billHTML += `
        </tbody>
      </table>

      <div class="bill-totals">
        <div>Subtotal: Rs. ${record.bill.subtotal.toFixed(2)}</div>
        <div>Tax: Rs. ${record.bill.tax.toFixed(2)}</div>
        <div class="bill-grand-total">Grand Total: Rs. ${record.bill.grand_total.toFixed(2)}</div>
      </div>

      <div class="bill-warranty">
        <div class="bill-section-title">WARRANTY INFORMATION</div>
        <div style="background-color: var(--color-secondary); padding: var(--space-12); border-radius: var(--radius-base); margin: var(--space-12) 0; font-size: 0.9rem; line-height: 1.8;">
          <strong>Warranty Period:</strong> ${record.bill.warranty === '6' ? '6 months' : '3 months'}<br>
          <strong>Valid From:</strong> ${record.bill.from_date}<br>
          <strong>Valid To:</strong> ${record.bill.to_date}
        </div>
      </div>

      <div class="bill-footer">
        <div class="bill-footer-left">
          <div style="font-weight: bold; margin-bottom: var(--space-8);">Terms &amp; Conditions:</div>
          <div style="line-height: 1.8;">
            1. Warranty void if the device is tampered.<br>
            2. No warranty on water damage.<br>
            3. Goods once sold will not be taken back.
          </div>
        </div>
        <div class="bill-footer-right">
          <div style="font-weight: bold; margin-bottom: var(--space-12);">Authorized Signature</div>
          <div class="signature-container">
            <img src="https://pplx-res.cloudinary.com/image/upload/v1759330125/pplx_project_search_images/6aae375d2d524b360fd03016f7df95541cab5f5f.png" alt="Signature" class="signature-image" />
            <div class="signature-line">Authorized Signatory</div>
          </div>
        </div>
      </div>

      <div class="bill-actions">
        <button class="btn btn-primary" onclick="printBill()">🖨 Print Bill</button>
        <button class="btn btn-secondary" onclick="editBill('${record.service_id}')">✎ Edit Bill</button>
      </div>
    </div>
  `;

  billDisplayArea.innerHTML = billHTML;
}

function editBill(serviceId) {
  const records = loadRecords();
  const record = records.find(r => r.service_id === serviceId);
  if (!record) {
    alert('Service record not found');
    return;
  }
  
  // Display the billing form first
  displayBillingForm(record);
  
  // If bill exists, load the existing items after a short delay
  if (record.bill && record.bill.items) {
    setTimeout(() => {
      const itemsTableBody = document.getElementById('itemsTableBody');
      if (itemsTableBody) {
        // Clear existing rows
        itemsTableBody.innerHTML = '';
        
        // Add each existing item as a row
        record.bill.items.forEach(item => {
          const row = document.createElement('tr');
          row.className = 'item-row';
          row.innerHTML = `
            <td><input type="text" class="item-desc" placeholder="Item description" value="${item.item}"></td>
            <td><input type="text" class="item-breakout" placeholder="Breakout" value="${item.breakout}"></td>
            <td><input type="number" class="item-price" placeholder="0" value="${item.price}" min="0"></td>
            <td><input type="number" class="item-qty" placeholder="1" value="${item.quantity}" min="1"></td>
            <td class="item-total">${item.total}</td>
            <td><button type="button" class="btn btn-danger" onclick="removeItemRow(this)">✕</button></td>
          `;
          itemsTableBody.appendChild(row);
        });
        
        // Update warranty dates if they exist
        if (record.bill.warranty) {
          const warrantyRadios = document.querySelectorAll('input[name="warrantyPeriod"]');
          warrantyRadios.forEach(radio => {
            if (radio.value === record.bill.warranty) {
              radio.checked = true;
            }
          });
        }
        
        if (record.bill.from_date) {
          const fromDateInput = document.getElementById('warrantyFromDate');
          if (fromDateInput) fromDateInput.value = record.bill.from_date;
        }
        
        if (record.bill.to_date) {
          const toDateInput = document.getElementById('warrantyToDate');
          if (toDateInput) toDateInput.value = record.bill.to_date;
        }
        
        // Re-attach event listeners and calculate totals
        attachItemEventListeners();
        updateBillTotals();
      }
    }, 100);
  }
}

// Make functions globally accessible for inline HTML
window.editBill = editBill;

function printBill() {
  // Simply call browser print
  window.print();
}

// Make functions globally accessible for inline HTML
window.printBill = printBill;

function generatePDF(serviceId) {
  alert('PDF export feature requires a library like jsPDF. For now, use Print function and save as PDF.');
}

// Make functions globally accessible for inline HTML
window.generatePDF = generatePDF;

// ============================================
// ALL RECORDS
// ============================================

// Global variables for date filtering
let currentDateFilter = null;

function filterByDateRange() {
  const fromDate = document.getElementById('filterFromDate').value;
  const toDate = document.getElementById('filterToDate').value;
  
  if (!fromDate || !toDate) {
    alert('Please select both From and To dates');
    return;
  }
  
  if (new Date(fromDate) > new Date(toDate)) {
    alert('From date cannot be after To date');
    return;
  }
  
  // Set current date filter
  currentDateFilter = { fromDate, toDate };
  
  // Apply filters
  const searchValue = allRecordsSearch.value;
  const selectedFilter = document.querySelector('input[name="recordFilter"]:checked')?.value || 'all';
  renderAllRecords(searchValue, selectedFilter);
}

function resetDateFilter() {
  // Clear filter inputs
  document.getElementById('filterFromDate').value = '';
  document.getElementById('filterToDate').value = '';
  
  // Clear date filter
  currentDateFilter = null;
  
  console.log('✓ Date filter reset - filter fields cleared');
  
  // Reload all records
  const searchValue = allRecordsSearch.value;
  const selectedFilter = document.querySelector('input[name="recordFilter"]:checked')?.value || 'all';
  renderAllRecords(searchValue, selectedFilter);
  
  // Ensure filters stay empty
  setTimeout(ensureFilterDatesEmpty, 50);
}

function updateSummaryWithFiltered(records) {
  const totalRecords = records.length;
  const individualCount = records.filter(r => r.record_type === 'service' || !r.record_type).length;
  const vendorCount = records.filter(r => r.record_type === 'vendor').length;
  const billedCount = records.filter(r => r.bill !== null && r.bill !== undefined).length;
  
  let totalRevenue = 0;
  records.forEach(record => {
    if (record.bill) {
      totalRevenue += record.bill.grand_total || 0;
    }
  });
  
  // Update summary HTML
  const summaryText = `📊 SUMMARY: Total: ${totalRecords} | Individual: ${individualCount} | Vendors: ${vendorCount} | Completed Bills: ${billedCount} | Total Revenue: Rs. ${totalRevenue.toFixed(2)}`;
  
  const summaryElement = document.getElementById('recordsSummary');
  if (summaryElement) {
    summaryElement.textContent = summaryText;
  }
}

// Make functions globally accessible
window.filterByDateRange = filterByDateRange;
window.resetDateFilter = resetDateFilter;

function renderAllRecords(filter = '', recordFilter = 'all') {
  const records = loadRecords();
  
  // Apply date filter first
  let dateFiltered = records;
  if (currentDateFilter) {
    const fromDate = new Date(currentDateFilter.fromDate);
    const toDate = new Date(currentDateFilter.toDate);
    
    dateFiltered = records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate >= fromDate && recordDate <= toDate;
    });
  }
  
  // Apply record type filter
  let filteredByType = dateFiltered;
  if (recordFilter === 'individual') {
    filteredByType = dateFiltered.filter(r => r.record_type === 'service' || !r.record_type);
  } else if (recordFilter === 'laptop') {
    filteredByType = dateFiltered.filter(r => r.record_type === 'laptop');
  } else if (recordFilter === 'vendor') {
    filteredByType = dateFiltered.filter(r => r.record_type === 'vendor');
  }
  
  // Apply search filter
  const filtered = filteredByType.filter(rec => {
    if (rec.record_type === 'vendor') {
      const vendorIdMatch = rec.vendor_id.toLowerCase().includes(filter.toLowerCase());
      const nameMatch = rec.vendor_name.toLowerCase().includes(filter.toLowerCase());
      const mobileMatch = rec.mobile_number.includes(filter);
      return vendorIdMatch || nameMatch || mobileMatch;
    } else if (rec.record_type === 'laptop') {
      const laptopIdMatch = rec.laptop_id.toLowerCase().includes(filter.toLowerCase());
      const contactMatch = rec.contact_number.includes(filter);
      const brandMatch = rec.laptop_brand.toLowerCase().includes(filter.toLowerCase());
      return laptopIdMatch || contactMatch || brandMatch;
    } else {
      const serviceIdMatch = rec.service_id.toLowerCase().includes(filter.toLowerCase());
      const nameMatch = rec.customer_name.toLowerCase().includes(filter.toLowerCase());
      const mobileMatch = rec.mobile_number.includes(filter);
      return serviceIdMatch || nameMatch || mobileMatch;
    }
  });

  // Update summary with filtered records
  updateSummaryWithFiltered(filtered);
  
  allRecordsList.innerHTML = '';

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = currentDateFilter ? 'No records found for selected date range' : 'No records found';
    allRecordsList.appendChild(li);
    return;
  }

  filtered.slice().reverse().forEach(rec => {
    const li = document.createElement('li');
    
    if (rec.record_type === 'laptop') {
      // Laptop record display
      const billStatus = rec.bill ? `✅ Billed (Rs. ${rec.bill.grand_total})` : '⏳ Pending Bill';
      const warrantyInfo = rec.bill ? ` | Warranty: ${rec.bill.warranty === '6' ? '6 months' : '3 months'}` : '';
      const issuePreview = rec.issue.length > 50 ? rec.issue.substring(0, 50) + '...' : rec.issue;
      
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div><strong>${rec.laptop_id}</strong> - 💻 ${rec.laptop_brand} ${rec.model} (${rec.contact_number})</div>
            <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 3px;">
              <span class="badge-laptop">LAPTOP</span> | 📅 ${rec.date} | ${rec.condition} | 👤 ${rec.received_by}
            </div>
            <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 2px;">
              📝 ${issuePreview}
            </div>
          </div>
          <div style="text-align: right; font-size: 0.85rem;">
            <div>${billStatus}</div>
            ${warrantyInfo ? `<div style="color: var(--color-success);">${warrantyInfo}</div>` : ''}
          </div>
        </div>
        <div style="margin-top: 8px; display: flex; gap: 5px; flex-wrap: wrap;">
          <button class="btn-mini btn-primary" onclick="event.stopPropagation(); viewLaptopDetails('${rec.laptop_id}')">👁️ View</button>
          ${!rec.bill ? `<button class="btn-mini btn-success" onclick="event.stopPropagation(); createBillForLaptop('${rec.laptop_id}')">💰 Create Bill</button>` : ''}
          ${rec.bill ? `<button class="btn-mini btn-secondary" onclick="event.stopPropagation(); viewBillForLaptop('${rec.laptop_id}')">📋 View Bill</button>` : ''}
          ${rec.bill ? `<button class="btn-mini btn-primary" onclick="event.stopPropagation(); printBillForLaptop('${rec.laptop_id}')">🖨️ Print</button>` : ''}
        </div>
      `;
      
      li.className = 'laptop-record';
      li.style.cursor = 'pointer';
      li.style.padding = '12px 15px';
      
      li.addEventListener('click', () => {
        viewLaptopDetails(rec.laptop_id);
      });
    } else if (rec.record_type === 'vendor') {
      // Vendor record display
      const totalPhones = rec.phones.length;
      const billsCount = rec.bills ? rec.bills.length : 0;
      const receivedCount = rec.phones.filter(p => p.status === 'Received').length;
      const inRepairCount = rec.phones.filter(p => p.status === 'In Repair').length;
      const readyCount = rec.phones.filter(p => p.status === 'Ready').length;
      const billedCount = rec.phones.filter(p => p.status === 'Billed').length;
      
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div><strong>${rec.vendor_id}</strong> - <span class="vendor-name-clickable" style="color: var(--color-primary); cursor: pointer; text-decoration: underline;" onclick="event.stopPropagation(); openVendorDetailsModal('${rec.vendor_id}')">${rec.vendor_name}</span> (${rec.mobile_number})</div>
            <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 3px;">
              🏢 <strong>VENDOR</strong> | ${totalPhones} phone(s) | 📅 Created: ${rec.created_date}
            </div>
            <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 2px;">
              📥 ${receivedCount} Received | 🔧 ${inRepairCount} In Repair | ✅ ${readyCount} Ready | 💰 ${billedCount} Billed
            </div>
            <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 2px;">
              ${billsCount} Bill(s) Generated
            </div>
          </div>
          <div style="text-align: right; font-size: 0.85rem;">
            <div style="color: var(--color-success);">${billsCount > 0 ? `✅ ${billsCount} Bill(s)` : '⏳ No Bills Yet'}</div>
          </div>
        </div>
        <div style="margin-top: 8px; display: flex; gap: 5px; flex-wrap: wrap;">
          <button class="btn-mini btn-primary" onclick="event.stopPropagation(); openVendorDetailsModal('${rec.vendor_id}')">👁️ View Details</button>
        </div>
      `;
    } else {
      // Individual service record display
      const billStatus = rec.bill ? `✅ Billed (Rs. ${rec.bill.grand_total})` : '⏳ Pending Bill';
      const warrantyInfo = rec.bill ? ` | Warranty: ${rec.bill.warranty === '6' ? '6 months' : '3 months'}` : '';
      const issuePreview = rec.issue.length > 50 ? rec.issue.substring(0, 50) + '...' : rec.issue;
      
      li.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div><strong>${rec.service_id}</strong> - ${rec.customer_name} (${rec.mobile_number})</div>
            <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 3px;">
              👤 <strong>INDIVIDUAL</strong> | 📱 ${rec.mobile_brand} ${rec.model} | 📅 ${rec.date} | ⏰ Est. Delivery: ${rec.estimated_delivery}
            </div>
            <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 2px;">
              🔧 ${rec.service_type.join(', ')} | 👤 ${rec.received_by}
            </div>
            <div style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 2px;">
              📝 ${issuePreview}
            </div>
          </div>
          <div style="text-align: right; font-size: 0.85rem;">
            <div>${billStatus}</div>
            ${warrantyInfo ? `<div style="color: var(--color-success);">${warrantyInfo}</div>` : ''}
          </div>
        </div>
        <div style="margin-top: 8px; display: flex; gap: 5px; flex-wrap: wrap;">
          <button class="btn-mini btn-primary" onclick="event.stopPropagation(); viewRecordDetails('${rec.service_id}')">👁️ View</button>
          ${!rec.bill ? `<button class="btn-mini btn-success" onclick="event.stopPropagation(); createBillForRecord('${rec.service_id}')">💰 Create Bill</button>` : ''}
          ${rec.bill ? `<button class="btn-mini btn-secondary" onclick="event.stopPropagation(); viewBillForRecord('${rec.service_id}')">📋 View Bill</button>` : ''}
          ${rec.bill ? `<button class="btn-mini btn-primary" onclick="event.stopPropagation(); printBillForRecord('${rec.service_id}')">🖨️ Print</button>` : ''}
        </div>
      `;
    }
    
    li.style.cursor = 'pointer';
    li.style.padding = '12px 15px';
    
    if (rec.record_type !== 'vendor') {
      li.addEventListener('click', () => {
        viewRecordDetails(rec.service_id);
      });
    }
    
    allRecordsList.appendChild(li);
  });
}

allRecordsSearch.addEventListener('input', (e) => {
  const selectedFilter = document.querySelector('input[name="recordFilter"]:checked')?.value || 'all';
  renderAllRecords(e.target.value, selectedFilter);
});

// Add record filter functionality
document.addEventListener('change', (e) => {
  if (e.target.name === 'recordFilter') {
    const searchValue = allRecordsSearch.value;
    renderAllRecords(searchValue, e.target.value);
  }
});

// Modal functionality
function createModal(serviceId) {
  const records = loadRecords();
  const record = records.find(r => r.service_id === serviceId);
  if (!record) return;

  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  // Create modal box
  const modalBox = document.createElement('div');
  modalBox.className = 'modal-box';
  modalBox.style.cssText = `
    background-color: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-32);
    max-width: 800px;
    width: 90%;
    max-height: 90%;
    overflow-y: auto;
    position: relative;
    border: 1px solid var(--color-card-border);
    box-shadow: var(--shadow-lg);
    transform: scale(0.95);
    transition: transform 0.3s ease;
  `;

  // Create modal content
  const modalContent = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-24); padding-bottom: var(--space-16); border-bottom: 2px solid var(--color-primary);">
      <h2 style="color: var(--color-primary); margin: 0; font-size: var(--font-size-2xl);">Service Details - ${record.service_id}</h2>
      <button class="modal-close-btn" style="
        background: none;
        border: none;
        font-size: var(--font-size-2xl);
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: var(--space-4);
        border-radius: var(--radius-sm);
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      " onmouseover="this.style.backgroundColor='var(--color-secondary)'" onmouseout="this.style.backgroundColor='transparent'">×</button>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-32); margin-bottom: var(--space-24);">
      <div>
        <h3 style="color: var(--color-primary); margin-bottom: var(--space-12); font-size: var(--font-size-lg);">👤 Customer Information</h3>
        <div style="background-color: var(--color-bg-1); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
          <div><strong>Name:</strong> ${record.customer_name}</div>
          <div><strong>Mobile:</strong> ${record.mobile_number}</div>
          <div><strong>Address:</strong> ${record.address || 'N/A'}</div>
        </div>
      </div>
      
      <div>
        <h3 style="color: var(--color-primary); margin-bottom: var(--space-12); font-size: var(--font-size-lg);">📱 Device Information</h3>
        <div style="background-color: var(--color-bg-2); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
          <div><strong>Brand:</strong> ${record.mobile_brand}</div>
          <div><strong>Model:</strong> ${record.model}</div>
          <div><strong>IMEI 1:</strong> ${record.imei1}</div>
          ${record.imei2 ? `<div><strong>IMEI 2:</strong> ${record.imei2}</div>` : ''}
        </div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-32); margin-bottom: var(--space-24);">
      <div>
        <h3 style="color: var(--color-primary); margin-bottom: var(--space-12); font-size: var(--font-size-lg);">🔧 Service Details</h3>
        <div style="background-color: var(--color-bg-3); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
          <div><strong>Issue:</strong> ${record.issue}</div>
          <div><strong>Service Type:</strong> ${record.service_type.join(', ')}</div>
          <div><strong>Condition:</strong> ${record.mobile_condition}</div>
          <div><strong>Accessories:</strong> ${record.accessories.length > 0 ? record.accessories.join(', ') : 'None'}</div>
        </div>
      </div>
      
      <div>
        <h3 style="color: var(--color-primary); margin-bottom: var(--space-12); font-size: var(--font-size-lg);">⚙️ Service Management</h3>
        <div style="background-color: var(--color-bg-4); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
          <div><strong>Received By:</strong> ${record.received_by}</div>
          <div><strong>Date:</strong> ${record.date}</div>
          <div><strong>Est. Delivery:</strong> ${record.estimated_delivery}</div>
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: var(--space-24);">
      <h3 style="color: var(--color-primary); margin-bottom: var(--space-12); font-size: var(--font-size-lg);">📸 Device Images</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-16);">
        <div style="text-align: center;">
          <div style="font-weight: var(--font-weight-medium); margin-bottom: var(--space-8);">Front Image</div>
          <div style="border: 2px solid var(--color-border); border-radius: var(--radius-base); padding: var(--space-16); background-color: var(--color-bg-5); min-height: 200px; display: flex; align-items: center; justify-content: center;">
            ${record.front_image ? `<img src="${record.front_image}" style="max-width: 100%; max-height: 180px; object-fit: cover; border-radius: var(--radius-sm);" />` : '<span style="color: var(--color-text-secondary);">No image uploaded</span>'}
          </div>
        </div>
        <div style="text-align: center;">
          <div style="font-weight: var(--font-weight-medium); margin-bottom: var(--space-8);">Back Image</div>
          <div style="border: 2px solid var(--color-border); border-radius: var(--radius-base); padding: var(--space-16); background-color: var(--color-bg-6); min-height: 200px; display: flex; align-items: center; justify-content: center;">
            ${record.back_image ? `<img src="${record.back_image}" style="max-width: 100%; max-height: 180px; object-fit: cover; border-radius: var(--radius-sm);" />` : '<span style="color: var(--color-text-secondary);">No image uploaded</span>'}
          </div>
        </div>
      </div>
    </div>
    
    ${record.bill ? `
    <div style="margin-bottom: var(--space-24);">
      <h3 style="color: var(--color-primary); margin-bottom: var(--space-12); font-size: var(--font-size-lg);">💰 Bill Summary</h3>
      <div style="background-color: var(--color-bg-7); padding: var(--space-16); border-radius: var(--radius-base); line-height: 1.8;">
        <div><strong>Total Amount:</strong> Rs. ${record.bill.grand_total}</div>
        <div><strong>Bill Status:</strong> <span style="color: var(--color-success);">✅ Completed</span></div>
        <div><strong>Warranty:</strong> ${record.bill.warranty} months (${record.bill.from_date} to ${record.bill.to_date})</div>
      </div>
    </div>
    ` : `
    <div style="margin-bottom: var(--space-24);">
      <h3 style="color: var(--color-primary); margin-bottom: var(--space-12); font-size: var(--font-size-lg);">💰 Bill Status</h3>
      <div style="background-color: var(--color-bg-8); padding: var(--space-16); border-radius: var(--radius-base);">
        <div style="color: var(--color-warning);"><strong>⏳ Bill Pending</strong></div>
      </div>
    </div>
    `}
    
    <div style="text-align: center; margin-top: var(--space-24);">
      <button class="btn btn--secondary modal-close-btn">Close</button>
    </div>
  `;

  modalBox.innerHTML = modalContent;
  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  // Add event listeners for closing
  const closeButtons = modalBox.querySelectorAll('.modal-close-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => closeModal(modalOverlay));
  });

  // Close on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal(modalOverlay);
    }
  });

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Animate in
  setTimeout(() => {
    modalOverlay.style.opacity = '1';
    modalBox.style.transform = 'scale(1)';
  }, 10);
}

function closeModal(modalOverlay) {
  modalOverlay.style.opacity = '0';
  modalOverlay.querySelector('.modal-box').style.transform = 'scale(0.95)';
  
  setTimeout(() => {
    document.body.removeChild(modalOverlay);
    document.body.style.overflow = 'auto';
  }, 300);
}

// Helper functions for All Records actions
function viewRecordDetails(serviceId) {
  createModal(serviceId);
}

function createBillForRecord(serviceId) {
  searchBillInput.value = serviceId;
  showSection('billing');
  searchAndLoadRecord();
  window.scrollTo(0, 0);
}

function viewBillForRecord(serviceId) {
  const records = loadRecords();
  const record = records.find(r => r.service_id === serviceId);
  if (record && record.bill) {
    showSection('billing');
    displayBill(record);
    window.scrollTo(0, 0);
  }
}

function printBillForRecord(serviceId) {
  const records = loadRecords();
  const record = records.find(r => r.service_id === serviceId);
  if (record && record.bill) {
    showSection('billing');
    displayBill(record);
    setTimeout(() => {
      printBill();
    }, 500);
  }
}

// ============================================
// VENDOR DETAILS MODAL
// ============================================

function openVendorDetailsModal(vendorId) {
  const records = loadRecords();
  const vendor = records.find(r => r.vendor_id === vendorId);
  if (!vendor) return;

  // Calculate summary statistics
  const totalPhones = vendor.phones.length;
  const receivedCount = vendor.phones.filter(p => p.status === 'Received').length;
  const inRepairCount = vendor.phones.filter(p => p.status === 'In Repair').length;
  const readyCount = vendor.phones.filter(p => p.status === 'Ready').length;
  const billedCount = vendor.phones.filter(p => p.status === 'Billed').length;

  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay vendor-modal';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  // Create modal box
  const modalBox = document.createElement('div');
  modalBox.className = 'modal-box';
  modalBox.style.cssText = `
    background-color: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-32);
    max-width: 1100px;
    width: 90%;
    max-height: 90%;
    overflow-y: auto;
    position: relative;
    border: 1px solid var(--color-card-border);
    box-shadow: var(--shadow-lg);
    transform: scale(0.95);
    transition: transform 0.3s ease;
  `;

  // Create phones table rows
  const phonesTableRows = vendor.phones.map((phone, index) => {
    const phoneShortId = phone.phone_id.split('-')[1];
    const isDisabled = phone.status === 'Billed';
    const statusClass = phone.status.toLowerCase().replace(' ', '-');
    
    return `
    <tr>
      <td style="text-align: center;">
        <input type="checkbox" class="phone-checkbox" data-phone-id="${phone.phone_id}" ${isDisabled ? 'disabled' : ''} ${phone.completed && !phone.billed ? 'checked' : ''} />
      </td>
      <td>${phoneShortId}</td>
      <td>${phone.date_received}</td>
      <td>${phone.brand}</td>
      <td>${phone.model}</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${phone.issue}</td>
      <td>${phone.received_by}</td>
      <td>
        ${phone.status === 'Billed' ? 
          `<span class="status-badge ${statusClass}">Billed</span>` : 
          `<select class="device-status-select" data-phone-id="${phone.phone_id}" onchange="updatePhoneStatus('${phone.phone_id}', this.value)">
            <option value="Received" ${phone.status === 'Received' ? 'selected' : ''}>Received</option>
            <option value="In Repair" ${phone.status === 'In Repair' ? 'selected' : ''}>In Repair</option>
            <option value="Ready" ${phone.status === 'Ready' ? 'selected' : ''}>Ready</option>
          </select>`
        }
      </td>
      <td>${phone.billed ? `✅ Bill #${phone.bill_id}` : '-'}</td>
    </tr>
    `;
  }).join('');

  // Create bills list
  const billsList = vendor.bills && vendor.bills.length > 0 ? vendor.bills.map(bill => {
    const phonesList = bill.phone_ids.map(pid => {
      const phone = vendor.phones.find(p => p.phone_id === pid);
      return phone ? `${pid.split('-')[1]} (${phone.brand} ${phone.model})` : pid;
    }).join(', ');
    
    return `
    <div class="bill-card">
      <h4>Bill ${bill.bill_number} - ${bill.date}</h4>
      <p>Phones: ${phonesList}</p>
      <p>Total: Rs. ${bill.grand_total}</p>
      <button class="btn-mini btn-primary" onclick="viewVendorBillById('${vendorId}', '${bill.bill_id}')">View</button>
      <button class="btn-mini btn-secondary" onclick="printVendorBillById('${vendorId}', '${bill.bill_id}')">Print</button>
    </div>
    `;
  }).join('') : '<p style="color: var(--color-text-secondary);">No bills yet</p>';

  // Create modal content
  const modalContent = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-24); padding-bottom: var(--space-16); border-bottom: 2px solid var(--color-primary);">
      <div>
        <h2 style="color: var(--color-primary); margin: 0; font-size: var(--font-size-2xl);">${vendor.vendor_name} (${vendor.vendor_id})</h2>
        <p style="margin: var(--space-4) 0 0 0; color: var(--color-text-secondary);">Mobile: ${vendor.mobile_number} | Created: ${vendor.created_date}</p>
      </div>
      <button class="modal-close-btn" style="
        background: none;
        border: none;
        font-size: var(--font-size-2xl);
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: var(--space-4);
        border-radius: var(--radius-sm);
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      " onmouseover="this.style.backgroundColor='var(--color-secondary)'" onmouseout="this.style.backgroundColor='transparent'">×</button>
    </div>
    
    <div class="vendor-summary">
      <div class="summary-card">
        <span>📱 Total Phones</span>
        <strong>${totalPhones}</strong>
      </div>
      <div class="summary-card">
        <span>📥 Received</span>
        <strong>${receivedCount}</strong>
      </div>
      <div class="summary-card">
        <span>🔧 In Repair</span>
        <strong>${inRepairCount}</strong>
      </div>
      <div class="summary-card">
        <span>✅ Ready</span>
        <strong>${readyCount}</strong>
      </div>
      <div class="summary-card">
        <span>💰 Billed</span>
        <strong>${billedCount}</strong>
      </div>
    </div>
    
    <div class="phones-section">
      <h3 style="color: var(--color-primary); margin-bottom: var(--space-12);">All Phones</h3>
      <button class="btn btn--secondary" onclick="addMorePhonesToVendor('${vendorId}')" style="margin-bottom: var(--space-16);">
        + Add More Phones to This Vendor
      </button>
      
      <table class="phones-table">
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">Select</th>
            <th>Phone ID</th>
            <th>Date Received</th>
            <th>Brand</th>
            <th>Model</th>
            <th>Issue</th>
            <th>Received By</th>
            <th>Status</th>
            <th>Billed</th>
          </tr>
        </thead>
        <tbody>
          ${phonesTableRows || '<tr><td colspan="9" style="text-align: center; color: var(--color-text-secondary);">No phones added yet</td></tr>'}
        </tbody>
      </table>
    </div>
    
    <div class="bills-section">
      <h3 style="color: var(--color-primary); margin-bottom: var(--space-12);">Bills History</h3>
      <div class="bills-list">
        ${billsList}
      </div>
    </div>
    
    <div class="modal-actions">
      <button class="btn btn--primary" onclick="createBillForCheckedPhones('${vendorId}')">
        Create Bill for Selected Phones
      </button>
      <button class="btn btn--secondary modal-close-btn">Close</button>
    </div>
  `;

  modalBox.innerHTML = modalContent;
  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  // Add event listeners for closing
  const closeButtons = modalBox.querySelectorAll('.modal-close-btn');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => closeModal(modalOverlay));
  });

  // Close on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal(modalOverlay);
    }
  });

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Animate in
  setTimeout(() => {
    modalOverlay.style.opacity = '1';
    modalBox.style.transform = 'scale(1)';
  }, 10);
}

// Update phone status
function updatePhoneStatus(phoneId, newStatus) {
  const records = loadRecords();
  
  let vendorId = null;
  for (let record of records) {
    if (record.record_type === 'vendor') {
      const phone = record.phones.find(p => p.phone_id === phoneId);
      if (phone) {
        phone.status = newStatus;
        if (newStatus === 'Ready') {
          phone.completed = true;
        } else {
          phone.completed = false;
        }
        vendorId = record.vendor_id;
        saveRecords(records);
        break;
      }
    }
  }
  
  if (vendorId) {
    // Close current modal and reopen with fresh data
    const modal = document.querySelector('.modal-overlay.vendor-modal');
    if (modal) {
      closeModal(modal);
      setTimeout(() => {
        openVendorDetailsModal(vendorId);
      }, 100);
    }
  }
}

// Add more phones to vendor (opens Add Phone section)
function addMorePhonesToVendor(vendorId) {
  closeModal(document.querySelector('.modal-overlay'));
  showSection('vendors');
  
  // Set vendor dropdown to this vendor
  const selectVendor = document.getElementById('selectVendor');
  selectVendor.value = vendorId;
  
  // Scroll to add phone form
  setTimeout(() => {
    document.querySelector('.add-phone-section').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// Create bill for checked phones
function createBillForCheckedPhones(vendorId) {
  const records = loadRecords();
  const vendorIndex = records.findIndex(r => r.vendor_id === vendorId);
  
  if (vendorIndex === -1) return;
  
  const vendor = records[vendorIndex];
  const checkboxes = document.querySelectorAll('.phone-checkbox:checked');
  const selectedPhoneIds = Array.from(checkboxes).map(cb => cb.dataset.phoneId);
  
  if (selectedPhoneIds.length === 0) {
    alert('Please select at least one phone to bill');
    return;
  }
  
  // Store selected phones for billing
  window.selectedPhonesForBilling = {
    vendorId: vendorId,
    phoneIds: selectedPhoneIds
  };
  
  // Find and close the vendor modal properly
  const modal = document.querySelector('.modal-overlay.vendor-modal');
  if (modal) {
    closeModal(modal);
  }
  
  // Small delay to ensure modal closes before opening billing
  setTimeout(() => {
    searchBillInput.value = vendorId;
    showSection('billing');
    searchAndLoadRecord();
    window.scrollTo(0, 0);
  }, 150);
}



// Helper function for status colors
function getStatusColor(status) {
  switch (status) {
    case 'Pending': return 'var(--color-orange-500)';
    case 'In Progress': return 'var(--color-primary)';
    case 'Completed': return 'var(--color-success)';
    default: return 'var(--color-text-secondary)';
  }
}

// Vendor billing functions
function createVendorBill(vendorId) {
  searchBillInput.value = vendorId;
  showSection('billing');
  searchAndLoadRecord();
  window.scrollTo(0, 0);
}

function viewVendorBill(vendorId) {
  const records = loadRecords();
  const vendor = records.find(r => r.vendor_id === vendorId);
  if (vendor && vendor.bill) {
    showSection('billing');
    displayVendorBill(vendor);
    window.scrollTo(0, 0);
  }
}

function printVendorBill(vendorId) {
  const records = loadRecords();
  const vendor = records.find(r => r.vendor_id === vendorId);
  if (vendor && vendor.bill) {
    showSection('billing');
    displayVendorBill(vendor);
    setTimeout(() => {
      printBill();
    }, 500);
  }
}

// Make functions globally accessible
window.openVendorDetailsModal = openVendorDetailsModal;
window.createVendorBill = createVendorBill;
window.viewVendorBill = viewVendorBill;
window.printVendorBill = printVendorBill;

// ============================================
// DATE HANDLING - CORRECT IMPLEMENTATION
// ============================================

/**
 * Get today's date in YYYY-MM-DD format
 * Uses LOCAL date (not UTC) to avoid timezone issues
 * Current IST: October 28, 2025, 2 AM → Returns "2025-10-28"
 */
function getTodaysDate() {
  const now = new Date();
  const year = now.getFullYear();        // 2025
  const month = String(now.getMonth() + 1).padStart(2, '0');  // "10"
  const day = String(now.getDate()).padStart(2, '0');         // "28"
  return `${year}-${month}-${day}`;      // "2025-10-28"
}

/**
 * Fill all date input fields with today's date
 * Only fills empty fields, never overwrites user input
 * SKIPS filter date fields to keep them empty
 */
function fillAllDateFields() {
  const today = getTodaysDate();
  
  console.log('=== FILLING DATE FIELDS ===');
  console.log('Today:', today);
  console.log('Time:', new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}));
  
  const dateInputs = document.querySelectorAll('input[type="date"]');
  console.log('Found', dateInputs.length, 'date inputs');
  
  let filledCount = 0;
  let skippedCount = 0;
  dateInputs.forEach((input, index) => {
    const inputId = input.id || `field-${index}`;
    const currentValue = input.value;
    
    // CRITICAL: SKIP filter date fields - MULTIPLE checks
    if (inputId === 'filterFromDate' || 
        inputId === 'filterToDate' ||
        inputId.includes('filter') ||
        input.hasAttribute('data-no-autofill') ||
        input.classList.contains('no-autofill') ||
        input.classList.contains('filter-date')) {
      console.log(`  ⊘ SKIP: ${inputId} (filter field)`);
      skippedCount++;
      return;  // Don't fill
    }
    
    if (!currentValue || currentValue === '') {
      input.value = today;
      filledCount++;
      console.log(`  ✓ FILL: ${inputId}: "" → "${today}"`);
    } else {
      console.log(`  - ${inputId}: already has "${currentValue}"`);
    }
  });
  
  console.log(`Result: Filled ${filledCount}, Skipped ${skippedCount}/${dateInputs.length} fields`);
  console.log('===========================');
}

/**
 * Explicitly clear filter date fields
 * Called after fillAllDateFields to ensure filters stay empty
 */
function ensureFilterDatesEmpty() {
  const filterFrom = document.getElementById('filterFromDate');
  const filterTo = document.getElementById('filterToDate');
  
  if (filterFrom) {
    filterFrom.value = '';
    console.log('✓ Cleared filterFromDate');
  }
  
  if (filterTo) {
    filterTo.value = '';
    console.log('✓ Cleared filterToDate');
  }
}

/**
 * Initialize date filling - runs on page load
 */
function initializeDateFilling() {
  console.log('🔧 INITIALIZING DATE AUTO-FILL...');
  console.log('📅 Expected date: 2025-10-28 (IST)');
  console.log('🕐 Current time:', new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}));
  
  // Fill immediately
  fillAllDateFields();
  ensureFilterDatesEmpty();
  
  // Fill with multiple delays to ensure all DOM elements are ready
  setTimeout(() => {
    fillAllDateFields();
    ensureFilterDatesEmpty();
  }, 50);
  setTimeout(() => {
    fillAllDateFields();
    ensureFilterDatesEmpty();
  }, 100);
  setTimeout(() => {
    fillAllDateFields();
    ensureFilterDatesEmpty();
  }, 200);
  setTimeout(() => {
    fillAllDateFields();
    ensureFilterDatesEmpty();
  }, 500);
  setTimeout(() => {
    ensureFilterDatesEmpty();
  }, 1000);
  setTimeout(() => {
    ensureFilterDatesEmpty();
  }, 2000);
  
  // Periodic check every 5 seconds (only fills empty fields, clears filters)
  setInterval(() => {
    fillAllDateFields();
    ensureFilterDatesEmpty();
  }, 5000);
  
  console.log('✅ Date auto-fill initialized');
  console.log('✅ Filter dates will stay EMPTY');
}

// Legacy function for compatibility
function fillTodaysDate() {
  fillAllDateFields();
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize sample data if memory is empty
function initializeSampleData() {
  const records = loadRecords();
  if (records.length === 0) {
    const sampleIndividualRecord = {
      record_type: "service",
      service_id: "SRV001",
      date: "2025-10-24",
      customer_name: "Rajesh Kumar",
      mobile_number: "9876543210",
      address: "123 Main Street, Mumbai",
      mobile_brand: "Samsung",
      model: "Galaxy S21",
      imei1: "123456789012345",
      imei2: "543210987654321",
      issue: "Display broken",
      service_type: ["Display"],
      mobile_condition: "ON",
      accessories: ["SIM Tray", "Back Cover"],
      front_image: null,
      back_image: null,
      received_by: "Avinash",
      estimated_delivery: "2025-10-26",
      bill: {
        items: [{
          item: "Display",
          breakout: "Original",
          price: 1300,
          quantity: 1,
          total: 1300
        }],
        subtotal: 1300,
        tax: 0,
        grand_total: 1300,
        warranty: "3",
        from_date: "2025-10-24",
        to_date: "2026-01-24"
      },
      timestamp: new Date().toISOString()
    };
    
    // Sample vendor with multiple phones and partial billing
    const sampleVendorRecord = {
      record_type: "vendor",
      vendor_id: "VND001",
      vendor_name: "ABC Mobile Shop",
      mobile_number: "9988776655",
      created_date: "2025-10-25",
      phones: [
        {
          phone_id: "VND001-P001",
          date_received: "2025-10-25",
          brand: "Samsung",
          model: "Galaxy S21",
          issue: "Display broken",
          received_by: "Avinash",
          status: "Billed",
          completed: true,
          billed: true,
          bill_id: "VND001-B001"
        },
        {
          phone_id: "VND001-P002",
          date_received: "2025-10-25",
          brand: "Apple",
          model: "iPhone 13",
          issue: "Battery issue",
          received_by: "Avinash",
          status: "Billed",
          completed: true,
          billed: true,
          bill_id: "VND001-B001"
        },
        {
          phone_id: "VND001-P003",
          date_received: "2025-10-26",
          brand: "Vivo",
          model: "V21",
          issue: "Charging port",
          received_by: "Aryan",
          status: "Ready",
          completed: true,
          billed: false,
          bill_id: null
        },
        {
          phone_id: "VND001-P004",
          date_received: "2025-10-26",
          brand: "Oppo",
          model: "F19",
          issue: "Screen replacement",
          received_by: "Aryan",
          status: "In Repair",
          completed: false,
          billed: false,
          bill_id: null
        },
        {
          phone_id: "VND001-P005",
          date_received: "2025-10-26",
          brand: "Realme",
          model: "8",
          issue: "Water damage",
          received_by: "Sameer",
          status: "Received",
          completed: false,
          billed: false,
          bill_id: null
        }
      ],
      bills: [
        {
          bill_id: "VND001-B001",
          bill_number: "VND001-B001",
          date: "2025-10-27",
          phone_ids: ["VND001-P001", "VND001-P002"],
          items: [
            {
              item: "Display (Samsung)",
              breakout: "Original",
              price: 1300,
              quantity: 1,
              total: 1300
            },
            {
              item: "Battery (Apple)",
              breakout: "Compatible",
              price: 900,
              quantity: 1,
              total: 900
            }
          ],
          subtotal: 2200,
          tax: 0,
          grand_total: 2200
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    saveRecords([sampleIndividualRecord, sampleVendorRecord]);
  }
}

// ============================================
// LAPTOP BILLING FUNCTIONALITY
// ============================================

function displayLaptopBillingForm(laptop) {
  const billHTML = `
    <div class="bill-container">
      <div class="bill-business-header">
        <div class="business-name">MYLAVAN MOBILE SERVICE</div>
        <div class="business-info">
          Shop no. 23, New municipality complex<br>
          old bus stand, Vellore 632004<br>
          Contact: +91-7339559582
        </div>
      </div>
      <div class="bill-header">LAPTOP SERVICE BILL</div>
      
      <div class="bill-info">
        <div>Laptop Service ID: <strong>${laptop.laptop_id}</strong></div>
        <div>Date: <strong>${laptop.date}</strong></div>
        <div>Contact: <strong>${laptop.contact_number}</strong></div>
      </div>

      <div class="bill-section-title">Laptop Details</div>
      <div style="font-size: 0.9rem; line-height: 1.8;">
        Brand: ${laptop.laptop_brand}<br>
        Model: ${laptop.model}<br>
        Condition: ${laptop.condition}<br>
        Accessories: ${laptop.accessories.length > 0 ? laptop.accessories.join(', ') : 'None'}<br>
        Issue: ${laptop.issue}
      </div>

      <div class="bill-section-title">WARRANTY PERIOD SELECTION</div>
      <div class="bill-warranty" style="background-color: var(--color-secondary); padding: 15px; border-radius: 6px; margin: 15px 0;">
        <div style="margin-bottom: 15px;">
          <label style="font-weight: bold; display: block; margin-bottom: 10px;">Select Warranty Period:</label>
          <div style="display: flex; gap: 20px; margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="warrantyPeriod" value="3" checked onchange="updateWarrantyDates()"> 3 months
            </label>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="radio" name="warrantyPeriod" value="6" onchange="updateWarrantyDates()"> 6 months
            </label>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem;">
          <div>
            <label style="font-weight: bold;">From Date:</label><br>
            <input type="date" id="warrantyFromDate" value="${new Date().toISOString().slice(0, 10)}" onchange="updateWarrantyDates()" style="padding: 5px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div>
            <label style="font-weight: bold;">To Date:</label><br>
            <input type="date" id="warrantyToDate" readonly style="padding: 5px; border: 1px solid #ccc; border-radius: 4px; background-color: #f5f5f5;">
          </div>
        </div>
      </div>

      <div class="bill-section-title">Add Items to Bill</div>
      <div id="billItemsForm">
        <form id="itemsForm">
          <table class="bill-items-table" id="itemsTable">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Breakout</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="itemsTableBody">
              <tr class="item-row">
                <td><input type="text" class="item-desc" placeholder="e.g., Screen Replace" value=""></td>
                <td><input type="text" class="item-breakout" placeholder="e.g., Original" value=""></td>
                <td><input type="number" class="item-price" placeholder="0" value="0" min="0"></td>
                <td><input type="number" class="item-qty" placeholder="1" value="1" min="1"></td>
                <td class="item-total">0</td>
                <td><button type="button" class="btn btn-danger" onclick="removeItemRow(this)">✕</button></td>
              </tr>
            </tbody>
          </table>
          <button type="button" class="btn btn-secondary mt-10" onclick="addItemRow()">+ Add Item</button>
        </form>
      </div>

      <div class="bill-totals">
        <div>Subtotal: <strong>Rs. <span id="subtotal">0</span></strong></div>
        <div>
          Tax (%) <input type="number" id="taxPercent" value="0" min="0" step="0.01" style="width: 60px; padding: 5px;">
          Tax: <strong>Rs. <span id="taxAmount">0</span></strong>
        </div>
        <div class="bill-grand-total">
          Grand Total: Rs. <span id="grandTotal">0</span>
        </div>
      </div>

      <div class="bill-actions">
        <button class="btn btn-success" onclick="saveLaptopBill('${laptop.laptop_id}')">✓ Save Bill</button>
        <button class="btn btn-primary" onclick="printBill()">🖨 Print Bill</button>
        <button class="btn btn-secondary" onclick="generatePDF('${laptop.laptop_id}')">📄 Export PDF</button>
      </div>
      
      <script>
        setTimeout(() => {
          updateWarrantyDates();
        }, 100);
      </script>
    </div>
  `;

  billDisplayArea.innerHTML = billHTML;
  attachItemEventListeners();
  setTimeout(() => {
    updateWarrantyDates();
  }, 100);
}

function saveLaptopBill(laptopId) {
  const records = loadRecords();
  const laptopIndex = records.findIndex(r => r.laptop_id === laptopId);
  
  if (laptopIndex === -1) {
    alert('Laptop record not found');
    return;
  }

  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const item = {
      item: row.querySelector('.item-desc').value,
      breakout: row.querySelector('.item-breakout').value,
      price: parseFloat(row.querySelector('.item-price').value) || 0,
      quantity: parseInt(row.querySelector('.item-qty').value) || 1,
      total: parseFloat(row.querySelector('.item-total').textContent) || 0
    };
    items.push(item);
  });

  const subtotal = parseFloat(document.getElementById('subtotal').textContent);
  const tax = parseFloat(document.getElementById('taxAmount').textContent);
  const grandTotal = parseFloat(document.getElementById('grandTotal').textContent);
  
  const warrantyPeriod = document.querySelector('input[name="warrantyPeriod"]:checked')?.value || '3';
  const fromDate = document.getElementById('warrantyFromDate')?.value || new Date().toISOString().slice(0, 10);
  const toDate = document.getElementById('warrantyToDate')?.value || calculateWarrantyEndDate(fromDate, warrantyPeriod);

  records[laptopIndex].bill = {
    items: items,
    subtotal: subtotal,
    tax: tax,
    grand_total: grandTotal,
    warranty: warrantyPeriod,
    from_date: fromDate,
    to_date: toDate,
    saved_at: new Date().toISOString()
  };

  saveRecords(records);
  alert('✓ Laptop bill saved successfully!');
  renderRecentBills('');
  renderRecentLaptops('');
  displayLaptopBill(records[laptopIndex]);
}

function displayLaptopBill(laptop) {
  if (!laptop.bill) {
    displayLaptopBillingForm(laptop);
    return;
  }

  let billHTML = `
    <div class="bill-container">
      <div class="bill-business-header">
        <div class="business-name">MYLAVAN MOBILE SERVICE</div>
        <div class="business-info">
          Shop no. 23, New municipality complex<br>
          old bus stand, Vellore 632004<br>
          Contact: +91-7339559582
        </div>
      </div>
      <div class="bill-header">LAPTOP SERVICE BILL</div>
      
      <div class="bill-info">
        <div>Laptop Service ID: <strong>${laptop.laptop_id}</strong></div>
        <div>Date: <strong>${laptop.date}</strong></div>
        <div>Contact: <strong>${laptop.contact_number}</strong></div>
      </div>

      <div class="bill-section-title">Laptop Details</div>
      <div style="font-size: 0.9rem; line-height: 1.8;">
        Brand: ${laptop.laptop_brand} | Model: ${laptop.model}<br>
        Condition: ${laptop.condition} | Accessories: ${laptop.accessories.length > 0 ? laptop.accessories.join(', ') : 'None'}<br>
        Issue: ${laptop.issue}
      </div>

      <table class="bill-items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Breakout</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  laptop.bill.items.forEach(item => {
    billHTML += `
      <tr>
        <td>${item.item}</td>
        <td>${item.breakout}</td>
        <td>Rs. ${item.price}</td>
        <td>${item.quantity}</td>
        <td>Rs. ${item.total}</td>
      </tr>
    `;
  });

  billHTML += `
        </tbody>
      </table>

      <div class="bill-totals">
        <div>Subtotal: Rs. ${laptop.bill.subtotal.toFixed(2)}</div>
        <div>Tax: Rs. ${laptop.bill.tax.toFixed(2)}</div>
        <div class="bill-grand-total">Grand Total: Rs. ${laptop.bill.grand_total.toFixed(2)}</div>
      </div>

      <div class="bill-warranty">
        <div class="bill-section-title">WARRANTY INFORMATION</div>
        <div style="background-color: var(--color-secondary); padding: var(--space-12); border-radius: var(--radius-base); margin: var(--space-12) 0; font-size: 0.9rem; line-height: 1.8;">
          <strong>Warranty Period:</strong> ${laptop.bill.warranty === '6' ? '6 months' : '3 months'}<br>
          <strong>Valid From:</strong> ${laptop.bill.from_date}<br>
          <strong>Valid To:</strong> ${laptop.bill.to_date}
        </div>
      </div>

      <div class="bill-footer">
        <div class="bill-footer-left">
          <div style="font-weight: bold; margin-bottom: var(--space-8);">Terms &amp; Conditions:</div>
          <div style="line-height: 1.8;">
            1. Warranty void if the device is tampered.<br>
            2. No warranty on water damage.<br>
            3. Goods once sold will not be taken back.
          </div>
        </div>
        <div class="bill-footer-right">
          <div style="font-weight: bold; margin-bottom: var(--space-12);">Authorized Signature</div>
          <div class="signature-container">
            <img src="https://pplx-res.cloudinary.com/image/upload/v1759330125/pplx_project_search_images/6aae375d2d524b360fd03016f7df95541cab5f5f.png" alt="Signature" class="signature-image" />
            <div class="signature-line">Authorized Signatory</div>
          </div>
        </div>
      </div>

      <div class="bill-actions">
        <button class="btn btn-primary" onclick="printBill()">🖨 Print Bill</button>
        <button class="btn btn-secondary" onclick="editLaptopBill('${laptop.laptop_id}')">✎ Edit Bill</button>
      </div>
    </div>
  `;

  billDisplayArea.innerHTML = billHTML;
}

function editLaptopBill(laptopId) {
  const records = loadRecords();
  const laptop = records.find(r => r.laptop_id === laptopId);
  if (!laptop) {
    alert('Laptop record not found');
    return;
  }
  
  displayLaptopBillingForm(laptop);
  
  if (laptop.bill && laptop.bill.items) {
    setTimeout(() => {
      const itemsTableBody = document.getElementById('itemsTableBody');
      if (itemsTableBody) {
        itemsTableBody.innerHTML = '';
        
        laptop.bill.items.forEach(item => {
          const row = document.createElement('tr');
          row.className = 'item-row';
          row.innerHTML = `
            <td><input type="text" class="item-desc" placeholder="Item description" value="${item.item}"></td>
            <td><input type="text" class="item-breakout" placeholder="Breakout" value="${item.breakout}"></td>
            <td><input type="number" class="item-price" placeholder="0" value="${item.price}" min="0"></td>
            <td><input type="number" class="item-qty" placeholder="1" value="${item.quantity}" min="1"></td>
            <td class="item-total">${item.total}</td>
            <td><button type="button" class="btn btn-danger" onclick="removeItemRow(this)">✕</button></td>
          `;
          itemsTableBody.appendChild(row);
        });
        
        if (laptop.bill.warranty) {
          const warrantyRadios = document.querySelectorAll('input[name="warrantyPeriod"]');
          warrantyRadios.forEach(radio => {
            if (radio.value === laptop.bill.warranty) {
              radio.checked = true;
            }
          });
        }
        
        if (laptop.bill.from_date) {
          const fromDateInput = document.getElementById('warrantyFromDate');
          if (fromDateInput) fromDateInput.value = laptop.bill.from_date;
        }
        
        if (laptop.bill.to_date) {
          const toDateInput = document.getElementById('warrantyToDate');
          if (toDateInput) toDateInput.value = laptop.bill.to_date;
        }
        
        attachItemEventListeners();
        updateBillTotals();
      }
    }, 100);
  }
}

// Make functions globally accessible
window.saveLaptopBill = saveLaptopBill;
window.editLaptopBill = editLaptopBill;

// Vendor billing form display (with partial billing support)
function displayVendorBillingForm(vendor) {
  // Check if we have selected phones for partial billing
  let selectedPhoneIds = [];
  if (window.selectedPhonesForBilling && window.selectedPhonesForBilling.vendorId === vendor.vendor_id) {
    selectedPhoneIds = window.selectedPhonesForBilling.phoneIds;
  }
  
  // If no phones selected, show all unbilled phones
  if (selectedPhoneIds.length === 0) {
    selectedPhoneIds = vendor.phones.filter(p => !p.billed).map(p => p.phone_id);
  }
  
  // Get phone details for selected phones
  const selectedPhones = vendor.phones.filter(p => selectedPhoneIds.includes(p.phone_id));
  const phonesList = selectedPhones.map(phone => {
    const phoneNum = phone.phone_id.split('-')[1];
    return `${phoneNum} - ${phone.brand} ${phone.model} (${phone.issue})`;
  }).join('<br>');

  const billHTML = `
    <div class="bill-container">
      <div class="bill-business-header">
        <div class="business-name">MYLAVAN MOBILE SERVICE</div>
        <div class="business-info">
          Shop no. 23, New municipality complex<br>
          old bus stand, Vellore 632004<br>
          Contact: +91-7339559582
        </div>
      </div>
      <div class="bill-header">VENDOR SERVICE BILL</div>
      
      <div class="bill-info">
        <div>Vendor ID: <strong>${vendor.vendor_id}</strong></div>
        <div>Date: <strong>${new Date().toISOString().slice(0, 10)}</strong></div>
        <div>Vendor Name: <strong>${vendor.vendor_name}</strong></div>
        <div>Mobile: <strong>${vendor.mobile_number}</strong></div>
      </div>

      <div class="bill-section-title">Phones in This Bill</div>
      <div style="font-size: 0.9rem; line-height: 1.8; background-color: var(--color-bg-1); padding: var(--space-12); border-radius: var(--radius-base); margin: var(--space-8) 0; border: 2px solid var(--color-primary);">
        <strong style="color: var(--color-primary);">Selected Phones (${selectedPhones.length}):</strong><br>
        ${phonesList}
      </div>

      <div class="bill-section-title">Add Items to Bill</div>
      <div id="billItemsForm">
        <form id="itemsForm">
          <table class="bill-items-table" id="itemsTable">
            <thead>
              <tr>
                <th>Item Description</th>
                <th>Breakout</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody id="itemsTableBody">
              <tr class="item-row">
                <td><input type="text" class="item-desc" placeholder="e.g., Service Charge" value=""></td>
                <td><input type="text" class="item-breakout" placeholder="e.g., All Phones" value=""></td>
                <td><input type="number" class="item-price" placeholder="0" value="0" min="0"></td>
                <td><input type="number" class="item-qty" placeholder="1" value="1" min="1"></td>
                <td class="item-total">0</td>
                <td><button type="button" class="btn btn-danger" onclick="removeItemRow(this)">✕</button></td>
              </tr>
            </tbody>
          </table>
          <button type="button" class="btn btn-secondary mt-10" onclick="addItemRow()">+ Add Item</button>
        </form>
      </div>

      <div class="bill-totals">
        <div>Subtotal: <strong>Rs. <span id="subtotal">0</span></strong></div>
        <div>
          Tax (%) <input type="number" id="taxPercent" value="0" min="0" step="0.01" style="width: 60px; padding: 5px;">
          Tax: <strong>Rs. <span id="taxAmount">0</span></strong>
        </div>
        <div class="bill-grand-total">
          Grand Total: Rs. <span id="grandTotal">0</span>
        </div>
      </div>

      <input type="hidden" id="selectedPhoneIds" value='${JSON.stringify(selectedPhoneIds)}' />
      
      <div class="bill-actions">
        <button class="btn btn-success" onclick="saveVendorBill('${vendor.vendor_id}', true)">✓ Save Bill for Selected Phones</button>
        <button class="btn btn-primary" onclick="printBill()">🖨 Print Bill</button>
        <button class="btn btn-secondary" onclick="generatePDF('${vendor.vendor_id}')">📄 Export PDF</button>
      </div>
    </div>
  `;

  billDisplayArea.innerHTML = billHTML;
  attachItemEventListeners();
}

// Save vendor bill (with partial billing support)
function saveVendorBill(vendorId, isPartial = false) {
  const records = loadRecords();
  const vendorIndex = records.findIndex(r => r.vendor_id === vendorId);
  
  if (vendorIndex === -1) {
    alert('Vendor record not found');
    return;
  }

  const vendor = records[vendorIndex];
  
  // Get selected phone IDs
  const selectedPhoneIdsInput = document.getElementById('selectedPhoneIds');
  let selectedPhoneIds = [];
  if (selectedPhoneIdsInput && selectedPhoneIdsInput.value) {
    selectedPhoneIds = JSON.parse(selectedPhoneIdsInput.value);
  } else {
    // If not partial billing, include all unbilled phones
    selectedPhoneIds = vendor.phones.filter(p => !p.billed).map(p => p.phone_id);
  }
  
  if (selectedPhoneIds.length === 0) {
    alert('No phones selected for billing');
    return;
  }

  // Collect bill items
  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const item = {
      item: row.querySelector('.item-desc').value,
      breakout: row.querySelector('.item-breakout').value,
      price: parseFloat(row.querySelector('.item-price').value) || 0,
      quantity: parseInt(row.querySelector('.item-qty').value) || 1,
      total: parseFloat(row.querySelector('.item-total').textContent) || 0
    };
    items.push(item);
  });

  const subtotal = parseFloat(document.getElementById('subtotal').textContent);
  const tax = parseFloat(document.getElementById('taxAmount').textContent);
  const grandTotal = parseFloat(document.getElementById('grandTotal').textContent);
  const todayDate = new Date().toISOString().slice(0, 10);
  
  // Initialize bills array if it doesn't exist
  if (!vendor.bills) {
    vendor.bills = [];
  }
  
  // Check if we're editing an existing bill
  let billId, billNumber;
  let isEditMode = window.selectedPhonesForBilling && window.selectedPhonesForBilling.editingBillId;
  
  if (isEditMode) {
    // Edit mode: update existing bill
    billId = window.selectedPhonesForBilling.editingBillId;
    const existingBillIndex = vendor.bills.findIndex(b => b.bill_id === billId);
    
    if (existingBillIndex !== -1) {
      // Update existing bill
      vendor.bills[existingBillIndex].items = items;
      vendor.bills[existingBillIndex].subtotal = subtotal;
      vendor.bills[existingBillIndex].tax = tax;
      vendor.bills[existingBillIndex].grand_total = grandTotal;
      vendor.bills[existingBillIndex].updated_at = new Date().toISOString();
      
      // Save
      records[vendorIndex] = vendor;
      saveRecords(records);
      
      // Clear selected phones
      window.selectedPhonesForBilling = null;
      
      alert(`✓ Bill ${billId} updated successfully!`);
      renderRecentBills('');
      renderRecentVendors('');
      
      // Display the updated bill
      displayVendorBillById(vendorId, billId);
      return;
    }
  }
  
  // Create new bill
  billNumber = vendor.bills.length + 1;
  billId = generateBillID(vendorId, billNumber);
  
  const newBill = {
    bill_id: billId,
    bill_number: billId,
    date: todayDate,
    phone_ids: selectedPhoneIds,
    items: items,
    subtotal: subtotal,
    tax: tax,
    grand_total: grandTotal,
    saved_at: new Date().toISOString()
  };
  
  // Add bill to vendor
  vendor.bills.push(newBill);
  
  // Update phones - mark as billed and add bill ID
  vendor.phones.forEach(phone => {
    if (selectedPhoneIds.includes(phone.phone_id)) {
      phone.billed = true;
      phone.bill_id = billId;
      phone.status = 'Billed';
    }
  });
  
  // Save
  records[vendorIndex] = vendor;
  saveRecords(records);
  
  // Clear selected phones
  window.selectedPhonesForBilling = null;
  
  alert(`✓ Bill ${billId} created successfully for ${selectedPhoneIds.length} phone(s)!`);
  renderRecentBills('');
  renderRecentVendors('');
  
  // Display the new bill
  displayVendorBillById(vendorId, billId);
}

// Edit vendor bill by bill ID
function editVendorBill(vendorId, billId) {
  const records = loadRecords();
  const vendor = records.find(r => r.vendor_id === vendorId);
  
  if (!vendor || !vendor.bills) {
    alert('Vendor or bills not found');
    return;
  }
  
  const bill = vendor.bills.find(b => b.bill_id === billId);
  if (!bill) {
    alert('Bill not found');
    return;
  }
  
  // Close vendor modal if open
  const modal = document.querySelector('.modal-overlay.vendor-modal');
  if (modal) {
    closeModal(modal);
  }
  
  // Set selected phones for editing
  window.selectedPhonesForBilling = {
    vendorId: vendorId,
    phoneIds: bill.phone_ids,
    editingBillId: billId
  };
  
  // Small delay to ensure modal closes
  setTimeout(() => {
    showSection('billing');
    displayVendorBillingForm(vendor);
    
    // Load existing items after a short delay
    setTimeout(() => {
      const itemsTableBody = document.getElementById('itemsTableBody');
      if (itemsTableBody && bill.items) {
        // Clear existing rows
        itemsTableBody.innerHTML = '';
        
        // Add each existing item as a row
        bill.items.forEach(item => {
          const row = document.createElement('tr');
          row.className = 'item-row';
          row.innerHTML = `
            <td><input type="text" class="item-desc" placeholder="Item description" value="${item.item}"></td>
            <td><input type="text" class="item-breakout" placeholder="Breakout" value="${item.breakout}"></td>
            <td><input type="number" class="item-price" placeholder="0" value="${item.price}" min="0"></td>
            <td><input type="number" class="item-qty" placeholder="1" value="${item.quantity}" min="1"></td>
            <td class="item-total">${item.total}</td>
            <td><button type="button" class="btn btn-danger" onclick="removeItemRow(this)">✕</button></td>
          `;
          itemsTableBody.appendChild(row);
        });
        
        // Re-attach event listeners and calculate totals
        attachItemEventListeners();
        updateBillTotals();
      }
    }, 100);
    
    window.scrollTo(0, 0);
  }, 150);
}

// View vendor bill by ID
function viewVendorBillById(vendorId, billId) {
  // Find and close the vendor modal properly
  const modal = document.querySelector('.modal-overlay.vendor-modal');
  if (modal) {
    closeModal(modal);
  }
  
  // Small delay to ensure modal closes before showing bill
  setTimeout(() => {
    showSection('billing');
    displayVendorBillById(vendorId, billId);
    window.scrollTo(0, 0);
  }, 150);
}

// Print vendor bill by ID
function printVendorBillById(vendorId, billId) {
  // Find and close the vendor modal properly
  const modal = document.querySelector('.modal-overlay.vendor-modal');
  if (modal) {
    closeModal(modal);
  }
  
  // Small delay to ensure modal closes before showing bill
  setTimeout(() => {
    showSection('billing');
    displayVendorBillById(vendorId, billId);
    setTimeout(() => {
      printBill();
    }, 300);
  }, 150);
}

// Display vendor bill by ID
function displayVendorBillById(vendorId, billId) {
  const records = loadRecords();
  const vendor = records.find(r => r.vendor_id === vendorId);
  
  if (!vendor || !vendor.bills) {
    alert('Vendor or bills not found');
    return;
  }
  
  const bill = vendor.bills.find(b => b.bill_id === billId);
  if (!bill) {
    alert('Bill not found');
    return;
  }
  
  // Get phones for this bill
  const billPhones = vendor.phones.filter(p => bill.phone_ids.includes(p.phone_id));
  const phonesList = billPhones.map(phone => {
    const phoneNum = phone.phone_id.split('-')[1];
    return `${phoneNum} - ${phone.brand} ${phone.model} (${phone.issue})`;
  }).join('<br>');
  
  let billHTML = `
    <div class="bill-container">
      <div class="bill-business-header">
        <div class="business-name">MYLAVAN MOBILE SERVICE</div>
        <div class="business-info">
          Shop no. 23, New municipality complex<br>
          old bus stand, Vellore 632004<br>
          Contact: +91-7339559582
        </div>
      </div>
      <div class="bill-header">VENDOR SERVICE BILL</div>
      
      <div class="bill-info">
        <div>Bill Number: <strong>${bill.bill_number}</strong></div>
        <div>Date: <strong>${bill.date}</strong></div>
        <div>Vendor ID: <strong>${vendor.vendor_id}</strong></div>
        <div>Vendor Name: <strong>${vendor.vendor_name}</strong></div>
        <div>Mobile: <strong>${vendor.mobile_number}</strong></div>
      </div>

      <div class="bill-section-title">Phones Serviced in This Bill</div>
      <div style="font-size: 0.9rem; line-height: 1.8; background-color: var(--color-bg-1); padding: var(--space-12); border-radius: var(--radius-base); margin: var(--space-8) 0; border: 2px solid var(--color-primary);">
        <strong style="color: var(--color-primary);">Phones (${billPhones.length}):</strong><br>
        ${phonesList}
      </div>

      <table class="bill-items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Breakout</th>
            <th>Price</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  bill.items.forEach(item => {
    billHTML += `
      <tr>
        <td>${item.item}</td>
        <td>${item.breakout}</td>
        <td>Rs. ${item.price}</td>
        <td>${item.quantity}</td>
        <td>Rs. ${item.total}</td>
      </tr>
    `;
  });

  billHTML += `
        </tbody>
      </table>

      <div class="bill-totals">
        <div>Subtotal: Rs. ${bill.subtotal.toFixed(2)}</div>
        <div>Tax: Rs. ${bill.tax.toFixed(2)}</div>
        <div class="bill-grand-total">Grand Total: Rs. ${bill.grand_total.toFixed(2)}</div>
      </div>

      <div class="bill-footer">
        <div class="bill-footer-left">
          <div style="font-weight: bold; margin-bottom: var(--space-8);">Terms &amp; Conditions:</div>
          <div style="line-height: 1.8;">
            1. NO WARRANTY (B2B Service)<br>
            2. Goods once sold will not be taken back.<br>
            3. Payment due upon delivery.
          </div>
        </div>
        <div class="bill-footer-right">
          <div style="font-weight: bold; margin-bottom: var(--space-12);">Authorized Signature</div>
          <div class="signature-container">
            <img src="https://pplx-res.cloudinary.com/image/upload/v1759330125/pplx_project_search_images/6aae375d2d524b360fd03016f7df95541cab5f5f.png" alt="Signature" class="signature-image" />
            <div class="signature-line">Authorized Signatory</div>
          </div>
        </div>
      </div>

      <div class="bill-actions">
        <button class="btn btn-primary" onclick="printBill()">🖨 Print Bill</button>
        <button class="btn btn-secondary" onclick="editVendorBill('${vendorId}', '${billId}')">✎ Edit Bill</button>
        <button class="btn btn-secondary" onclick="showSection('vendors'); renderRecentVendors(''); openVendorDetailsModal('${vendorId}');">Back to Vendor</button>
      </div>
    </div>
  `;

  billDisplayArea.innerHTML = billHTML;
}

// Make functions globally accessible for inline HTML
window.updateWarrantyDates = updateWarrantyDates;
window.addItemRow = addItemRow;
window.removeItemRow = removeItemRow;
window.saveBill = saveBill;
window.saveVendorBill = saveVendorBill;
window.printBill = printBill;
window.generatePDF = generatePDF;
window.editBill = editBill;
window.editVendorBill = editVendorBill;
window.viewVendorBillById = viewVendorBillById;
window.printVendorBillById = printVendorBillById;
window.displayVendorBillById = displayVendorBillById;
window.updatePhoneStatus = updatePhoneStatus;
window.addMorePhonesToVendor = addMorePhonesToVendor;
window.createBillForCheckedPhones = createBillForCheckedPhones;

// ============================================
// INITIALIZATION
// ============================================

// CRITICAL: Run date filling as early as possible
if (document.readyState === 'loading') {
  // DOM still loading - wait for it
  document.addEventListener('DOMContentLoaded', function() {
    console.log('📋 DOM LOADED - Filling dates NOW');
    initializeDateFilling();
  });
} else {
  // DOM already ready - fill NOW
  console.log('📋 DOM ALREADY READY - Filling dates NOW');
  initializeDateFilling();
}

// Also on window load (backup)
window.addEventListener('load', function() {
  console.log('🪟 WINDOW LOADED - Filling dates again');
  fillAllDateFields();
});

// Main application initialization
window.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 APPLICATION LOADING...');
  console.log('📅 Expected date: 2025-10-28 (IST, not UTC)');
  console.log('⏰ Current IST time:', new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}));
  
  try {
    // Initialize database and load data into cache
    await initDB();
    console.log('✓ Database ready, cache loaded with', cachedRecords.length, 'records');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    alert('Warning: Database initialization failed. Data will not persist.');
  }
  
  initializeSampleData();
  
  // Initialize laptop service ID
  const records = loadRecords();
  const nextLaptopId = generateLaptopID(records);
  const laptopIdInput = document.getElementById('laptopServiceId');
  if (laptopIdInput) {
    laptopIdInput.value = nextLaptopId;
  }
  
  updateVendorDropdown();
  renderRecentServices('');
  renderRecentBills('');
  renderRecentVendors('');
  renderRecentLaptops('');
  renderAllRecords('');
  
  // Fill dates again after all rendering
  setTimeout(fillAllDateFields, 100);
  setTimeout(fillAllDateFields, 300);
  setTimeout(fillAllDateFields, 500);
  
  console.log('✅ APPLICATION READY!');
  console.log('📋 All date fields should now show: 2025-10-28');
  console.log('💾 Database status: Ready =', dbReady);
});