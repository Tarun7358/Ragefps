; RAGE OPTIMIZATION INSTALLER CONFIGURATION SCRIPT
; Generated for Inno Setup Compiler
; Designed for Windows 10/11 Gaming PC Deployment

[Setup]
AppId={{D1A39D9E-4B0D-47BC-B556-FFC76BD488E8}
AppName=Rage Optimization
AppVersion=1.0.0
AppPublisher=Rage Optimization Team
AppPublisherURL=https://ragefps.in
AppSupportURL=mailto:support@ragefps.in
AppUpdatesURL=https://ragefps.in
DefaultDirName={autopf}\RageOptimization
DisableDirPage=no
DefaultGroupName=Rage Optimization
DisableProgramGroupPage=yes
LicenseFile=
InfoBeforeFile=
InfoAfterFile=
; Requires Administrator Privileges to Apply Registry Tweaks and Services
PrivilegesRequired=admin
OutputBaseFilename=RageOptimizationSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\RageOptimization\bin\Release\net8.0-windows7.0\win-x64\publish\RageOptimization.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\RageOptimization\bin\Release\net8.0-windows7.0\win-x64\publish\wpfgfx_cor3.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\RageOptimization\bin\Release\net8.0-windows7.0\win-x64\publish\PresentationNative_cor3.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\RageOptimization\bin\Release\net8.0-windows7.0\win-x64\publish\PenImc_cor3.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\RageOptimization\bin\Release\net8.0-windows7.0\win-x64\publish\D3DCompiler_47_cor3.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\RageOptimization\bin\Release\net8.0-windows7.0\win-x64\publish\vcruntime140_cor3.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "c:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\RageOptimization\bin\Release\net8.0-windows7.0\win-x64\publish\HackerSensi\*"; DestDir: "{app}\HackerSensi"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\Rage Optimization"; Filename: "{app}\RageOptimization.exe"
Name: "{autodesktop}\Rage Optimization"; Filename: "{app}\RageOptimization.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\RageOptimization.exe"; Description: "{cm:LaunchProgram,Rage Optimization}"; Flags: runascurrentuser nowait postinstall skipifsilent
