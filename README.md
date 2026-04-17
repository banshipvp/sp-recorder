# SP Recorder

A macOS desktop app for practitioners to record Zoom sessions (microphone **and** system audio simultaneously) and upload them automatically to the Southern Psychologists Transcription service.

## Requirements

- macOS 12 Monterey or later (Monterey 12.3+ preferred for best ScreenCaptureKit compatibility)
- Zoom or any other conferencing app on the same Mac
- Internet access to reach the transcription service

## Installation (unsigned build)

Because this app is distributed internally without Apple notarisation, macOS will warn you the first time you open it.

1. Open the `.dmg` file and drag **SP Recorder** to your Applications folder.
2. **Do not double-click** the app icon the first time. Instead, **right-click** (or Control-click) it and choose **Open**.
3. Click **Open** in the Gatekeeper dialog.
4. On first launch you will be asked for:
   - **Microphone** access → click Allow
   - **Screen Recording** access → click Open System Preferences, tick **SP Recorder**, then come back to the app.
5. The app will remember your permissions and session on next launch.

## Usage

1. **Sign in** with your Southern Psychologists portal credentials.
2. **Search for the client** whose session you are recording.
3. Start your Zoom call as normal.
4. Click the **⏺ record button** in SP Recorder.
5. When the session ends, click **⏹ stop**. The recording uploads automatically.
6. The transcription appears in the Practice Portal under **Tools → Transcription** within a few minutes.

## Building from source

```bash
npm install
npm start                 # run in development
npm run build:mac         # build both arm64 + x64 DMGs
npm run build:mac-arm64   # Apple Silicon only
npm run build:mac-x64     # Intel only
```

## CI / Release

Pushing a tag like `v1.0.0` triggers the GitHub Actions workflow (`.github/workflows/build.yml`) which:
1. Builds both arm64 and x64 DMGs on a macOS runner.
2. Attaches them to a GitHub Release automatically.

### Updating the download links in the Practice Portal

Edit `src/app/(portal)/tools/recorder/page.tsx` in the `practice-portal` repo and replace the placeholder URLs with the real GitHub Release asset URLs once the first build is complete.
