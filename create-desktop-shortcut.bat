@echo off
echo ========================================
echo  Creating Desktop Shortcut
echo ========================================
echo.

REM Get the current directory
set "SCRIPT_DIR=%~dp0"
set "VBS_FILE=%SCRIPT_DIR%launch-app.vbs"

REM Create VBScript to create shortcut
echo Set oWS = WScript.CreateObject("WScript.Shell") > CreateShortcut.vbs
echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\MYLAVAN Service App.lnk" >> CreateShortcut.vbs
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> CreateShortcut.vbs
echo oLink.TargetPath = "%VBS_FILE%" >> CreateShortcut.vbs
echo oLink.WindowStyle = 1 >> CreateShortcut.vbs
echo oLink.IconLocation = "%VBS_FILE%, 0" >> CreateShortcut.vbs
echo oLink.Description = "MYLAVAN Mobile and Laptop Service Management" >> CreateShortcut.vbs
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> CreateShortcut.vbs
echo oLink.Save >> CreateShortcut.vbs

REM Run the VBScript
cscript //nologo CreateShortcut.vbs

REM Clean up
del CreateShortcut.vbs

echo.
echo ✓ Desktop shortcut created successfully!
echo   Look for "MYLAVAN Service App" on your desktop
echo.
pause
