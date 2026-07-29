# École La RACINE Management System

A full-stack **school management system** for **École La RACINE**, built with React, Tailwind CSS, Node.js, Express, PostgreSQL, and Prisma ORM.

## Features

- **Dashboard** — Students, teachers, classes, attendance, and fee collection overview
- **Students** — Enroll, edit, and manage student records with parent/guardian info
- **Teachers** — Manage teaching staff and subject assignments
- **Classes** — Create grade sections and assign class teachers
- **Attendance** — Mark daily attendance (Present, Absent, Late, Excused)
- **School Fees** — Record tuition and other fees, track payment status, print receipts
- **School Profile** — Manage school info, contact details, and fee payment bank accounts

## Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | React 19 + Vite         |
| Styling  | Tailwind CSS 3          |
| Backend  | Node.js + Express       |
| Database | PostgreSQL              |
| ORM      | Prisma                  |

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [PostgreSQL](https://www.postgresql.org/) running locally

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure database

Edit `server/.env` with your PostgreSQL credentials:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/laracine_school?schema=public"
PORT=5001
```

Create the database:

```bash
createdb laracine_school
```

### 3. Initialize database

```bash
npm run db:setup
```

This creates tables and seeds sample students, teachers, classes, and the school profile.

### 4. Start the application

**Terminal 1 — Backend (port 5001):**
```bash
npm run dev:server
```

**Terminal 2 — Frontend (port 3000):**
```bash
npm run dev:client
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

| Method | Endpoint                    | Description                |
|--------|-----------------------------|----------------------------|
| GET    | `/api/health`               | Health check               |
| GET    | `/api/school`               | Get school profile         |
| PUT    | `/api/school/:id`           | Update school profile      |
| GET    | `/api/students`             | List students              |
| POST   | `/api/students`             | Enroll a student           |
| PUT    | `/api/students/:id`         | Update a student           |
| DELETE | `/api/students/:id`         | Delete a student           |
| GET    | `/api/teachers`             | List teachers              |
| POST   | `/api/teachers`             | Add a teacher              |
| GET    | `/api/classes`              | List classes               |
| POST   | `/api/classes`              | Create a class             |
| GET    | `/api/attendance`           | Get attendance for a date  |
| POST   | `/api/attendance/bulk`      | Save attendance records    |
| GET    | `/api/fees`                 | List fee payments          |
| POST   | `/api/fees`                 | Record a fee payment       |
| PATCH  | `/api/fees/:id/status`      | Update payment status      |

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Layout, SchoolHeader
│   │   ├── pages/          # Dashboard, Students, Teachers, etc.
│   │   └── lib/            # API client
│   └── ...
├── server/                 # Express backend
│   ├── prisma/
│   │   ├── schema.prisma   # Database schema
│   │   └── seed.js         # Seed data
│   └── src/
│       ├── routes/         # API routes
│       └── index.js        # Server entry point
└── package.json            # Root scripts
```

## License

Private — École La RACINE
