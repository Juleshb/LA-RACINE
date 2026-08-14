# La Racine — Student mobile app

Expo (React Native) client for student accounts. It uses the same Express API as the web student portal.

## Features

- Login (+ OTP when enabled)
- Home dashboard
- Homework list / quiz submit
- Live classes (open Meet/Zoom links)
- E-Learning courses + exercises
- E-Library browse / open files
- AI tutor chat
- Profile photo + password change
- Dark mode + EN / FR / RW / SW languages

## Setup

```bash
# from repo root
npm run install:all

# or just mobile
cd mobile && npm install
```

Copy env:

```bash
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` to your API origin:

| Where you run Expo | Typical value |
|---|---|
| iOS Simulator | `http://localhost:5001` |
| Android Emulator | `http://10.0.2.2:5001` |
| Physical device | `http://<your-computer-LAN-IP>:5001` |
| Production / App Store | `https://ecolelaracine.online` |

Production EAS builds bake `https://ecolelaracine.online` via [`eas.json`](eas.json) (`production` / `preview` profiles).

## Run

Start the API first (from repo root):

```bash
npm run dev:server
```

Then start Expo:

```bash
npm run dev:mobile
# or: cd mobile && npx expo start
```

Demo student (from seed, if present): `student@laracineschool.rw` / `password123`

If that account is missing in your database, use any provisioned `STUDENT` login, or re-run `npm run db:setup`.

## App Store (iOS) with EAS

Bundle ID: `rw.laracineschool.students`  
Expo project: [juleshb/laracine-students](https://expo.dev/accounts/juleshb/projects/laracine-students)

### Prerequisites

- Apple Developer Program membership
- Expo account ([expo.dev](https://expo.dev)) — linked as `@juleshb`
- App Store Connect access for your team

### Commands (from `mobile/`)

```bash
# Already logged in? Check:
npm run eas:whoami

# Login if needed:
npm run eas:login

# Production iOS build (creates distribution certs on first run — follow Apple prompts)
npm run eas:build:ios

# Upload latest build to App Store Connect / TestFlight
npm run eas:submit:ios

# Or build + auto-submit:
npm run eas:build:submit:ios
```

After submit, wait ~10–15 minutes for processing, then open [App Store Connect](https://appstoreconnect.apple.com/) → your app → TestFlight.

### App Store Connect checklist (manual)

1. Create the app if it does not exist (bundle ID must match `rw.laracineschool.students`)
2. Fill **App Information**: name, subtitle, category (Education), age rating
3. Add **screenshots** for required iPhone sizes (and iPad if you keep `supportsTablet`)
4. Complete **Privacy Nutrition Labels** (account login; camera/mic for Zoom; photos if profile upload is used)
5. Support URL / marketing URL (e.g. school website)
6. Select the processed build → **Submit for Review**

`eas submit` uploads the binary to TestFlight; releasing to the public App Store still requires the App Review step in App Store Connect.

## Notes

- Only `STUDENT` role accounts can use this app.
- Auth token and campus/year context are stored in SecureStore and sent as `Authorization` + `X-Campus-Id` (+ optional `X-Academic-Year-Id`) headers, matching the web client.
