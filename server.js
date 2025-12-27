const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');

// Try to load open package
let openModule;
try {
  openModule = require('open');
} catch (err) {
  console.log('⚠ "open" package not available. Browser will not auto-open.');
}

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'app_data.xlsx');
const BACKUPS_DIR = path.join(__dirname, 'backups');

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ============================================
// EXCEL DATABASE FUNCTIONS
// ============================================

/**
 * Read all records from Excel
 */
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { services: [], vendors: [], laptops: [], changelog: [] };
    }

    const workbook = XLSX.readFile(DB_FILE);
    
    // Read each sheet
    const services = XLSX.utils.sheet_to_json(workbook.Sheets['Services'] || {});
    const vendors = XLSX.utils.sheet_to_json(workbook.Sheets['Vendors'] || {});
    const laptops = XLSX.utils.sheet_to_json(workbook.Sheets['Laptops'] || {});
    const changelog = XLSX.utils.sheet_to_json(workbook.Sheets['ChangeLog'] || {});

    return { services, vendors, laptops, changelog };
  } catch (error) {
    console.error('Error reading database:', error);
    throw error;
  }
}

/**
 * Write all records to Excel
 */
function writeDatabase(data) {
  try {
    const workbook = XLSX.utils.book_new();

    // Convert arrays to sheets
    const servicesSheet = XLSX.utils.json_to_sheet(data.services || []);
    const vendorsSheet = XLSX.utils.json_to_sheet(data.vendors || []);
    const laptopsSheet = XLSX.utils.json_to_sheet(data.laptops || []);
    const changelogSheet = XLSX.utils.json_to_sheet(data.changelog || []);

    // Append sheets to workbook
    XLSX.utils.book_append_sheet(workbook, servicesSheet, 'Services');
    XLSX.utils.book_append_sheet(workbook, vendorsSheet, 'Vendors');
    XLSX.utils.book_append_sheet(workbook, laptopsSheet, 'Laptops');
    XLSX.utils.book_append_sheet(workbook, changelogSheet, 'ChangeLog');

    // Write to file
    XLSX.writeFile(workbook, DB_FILE);
    console.log('✓ Database saved successfully');
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    throw error;
  }
}

/**
 * Log changes to ChangeLog sheet
 */
function logChange(action, recordType, recordId, fieldChanged = '', oldValue = '', newValue = '') {
  try {
    const db = readDatabase();
    const changeEntry = {
      timestamp: new Date().toISOString(),
      action,
      record_type: recordType,
      record_id: recordId,
      field_changed: fieldChanged,
      old_value: String(oldValue),
      new_value: String(newValue),
      user: 'System'
    };
    
    db.changelog = db.changelog || [];
    db.changelog.push(changeEntry);
    writeDatabase(db);
  } catch (error) {
    console.error('Error logging change:', error);
  }
}

/**
 * Create backup of database
 */
function createBackup() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      console.log('No database file to backup');
      return;
    }

    // Ensure backups directory exists
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(BACKUPS_DIR, `app_data_backup_${timestamp}.xlsx`);
    
    fs.copyFileSync(DB_FILE, backupFile);
    console.log('✓ Backup created:', backupFile);
    return backupFile;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

// ============================================
// SCHEDULED TASKS
// ============================================

// Schedule monthly backups (1st of every month at 2 AM)
schedule.scheduleJob('0 2 1 * *', () => {
  console.log('🗓️ Running scheduled monthly backup...');
  createBackup();
});

// ============================================
// API ROUTES
// ============================================

/**
 * GET /api/records - Get all records
 */
app.get('/api/records', (req, res) => {
  try {
    const db = readDatabase();
    // Combine all records with record_type field
    const allRecords = [
      ...db.services.map(r => ({ ...r, record_type: 'service' })),
      ...db.vendors.map(r => ({ ...r, record_type: 'vendor' })),
      ...db.laptops.map(r => ({ ...r, record_type: 'laptop' }))
    ];
    res.json(allRecords);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read records', message: error.message });
  }
});

/**
 * GET /api/services - Get all service records
 */
app.get('/api/services', (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.services);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read services', message: error.message });
  }
});

/**
 * GET /api/vendors - Get all vendor records
 */
app.get('/api/vendors', (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.vendors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read vendors', message: error.message });
  }
});

/**
 * GET /api/laptops - Get all laptop records
 */
app.get('/api/laptops', (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.laptops);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read laptops', message: error.message });
  }
});

/**
 * POST /api/services - Add new service record
 */
app.post('/api/services', (req, res) => {
  try {
    const db = readDatabase();
    const newService = {
      ...req.body,
      id: db.services.length + 1,
      record_type: 'service',
      timestamp: new Date().toISOString()
    };
    
    db.services.push(newService);
    writeDatabase(db);
    logChange('CREATE', 'service', newService.service_id);
    
    res.json(newService);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add service', message: error.message });
  }
});

/**
 * POST /api/vendors - Add new vendor record
 */
app.post('/api/vendors', (req, res) => {
  try {
    const db = readDatabase();
    const newVendor = {
      ...req.body,
      id: db.vendors.length + 1,
      record_type: 'vendor',
      timestamp: new Date().toISOString()
    };
    
    db.vendors.push(newVendor);
    writeDatabase(db);
    logChange('CREATE', 'vendor', newVendor.vendor_id);
    
    res.json(newVendor);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add vendor', message: error.message });
  }
});

/**
 * POST /api/laptops - Add new laptop record
 */
