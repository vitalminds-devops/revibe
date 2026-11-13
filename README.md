# ReVibe

Desktop app (Windows) that turns screenshots of technicians' chat reports into
accomplishment reports with charts.

- **Capture:** watch a mirrored phone screen and take screenshots, add screenshot files,
  or paste report text.
- **Store:** everything stays on this PC: a SQLite database and image files in
  `%APPDATA%\com.revibe.desktop\`.
- **Generate:** OCR ([ocrs](https://github.com/robertknight/ocrs)) reads each screenshot and
  Qwen2.5-0.5B-Instruct ([candle](https://github.com/huggingface/candle)) writes the report,
  locally on the CPU. Both models ship inside the installer; no internet, no AI service.
- **Report:** charts (job categories, reports per day, issue types, rectification time),
  exportable to PDF or Excel.

Built with Tauri 2: a Rust core (`src-tauri/`) and the Next.js UI (`src/`)
exported as static files.

## Install

Run `ReVibe_<version>_x64-setup.exe` (about 1 GB, most of it the AI model). Needs Windows 10/11
and about 4 GB of free RAM while generating reports.

## Use

1. **Choose a folder.** Click **New folder** and name it, e.g. "Nov 11 – Team 5".
2. **Add items**
   - **Watch screen:** mirror your phone with [scrcpy](https://github.com/Genymobile/scrcpy)
     (Android), Phone Link, or an AirPlay receiver (iPhone), click **Watch screen** and pick
     the mirror window. Click **Take screenshot** whenever a report is on screen.
   - **Add screenshots:** choose screenshot files, e.g. ones copied from a phone.
   - **Paste text:** paste a report's text; it skips OCR.
   - Select several screenshots of one long message and **Combine** them into one report.
3. **Generate:** processes every pending item, about 1–2 minutes each on the CPU. Unreadable
   items are marked **Failed** and skipped next time.
4. **Report tab:** charts and reports for the folder.
   - **Export PDF** opens the print dialog; choose **Save as PDF**.
   - **Export Excel** saves `<folder name>.xlsx` in your Downloads folder.

Review extracted names, codes, dates and generated text before using them. Rectification
charts show whether a time was recorded, not whether the job was verified as complete.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Local inference failed" | The PC is out of memory, or the installed `models\` folder is damaged: reinstall. |
| An item is **Failed** with "No readable text" | The screenshot has no readable text; crop or retake it, or paste the text instead. |
| Data location | `%APPDATA%\com.revibe.desktop\` (`revibe.db` and `images\`). Back up this folder to keep your reports. |

Building from source: see [DEVELOPMENT.md](DEVELOPMENT.md).
