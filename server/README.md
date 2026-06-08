# Backend Setup

This project uses Express, Prisma, and PostgreSQL for saved canvases and future component-file search.

## Environment

Copy `.env.example` to `.env` and update `DATABASE_URL` if your PostgreSQL user, password, host, or database name differs.

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/retejs?schema=public"
PORT=3001
CLIENT_ORIGIN="http://localhost:5173"
```

## Database Commands

If you use Docker, start PostgreSQL first:

```bash
docker compose up -d postgres
```

```bash
npm run db:generate
npx prisma migrate dev --name init
npm run db:studio
```

- `db:generate` creates the Prisma client in `server/generated/prisma`.
- `db:migrate` creates or updates PostgreSQL tables from `prisma/schema.prisma`.
- `db:studio` opens Prisma Studio for inspecting data.

## API Commands

```bash
npm run server:dev
npm run server
```

The API runs on `http://localhost:3001` by default.

## One-Click Services

Start PostgreSQL, the API server, and the Vite app:

```bash
npm run services:start
```

Stop the web/API processes and keep PostgreSQL running:

```bash
npm run services:stop:keep-db
```

Stop the web/API processes and stop PostgreSQL too:

```bash
npm run services:stop
```

Logs are written to `logs/`, and process state is written to `.run/services.json`.

Initial endpoints:

- `GET /api/health`
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:id`
- `PUT /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/components/files`
- `GET /api/components/search?q=Reynolds`
- `GET /api/components/chunks/search?q=DataflowEngine`
- `GET /api/components/files/:id`

## Sync Project Knowledge

Populate `component_files` and `component_chunks` with current source files plus canvas docs:

```bash
npm run db:sync-knowledge
```
