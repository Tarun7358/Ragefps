using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using RageOptimization.Models;

namespace RageOptimization.Services
{
    public class TweakEngine
    {
        private static readonly string TweaksBaseDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Tweaks");
        private static readonly HttpClient client = new HttpClient();

        public static async Task SyncCloudTweaksAsync(string firebaseProjectId)
        {
            if (string.IsNullOrEmpty(firebaseProjectId))
            {
                return; // Run in local simulation/demo mode
            }

            try
            {
                string url = $"https://firestore.googleapis.com/v1/projects/{firebaseProjectId}/databases/(default)/documents/tweaks";
                HttpResponseMessage response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode) return;

                string json = await response.Content.ReadAsStringAsync();
                JObject doc = JObject.Parse(json);
                JArray documents = doc["documents"] as JArray;
                if (documents == null) return;

                foreach (var item in documents)
                {
                    var fields = item["fields"];
                    if (fields == null) continue;

                    string name = fields["name"]?["stringValue"]?.ToString();
                    string category = fields["category"]?["stringValue"]?.ToString();
                    string content = fields["content"]?["stringValue"]?.ToString();
                    string filename = fields["filename"]?["stringValue"]?.ToString();

                    if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(content) || string.IsNullOrEmpty(filename))
                        continue;

                    // Match categories to subdirectories
                    string subfolder = "Advanced";
                    string catLower = category.ToLower();
                    if (catLower.Contains("fps")) subfolder = "FPS";
                    else if (catLower.Contains("latency") || catLower.Contains("network")) subfolder = "Latency";
                    else if (catLower.Contains("free fire") || catLower.Contains("emulator")) subfolder = "FreeFire";
                    else if (catLower.Contains("power")) subfolder = "Power";

                    string destDir = Path.Combine(TweaksBaseDir, subfolder);
                    if (!Directory.Exists(destDir))
                    {
                        Directory.CreateDirectory(destDir);
                    }

                    string destFile = Path.Combine(destDir, filename);
                    await File.WriteAllTextAsync(destFile, content, Encoding.UTF8);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to sync cloud tweaks: {ex.Message}");
            }
        }

