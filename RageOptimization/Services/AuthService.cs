using System;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RageOptimization.Models;

namespace RageOptimization.Services
{
    public class AuthService
    {
        private static readonly HttpClient client = new HttpClient();
        
        // Configurable Firebase settings (users can set these or leave blank for local demo mode)
        public static string FirebaseProjectId = "rage-optimization"; // Set your project ID here
        private static string FirebaseAuthApiKey = "AIzaSyDGJYqtrAaHWouBGAQ5BJb4xaDlvWTQypo"; // Set your Web API Key here

        public static readonly string CurrentVersion = "1.0.0";

        private static string currentHwid = null;

        public static async Task<(bool updateAvailable, string latestVersion, string downloadUrl)> CheckForUpdatesAsync()
        {
            if (string.IsNullOrEmpty(FirebaseProjectId))
            {
                return (false, "", "");
            }

            try
            {
                string url = $"https://firestore.googleapis.com/v1/projects/{FirebaseProjectId}/databases/(default)/documents/metadata/version";
                HttpResponseMessage response = await client.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    string json = await response.Content.ReadAsStringAsync();
                    JObject doc = JObject.Parse(json);
                    JObject fields = (JObject)doc["fields"];
                    if (fields != null)
                    {
                        string latest = fields["latestVersion"]?["stringValue"]?.ToString() ?? "1.0.0";
                        string download = fields["downloadUrl"]?["stringValue"]?.ToString() ?? "";

                        if (Version.TryParse(latest, out Version serverVer) && Version.TryParse(CurrentVersion, out Version localVer))
                        {
                            if (serverVer > localVer)
                            {
                                return (true, latest, download);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Auto-updater error checking update: {ex.Message}");
            }

            return (false, "", "");
        }
        
        // Standard Base32 key compatible with Authenticator apps (Google / Microsoft)
        private static readonly string OTP_BASE32_SECRET = "RAGEOTPSECRETTSXXKEY";

        private static readonly string CacheFilePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "RageOptimization",
            "session.dat"
        );

        public static string GetHWID()
        {
            if (currentHwid != null) return currentHwid;

            string cpuId = "CPU_UNKNOWN";
            string mbId = "MB_UNKNOWN";
            string diskId = "DISK_UNKNOWN";

            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT ProcessorId FROM Win32_Processor"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        cpuId = obj["ProcessorId"]?.ToString()?.Trim() ?? "CPU_UNKNOWN";
                        break;
                    }
                }
            }
            catch { }

            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BaseBoard"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        mbId = obj["SerialNumber"]?.ToString()?.Trim() ?? "MB_UNKNOWN";
                        break;
                    }
                }
            }
            catch { }

            try
            {
                using (var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_DiskDrive"))
                {
                    foreach (var obj in searcher.Get())
                    {
                        string sn = obj["SerialNumber"]?.ToString()?.Trim();
                        if (!string.IsNullOrEmpty(sn))
                        {
                            diskId = sn;
                            break;
                        }
                    }
                }
            }
            catch { }

            string rawFingerprint = $"RAGE_{cpuId}_{mbId}_{diskId}";
            using (var sha = SHA256.Create())
            {
                byte[] hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(rawFingerprint));
                StringBuilder sb = new StringBuilder();
                foreach (byte b in hashBytes)
                {
                    sb.Append(b.ToString("x2"));
                }
                currentHwid = sb.ToString();
            }

            return currentHwid;
        }

        // --- Rotating TOTP Password System (Google Authenticator Compatible: SHA1, 30s) ---
        public static string GetCurrentAdminOtp()
        {
            long timeStep = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds / 30;
            return GenerateOtp(timeStep);
        }

        public static string GetPreviousAdminOtp()
        {
            long timeStep = ((long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds / 30) - 1;
            return GenerateOtp(timeStep);
        }

        public static bool ValidateAdminOtp(string inputOtp)
        {
            if (string.IsNullOrEmpty(inputOtp)) return false;
            long baseStep = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds / 30;
            for (int i = -3; i <= 3; i++)
            {
                if (inputOtp == GenerateOtp(baseStep + i))
                {
                    return true;
                }
            }
            return false;
        }

        private static string GenerateOtp(long timeStep)
        {
            byte[] keyBytes = Base32Decode(OTP_BASE32_SECRET);
            using (var hmac = new HMACSHA1(keyBytes))
            {
                byte[] stepBytes = BitConverter.GetBytes(timeStep);
                if (BitConverter.IsLittleEndian)
                {
                    Array.Reverse(stepBytes);
                }
                byte[] hash = hmac.ComputeHash(stepBytes);
                int offset = hash[hash.Length - 1] & 0xf;
                int binary =
                    ((hash[offset] & 0x7f) << 24) |
                    ((hash[offset + 1] & 0xff) << 16) |
                    ((hash[offset + 2] & 0xff) << 8) |
                    (hash[offset + 3] & 0xff);
                int otp = binary % 1000000;
                return otp.ToString("D6");
            }
        }

        private static byte[] Base32Decode(string base32)
        {
            base32 = base32.ToUpperInvariant().TrimEnd('=');
            if (base32.Length == 0) return new byte[0];

            int byteCount = base32.Length * 5 / 8;
            byte[] returnArray = new byte[byteCount];

            byte curByte = 0, bitsRemaining = 8;
            int mask = 0, arrayIndex = 0;

            foreach (char c in base32)
            {
                int cValue = c - 'A';
                if (cValue < 0 || cValue > 25)
                {
                    cValue = c - '2' + 26;
                    if (cValue < 26 || cValue > 31)
                    {
                        continue; // Skip invalid base32 characters
                    }
                }

                if (bitsRemaining > 5)
                {
                    mask = cValue << (bitsRemaining - 5);
                    curByte = (byte)(curByte | mask);
                    bitsRemaining -= 5;
                }
                else
                {
                    mask = cValue >> (5 - bitsRemaining);
                    curByte = (byte)(curByte | mask);
                    returnArray[arrayIndex++] = curByte;
                    curByte = (byte)((cValue << (3 + bitsRemaining)) & 0xFF);
                    bitsRemaining += 3;
                }
            }

            return returnArray;
        }

        // --- Encrypted Offline Storage Cache ---
        private static byte[] EncryptString(string plainText, string key)
        {
            byte[] keyBytes = SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(key));
            byte[] ivBytes = new byte[16];
            Array.Copy(keyBytes, ivBytes, 16);

            using (Aes aes = Aes.Create())
            {
                aes.Key = keyBytes;
                aes.IV = ivBytes;

                using (MemoryStream ms = new MemoryStream())
                {
                    using (CryptoStream cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
                    {
                        byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
                        cs.Write(plainBytes, 0, plainBytes.Length);
                        cs.FlushFinalBlock();
                    }
                    return ms.ToArray();
                }
            }
        }

        private static string DecryptString(byte[] cipherText, string key)
        {
            byte[] keyBytes = SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(key));
            byte[] ivBytes = new byte[16];
            Array.Copy(keyBytes, ivBytes, 16);

            using (Aes aes = Aes.Create())
            {
                aes.Key = keyBytes;
                aes.IV = ivBytes;

                using (MemoryStream ms = new MemoryStream())
                {
                    using (CryptoStream cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Write))
                    {
                        cs.Write(cipherText, 0, cipherText.Length);
                        cs.FlushFinalBlock();
                    }
                    return Encoding.UTF8.GetString(ms.ToArray());
                }
            }
        }

        private static void SaveOfflineCache(User user)
        {
            try
            {
                string dir = Path.GetDirectoryName(CacheFilePath);
                if (!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }

                string json = JsonConvert.SerializeObject(user);
                byte[] encryptedData = EncryptString(json, GetHWID());
                File.WriteAllBytes(CacheFilePath, encryptedData);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to save offline cache: {ex.Message}");
            }
        }

        private static User LoadOfflineCache()
        {
            try
            {
                if (!File.Exists(CacheFilePath)) return null;

                byte[] encryptedData = File.ReadAllBytes(CacheFilePath);
                string json = DecryptString(encryptedData, GetHWID());
                return JsonConvert.DeserializeObject<User>(json);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to load offline cache: {ex.Message}");
                return null;
            }
        }

        // --- Authenticate Method ---
        public static async Task<(bool success, string message, User user)> AuthenticateLicenseAsync(string username, string password, string licenseKey)
        {
            string systemHwid = GetHWID();

            // Validate rotating TOTP admin password first
            if (!string.IsNullOrEmpty(password) && ValidateAdminOtp(password))
            {
                var adminUser = new User
                {
                    Username = string.IsNullOrEmpty(username) ? "AdminOwner" : username,
                    LicenseKey = "ADMIN-DYNAMIC-SESSION",
                    HWID = systemHwid,
                    Status = "active",
                    ExpiryDate = DateTime.Now.AddDays(1),
                    IsAdmin = true
                };
                SaveOfflineCache(adminUser);
                return (true, "Dynamic Admin Session Authorized", adminUser);
            }

            // Fallback / Offline Demo Mode
            if (string.IsNullOrEmpty(FirebaseProjectId))
            {
                await Task.Delay(800);
                
                if (licenseKey.StartsWith("RAGE-") || licenseKey == "admin")
                {
                    bool isAdmin = licenseKey == "admin" || username.ToLower() == "admin";
                    var demoUser = new User
                    {
                        Username = username,
                        LicenseKey = licenseKey,
                        HWID = systemHwid,
                        Status = "active",
                        ExpiryDate = DateTime.Now.AddDays(365),
                        IsAdmin = isAdmin
                    };
                    SaveOfflineCache(demoUser);
                    return (true, "Offline License Verified (Demo Mode)", demoUser);
                }
                return (false, "Invalid License Key format in Offline Mode. Use prefix 'RAGE-' or 'admin'.", null);
            }

            // Online Verification
            try
            {
                string docUrl = $"https://firestore.googleapis.com/v1/projects/{FirebaseProjectId}/databases/(default)/documents/licenses/{licenseKey}";
                
                HttpResponseMessage response = await client.GetAsync(docUrl);
                if (!response.IsSuccessStatusCode)
                {
                    if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                    {
                        return (false, "License key not found in server records.", null);
                    }
                    return (false, $"Auth server error: {response.ReasonPhrase}", null);
                }

                string jsonContent = await response.Content.ReadAsStringAsync();
                JObject doc = JObject.Parse(jsonContent);
                JObject fields = (JObject)doc["fields"];

                if (fields == null)
                {
                    return (false, "Invalid response schema from licensing database.", null);
                }

                string dbHwid = fields["hwid"]?["stringValue"]?.ToString();
                string dbStatus = fields["status"]?["stringValue"]?.ToString() ?? "inactive";
                string dbUsername = fields["username"]?["stringValue"]?.ToString() ?? "";
                bool isAdmin = fields["isAdmin"]?["booleanValue"]?.ToObject<bool>() ?? false;
                
                string expiryString = fields["expiryDate"]?["stringValue"]?.ToString();
                DateTime expiryDate = DateTime.MinValue;
                if (!string.IsNullOrEmpty(expiryString))
                {
                    DateTime.TryParse(expiryString, out expiryDate);
                }

                if (dbStatus.ToLower() == "banned")
                {
                    return (false, "This license has been banned for policy violation.", null);
                }

                if (expiryDate != DateTime.MinValue && expiryDate < DateTime.Now)
                {
                    return (false, "This license key has expired.", null);
                }

                if (string.IsNullOrEmpty(dbHwid))
                {
                    bool bindSuccess = await BindHWIDAsync(licenseKey, systemHwid, username);
                    if (!bindSuccess)
                    {
                        return (false, "Failed to bind hardware identifier (HWID) on server.", null);
                    }
                    dbHwid = systemHwid;
                }
                else if (dbHwid != systemHwid)
                {
                    return (false, "HWID Mismatch. This key is locked to another computer.", null);
                }

                var authenticatedUser = new User
                {
                    Username = string.IsNullOrEmpty(dbUsername) ? username : dbUsername,
                    LicenseKey = licenseKey,
                    HWID = systemHwid,
                    Status = dbStatus,
                    ExpiryDate = expiryDate,
                    IsAdmin = isAdmin
                };

                SaveOfflineCache(authenticatedUser);

                return (true, "License Successfully Verified Online.", authenticatedUser);
            }
            catch (Exception ex)
            {
                var cached = LoadOfflineCache();
                if (cached != null && cached.LicenseKey == licenseKey && cached.HWID == systemHwid)
                {
                    if (cached.ExpiryDate != DateTime.MinValue && cached.ExpiryDate < DateTime.Now)
                    {
                        return (false, "Cached session expired. Connect online to renew.", null);
                    }
                    return (true, "Offline Cached License Verified successfully.", cached);
                }

                return (false, $"Network offline and no valid cache found. Error: {ex.Message}", null);
            }
        }

        private static async Task<bool> BindHWIDAsync(string licenseKey, string hwid, string username)
        {
            if (string.IsNullOrEmpty(FirebaseProjectId)) return true;

            try
            {
                string docUrl = $"https://firestore.googleapis.com/v1/projects/{FirebaseProjectId}/databases/(default)/documents/licenses/{licenseKey}?updateMask.fieldPaths=hwid&updateMask.fieldPaths=username";

                var payload = new
                {
                    fields = new
                    {
                        hwid = new { stringValue = hwid },
                        username = new { stringValue = username }
                    }
                };

                string jsonPayload = JsonConvert.SerializeObject(payload);
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
                
                var request = new HttpRequestMessage(new HttpMethod("PATCH"), docUrl) { Content = content };
                HttpResponseMessage response = await client.SendAsync(request);

                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public static async Task<bool> ResetHWIDOnlineAsync(string licenseKey)
        {
            if (string.IsNullOrEmpty(FirebaseProjectId)) return true;

            try
            {
                string docUrl = $"https://firestore.googleapis.com/v1/projects/{FirebaseProjectId}/databases/(default)/documents/licenses/{licenseKey}?updateMask.fieldPaths=hwid";

                var payload = new
                {
                    fields = new
                    {
                        hwid = new { stringValue = "" }
                    }
                };

                string jsonPayload = JsonConvert.SerializeObject(payload);
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(new HttpMethod("PATCH"), docUrl) { Content = content };
                HttpResponseMessage response = await client.SendAsync(request);

                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public static async Task<bool> CreateLicenseKeyOnlineAsync(string key, string username, int daysActive, bool isAdmin)
        {
            if (string.IsNullOrEmpty(FirebaseProjectId)) return true;

            try
            {
                string docUrl = $"https://firestore.googleapis.com/v1/projects/{FirebaseProjectId}/databases/(default)/documents/licenses/{key}";

                var payload = new
                {
                    fields = new
                    {
                        username = new { stringValue = username },
                        hwid = new { stringValue = "" },
                        status = new { stringValue = "active" },
                        expiryDate = new { stringValue = DateTime.Now.AddDays(daysActive).ToString("o") },
                        isAdmin = new { booleanValue = isAdmin }
                    }
                };

                string jsonPayload = JsonConvert.SerializeObject(payload);
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

                var request = new HttpRequestMessage(new HttpMethod("PATCH"), docUrl + "?") { Content = content };
                HttpResponseMessage response = await client.SendAsync(request);

                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public static async Task<(bool success, string message)> SendPasswordResetEmailAsync(string email)
        {
            if (string.IsNullOrEmpty(email)) return (false, "Email address cannot be empty.");

            if (string.IsNullOrEmpty(FirebaseProjectId))
            {
                await Task.Delay(1000);
                return (true, $"[Demo Mode] Password reset email simulated successfully to: {email}");
            }

            try
            {
                string url = $"https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key={FirebaseAuthApiKey}";
                
                var payload = new
                {
                    requestType = "PASSWORD_RESET",
                    email = email
                };

                string jsonPayload = JsonConvert.SerializeObject(payload);
                var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

                HttpResponseMessage response = await client.PostAsync(url, content);
                if (response.IsSuccessStatusCode)
                {
                    return (true, "Password reset email has been dispatched. Check your inbox.");
                }

                string errJson = await response.Content.ReadAsStringAsync();
                JObject doc = JObject.Parse(errJson);
                string errMsg = doc["error"]?["message"]?.ToString() ?? "Unknown Firebase error";
                
                return (false, $"Firebase Error: {errMsg}");
            }
            catch (Exception ex)
            {
                return (false, $"Failed to send reset email: {ex.Message}");
            }
        }
    }
}
