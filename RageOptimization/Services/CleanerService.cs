using System;
using System.IO;
using System.Threading.Tasks;

namespace RageOptimization.Services
{
    public class CleanerService
    {
        public static async Task<(long bytesDeleted, int filesDeleted)> RunSystemCleanupAsync(Action<string> statusCallback = null)
        {
            long totalBytes = 0;
            int totalFiles = 0;

            string[] paths = {
                Path.GetTempPath(), // User Temp
                @"C:\Windows\Temp",  // System Temp
                @"C:\Windows\Prefetch" // Prefetch
            };

            foreach (var path in paths)
            {
                if (!Directory.Exists(path)) continue;

                statusCallback?.Invoke($"Cleaning directory: {Path.GetFileName(path)}...");
                
                await Task.Run(() =>
                {
                    // Scan files
                    try
                    {
                        var files = Directory.GetFiles(path);
                        foreach (var file in files)
                        {
                            try
                            {
                                var fi = new FileInfo(file);
                                long len = fi.Length;
                                File.Delete(file);
                                totalBytes += len;
                                totalFiles++;
                            }
                            catch { } // Bypass locked/in-use system files
                        }
                    }
                    catch { }

                    // Scan directories
                    try
                    {
                        var dirs = Directory.GetDirectories(path);
                        foreach (var dir in dirs)
                        {
                            try
                            {
                                Directory.Delete(dir, true);
                                totalFiles++;
                            }
                            catch { }
                        }
                    }
                    catch { }
                });
            }

            // DirectX Shader Cache
            string shaderCache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\DirectX Shader Cache");
            if (Directory.Exists(shaderCache))
            {
                statusCallback?.Invoke("Clearing DirectX Shader Cache...");
                await Task.Run(() =>
                {
                    try
                    {
                        var files = Directory.GetFiles(shaderCache, "*", SearchOption.AllDirectories);
                        foreach (var file in files)
                        {
                            try
                            {
                                var fi = new FileInfo(file);
                                long len = fi.Length;
                                File.Delete(file);
                                totalBytes += len;
                                totalFiles++;
                            }
                            catch { }
                        }
                    }
                    catch { }
                });
            }

            // Flush DNS Cache
            statusCallback?.Invoke("Flushing system DNS cache...");
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo("ipconfig", "/flushdns")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                var proc = System.Diagnostics.Process.Start(psi);
                proc?.WaitForExit();
            }
            catch { }

            statusCallback?.Invoke("Cleanup completed.");
            return (totalBytes, totalFiles);
        }
    }
}
