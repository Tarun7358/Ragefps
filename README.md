# Rage Optimization Suite

Rage Optimization is a premium, esports-focused Windows PC performance optimization, latency reduction, and booster utility packaged as a secure, licensed desktop platform. 

---

## 🚀 Key Master Features

*   **Cyberpunk Gaming UI:** Custom dark borderless WPF window styled with neon crimson accents, custom-designed templates, and responsive sidebar navigation views.
*   **Booster Engine:** Cleans system caches (Prefetch, user/system temp directories, DirectX shaders), resets DNS parameters, and applies advanced performance registry tweaks in parallel on demand.
*   **Dynamic Admin Passcode (TOTP):** Features a rotating master passcode changing every 20 seconds. Synchronized cryptographically via RFC-6238 HMAC-SHA256 standards between the client and web panel.
*   **Encrypted Offline Cache:** Supports cached authentication. When logged in online once, session metadata is encrypted locally using the unique machine hardware fingerprint as the key. This prevents registry tampering, user token sharing, or manual bypass attempts on other systems.
*   **Admin Control Panel:** Fully operational dark-themed React + Vite panel displaying current rotating access keys, client stats, and administrative license controls (creating keys, hardware un-binding, and banning).

---

## 📂 Project Architecture

```
RBZ_PC_Optimizer_Project/
│
├── RageOptimization/               # WPF Desktop Suite (.NET 8.0)
│   ├── App.xaml / App.xaml.cs      # Core Design Resources & Entrypoint
│   ├── MainWindow.xaml / .cs       # Dashboard & View Modules Router
│   ├── Models/                     # Data Objects (User, SystemStats, TweakItem)
│   ├── Services/
│   │   ├── AuthService.cs          # Encrypted Session Cache & TOTP Keys
│   │   ├── TweakEngine.cs          # Registry Tweaks, PowerShell & Bat Executors
│   │   ├── CleanerService.cs       # Temporary directory garbage cleanup
│   │   └── HardwareMonitor.cs      # WMI Telemetry (CPU, GPU, RAM, Latency)
│   └── Views/
│       └── LoginWindow.xaml / .cs  # Security Gateway & Clipboard HWID Fingerprint
│
├── AdminPanel/                     # React + Vite Admin Dashboard
│   ├── src/App.jsx                 # Web Crypto TOTP Generator & Controls
│   ├── src/index.css               # Gaming Dashboard Visual Styles
│   └── package.json
│
├── installer.iss                   # Inno Setup Installation Compiler
└── README.md
```

---

## 🛠️ Getting Started & Launching

### 1. Running the WPF Client
The desktop client is pre-compiled into a standalone, self-contained single-file executable that bundles the .NET runtime:
*   **Path:** `RageOptimization/bin/Release/net8.0-windows7.0/win-x64/publish/RageOptimization.exe`
*   No runtime prerequisites are required.

To run the codebase in development:
```powershell
cd RageOptimization
dotnet run
```

### 2. Launching the React Admin Panel
The admin dashboard runs on Vite:
```bash
cd AdminPanel
npm install
npm run dev
```

### 3. Compiling the Setup Installer
1. Install **Inno Setup** compiler on Windows.
2. Open `installer.iss`.
3. Click **Compile** to package the published single-file client into an installer wizard (`RageOptimizationSetup.exe`).

---

## 🔒 Master Security Access Credentials
When Firebase database settings are not configured, the app runs in secure offline demo mode:
*   **Username:** Any string
*   **Password:** Any string OR input the active 6-digit **Dynamic TOTP Key** visible on the Admin Web Panel to log in as administrator.
*   **License Key:** `RAGE-DEMO-EXPRESS` (or any string beginning with `RAGE-`) or `admin` to open the admin view.
