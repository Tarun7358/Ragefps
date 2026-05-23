module.exports = {
  apps: [
    {
      name: 'ragefps-backend',
      script: 'server.js',
      cwd: 'C:\\Users\\Admin\\Downloads\\RBZ_PC_Optimizer_Project\\Backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_file: 'C:\\Users\\Admin\\Downloads\\RBZ_PC_Optimizer_Project\\Backend\\.env',
      error_file: 'C:\\Users\\Admin\\Downloads\\RBZ_PC_Optimizer_Project\\Backend\\logs\\error.log',
      out_file: 'C:\\Users\\Admin\\Downloads\\RBZ_PC_Optimizer_Project\\Backend\\logs\\out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
