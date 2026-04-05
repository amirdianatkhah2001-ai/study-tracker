"""
study_tracker_pdf_watcher.py
────────────────────────────
Watches your OneDrive module folders for NEW .pptx files and auto-converts
them to PDF exactly once (only when copied/added, never on edits).

Requirements:
    pip install watchdog pywin32

Usage:
    1. Edit WATCH_FOLDERS below to match your module paths.
    2. Run:  python study_tracker_pdf_watcher.py
    3. Keep it running in the background (or add to Windows startup).

How it works:
    - Uses a SQLite database (conversions.db) to track which files have
      already been converted. A file is converted at most once.
    - Detects "new file" events only (not modifications).
    - Converts using PowerPoint COM automation (requires MS Office installed).
    - Falls back to LibreOffice if PowerPoint COM fails.
"""

import os
import time
import sqlite3
import logging
import subprocess
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
WATCH_FOLDERS = [
    r"F:\UOS\OneDrive - University of Southampton\Course\Year 0\EP",
    r"F:\UOS\OneDrive - University of Southampton\Course\Year 0\Maths",
    r"F:\UOS\OneDrive - University of Southampton\Course\Year 0\Mechanics",
    r"F:\UOS\OneDrive - University of Southampton\Course\Year 0\EE",
    r"F:\UOS\OneDrive - University of Southampton\Course\Year 0\RTS",
    r"F:\UOS\OneDrive - University of Southampton\Course\Year 0\Coursework",
    # Add more folders here as needed
]

DB_PATH   = os.path.join(os.path.dirname(__file__), "conversions.db")
LOG_PATH  = os.path.join(os.path.dirname(__file__), "pdf_watcher.log")
# ──────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)


def init_db():
    con = sqlite3.connect(DB_PATH)
    con.execute("""
        CREATE TABLE IF NOT EXISTS converted (
            path TEXT PRIMARY KEY,
            converted_at TEXT DEFAULT (datetime('now'))
        )
    """)
    con.commit()
    return con


def already_converted(con, path):
    row = con.execute("SELECT 1 FROM converted WHERE path=?", (path,)).fetchone()
    return row is not None


def mark_converted(con, path):
    con.execute("INSERT OR IGNORE INTO converted (path) VALUES (?)", (path,))
    con.commit()


def convert_pptx_to_pdf(pptx_path: str) -> bool:
    """Convert a .pptx file to PDF. Returns True on success."""
    pdf_path = str(Path(pptx_path).with_suffix(".pdf"))

    # Method 1: PowerPoint COM (Windows, requires MS Office)
    try:
        import comtypes.client
        powerpoint = comtypes.client.CreateObject("Powerpoint.Application")
        powerpoint.Visible = 1
        deck = powerpoint.Presentations.Open(pptx_path, WithWindow=False)
        deck.SaveAs(pdf_path, 32)  # 32 = ppSaveAsPDF
        deck.Close()
        powerpoint.Quit()
        log.info(f"Converted via PowerPoint COM: {pptx_path} → {pdf_path}")
        return True
    except Exception as e:
        log.warning(f"PowerPoint COM failed ({e}), trying LibreOffice...")

    # Method 2: LibreOffice (cross-platform fallback)
    try:
        out_dir = str(Path(pptx_path).parent)
        result = subprocess.run(
            ["soffice", "--headless", "--convert-to", "pdf", "--outdir", out_dir, pptx_path],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            log.info(f"Converted via LibreOffice: {pptx_path} → {pdf_path}")
            return True
        else:
            log.error(f"LibreOffice failed: {result.stderr}")
    except FileNotFoundError:
        log.error("LibreOffice (soffice) not found. Install MS Office or LibreOffice.")
    except Exception as e:
        log.error(f"LibreOffice error: {e}")

    return False


class PPTXHandler(FileSystemEventHandler):
    def __init__(self, db_con):
        self.con = db_con
        # Small delay to ensure file is fully written before converting
        self._pending = {}

    def on_created(self, event):
        if event.is_directory:
            return
        path = os.path.abspath(event.src_path)
        if path.lower().endswith(".pptx") and not os.path.basename(path).startswith("~"):
            self._schedule(path)

    def _schedule(self, path):
        """Wait 3 seconds after creation to ensure the file is fully copied."""
        import threading
        def delayed():
            time.sleep(3)
            self._process(path)
        t = threading.Thread(target=delayed, daemon=True)
        t.start()

    def _process(self, path):
        if not os.path.exists(path):
            return
        if already_converted(self.con, path):
            log.info(f"Already converted, skipping: {path}")
            return
        log.info(f"New .pptx detected: {path}")
        success = convert_pptx_to_pdf(path)
        if success:
            mark_converted(self.con, path)


def main():
    con = init_db()
    handler = PPTXHandler(con)
    observer = Observer()

    active = []
    for folder in WATCH_FOLDERS:
        if os.path.isdir(folder):
            observer.schedule(handler, folder, recursive=True)
            active.append(folder)
            log.info(f"Watching: {folder}")
        else:
            log.warning(f"Folder not found (skipping): {folder}")

    if not active:
        log.error("No valid folders to watch. Edit WATCH_FOLDERS in the script.")
        return

    observer.start()
    log.info("PDF watcher running. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
    con.close()


if __name__ == "__main__":
    main()
