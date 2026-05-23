namespace RageOptimization.Models
{
    public class TweakItem
    {
        public string Name { get; set; }
        public string Category { get; set; }
        public string Description { get; set; }
        public string RiskLevel { get; set; } // "Safe", "Moderate", "High"
        public string TweakFile { get; set; } // Path to script or reg file
        public string TweakType { get; set; } // "REG", "BAT", "PS1", "INTERNAL"
        public bool IsApplied { get; set; }

        public TweakItem(string name, string category, string description, string riskLevel, string tweakFile, string tweakType)
        {
            Name = name;
            Category = category;
            Description = description;
            RiskLevel = riskLevel;
            TweakFile = tweakFile;
            TweakType = tweakType;
            IsApplied = false;
        }
    }
}
