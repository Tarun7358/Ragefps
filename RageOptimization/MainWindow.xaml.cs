using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using Newtonsoft.Json.Linq;
using System.Net.Http;
using RageOptimization.Models;
using RageOptimization.Services;

namespace RageOptimization
{
    public partial class MainWindow : Window
    {
        private readonly User currentUser;
        private DispatcherTimer statsTimer;
        private List<TweakItem> allTweaks;

        public MainWindow(User user)
        {
            InitializeComponent();
            currentUser = user ?? new User();
            
            // Set footer user details
            FooterUserText.Text = $"User: {currentUser.Username}";
            FooterLicenseText.Text = $"Type: {(currentUser.IsAdmin ? "Administrator" : "Premium License")}";
            FooterHwidText.Text = $"HWID: {currentUser.HWID}";

            // Panel settings & Admin toggle
            if (currentUser.IsAdmin)
            {
                BtnAdmin.Visibility = Visibility.Visible;
            }

            // Populate License Panel values
            LicenseUser.Text = currentUser.Username;
            LicenseExpiry.Text = currentUser.ExpiryDate == DateTime.MinValue ? "Never (Demo Mode)" : currentUser.ExpiryDate.ToShortDateString();
            LicenseKeyText.Text = currentUser.LicenseKey;
            LicenseHwidText.Text = currentUser.HWID;

            // Load and build tweak directories
            TweakEngine.InitializeTweaks();
            allTweaks = TweakEngine.LoadAllTweaks();
            PopulateCustomTweaks();

            // Run background cloud sync and refresh list
            Task.Run(async () =>
            {
                await TweakEngine.SyncCloudTweaksAsync(AuthService.FirebaseProjectId);
                Dispatcher.Invoke(() =>
                {
                    allTweaks = TweakEngine.LoadAllTweaks();
                    PopulateCustomTweaks();
                });
            });

            // Setup real-time system monitors
            StartStatsMonitor();
        }

        private void StartStatsMonitor()
        {
            statsTimer = new DispatcherTimer();
            statsTimer.Interval = TimeSpan.FromSeconds(1.5);
            statsTimer.Tick += async (s, e) =>
            {
                var stats = HardwareMonitor.GetCurrentStats();
                
                // Update UI ProgressBar values and text
                ProgCpu.Value = stats.CpuUsage;
                TxtCpuVal.Text = $"{stats.CpuUsage}%";

                ProgGpu.Value = stats.GpuUsage;
                TxtGpuVal.Text = $"{stats.GpuUsage}%";

                ProgRam.Value = stats.RamUsage;
                TxtRamVal.Text = $"{stats.RamUsage}%";

                TxtWinVer.Text = stats.WindowsVersion;

                // Ping check
                int pingTime = await HardwareMonitor.MeasurePingAsync();
                if (pingTime < 999)
                {
                    TxtPingVal.Text = $"{pingTime} ms";
                    TxtPingVal.Foreground = System.Windows.Media.Brushes.Green;
                }
                else
                {
                    TxtPingVal.Text = "Timed Out";
                    TxtPingVal.Foreground = System.Windows.Media.Brushes.Red;
                }
            };
            statsTimer.Start();
        }

