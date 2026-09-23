# Admin Frontend Users

Python web UI and API for managing the `admin_users` table in the existing Docker PostgreSQL database.

## Run

Start PostgreSQL first:

```powershell
docker compose -f ..\postgres\docker-compose.yml up -d
```

Use the Windows runner:

```powershell
.\run.bat
```

Or create and activate a virtual environment manually:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python main.py
```

Open:

```text
http://localhost:3100
```

The local Docker seed account is:

```text
username: admin
password: admin
```

## Capabilities

- Sign in with an existing `admin_users` account.
- List admin accounts.
- Create new admin accounts.
- Update username, email, and role.
- Reset passwords using the same `pbkdf2_sha256` format used by the existing frontend API.
- Delete users, with protection against deleting the signed-in account or the last admin user.

## JSON API

The browser UI uses a signed HTTP-only cookie. You can also call:

- `POST /api/login`
- `GET /api/admin-users`
- `POST /api/admin-users`
- `PUT /api/admin-users/{user_id}`
- `POST /api/admin-users/{user_id}/password`
- `DELETE /api/admin-users/{user_id}`

Use the token from `POST /api/login` as:

```text
Authorization: Bearer <token>
```