app.post('/api/laptops', (req, res) => {
  try {
    const db = readDatabase();
    const newLaptop = {
      ...req.body,
      id: db.laptops.length + 1,
      record_type: 'laptop',
      timestamp: new Date().toISOString()
    };
    
    db.laptops.push(newLaptop);
    writeDatabase(db);
    logChange('CREATE', 'laptop', newLaptop.laptop_id);
    
    res.json(newLaptop);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add laptop', message: error.message });
  }
});

/**
 * PUT /api/services/:id - Update service record
 */
app.put('/api/services/:id', (req, res) => {
  try {
    const db = readDatabase();
    const serviceId = req.params.id;
    const index = db.services.findIndex(s => s.service_id === serviceId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const oldRecord = db.services[index];
    db.services[index] = { ...oldRecord, ...req.body };
    writeDatabase(db);
    logChange('UPDATE', 'service', db.services[index].service_id);
    
    res.json(db.services[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service', message: error.message });
  }
});

/**
 * PUT /api/vendors/:id - Update vendor record
 */
app.put('/api/vendors/:id', (req, res) => {
  try {
    const db = readDatabase();
    const vendorId = req.params.id;
    const index = db.vendors.findIndex(v => v.vendor_id === vendorId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    const oldRecord = db.vendors[index];
    db.vendors[index] = { ...oldRecord, ...req.body };
    writeDatabase(db);
    logChange('UPDATE', 'vendor', db.vendors[index].vendor_id);
    
    res.json(db.vendors[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vendor', message: error.message });
  }
});

/**
 * PUT /api/laptops/:id - Update laptop record
 */
app.put('/api/laptops/:id', (req, res) => {
  try {
    const db = readDatabase();
    const laptopId = req.params.id;
    const index = db.laptops.findIndex(l => l.laptop_id === laptopId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Laptop not found' });
    }
    
    const oldRecord = db.laptops[index];
    db.laptops[index] = { ...oldRecord, ...req.body };
    writeDatabase(db);
    logChange('UPDATE', 'laptop', db.laptops[index].laptop_id);
    
    res.json(db.laptops[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update laptop', message: error.message });
  }
});

/**
 * DELETE /api/services/:id - Delete service record
 */
app.delete('/api/services/:id', (req, res) => {
  try {
    const db = readDatabase();
    const id = parseInt(req.params.id);
    const index = db.services.findIndex(s => s.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const deleted = db.services[index];
    db.services.splice(index, 1);
    writeDatabase(db);
    logChange('DELETE', 'service', deleted.service_id);
    
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service', message: error.message });
  }
});

/**
 * DELETE /api/vendors/:id - Delete vendor record
 */
app.delete('/api/vendors/:id', (req, res) => {
  try {
    const db = readDatabase();
    const id = parseInt(req.params.id);
    const index = db.vendors.findIndex(v => v.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    const deleted = db.vendors[index];
    db.vendors.splice(index, 1);
    writeDatabase(db);
    logChange('DELETE', 'vendor', deleted.vendor_id);
    
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vendor', message: error.message });
  }
});

/**
 * DELETE /api/laptops/:id - Delete laptop record
 */
app.delete('/api/laptops/:id', (req, res) => {
  try {
    const db = readDatabase();
    const id = parseInt(req.params.id);
    const index = db.laptops.findIndex(l => l.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Laptop not found' });
    }
    
    const deleted = db.laptops[index];
    db.laptops.splice(index, 1);
    writeDatabase(db);
    logChange('DELETE', 'laptop', deleted.laptop_id);
    
    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete laptop', message: error.message });
  }
});

/**
 * POST /api/backup - Create manual backup
 */
app.post('/api/backup', (req, res) => {
  try {
    const backupFile = createBackup();
    res.json({ success: true, backup: backupFile });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create backup', message: error.message });
  }
});

/**
 * GET /api/changelog - Get change log
 */
app.get('/api/changelog', (req, res) => {
  try {
    const db = readDatabase();
    res.json(db.changelog || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read changelog', message: error.message });
  }
});

/**
 * POST /api/shutdown - Shutdown server (called when browser closes)
 */
app.post('/api/shutdown', (req, res) => {
  console.log('\n🛑 Shutdown requested by client');
  res.json({ message: 'Server shutting down...' });
  
  // Give time for response to send, then exit
  setTimeout(() => {
    console.log('👋 Goodbye!');
    process.exit(0);
  }, 500);
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('========================================');
  console.log('🚀 MYLAVAN Service App Server');
  console.log('========================================');
  console.log(`✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ Database: ${DB_FILE}`);
  console.log(`✓ Backups folder: ${BACKUPS_DIR}`);
  console.log(`✓ Monthly backups scheduled (1st of month, 2 AM)`);
  console.log('========================================');
  
  // Auto-open browser in app mode (Chrome without browser UI)
  if (openModule) {
    try {
      openModule.default(`http://localhost:${PORT}`, {
        app: {
          name: openModule.apps.chrome,
          arguments: [`--app=http://localhost:${PORT}`]
        }
      }).then(() => {
        console.log('✓ Browser opened in app mode (no browser UI)');
      }).catch(err => {
        console.log('⚠ Could not open in app mode, trying normal browser...');
        openModule.default(`http://localhost:${PORT}`).catch(e => {
          console.log('⚠ Please manually open: http://localhost:' + PORT);
        });
      });
    } catch (err) {
      console.log('⚠ Please manually open: http://localhost:' + PORT);
    }
  } else {
    console.log('⚠ Please manually open: http://localhost:' + PORT);
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});
