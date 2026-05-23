
# RBZ PC Optimizer

Simple Windows PC optimization tool built with Python + Tkinter.

## Features
- Clear temporary files
- Flush DNS cache
- Open Windows Disk Cleanup
- Show system info

## Build EXE

1. Install Python
2. Open CMD in this folder
3. Install PyInstaller:

pip install pyinstaller

4. Build EXE:

pyinstaller --onefile --windowed main.py

5. EXE will be inside:
dist/main.exe
