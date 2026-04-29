# Serie A Registration Workbook

A browser-based squad registration simulator for Serie A clubs.

The app helps users review squad registration rules, edit squad lists, mark players as registered or not listed, and build a free-form lineup board using only registered players.

Live site: https://serie-a-registration-simulator.vercel.app/

## Features

- Serie A squad workbook interface
- Excel-style editable squad table
- Club selector for all Serie A teams
- Registration status toggle: `REG` / `OUT`
- Player eligibility flags:
  - Club-trained
  - Italy-trained / homegrown
  - Non-EU / non-EEA
  - Arriving from abroad
  - Manual review
- Automatic registration rule checks
- Player pool search and add-to-sheet flow
- Manual player row creation
- Free-form lineup board
- Bench section for available registered players
- Drag-and-drop lineup placement
- Static web deployment support
- Electron desktop build support

## Registration Logic

The simulator currently checks:

- Maximum 25 senior registered players
- Maximum 17 non-homegrown senior players
- Minimum 4 club-trained senior players
- Minimum 8 Italy-trained / homegrown senior players
- U23 players are exempt from the senior list
- Non-EU arrivals from abroad are flagged for manual review

The app treats the sheet as the source of truth.

Only players marked as `REG` are counted in registration checks and made available for the lineup board.

## Column Guide

| Column | Meaning |
|---|---|
| `REG` | Player is registered and counts in the squad list |
| `OUT` | Player exists in the sheet but does not count in the registration list |
| `Club` | Player counts as club-trained |
| `Italy` | Player counts as Italy-trained / homegrown |
| `Non-EU` | Player is non-EU / non-EEA |
| `Abroad` | Player arrived from abroad during the transfer window |
| `Review` | Player needs manual eligibility review |

## Lineup Board

The lineup board uses only players who are:

- marked as `REG`
- assigned a name
- assigned a date of birth
- assigned a nationality

Players can be dragged from the bench onto the board and moved freely.

There is no fixed formation system.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Electron
- electron-builder
- Vercel

## Local Development

Install dependencies:

```bash
npm install
```

Run the web app locally:

```bash
npm run dev
```

Open:

```txt
http://127.0.0.1:5173/
```

## Build for Web

```bash
npm run build
```

The production static build is created in:

```txt
dist/
```

## Build Desktop App

To build a Windows `.exe` installer:

```bash
npm run dist
```

The installer is created in:

```txt
dist-electron/
```

If the build fails with an `EBUSY` error, close any running app window and delete the previous `dist-electron` folder before rebuilding.

## Deployment

This project can be deployed as a static Vite app.

Recommended Vercel settings:

```txt
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

## Security

The deployed app uses security headers including:

- Content Security Policy
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy
- Strict Transport Security

The app does not currently include:

- user accounts
- authentication
- payments
- server-side user storage
- private user data collection

## Data Notice

This is an unofficial squad planning and registration simulator.

Player data is provided for planning/demo purposes and may be incomplete or require manual verification.

Eligibility fields such as club-trained status, Italy-trained status, and non-EU transfer slot status should be manually reviewed.

This project is not affiliated with Serie A, its clubs, FBref, Sports Reference, or any official football governing body.

## Disclaimer

The registration checks are intended as a planning aid only.

They should not be treated as official legal, sporting, or regulatory advice.

Always verify final squad registration decisions with official league and club sources.

## Roadmap

Potential future improvements:

- Better mobile layout
- Team logos
- Saved squad scenarios
- Export lineup image
- Export squad sheet as CSV
- More accurate player eligibility database
- Licensed football data provider integration
- Custom backend for scheduled data refreshes
