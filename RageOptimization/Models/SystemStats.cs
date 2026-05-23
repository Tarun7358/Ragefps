namespace RageOptimization.Models
{
    public class SystemStats
    {
        public double CpuUsage { get; set; }
        public double GpuUsage { get; set; }
        public double RamUsage { get; set; }
        public double DiskUsage { get; set; }
        public int Ping { get; set; }
        public string WindowsVersion { get; set; }
        public int ActiveTweaksCount { get; set; }
        public int PerformanceScore { get; set; }

        public SystemStats()
        {
            CpuUsage = 0;
            GpuUsage = 0;
            RamUsage = 0;
            DiskUsage = 0;
            Ping = 0;
            WindowsVersion = "Windows 10/11";
            ActiveTweaksCount = 0;
            PerformanceScore = 70;
        }
    }
}
