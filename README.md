# Serie A Registration Workbook

Excel-style Serie A squad registration planner with a free lineup board.

## Install

```powershell
npm install
```

## Browser preview

```powershell
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173/`.

## Electron preview

```powershell
npm run electron
```

## Build Windows installer

```powershell
npm run dist
```

The installer is created in `dist-electron/`.

## Notes

- The Sheet tab is the registration source of truth.
- The Lineup Board uses only players who are `REG` and have player name, DOB, and nationality.
- Manual blank rows start as `OUT`, so they do not appear on the lineup board until completed and registered.
- Built files and installers should not be committed to GitHub.
