using System;

namespace RageOptimization.Models
{
    public class User
    {
        public string Username { get; set; }
        public string LicenseKey { get; set; }
        public string HWID { get; set; }
        public string Status { get; set; } // "active", "banned", "expired"
        public DateTime ExpiryDate { get; set; }
        public bool IsAdmin { get; set; }

        public User()
        {
            Username = "";
            LicenseKey = "";
            HWID = "";
            Status = "inactive";
            ExpiryDate = DateTime.MinValue;
            IsAdmin = false;
        }
    }
}
