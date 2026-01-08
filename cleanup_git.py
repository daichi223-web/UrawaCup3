
import os
import shutil
import stat

def remove_readonly(func, path, _):
    os.chmod(path, stat.S_IWRITE)
    func(path)

def clean_nested_git():
    base_dir = r"d:\UrawaCup2\UrawaCup3"
    subdirs = ["backend", "frontend"]
    
    for subdir in subdirs:
        git_dir = os.path.join(base_dir, subdir, ".git")
        if os.path.exists(git_dir):
            print(f"Removing nested git dir: {git_dir}")
            try:
                shutil.rmtree(git_dir, onerror=remove_readonly)
                print("Successfully removed.")
            except Exception as e:
                print(f"Error removing {git_dir}: {e}")
        else:
            print(f"No nested git dir found in {subdir}")

if __name__ == "__main__":
    clean_nested_git()
