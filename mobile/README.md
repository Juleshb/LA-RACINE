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
| Production | `https://your-api-domain` |

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

## Notes

- Only `STUDENT` role accounts can use this app.
- Auth token and campus/year context are stored in SecureStore and sent as `Authorization` + `X-Campus-Id` (+ optional `X-Academic-Year-Id`) headers, matching the web client.
