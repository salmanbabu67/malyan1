const XLSX = require('xlsx');
const path = require('path');

// Create initial Excel database with proper structure
const workbook = XLSX.utils.book_new();

// Sheet 1: Services (Mobile service records)
const servicesData = [
  ['service_id', 'date', 'customer_name', 'mobile_number', 'address', 'mobile_brand', 'model', 'imei1', 'imei2', 'issue', 'service_type', 'mobile_condition', 'accessories', 'front_image', 'back_image', 'received_by', 'estimated_delivery', 'bill', 'timestamp']
];
const servicesSheet = XLSX.utils.aoa_to_sheet(servicesData);
XLSX.utils.book_append_sheet(workbook, servicesSheet, 'Services');

// Sheet 2: Vendors (Supplier records with phones and bills)
const vendorsData = [
  ['vendor_id', 'vendor_name', 'mobile_number', 'created_date', 'phones', 'bills', 'timestamp']
];
const vendorsSheet = XLSX.utils.aoa_to_sheet(vendorsData);
XLSX.utils.book_append_sheet(workbook, vendorsSheet, 'Vendors');

// Sheet 3: Laptops (Laptop service records)
const laptopsData = [
  ['laptop_id', 'date', 'contact_number', 'laptop_brand', 'model', 'issue', 'condition', 'received_by', 'bill', 'timestamp']
];
const laptopsSheet = XLSX.utils.aoa_to_sheet(laptopsData);
XLSX.utils.book_append_sheet(workbook, laptopsSheet, 'Laptops');

// Sheet 4: ChangeLog (Track all modifications)
const changeLogData = [
  ['timestamp', 'action', 'record_type', 'record_id', 'field_changed', 'old_value', 'new_value', 'user']
];
const changeLogSheet = XLSX.utils.aoa_to_sheet(changeLogData);
XLSX.utils.book_append_sheet(workbook, changeLogSheet, 'ChangeLog');

// Write the file
const filePath = path.join(__dirname, 'app_data.xlsx');
XLSX.writeFile(workbook, filePath);

console.log('✓ Excel database created successfully at:', filePath);
console.log('✓ Sheets created: Services, Vendors, Laptops, ChangeLog');
