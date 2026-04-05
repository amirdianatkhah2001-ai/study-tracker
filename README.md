# 📚 Study Tracker

A personal study management web app built for **Year 0 Engineering at University of Southampton**.  
Tracks weekly progress, labs, exams, and sends Telegram reminders.

**Live site:** `https://YOUR_USERNAME.github.io/study-tracker`

---

## Features

- **Weekly tracker** — all 34 weeks on one page, click any cell to set status
- **Auto week detection** — set your term start date once, it always knows which week you're in
- **Correct % progress** — only counts weeks up to the current week
- **Lab tracking** — mark modules as "Lab", click cells to log EP3, MS2 etc. by name
- **Exam & event countdown** — days remaining, colour-coded (green → amber → red)
- **Telegram reminders** — get notified 1 week, 3 days, 1 day, 30 min before any event
- **Custom repeat reminders** — e.g. every 2 days, every 6 hours until an event
- **OneDrive folder links** — click any cell to open its OneDrive folder (PC or iPad)
- **Browser notifications** — backup to Telegram
- **Full JSON export/import** — your data is yours, portable across devices
- **Auto PDF watcher** — Python script converts new `.pptx` files to PDF automatically

---

## Deploying to GitHub Pages (do this once)

### Step 1 — Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in (or create a free account)
2. Click **+** → **New repository**
3. Name it: `study-tracker`
4. Set to **Public**
5. Do NOT initialise with README (you already have files)
6. Click **Create repository**

### Step 2 — Upload the files

On the new empty repo page, click **uploading an existing file**, then drag and drop:
- `index.html`
- `style.css`
- `app.js`
- `README.md`

Click **Commit changes**.

### Step 3 — Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages** (left sidebar)
2. Under **Source**, select **Deploy from a branch**
3. Branch: `main`, folder: `/ (root)`
4. Click **Save**
5. Wait ~60 seconds, then visit: `https://YOUR_USERNAME.github.io/study-tracker`

---

## Setting up Telegram reminders

1. Open Telegram and search for **@userinfobot**
2. Send it any message — it replies with your **Chat ID** (a number like `123456789`)
3. Open the app → **Settings** → paste your Chat ID into **Telegram Chat ID**
4. Click **Test 📨** to confirm it works

Your bot token is already built into the app.

> **Security note:** Regenerate your bot token via @BotFather (`/token`) if you share this repo publicly, then update the `TG_TOKEN` constant in `app.js`.

---

## OneDrive folders — PC vs iPad

### On your Windows PC
In Settings → each module has a **PC / Windows path** field.  
Enter your full path, e.g.:
```
F:\UOS\OneDrive - University of Southampton\Course\Year 0\EP
```
The app opens `file:///F:/UOS/.../EP/1` for Week 1, `/EP/2` for Week 2, etc.

> **Chrome required:** Edge and Firefox block `file:///` links from web pages by default.  
> In Chrome, go to `chrome://flags` → search "Allow" → enable **Allow access to local files**.  
> Or install the [Local Explorer](https://chrome.google.com/webstore/detail/local-explorer-file-manag/eokeeoejbl) Chrome extension.

### On iPad / Mac / Other devices
1. Open **OneDrive** on your device
2. Navigate to your module folder (e.g. EP)
3. Tap the **⋯ menu** → **Share** → **Copy Link** → make sure it's set to **People in your organisation**
4. Paste that URL into the **Web / iPad URL** field in Settings

Then in Settings, change **This device type** to **iPad / Mac / Other**.

### Week folder structure
The app expects your OneDrive folders to contain sub-folders named `1`, `2`, `3`... for each week:
```
EP/
  1/   ← Week 1 files
  2/   ← Week 2 files
  ...
```
If your folder structure is different, switch **Week folder mode** to **Manual** in Settings and set each week's path individually.

---

## Auto PDF from PowerPoint (`pdf_watcher.py`)

This Python script watches your OneDrive folders and converts any **new** `.pptx` to PDF automatically. It runs on your Windows PC in the background.

### Install
```bash
pip install watchdog pywin32
```

### Configure
Edit `WATCH_FOLDERS` at the top of `pdf_watcher.py` to match your paths.

### Run
```bash
python pdf_watcher.py
```

### Auto-start with Windows
1. Press `Win + R` → type `shell:startup` → press Enter
2. Create a shortcut to `pdf_watcher.py` in that folder  
   (right-click → New Shortcut → `pythonw.exe "C:\path\to\pdf_watcher.py"`)

The script uses a `conversions.db` database to ensure each file is only converted **once** — editing a `.pptx` later will NOT regenerate the PDF.

---

## Using on multiple devices

Your data is stored in each device's **localStorage**.  
To sync between devices, use **Export JSON** on one device and **Import JSON** on another.  
(Cloud sync via the app itself would require a backend server — use the export/import for now.)

---

## File structure

```
study-tracker/
├── index.html        ← Main app HTML
├── style.css         ← All styles
├── app.js            ← All logic (tracker, events, reminders, Telegram)
├── pdf_watcher.py    ← Auto PDF converter (run on Windows PC)
└── README.md         ← This file
```
