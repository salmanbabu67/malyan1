Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get the directory where this script is located
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Change to the script directory
WshShell.CurrentDirectory = scriptDir

' Start the server silently (hidden window - 0 means hidden)
WshShell.Run "cmd /c node server.js", 0, False

' Wait 3 seconds for server to start
WScript.Sleep 3000

WScript.Quit
