# Developing ReVibe

## Prerequisites (Windows)

- Node.js 24+
- Rust (`winget install Rustlang.Rustup`)
- Visual Studio 2022 Build Tools with the C++ workload
  (`winget install Microsoft.VisualStudio.2022.BuildTools --override "--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`)
- The model files in `src-tauri/models/` (not in Git, ~1 GB):

  ```
  models/
    text-detection.onnx      https://ocrs-models.s3-accelerate.amazonaws.com/text-detection.onnx
    text-recognition.onnx    https://ocrs-models.s3-accelerate.amazonaws.com/text-recognition.onnx
    qwen/                    from https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct
      config.json
      model.safetensors
      tokenizer.json
      LICENSE
  ```

## Run and build

In the repo root:

```powershell
npm ci
npm run dev       # opens the app window; UI edits reload live, Rust edits rebuild the app
npm run build     # installer: src-tauri/target/release/bundle/nsis/ReVibe_<version>_x64-setup.exe
```

The app only runs as the desktop window: the UI calls the Rust core through Tauri, so opening
the dev server in a browser shows nothing useful. In dev the models load from
`src-tauri/target/debug/models/` (copied on build). Report generation is much slower in a debug
build; use `npm run build` to judge speed.

## Checks

| Check | Command |
|---|---|
| Rust unit tests (in `src-tauri/`) | `cargo test --release` |
| Real-model check on `sample.png`, about 2 minutes | `cargo test --release -- --ignored --nocapture` |
| UI tests and lint | `npm test`, `npm run lint` |

## Project structure

The Rust side is layered; each layer calls only the ones below it.

```
src/                        Next.js UI, exported to static files bundled into the app
  lib/api.ts                typed calls to the Rust commands (Tauri invoke)
src-tauri/src/
  lib.rs                    app wiring: state, command registration
  commands/                 Tauri API: unpack arguments, call a service, shape the answer
    folders.rs  screenshots.rs  reports.rs
  services/                 rules: validation, must-exist lookups, multi-step operations
    folders.rs  screenshots.rs  reports.rs
  db/                       SQLite: schema (mod.rs) and one module of queries per table
  storage.rs                image files under the app data folder
  inference/                local AI: parser.rs (text -> fields), ocr.rs, llm.rs, mod.rs (pipeline)
  excel.rs                  Excel export
  domain.rs  error.rs  state.rs   shared types, the error commands return, app state
src-tauri/tauri.conf.json   window, bundled models/, asset protocol for the image files
```

App data (database and images) lives in `%APPDATA%\com.revibe.desktop\`.
