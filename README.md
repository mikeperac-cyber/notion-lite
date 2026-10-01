# Notion Lite

A local workspace for Windows built with Electron, Next.js, TipTap, Prisma, and SQLite. Pages, databases, attachments, backups, and settings live on your computer.

## Run from source

Use Node.js 20 or newer on Windows.

```powershell
npm ci
npx prisma generate
npx prisma db push
npm run desktop
```

Set `DATABASE_URL=file:./dev.db` in a local `.env` file for development. `.env` and all SQLite files are ignored by Git. The production build creates a clean database template and copies it to the app data folder on first launch.

## Build and install

```powershell
npm run electron:build:prod
```

Install the versioned `dist-electron/Notion Lite Setup *.exe`. The installer adds Desktop and Start Menu shortcuts. The app also refreshes `Notion Lite.lnk` in the Windows Desktop and OneDrive Desktop folders on launch, using the running executable's actual location. The unpacked and portable executables are for testing; use the installer for normal use.

Workspace data is stored in the Windows user data folder for Notion Lite. Open **Settings** to see the exact folder, choose the theme and close behavior, import Markdown, and create or restore a backup. Closing the window hides it in the tray by default; choose **Quit** from the tray or **Exit Notion Lite** from the File menu to stop it. `Ctrl+Alt+Space` reveals Search while the window is hidden.

## Pages and notes

Use the visible **Delete** button in a page header or the trash icon beside a page in the sidebar to move it to Trash. Trash can restore pages. In the editor, type `/` to open commands, then use the arrow keys and Enter to choose a block. The **Link to Page** command inserts an internal link; linked pages list their backlinks. The page organization panel also lets you nest a page in a notebook, add tags, and create tasks with optional due times. The sidebar can filter pages by tag. When the Windows app is running, due tasks raise a desktop notification that opens their page.

The template gallery includes Sprint Tracker, an architecture RFC, Meeting Notes, and five productivity starters: Project Planner, Daily Planner, Weekly Review, Habit Tracker, and Reading List. Document templates seed editable blocks; database templates seed properties and useful views.

Backups are versioned ZIP files with a consistent SQLite snapshot, local image attachments, and a manifest. Restore validates the archive and saves the previous workspace in a `rollback-*` folder before restarting. Page export supports Markdown, HTML, and JSON. Markdown and HTML export copy referenced local images into an adjacent assets folder.

## AI providers

In **Settings**, select Gemini, OpenAI, Anthropic, OpenRouter, OpenCode Zen, or NVIDIA NIM, enter the provider's model ID, and save an API key. The key is stored in Windows Credential Manager through `keytar`, not in the workspace database or backups. AI actions return an error when no key or model is configured and show their result before it is inserted into a page.

## Releases

The Windows release workflow builds signed NSIS installers on `v*` tags and publishes through GitHub Releases. Configure repository secrets `CSC_LINK` (certificate file or encoded certificate) and `CSC_KEY_PASSWORD` before tagging a release. Local builds are unsigned and do not publish updates. An installed build checks GitHub Releases for updates; user data remains in the app data folder across installer upgrades.

## Checks

```powershell
npm run lint
npx tsc --noEmit
npm run build
node scripts/prepare-standalone.js
node scripts/smoke-api.mjs
```

The smoke test starts the standalone server against a temporary copy of the clean database and checks rich block persistence, search, history, snapshot backup, relations, rollups, links, tags, reminders, notebook moves, and Trash.
