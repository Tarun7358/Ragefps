using System;
using System.Windows;
using System.Windows.Input;
using RageOptimization.Services;

namespace RageOptimization.Views
{
    public partial class LoginWindow : Window
    {
        public LoginWindow()
        {
            InitializeComponent();
            LoadHWID();
            CheckForUpdatesOnStartup();
        }

        private void LoadHWID()
        {
            try
            {
                string hwid = AuthService.GetHWID();
                HwidText.Text = hwid;
            }
            catch (Exception ex)
            {
                HwidText.Text = "Error computing HWID: " + ex.Message;
            }
        }

        private async void CheckForUpdatesOnStartup()
        {
            try
            {
                var update = await AuthService.CheckForUpdatesAsync();
                if (update.updateAvailable)
                {
                    var result = MessageBox.Show(
                        $"A new software update (v{update.latestVersion}) is available.\n\nDo you want to download and install it now to avoid running outdated software?",
                        "Rage Optimization Update",
                        MessageBoxButton.YesNo,
                        MessageBoxImage.Question
                    );

                    if (result == MessageBoxResult.Yes)
                    {
                        LoginBtn.IsEnabled = false;
                        UsernameInput.IsEnabled = false;
                        PasswordInput.IsEnabled = false;
                        LicenseInput.IsEnabled = false;
                        StatusMessage.Text = "Downloading new update package...";
                        StatusMessage.Foreground = System.Windows.Media.Brushes.Orange;

                        string tempPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "RageOptimizationSetup.exe");

                        using (var webClient = new System.Net.Http.HttpClient())
                        {
                            var bytes = await webClient.GetByteArrayAsync(update.downloadUrl);
                            System.IO.File.WriteAllBytes(tempPath, bytes);
                        }

                        StatusMessage.Text = "Launching installer and restarting...";
                        StatusMessage.Foreground = System.Windows.Media.Brushes.Green;

                        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                        {
                            FileName = tempPath,
                            UseShellExecute = true
                        });

                        Application.Current.Shutdown();
                    }
                }
            }
            catch (Exception ex)
            {
                StatusMessage.Text = "Auto-updater: " + ex.Message;
                StatusMessage.Foreground = System.Windows.Media.Brushes.Red;
            }
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

        private void HwidBorder_Click(object sender, MouseButtonEventArgs e)
        {
            try
            {
                Clipboard.SetText(HwidText.Text);
                MessageBox.Show("HWID copied to clipboard!", "Rage Optimization", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Failed to copy HWID: " + ex.Message, "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void LoginBtn_Click(object sender, RoutedEventArgs e)
        {
            string username = UsernameInput.Text.Trim();
            string password = PasswordInput.Password.Trim();
            string license = LicenseInput.Text.Trim();

            if (string.IsNullOrEmpty(username))
            {
                StatusMessage.Text = "Please enter your username.";
                return;
            }
            if (string.IsNullOrEmpty(license))
            {
                StatusMessage.Text = "Please enter your license key.";
                return;
            }

            StatusMessage.Text = "Verifying license credentials...";
            StatusMessage.Foreground = System.Windows.Media.Brushes.Gray;
            LoginBtn.IsEnabled = false;

            try
            {
                var result = await AuthService.AuthenticateLicenseAsync(username, password, license);
                
                if (result.success)
                {
                    StatusMessage.Text = result.message;
                    StatusMessage.Foreground = System.Windows.Media.Brushes.Green;

                    // Open MainWindow and pass authenticated user session
                    MainWindow main = new MainWindow(result.user);
                    main.Show();
                    this.Close();
                }
                else
                {
                    StatusMessage.Text = result.message;
                    StatusMessage.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 51, 51));
                    LoginBtn.IsEnabled = true;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.ToString(), "Login Exception Details", MessageBoxButton.OK, MessageBoxImage.Error);
                StatusMessage.Text = "Auth Service Error: " + ex.Message;
                StatusMessage.Foreground = new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 51, 51));
                LoginBtn.IsEnabled = true;
            }
        }
    }
}
