# MYLAVAN Service App - Local Server Version

This application has been converted to use a local Node.js/Express server with Excel as the database.

## 📁 Project Structure

```
mylavan-(V1)/
├── server.js              # Main Express server
├── package.json           # Node.js dependencies
├── app_data.xlsx          # Excel database file
├── launch-app.vbs         # ⭐ MAIN LAUNCHER (silent, no cmd window)
├── start-server.bat       # Alternative launcher (shows cmd window)
├── create-database.js     # Database initialization script
├── public/                # Frontend files
│   ├── index.html
│   ├── style.css
│   └── app.js            # Frontend JavaScript (API-enabled)
└── backups/              # Automatic backups folder
```

## 🚀 How to Run

### Method 1: Double-click `launch-app.vbs` (Recommended)
- This is the main entry point for users
- Runs silently without showing command window
- Automatically opens browser to http://localhost:3000

### Method 2: Run `start-server.bat`
- Shows the server console window
- Useful for debugging
- Keep the window open while using the app

## 📊 Excel Database

The application uses `app_data.xlsx` with the following sheets:

1. **Services** - Mobile service records
2. **Vendors** - Supplier/vendor records
3. **Laptops** - Laptop service records
4. **ChangeLog** - Tracks all data modifications

## 🔄 Features

- ✅ All CRUD operations via REST API
- ✅ Automatic monthly backups (1st of each month at 2 AM)
- ✅ Manual backup via API: `POST http://localhost:3000/api/backup`
- ✅ Change tracking in ChangeLog sheet
- ✅ Auto-opens browser on server start
- ✅ Serves static files from `public/` folder

## 🔌 API Endpoints

### Records
- `GET /api/records` - Get all records
- `GET /api/services` - Get all service records
- `GET /api/vendors` - Get all vendor records
- `GET /api/laptops` - Get all laptop records

### Create
- `POST /api/services` - Add new service
- `POST /api/vendors` - Add new vendor
- `POST /api/laptops` - Add new laptop

### Update
- `PUT /api/services/:id` - Update service
- `PUT /api/vendors/:id` - Update vendor
- `PUT /api/laptops/:id` - Update laptop

### Delete
- `DELETE /api/services/:id` - Delete service
- `DELETE /api/vendors/:id` - Delete vendor
- `DELETE /api/laptops/:id` - Delete laptop

### Utility
- `POST /api/backup` - Create manual backup
- `GET /api/changelog` - Get change history

## 💾 Backups

- **Automatic**: Monthly on the 1st at 2 AM
- **Manual**: Click "Create Backup" in app or call API
- **Location**: `backups/` folder
- **Format**: `app_data_backup_YYYY-MM-DDTHH-MM-SS.xlsx`

## 🛠️ Requirements

- Node.js (v14 or higher)
- npm (comes with Node.js)

## 📦 Dependencies

- **express**: Web server
- **xlsx**: Excel file read/write
- **open**: Auto-open browser
- **node-schedule**: Scheduled backups

## ⚙️ Configuration

### Change Server Port
Edit `server.js`:
```javascript
const PORT = 3000; // Change to your desired port
```

### Change Backup Schedule
Edit `server.js`:
```javascript
// Current: 1st of month at 2 AM
schedule.scheduleJob('0 2 1 * *', () => {
  createBackup();
});

// Examples:
// Daily at 2 AM: '0 2 * * *'
// Every hour: '0 * * * *'
// Every Sunday at 3 AM: '0 3 * * 0'
```

## 🔧 Troubleshooting

### Server won't start
1. Check if Node.js is installed: `node --version`
2. Check if port 3000 is available
3. Run `npm install` to ensure dependencies are installed

### Can't save data
1. Ensure server is running
2. Check browser console for errors
3. Verify `app_data.xlsx` is not open in Excel

### Browser doesn't open automatically
- Manually navigate to http://localhost:3000

## 📝 Development

To run in development mode:
```bash
npm start
```

To manually start:
```bash
node server.js
```

## 🔒 Security Notes

- This is a **local-only** application (localhost:3000)
- Not designed for internet/network access
- No authentication/authorization built-in
- Excel file contains all sensitive data

## 📅 Changelog

### v1.0.0 (Current)
- Converted from IndexedDB to Excel database
- Added Express REST API
- Implemented automatic backups
- Created VBS launcher for silent execution
- Added change tracking

---

**Note**: Keep the Excel file (`app_data.xlsx`) backed up separately for extra safety!