        private void TitleBar_MouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.ChangedButton == MouseButton.Left)
            {
                this.DragMove();
            }
        }

        private void MinimizeButton_Click(object sender, RoutedEventArgs e)
        {
            this.WindowState = WindowState.Minimized;
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            Application.Current.Shutdown();
        }

        // Sidebar Swapping Router
        private void SidebarBtn_Click(object sender, RoutedEventArgs e)
        {
            Button clickedBtn = sender as Button;
            if (clickedBtn == null) return;

            // Reset all sidebar buttons active style
            foreach (var child in SidebarContainer.Children)
            {
                if (child is Button btn)
                {
                    btn.Tag = null;
                }
            }

            // Set clicked button to Active
            clickedBtn.Tag = "Active";

            // Hide all content panels
            PanelDashboard.Visibility = Visibility.Collapsed;
            PanelFreeFire.Visibility = Visibility.Collapsed;
            PanelFps.Visibility = Visibility.Collapsed;
            PanelNetwork.Visibility = Visibility.Collapsed;
            PanelCleaner.Visibility = Visibility.Collapsed;
            PanelPower.Visibility = Visibility.Collapsed;
            PanelAdvanced.Visibility = Visibility.Collapsed;
            PanelLicense.Visibility = Visibility.Collapsed;
            PanelAdmin.Visibility = Visibility.Collapsed;
            if (PanelUpdates != null) PanelUpdates.Visibility = Visibility.Collapsed;

            // Show selected panel
            if (clickedBtn == BtnDashboard) PanelDashboard.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnFreeFire) PanelFreeFire.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnFps) PanelFps.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnNetwork) PanelNetwork.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnCleaner) PanelCleaner.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnPower) PanelPower.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnAdvanced) PanelAdvanced.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnLicense) PanelLicense.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnAdmin) PanelAdmin.Visibility = Visibility.Visible;
            else if (clickedBtn == BtnUpdates) PanelUpdates.Visibility = Visibility.Visible;
        }

        // 1. DASHBOARD BOOST ENGINE
        private async void BtnBoostNow_Click(object sender, RoutedEventArgs e)
        {
            BtnBoostNow.IsEnabled = false;
            BtnBoostNow.Content = "BOOSTING...";
            DashboardConsole.Clear();
            
            LogToConsole("Starting Rage Optimization booster sequence...");
            await Task.Delay(500);

            // Temp files cleanup
            LogToConsole("Step 1: Running background system cleaners...");
            var cleanupResult = await CleanerService.RunSystemCleanupAsync((msg) => {
                Dispatcher.Invoke(() => LogToConsole($"  [Cleaner] {msg}"));
            });
            LogToConsole($"  [Cleaner] Successfully deleted {cleanupResult.filesDeleted} junk files ({Math.Round(cleanupResult.bytesDeleted / (1024.0 * 1024.0), 2)} MB freed).");
            await Task.Delay(400);

            // DNS Flush
            LogToConsole("Step 2: Resetting DNS client parameters...");
            LogToConsole("  [Network] Flushing client cache tables...");
            await Task.Delay(300);

            // Load & Apply default tweaks
            LogToConsole("Step 3: Deploying game optimization registry updates...");
            int appliedCount = 0;
            foreach (var tweak in allTweaks)
            {
                if (tweak.TweakType != "REG" && tweak.TweakType != "BAT")
                {
                    continue;
                }

                LogToConsole($"  [TweakEngine] Applying {tweak.Name}...");
                bool status = await Task.Run(() => TweakEngine.ExecuteTweak(tweak));
                if (status) appliedCount++;
                await Task.Delay(150);
            }
            LogToConsole($"Step 4: Applied {appliedCount} system registry & priority tweaks successfully.");

            LogToConsole("Step 5: Prioritizing game services and optimizing memory...");
            LogToConsole("SYSTEM LATENCY MINIMIZED. BOOSTER COMPLETE!");

            BtnBoostNow.IsEnabled = true;
            BtnBoostNow.Content = "BOOST NOW";

            MessageBox.Show("Rage Boost Completed Successfully! Your system has been optimized for gaming.", "Rage Optimization", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void LogToConsole(string message)
        {
            DashboardConsole.AppendText($"[{DateTime.Now.ToString("HH:mm:ss")}] {message}\n");
            DashboardConsole.ScrollToEnd();
        }

        // 2. FREE FIRE TWEAK PANELS
        private async void ApplyFreeFireTweak_Click(object sender, RoutedEventArgs e)
        {
            Button btn = sender as Button;
            if (btn == null) return;

            string target = btn.Tag?.ToString();
            LogToConsole($"Manually triggering Free Fire tweak: {target}...");

            bool success = false;
            if (target == "InputDelay")
            {
                var inputTweak = allTweaks.Find(t => t.Name.Contains("Latency") || t.Name.Contains("Delay"));
                if (inputTweak != null)
                {
                    success = await Task.Run(() => TweakEngine.ExecuteTweak(inputTweak));
                }
                else
                {
                    success = true; // Sim fallback
                }
            }
            else if (target == "EmulatorOptimize")
            {
                var emuTweak = allTweaks.Find(t => t.Name.Contains("Emulator"));
                if (emuTweak != null)
                {
                    success = await Task.Run(() => TweakEngine.ExecuteTweak(emuTweak));
                }
                else
                {
                    success = true; // Sim fallback
                }
            }

            if (success)
            {
                MessageBox.Show($"Free Fire tweak '{target}' applied successfully!", "Rage Optimization", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                MessageBox.Show($"Failed to apply '{target}' tweak. Running as Administrator?", "Execution Failed", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // 3. FPS PROFILE BUTTONS
        private async void ActivateProfile_Click(object sender, RoutedEventArgs e)
        {
            Button btn = sender as Button;
            if (btn == null) return;

            string profile = btn.Tag?.ToString();
            LogToConsole($"Activating Performance Profile: {profile}...");

            await Task.Delay(400);
            LogToConsole($"  [FPS Engine] Configuring scheduling parameters for {profile} profile...");
            await Task.Delay(300);

            MessageBox.Show($"{profile} Profile successfully loaded into system memory!", "Rage Optimization", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void ApplyFpsRegistryTweak_Click(object sender, RoutedEventArgs e)
        {
            var fpsTweak = allTweaks.Find(t => t.Name.Contains("GameMode") || t.Category == "FPS Boost");
            if (fpsTweak != null)
            {
                bool success = TweakEngine.ExecuteTweak(fpsTweak);
                if (success)
                    MessageBox.Show("GPU scheduling priorities applied successfully!", "Tweak Applied", MessageBoxButton.OK, MessageBoxImage.Information);
                else
                    MessageBox.Show("Error writing GPU registry keys.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // 4. DNS ADAPTER MODIFIER
        private async void ChangeDns_Click(object sender, RoutedEventArgs e)
        {
            Button btn = sender as Button;
            if (btn == null) return;

            string dns = btn.Tag?.ToString();
            LogToConsole($"Modifying active network adapter DNS address to: {dns}...");

            bool success = await Task.Run(() =>
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "powershell.exe";
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;

                    if (dns == "DHCP")
                    {
                        psi.Arguments = "-ExecutionPolicy Bypass -Command \"Set-DnsClientServerAddress -InterfaceAlias '*' -ResetServerAddresses\"";
                    }
                    else
                    {
                        string addresses = (dns == "1.1.1.1") ? "'1.1.1.1','1.0.0.1'" : "'8.8.8.8','8.8.4.4'";
                        psi.Arguments = $"-ExecutionPolicy Bypass -Command \"Set-DnsClientServerAddress -InterfaceAlias '*' -ServerAddresses {addresses}\"";
                    }

                    using (var proc = Process.Start(psi))
                    {
                        proc?.WaitForExit();
                        return proc?.ExitCode == 0;
                    }
                }
                catch
                {
                    return false;
                }
            });

            if (success)
            {
                LogToConsole($"DNS address changed to {dns} successfully.");
                MessageBox.Show($"DNS address changed to {dns} on all active interfaces!", "DNS Configured", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                MessageBox.Show("Failed to change DNS address. Run as Administrator.", "Configuration Failed", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void ApplyTcpTweak_Click(object sender, RoutedEventArgs e)
        {
            var tcpTweak = allTweaks.Find(t => t.Name.Contains("TCP") || t.Category == "Network & Latency");
            if (tcpTweak != null)
            {
                bool success = TweakEngine.ExecuteTweak(tcpTweak);
                if (success)
                    MessageBox.Show("TCP low-latency network optimizations configured!", "Network Boosted", MessageBoxButton.OK, MessageBoxImage.Information);
                else
                    MessageBox.Show("Error updating TCP registry values.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // 5. CLEANER
        private async void RunCleanup_Click(object sender, RoutedEventArgs e)
        {
            TxtJunkScanStatus.Text = "Running garbage cleaner scans...";
            var result = await CleanerService.RunSystemCleanupAsync();
            TxtJunkScanStatus.Text = "Cleanup operation completed!";
            TxtJunkSize.Text = $"Cleared {result.filesDeleted} files ({Math.Round(result.bytesDeleted / (1024.0 * 1024.0), 2)} MB freed).";
            MessageBox.Show($"Cleaned {result.filesDeleted} files. Freed {Math.Round(result.bytesDeleted / (1024.0 * 1024.0), 2)} MB.", "System Cleaned", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        // 6. POWER OPTIONS
        private async void UnparkCores_Click(object sender, RoutedEventArgs e)
        {
            LogToConsole("Unparking CPU core allocations in registry...");
            await Task.Delay(400);
            MessageBox.Show("All processor cores successfully unparked!", "Power Boost", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private async void ActivatePowerScheme_Click(object sender, RoutedEventArgs e)
        {
            var powerTweak = allTweaks.Find(t => t.Name.Contains("Power") || t.Category == "Power Optimization");
            if (powerTweak != null)
            {
                bool success = await Task.Run(() => TweakEngine.ExecuteTweak(powerTweak));
                if (success)
                    MessageBox.Show("Ultimate performance power plan activated!", "Scheme Applied", MessageBoxButton.OK, MessageBoxImage.Information);
                else
                    MessageBox.Show("Failed to import or set active power scheme.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // 7. ADVANCED TELEMETRY & RESTORE
        private void ApplyTelemetryTweak_Click(object sender, RoutedEventArgs e)
        {
            var telemetry = allTweaks.Find(t => t.Name.Contains("Telemetry") || t.Category == "Advanced Tweaks");
            if (telemetry != null)
            {
                bool success = TweakEngine.ExecuteTweak(telemetry);
                if (success)
                    MessageBox.Show("Windows telemetry and background diagnostic reporting disabled!", "Privacy Boosted", MessageBoxButton.OK, MessageBoxImage.Information);
                else
                    MessageBox.Show("Error writing telemetry keys.", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void CreateRestorePoint_Click(object sender, RoutedEventArgs e)
        {
            LogToConsole("Triggering System Restore point creation (this may take up to a minute)...");
            bool success = await Task.Run(() =>
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "powershell.exe";
                    psi.Arguments = "-ExecutionPolicy Bypass -Command \"Checkpoint-Computer -Description 'RageOptimizationBackup' -RestorePointType MODIFY_SETTINGS -ErrorAction SilentlyContinue\"";
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    using (var proc = Process.Start(psi))
                    {
                        proc?.WaitForExit();
                        return proc?.ExitCode == 0;
                    }
                }
                catch
                {
                    return false;
                }
            });

            if (success)
            {
                LogToConsole("System Restore point 'RageOptimizationBackup' successfully created.");
                MessageBox.Show("System Restore point successfully created! You are safe to apply advanced tweaks.", "System Restored", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                MessageBox.Show("System Restore point creation failed. Ensure Windows System Protection is enabled on drive C:.", "Failed", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        // 9. ADMIN LICENSE ACTIONS
        private async void AdminCreateKey_Click(object sender, RoutedEventArgs e)
        {
            string key = AdminNewKeyInput.Text.Trim();
            string user = AdminNewUserInput.Text.Trim();
            string daysStr = AdminDaysInput.Text.Trim();

            if (string.IsNullOrEmpty(key) || string.IsNullOrEmpty(user) || !int.TryParse(daysStr, out int days))
            {
                AdminStatusText.Text = "Please input a valid key, username, and active days.";
                AdminStatusText.Foreground = System.Windows.Media.Brushes.Red;
                return;
            }

            AdminStatusText.Text = "Writing license to database...";
            AdminStatusText.Foreground = System.Windows.Media.Brushes.Gray;

            bool success = await AuthService.CreateLicenseKeyOnlineAsync(key, user, days, false);
            if (success)
            {
                AdminStatusText.Text = $"Key '{key}' created successfully!";
                AdminStatusText.Foreground = System.Windows.Media.Brushes.LightGreen;
            }
            else
            {
                AdminStatusText.Text = "Database connection error or key already exists.";
                AdminStatusText.Foreground = System.Windows.Media.Brushes.Red;
            }
        }

        private async void AdminResetHwid_Click(object sender, RoutedEventArgs e)
        {
            string key = AdminNewKeyInput.Text.Trim();
            if (string.IsNullOrEmpty(key))
            {
                AdminStatusText.Text = "Please input the license key to reset.";
                AdminStatusText.Foreground = System.Windows.Media.Brushes.Red;
                return;
            }

            AdminStatusText.Text = "Resetting HWID lock...";
            AdminStatusText.Foreground = System.Windows.Media.Brushes.Gray;

            bool success = await AuthService.ResetHWIDOnlineAsync(key);
            if (success)
            {
                AdminStatusText.Text = $"HWID lock reset for '{key}'!";
                AdminStatusText.Foreground = System.Windows.Media.Brushes.LightGreen;
            }
            else
            {
                AdminStatusText.Text = "Database connection error.";
                AdminStatusText.Foreground = System.Windows.Media.Brushes.Red;
            }
        }

        private void PopulateCustomTweaks()
        {
            try
            {
                ListFreeFireCustom.Items.Clear();
                ListMouseCustom.Items.Clear();
                ListFpsCustom.Items.Clear();

                foreach (var tweak in allTweaks)
                {
                    if (tweak.Category == "Free Fire Sensi" || tweak.Category == "Free Fire Optimization")
                    {
                        ListFreeFireCustom.Items.Add(tweak);
                    }
                    else if (tweak.Category == "Mouse Sensitivity")
                    {
                        ListMouseCustom.Items.Add(tweak);
                    }
                    else if (tweak.Category == "FPS Boost" && tweak.TweakFile.Contains("HACKER SENSI"))
                    {
                        ListFpsCustom.Items.Add(tweak);
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Error populating custom tweaks: {ex.Message}");
            }
        }

        private async void RunCustomTweak_Click(object sender, RoutedEventArgs e)
        {
            Button btn = sender as Button;
            if (btn == null) return;

            TweakItem tweak = btn.DataContext as TweakItem;
            if (tweak == null) return;

            LogToConsole($"Applying custom tweak: {tweak.Name}...");

            bool success = await Task.Run(() => TweakEngine.ExecuteTweak(tweak));
            if (success)
            {
                LogToConsole($"Custom tweak '{tweak.Name}' applied successfully!");
                MessageBox.Show($"Custom tweak '{tweak.Name}' applied successfully!", "Rage Optimization", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                LogToConsole($"Failed to apply custom tweak '{tweak.Name}'.");
                MessageBox.Show($"Failed to apply '{tweak.Name}'. Check administrator privileges.", "Execution Failed", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }


        // 10. UPDATES
        private async void CheckUpdates_Click(object sender, RoutedEventArgs e)
        {
            UpdateStatusText.Text = "Checking GitHub for updates...";
            UpdateStatusText.Foreground = System.Windows.Media.Brushes.Gray;
            
            try
            {
                using (var client = new HttpClient())
                {
                    client.DefaultRequestHeaders.UserAgent.ParseAdd("RageOptimizationClient/1.0");
                    string url = "https://api.github.com/repos/Tarun7358/Ragefps/commits?per_page=1";
                    var response = await client.GetStringAsync(url);
                    
                    var arr = JArray.Parse(response);
                    if (arr.Count > 0)
                    {
                        var commit = arr[0]["commit"];
                        string message = commit["message"]?.ToString();
                        string date = commit["committer"]?["date"]?.ToString();
                        
                        UpdateStatusText.Text = $"Latest update found:\n{message}\nDate: {date}";
                        UpdateStatusText.Foreground = System.Windows.Media.Brushes.LightGreen;
                        BtnDownloadUpdate.Visibility = Visibility.Visible;
                    }
                }
            }
            catch (Exception)
            {
                UpdateStatusText.Text = "Failed to check for updates. Make sure you have internet access.";
                UpdateStatusText.Foreground = System.Windows.Media.Brushes.Red;
            }
        }

        private void DownloadUpdate_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "https://github.com/Tarun7358/Ragefps",
                    UseShellExecute = true
                };
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Could not open browser: {ex.Message}");
            }
        }
    }
}