# École La RACINE Management System

Full-stack **school ERP** and **public website** for **École La RACINE** (Rwanda — Western Province / Rubavu–Gisenyi).

Multi-campus operations, role-based portals, academic records, digital learning, transport, communication, and a multilingual public site with a CMS — all in one monorepo.

**Motto:** *Discipline · Intelligence · Innovation*

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [User roles](#user-roles)
- [Languages](#languages)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [Running the app](#running-the-app)
- [Scripts](#scripts)
- [API overview](#api-overview)
- [Public website](#public-website)
- [Authentication & multi-campus](#authentication--multi-campus)
- [Production notes](#production-notes)

---

## Overview

| Item | Detail |
|------|--------|
| **Package** | `laracine-school-system` |
| **Frontend** | React SPA (`client/`) — Vite, port **3000** |
| **Backend** | Express API + Socket.IO (`server/`) — port **5001** |
| **Database** | PostgreSQL via Prisma |
| **Campuses (seed)** | Gisenyi, Rubavu |
| **UI languages** | English, Français, Ikinyarwanda, Kiswahili |

Open the app at [http://localhost:3000](http://localhost:3000) after starting both servers. The public school site is at `/`; staff/parent/student portals start at `/login`.

---

## Features

### School operations

| Module | Description |
|--------|-------------|
| **Dashboard** | Live KPIs, charts, and role-specific overviews (manager, teacher, parent, student) |
| **Reports** | Generate and export school reports (Excel, PDF, Word) |
| **Students** | Enrollment, registration workflow, profiles, parent links |
| **Teachers** | Staff records and subject assignments |
| **Classes & courses** | Grades/sections, per-class courses, bulletin layout |
| **Marks** | Auto-saving mark entry by class and course |
| **Bulletin scolaire** | Official report cards — preview, print, PDF, public verify link |
| **Attendance** | Daily status: Present, Absent, Late, Excused |
| **Fees** | Tuition and other fees, payment status, receipts |
| **Academic years** | Per-campus years; switch active/closed years |
| **Users** | Role-based accounts (staff, parents, students) |
| **School profile** | Campus info, contacts, bank accounts for fees |
| **Website CMS** | Edit public pages per language (EN / FR / SW / RW) |

### Digital learning & activities

| Module | Description |
|--------|-------------|
| **Library** | Physical books, loans, borrowers |
| **E-Library** | Digital books read inside the app |
| **E-Learning** | Video courses with auto-marked exercises |
| **Homework** | Assignments with files, quizzes, auto-marking |
| **Online classes** | Live lessons via Google Meet / Zoom |
| **Timetable** | Weekly schedules with customizable periods |
| **Extracurricular** | Primary clubs and activity enrollment |
| **Transport** | Bus routes, stops, passengers, schedules, parent alerts |
| **Communication** | Announcements and two-way messaging |

### Public website

Marketing and information site for visitors: home, about, academics, campuses/locations, news, announcements, events, gallery, admissions, and contact — with live support chat (Socket.IO). Content is managed in the **Website CMS**.

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 6, React Router 7 |
| Styling | Tailwind CSS 3, Lucide icons, Iconify |
| Charts / export | Recharts, jsPDF, html2canvas, docx, xlsx, QRCode |
| Backend | Node.js (ESM), Express 4 |
| Database | PostgreSQL + Prisma 6 |
| Auth | JWT + bcrypt |
| Realtime | Socket.IO 4 (contact chat / typing) |
| Email | Nodemailer (OTP, contact, password reset) |
| Location | `@devrw/rwanda-location` (Rwanda address fields) |

---

## Project structure

```
/
├── package.json                 # Root scripts (install, dev, db:setup)
├── README.md
├── client/                      # React SPA
│   ├── src/
│   │   ├── App.jsx              # Public + authenticated routes
│   │   ├── pages/               # Feature pages (+ pages/public/)
│   │   ├── components/          # Layout, dashboards, forms, bulletin, media
│   │   ├── context/             # Auth, Campus, Language
│   │   ├── config/              # permissions, grades, registration
│   │   ├── i18n/                # App translations (en/fr/rw/sw)
│   │   ├── hooks/
│   │   └── lib/                 # api.js, socket, bulletin helpers
│   └── vite.config.js           # Port 3000; proxies /api & /socket.io
└── server/                      # Express API
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.js
    ├── .env.example
    └── src/
        ├── index.js
        ├── routes/              # REST modules
        ├── middleware/          # auth, campus, academic year, scope
        ├── config/permissions.js
        └── lib/                 # auth, realtime, website CMS, curriculum
```

---

## User roles

Nine roles with permission-gated menus and APIs:

| Role | Who | Access (summary) |
|------|-----|------------------|
| **School Manager** | Overall admin | Full system; starts at `/campuses` |
| **Secretary** | Campus admin | People, academics, fees, users, CMS, reports, etc. |
| **Head of Studies** | Academic lead | Students, teachers, classes, marks, timetable, digital learning, CMS |
| **Head of Discipline** | Discipline | Students, attendance, activities, transport, communication |
| **Accountant** | Finance | Fees, students (billing), transport, reports |
| **Librarian** | Library | Physical library, e-library, reports |
| **Teacher** | Teaching staff | Own classes/students, marks, attendance, homework, live classes |
| **Parent** | Guardians | Child registration, attendance, report cards, fees, messages, activities |
| **Student** | Learners | Homework, live classes, e-library, e-learning |

Permissions live in `client/src/config/permissions.js` (mirrored on the server).

---

## Languages

### Logged-in app (UI)

Users pick **English / Français / Ikinyarwanda / Kiswahili** from the top bar, login page, or profile. Preference is stored in `localStorage` and, when logged in, on the user as `preferredLanguage`.

### Public website & CMS

Same four locales. Public pages use `?lang=` / localStorage; CMS editors create content per language.

---

## Prerequisites

- [Node.js](https://nodejs.org/) **v18+**
- [PostgreSQL](https://www.postgresql.org/) running locally (or a remote Postgres URL)

---

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure the database

Copy and edit env:

```bash
cp server/.env.example server/.env
```

Example `server/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/laracine_school?schema=public"
PORT=5001
```

Create the database (if needed):

```bash
createdb laracine_school
```

### 3. Initialize schema and seed data

```bash
npm run db:setup
```

This runs Prisma generate, `db push`, and seed (campuses, demo users, sample academic data, website defaults).

### 4. Start development servers

**Terminal 1 — API (port 5001):**

```bash
npm run dev:server
```

**Terminal 2 — Client (port 3000):**

```bash
npm run dev:client
```

Then open:

| URL | Purpose |
|-----|---------|
| [http://localhost:3000](http://localhost:3000) | Public website |
| [http://localhost:3000/login](http://localhost:3000/login) | Staff / parent / student login |

Vite proxies `/api` and `/socket.io` to the backend.

---

## Environment variables

### Required (`server/.env`)

| Variable | Description | Default / example |
|----------|-------------|-------------------|
| `DATABASE_URL` | PostgreSQL connection string | see `.env.example` |
| `PORT` | API + Socket.IO port | `5001` |

### Recommended for production / full features

| Variable | Description | Default (dev) |
|----------|-------------|----------------|
| `JWT_SECRET` | JWT signing secret | `laracine-school-dev-secret` |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CLIENT_URL` | Frontend origin (CORS, verify links) | `http://localhost:3000` |
| `SMTP_USER` | SMTP account for email | — |
| `SMTP_PASS` | SMTP password / app password | — |

The client talks to `/api` on the same origin in development (Vite proxy). For production (or a remote API), set `VITE_API_URL` in `client/.env` / `client/.env.production` — see [Client env](#client-env-vite).

---

## Client env (Vite)

Only variables prefixed with `VITE_` are available in the browser.

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_URL` | Backend origin (no `/api` suffix, no trailing slash) | `https://ecolelaracine.online` |
| `VITE_SOCKET_URL` | Socket.IO origin (optional; defaults to `VITE_API_URL`) | `https://ecolelaracine.online` |

**Local development** — leave them empty (or omit). Vite proxies `/api` and `/socket.io` to `http://localhost:5001`.

```bash
# client/.env.local (optional)
VITE_API_URL=
```

**Production frontend** pointing at the live API:

```bash
# client/.env.production
VITE_API_URL=https://ecolelaracine.online
VITE_SOCKET_URL=https://ecolelaracine.online
```

Then build:

```bash
cd client && npm run build
```

Also set server `CLIENT_URL` to your **frontend** origin so CORS and bulletin links work.

Templates: `client/.env.example`, `client/.env.production.example`.

---

## Demo accounts

Seeded password for **all** accounts: **`password123`**

| Email | Role |
|-------|------|
| `manager@laracineschool.rw` | School Manager → campus picker |
| `secretary@laracineschool.rw` | Secretary |
| `head.studies@laracineschool.rw` | Head of Studies |
| `head.discipline@laracineschool.rw` | Head of Discipline |
| `accountant@laracineschool.rw` | Accountant |
| `librarian@laracineschool.rw` | Librarian |
| `teacher@laracineschool.rw` | Teacher |
| `parent@laracineschool.rw` | Parent |
| `student@laracineschool.rw` | Student |

Quick-login shortcuts for these accounts are also shown on the login page.

---

## Running the app

| Mode | Command | Notes |
|------|---------|--------|
| API (dev) | `npm run dev:server` | Nodemon on port **5001** |
| Client (dev) | `npm run dev:client` | Vite on port **3000** |
| API (prod) | `cd server && npm start` | `prisma generate` + Node |
| Client build | `cd client && npm run build` | Output in `client/dist` |
| Client preview | `cd client && npm run preview` | Serves the production build |

Health check: `GET http://localhost:5001/api/health`

---

## Scripts

### Root (`package.json`)

| Script | Action |
|--------|--------|
| `npm run install:all` | Install server + client dependencies |
| `npm run dev:server` | Start API in watch mode |
| `npm run dev:client` | Start Vite dev server |
| `npm run db:setup` | Generate client, push schema, seed |

### Server (`server/package.json`)

| Script | Action |
|--------|--------|
| `npm run db:generate` | Prisma client generate |
| `npm run db:push` | Push schema to DB |
| `npm run db:migrate` | Dev migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |

---

## API overview

Base path: **`/api`**

| Area | Prefix | Auth |
|------|--------|------|
| Health | `/health` | Public |
| Auth | `/auth/*` | Login public; `me` / updates need JWT |
| Public site | `/public/*` | Public |
| Contact / chat | `/contact/*` | Public (OTP when SMTP configured) |
| Bulletin verify | `/verify/*` | Public token |
| Campuses / users / school / CMS | `/campuses`, `/users`, `/school`, `/website` | JWT |
| Academic years | `/academic-years` | JWT + campus |
| Operations | `/students`, `/teachers`, `/classes`, `/courses`, `/marks`, `/attendance`, `/fees`, `/library`, `/e-library`, `/e-learning`, `/timetable`, `/homework`, `/online-classes`, `/extracurricular`, `/transport`, `/communication`, `/reports`, … | JWT + campus (+ academic year) |
| Role helpers | `/parent`, `/teacher`, `/student` | JWT + role scope |

**Headers (campus-scoped requests):**

- `Authorization: Bearer <token>`
- `X-Campus-Id: <campusUuid>`
- `X-Academic-Year-Id: <yearUuid>` (optional; defaults to active year)

JSON body limit is **20 MB** (large CMS / media payloads).

---

## Public website

| Path | Page |
|------|------|
| `/` | Home |
| `/about` | About |
| `/academics` | Academics |
| `/locations` | Campuses / map |
| `/news` | News |
| `/announcements` | Announcements |
| `/events` | Events |
| `/gallery` | Gallery |
| `/admissions` | Admissions |
| `/contact` | Contact + support chat |

CMS page slugs: `nav`, `home`, `about`, `academics`, `locations`, `announcements`, `news`, `events`, `gallery`, `admissions`, `contact`.

Staff with website permission edit content under **Website CMS** (`/campus/:campusId/website`).

---

## Authentication & multi-campus

1. User signs in → JWT stored in the browser.
2. **School Manager** lands on `/campuses` and chooses a campus.
3. Other roles go to `/campus/{defaultCampusId}` for their assigned campus.
4. Operational data is scoped by **campus** and **academic year**.
5. Non-managers cannot switch to another campus via API headers.

---

## Production notes

There is no Docker/CI config in this repo by default. For deployment:

1. Provision PostgreSQL and set a strong `DATABASE_URL` and `JWT_SECRET`.
2. Set `CLIENT_URL` to the real frontend origin.
3. Configure `SMTP_USER` / `SMTP_PASS` for contact OTP and password emails.
4. Run `cd server && npm start` (or your process manager).
5. Build the client (`cd client && npm run build`) and serve `client/dist` behind the same origin as the API **or** configure CORS and a production API base URL.
6. Ensure WebSocket/Socket.IO (`/socket.io`) reaches the Node server for live chat.

---

## License

Private project for **École La RACINE**. All rights reserved.