        public static void InitializeTweaks()
        {
            try
            {
                if (!Directory.Exists(TweaksBaseDir))
                {
                    Directory.CreateDirectory(TweaksBaseDir);
                }

                // Create subfolders
                string[] folders = { "FPS", "Latency", "FreeFire", "Cleaner", "Power", "Advanced" };
                foreach (var folder in folders)
                {
                    string path = Path.Combine(TweaksBaseDir, folder);
                    if (!Directory.Exists(path))
                    {
                        Directory.CreateDirectory(path);
                    }
                }

                // Write default FPS tweaks
                string fpsReg = Path.Combine(TweaksBaseDir, "FPS", "GameMode.reg");
                if (!File.Exists(fpsReg))
                {
                    File.WriteAllText(fpsReg, @"Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Microsoft\GameBar]
""AllowAutoGameMode""=dword:00000001
""AutoGameModeEnabled""=dword:00000001

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile]
""SystemResponsiveness""=dword:00000000

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile\Tasks\Games]
""GPU Priority""=dword:00000008
""Priority""=dword:00000006
""Scheduling Category""=""High""
""SFIO Priority""=""High""
", Encoding.UTF8);
                }

                // Write default Latency tweaks
                string latencyReg = Path.Combine(TweaksBaseDir, "Latency", "TCP_Latency_Tuning.reg");
                if (!File.Exists(latencyReg))
                {
                    File.WriteAllText(latencyReg, @"Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters]
""Tcp1323Opts""=dword:00000001
""TcpMaxDupAcks""=dword:00000002
""TCPNoDelay""=dword:00000001
""TCPAckFrequency""=dword:00000001

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\MSMQ\Parameters]
""TCPNoDelay""=dword:00000001
", Encoding.UTF8);
                }

                // Write default Free Fire tweaks
                string freefireBat = Path.Combine(TweaksBaseDir, "FreeFire", "EmulatorOptimize.bat");
                if (!File.Exists(freefireBat))
                {
                    File.WriteAllText(freefireBat, @"@echo off
echo Optimizing Free Fire Emulator process priority (High)...
wmic process where name=""HD-Player.exe"" CALL setpriority 128 >nul 2>&1
wmic process where name=""aow_exe.exe"" CALL setpriority 128 >nul 2>&1
wmic process where name=""LdVBoxHeadless.exe"" CALL setpriority 128 >nul 2>&1
wmic process where name=""dnplayer.exe"" CALL setpriority 128 >nul 2>&1
echo Prioritized active emulators.
", Encoding.UTF8);
                }

                // Write default Power tweaks
                string powerPs1 = Path.Combine(TweaksBaseDir, "Power", "UltimatePowerPlan.ps1");
                if (!File.Exists(powerPs1))
                {
                    File.WriteAllText(powerPs1, @"# Activate Ultimate Performance Scheme
$scheme = ""e9a42b02-d5df-448d-aa00-03f14749eb61""
powercfg -duplicatescheme $scheme 2>&1 > $null
powercfg -setactive $scheme 2>&1 > $null
Write-Host ""Ultimate Performance Power Scheme applied successfully.""
", Encoding.UTF8);
                }

                // Write default Advanced tweaks
                string advancedReg = Path.Combine(TweaksBaseDir, "Advanced", "DisableTelemetry.reg");
                if (!File.Exists(advancedReg))
                {
                    File.WriteAllText(advancedReg, @"Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows\DataCollection]
""AllowTelemetry""=dword:00000000

[HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection]
""AllowTelemetry""=dword:00000000

[HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\DiagTrack]
""Start""=dword:00000004
", Encoding.UTF8);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to initialize tweaks: {ex.Message}");
            }
        }

        public static List<TweakItem> LoadAllTweaks()
        {
            var tweaks = new List<TweakItem>();
            InitializeTweaks();

            try
            {
                // Map of folders to categories
                var categoryMap = new Dictionary<string, string>
                {
                    { "FPS", "FPS Boost" },
                    { "Latency", "Network & Latency" },
                    { "FreeFire", "Free Fire Optimization" },
                    { "Power", "Power Optimization" },
                    { "Advanced", "Advanced Tweaks" }
                };

                foreach (var kvp in categoryMap)
                {
                    string folderPath = Path.Combine(TweaksBaseDir, kvp.Key);
                    if (!Directory.Exists(folderPath)) continue;

                    string[] files = Directory.GetFiles(folderPath, "*.*");
                    foreach (var file in files)
                    {
                        string ext = Path.GetExtension(file).ToUpper();
                        string type = "";
                        if (ext == ".REG") type = "REG";
                        else if (ext == ".BAT" || ext == ".CMD") type = "BAT";
                        else if (ext == ".PS1") type = "PS1";
                        else if (ext == ".EXE") type = "EXE";
                        else continue;

                        string name = Path.GetFileNameWithoutExtension(file).Replace("_", " ");
                        string risk = (kvp.Key == "Advanced") ? "Moderate" : "Safe";
                        string desc = $"Apply system settings optimization from {Path.GetFileName(file)} for {kvp.Value}.";

                        tweaks.Add(new TweakItem(name, kvp.Value, desc, risk, file, type));
                    }
                }

                // Check and merge hacker sensi packages if present
                string sensiRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "HackerSensi");
                if (!Directory.Exists(sensiRoot))
                {
                    sensiRoot = @"C:\Users\Admin\Downloads\HACKER SENSI V1.01";
                }

                if (Directory.Exists(sensiRoot))
                {
                    ScanDirectoryRecursively(Path.Combine(sensiRoot, "1_FPS_Boost"), "FPS Boost", tweaks);
                    ScanDirectoryRecursively(Path.Combine(sensiRoot, "2_Emulators"), "Free Fire Optimization", tweaks);
                    ScanDirectoryRecursively(Path.Combine(sensiRoot, "3_Mouse_Regedits"), "Mouse Sensitivity", tweaks);
                    ScanDirectoryRecursively(Path.Combine(sensiRoot, "4_Emulator_Settings"), "Free Fire Sensi", tweaks);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error loading tweaks: {ex.Message}");
            }

            return tweaks;
        }

        public static void ScanDirectoryRecursively(string dirPath, string category, List<TweakItem> list)
        {
            if (!Directory.Exists(dirPath)) return;

            try
            {
                string[] files = Directory.GetFiles(dirPath, "*.*");
                foreach (var file in files)
                {
                    string ext = Path.GetExtension(file).ToUpper();
                    string type = "";
                    if (ext == ".REG") type = "REG";
                    else if (ext == ".BAT" || ext == ".CMD") type = "BAT";
                    else if (ext == ".PS1") type = "PS1";
                    else if (ext == ".EXE") type = "EXE";
                    else if (ext == ".TXT") type = "TXT";
                    else continue;

                    string name = Path.GetFileNameWithoutExtension(file).Replace("_", " ");
                    string risk = (category.Contains("Advanced") || name.Contains("Aim") || name.Contains("Recoil") || name.Contains("Aimbot")) ? "Moderate" : "Safe";
                    string desc = $"Apply optimization registry and configs from {Path.GetFileName(file)}.";

                    list.Add(new TweakItem(name, category, desc, risk, file, type));
                }

                string[] subdirs = Directory.GetDirectories(dirPath);
                foreach (var subdir in subdirs)
                {
                    ScanDirectoryRecursively(subdir, category, list);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error scanning directory {dirPath}: {ex.Message}");
            }
        }

        public static bool ExecuteTweak(TweakItem tweak)
        {
            if (string.IsNullOrEmpty(tweak.TweakFile) || !File.Exists(tweak.TweakFile))
            {
                return false;
            }

            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.Verb = "runas"; // Request elevation

                if (tweak.TweakType == "REG")
                {
                    psi.FileName = "reg.exe";
                    psi.Arguments = $"import \"{tweak.TweakFile}\"";
                }
                else if (tweak.TweakType == "BAT")
                {
                    psi.FileName = "cmd.exe";
                    psi.Arguments = $"/c \"{tweak.TweakFile}\"";
                }
                else if (tweak.TweakType == "PS1")
                {
                    psi.FileName = "powershell.exe";
                    psi.Arguments = $"-ExecutionPolicy Bypass -File \"{tweak.TweakFile}\"";
                }
                else if (tweak.TweakType == "EXE")
                {
                    psi.FileName = tweak.TweakFile;
                    psi.UseShellExecute = true; // Exes might need standard shell execute
                }
                else if (tweak.TweakType == "TXT")
                {
                    psi.FileName = "notepad.exe";
                    psi.Arguments = $"\"{tweak.TweakFile}\"";
                    psi.UseShellExecute = true; // Notepad handles standard files
                }
                else
                {
                    return false;
                }

                using (var process = Process.Start(psi))
                {
                    process?.WaitForExit();
                    tweak.IsApplied = true;
                    return process?.ExitCode == 0 || tweak.TweakType == "REG" || tweak.TweakType == "EXE" || tweak.TweakType == "TXT"; // REG returns 0 on success, EXE might vary, TXT is instant
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error executing tweak {tweak.Name}: {ex.Message}");
                return false;
            }
        }
    }
}
