# HelpDesk

## Run the application locally

The backend connects to SQL Server using the existing `Backend/.env` settings
and Windows trusted authentication. Keep that file local and do not commit it.
`Backend/.env.example` lists the required variables without connection details.
`JWT_SECRET` must be at least 32 bytes. A private random development secret is
stored in the local `Backend/.env`.

Start the API in one terminal:

```powershell
cd Backend
npm run dev
```

Start the frontend in another terminal:

```powershell
cd helpdesk-frontend
npm run dev
```

Vite proxies `/api` requests to `http://localhost:3000` by default. If the API
runs on another address, set `VITE_API_PROXY_TARGET` in
`helpdesk-frontend/.env` (see `.env.example`) and restart Vite.

### Run the backend and frontend in Docker

The local backend keeps using Windows authentication. The Docker backend uses a
dedicated SQL login because a Linux container cannot use the host's Windows
login. SQL Server TCP/IP must be enabled on port 1433, and Windows Firewall
must allow that port from Docker.

On this machine, the `ithelpdesk_app` login has already been created with
limited permissions, and its generated password is stored only in the ignored
`Backend/.env`. For a fresh database, create a dedicated login in SSMS while
connected as a SQL Server administrator (replace `[HelpDesk]` with the
database name configured in `Backend/.env`):

```sql
USE [master];
GO
CREATE LOGIN [ithelpdesk_app]
WITH PASSWORD = N'<choose-a-strong-new-password>';
GO
USE [HelpDesk];
GO
CREATE USER [ithelpdesk_app] FOR LOGIN [ithelpdesk_app];
GRANT SELECT, INSERT ON OBJECT::dbo.Users TO [ithelpdesk_app];
GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.Tickets TO [ithelpdesk_app];
GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.TicketHistory TO [ithelpdesk_app];
GO
```

Set `DB_USER=ithelpdesk_app` and the new `DB_PASSWORD` in the ignored
`Backend/.env`; do not share or commit the password. SQL authentication stays
off for `npm run dev`; Docker Compose enables it only inside the container.
Build and start both containers from the repository root:

```powershell
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

Open `http://localhost:5173`. The API is also available on
`http://localhost:3001`; the existing Windows backend can continue using port
3000. Stop the Docker services with `docker compose down`.

Run frontend unit and component tests from `helpdesk-frontend` with
`npm test`.

If the API server cannot be reached at sign-in, the frontend offers a browser-
only demo with sample employee, IT staff, and IT administrator accounts.
Demo ticket changes are saved in that browser's local storage and are never
sent to SQL Server. If the backend responds (including with an invalid-login
response), the existing backend sign-in flow is used instead. If a demo session
is already open when the backend becomes available, the frontend ends that
session and asks you to sign in with an account registered on the server.

| Demo role | Email | Password |
|---|---|---|
| Employee | `employee@demo.local` | `Employee123!` |
| IT staff | `it.staff@demo.local` | `Staff123!` |
| IT administrator | `it.admin@demo.local` | `Admin123!` |

The frontend reads ticket and user data from the API backed by SQL Server.
Sign in with an existing account to use it. Creating tickets and changing
ticket status write to the database. Ticket panels show elapsed time in
minutes; the timer stops at the ticket's first resolution and stays fixed if
the ticket is reopened later.

## Sign-in and role access

`POST /api/auth/login` validates the email and bcrypt password hash, then
returns a signed JWT access token and the public user fields. The frontend
keeps the token for the current browser tab and sends it as a Bearer token.
Tokens expire after 8 hours; signing out or closing the tab clears the session.

- `it_staff` users see the support dashboard, all tickets, their assigned
  tickets, and the technician directory. They can update ticket status and
  create tickets for a selected employee.
- `it_admin` users have the IT staff views, can create tickets for a selected
  employee, and can assign tickets to an `it_staff` user or clear an
  assignment. They can also permanently delete tickets and their status
  history after confirmation. The Atama Kuyruğu sidebar page lists unassigned
  tickets for manual assignment.
- New open tickets are automatically assigned to idle `it_staff` users. The
  queue serves higher priorities first (`high`, `medium`, `low`), then older
  tickets first. An `it_staff` user has at most one unresolved auto-assigned
  ticket; resolving it makes them available for the next queued ticket.
  Staff can release their own ticket back to the open queue, while an
  administrator can manually override an assignment. A released ticket is
  not automatically returned to the same staff member. Unassigned tickets
  cannot be moved to `in_progress`; no expected-duration estimate is stored.
- `employee` users see only their own ticket list, can create tickets for
  themselves, and can open their tickets to check status and status history.
- Ticket and user APIs require authentication. Employees cannot list users,
  view other employees' tickets, or update ticket status. Only `it_admin`
  users can change ticket assignments. Ticket ownership, status-history
  access, and status-change attribution are taken from the verified token,
  not client-supplied IDs.

There is no registration screen. New employee accounts can be created through
the existing `POST /api/auth/register` endpoint. Staff and administrator
accounts must be provisioned by an administrator in the database; public
registration cannot choose an IT role.

Ticket categories are not stored because the current SQL Server `Tickets`
table has no category column.

## Backend email and password validation

The existing `dbo.Users.PasswordHash` column stores bcrypt hashes, so no
database migration is required.

- `POST /api/auth/register` accepts `name`, `email`, and `password`. It trims
  and lowercases the email, rejects invalid or duplicate addresses, requires a
  password of at least 8 characters (up to bcrypt's 72-byte limit), hashes the
  password with bcrypt, and creates an `employee` account.
- `POST /api/auth/login` accepts `email` and `password`, verifies the bcrypt
  hash, and returns the public user fields plus a signed access token. Invalid
  credentials receive the same response whether the email is unknown or the
  password is incorrect.

Example login request body:

```json
{
  "email": "employee@example.com",
  "password": "your-password"
}
```
