@echo off
cd /d "C:\Users\Admin\Downloads\RBZ_PC_Optimizer_Project\Backend"
pm2 resurrect
timeout /t 5
pm2 start ecosystem.config.js --no-daemon-check 2>nul
pm2 save
