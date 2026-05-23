
import os
import shutil
import tempfile
import subprocess
import tkinter as tk
from tkinter import messagebox

def clear_temp():
    temp_dir = tempfile.gettempdir()
    deleted = 0

    for item in os.listdir(temp_dir):
        item_path = os.path.join(temp_dir, item)
        try:
            if os.path.isfile(item_path) or os.path.islink(item_path):
                os.unlink(item_path)
                deleted += 1
            elif os.path.isdir(item_path):
                shutil.rmtree(item_path, ignore_errors=True)
                deleted += 1
        except:
            pass

    messagebox.showinfo("Done", f"Cleared {deleted} temporary files/folders.")

def flush_dns():
    try:
        subprocess.run("ipconfig /flushdns", shell=True)
        messagebox.showinfo("Done", "DNS cache flushed successfully.")
    except Exception as e:
        messagebox.showerror("Error", str(e))

def disk_cleanup():
    try:
        subprocess.run("cleanmgr", shell=True)
    except Exception as e:
        messagebox.showerror("Error", str(e))

def system_info():
    info = f"""
OS: {os.name}
User: {os.getlogin()}
Temp Folder: {tempfile.gettempdir()}
"""
    messagebox.showinfo("System Info", info)

root = tk.Tk()
root.title("RBZ PC Optimizer")
root.geometry("420x350")
root.resizable(False, False)

title = tk.Label(root, text="RBZ PC Optimizer", font=("Arial", 20, "bold"))
title.pack(pady=20)

btn1 = tk.Button(root, text="Clear Temp Files", width=30, height=2, command=clear_temp)
btn1.pack(pady=10)

btn2 = tk.Button(root, text="Flush DNS Cache", width=30, height=2, command=flush_dns)
btn2.pack(pady=10)

btn3 = tk.Button(root, text="Open Disk Cleanup", width=30, height=2, command=disk_cleanup)
btn3.pack(pady=10)

btn4 = tk.Button(root, text="System Info", width=30, height=2, command=system_info)
btn4.pack(pady=10)

footer = tk.Label(root, text="Made by Clasher", font=("Arial", 9))
footer.pack(side="bottom", pady=10)

root.mainloop()
