import base64
import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Any
from urllib.parse import quote

import psycopg
from dotenv import load_dotenv
from fastapi import Cookie, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, EmailStr, Field


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgres://disaster_admin:disaster_password@localhost:5432/disaster_events",
)
PORT = int(os.getenv("ADMIN_USERS_PORT", "3100"))
SESSION_SECRET = os.getenv("ADMIN_USERS_SESSION_SECRET", "local-dev-admin-users-secret")
SESSION_HOURS = int(os.getenv("ADMIN_USERS_SESSION_HOURS", "8"))
COOKIE_NAME = "wave_admin_users_session"
HASH_ITERATIONS = 310000
USERNAME_RE = re.compile(r"^[a-z0-9_.-]{3,100}$")
DEFAULT_ALLOWED_ROLES = "admin,super_admin,viewer"
ALLOWED_ROLES = [
    role.strip()
    for role in os.getenv("ADMIN_ALLOWED_ROLES", DEFAULT_ALLOWED_ROLES).split(",")
    if role.strip()
]
MANAGER_ROLES = {
    role.strip()
    for role in os.getenv("ADMIN_MANAGER_ROLES", "admin,super_admin").split(",")
    if role.strip()
}

app = FastAPI(title="WAVE Admin User Manager")


class LoginRequest(BaseModel):
    username: str
    password: str


class CreateAdminRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = "admin"


class UpdateAdminRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    email: EmailStr
    role: str = "admin"


class PasswordUpdateRequest(BaseModel):
    password: str = Field(min_length=8)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def connection():
    return psycopg.connect(DATABASE_URL, row_factory=psycopg.rows.dict_row)


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def normalize_username(username: str) -> str:
    return username.strip().lower()


def validate_username(username: str) -> str:
    normalized = normalize_username(username)
    if not USERNAME_RE.fullmatch(normalized):
        raise ValueError("Username must be 3-100 characters using lowercase letters, numbers, dot, dash, or underscore.")
    return normalized


def validate_role(role: str) -> str:
    normalized = role.strip()
    if normalized not in ALLOWED_ROLES:
        raise ValueError(f"Role must be one of: {', '.join(ALLOWED_ROLES)}.")
    return normalized


def hash_password(password: str) -> str:
    salt = secrets.token_urlsafe(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        HASH_ITERATIONS,
        dklen=32,
    )
    return f"pbkdf2_sha256${HASH_ITERATIONS}${salt}${b64url_encode(digest)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_value, salt, stored_digest = stored_hash.split("$", 3)
        iterations = int(iterations_value)
        expected = b64url_decode(stored_digest)
    except Exception:
        return False

    if algorithm != "pbkdf2_sha256" or iterations < 100000 or not salt:
        return False

    actual = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
        dklen=len(expected),
    )
    return hmac.compare_digest(actual, expected)


def sign_session(user: dict[str, Any]) -> str:
    expires_at = utc_now() + timedelta(hours=SESSION_HOURS)
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user.get("role") or "admin",
        "exp": int(expires_at.timestamp()),
    }
    payload_part = b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        SESSION_SECRET.encode("utf-8"),
        payload_part.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{payload_part}.{b64url_encode(signature)}"


def verify_session(token: str | None) -> dict[str, Any] | None:
    if not token or "." not in token:
        return None

    payload_part, signature = token.split(".", 1)
    expected_signature = b64url_encode(
        hmac.new(
            SESSION_SECRET.encode("utf-8"),
            payload_part.encode("ascii"),
            hashlib.sha256,
        ).digest()
    )
    if not hmac.compare_digest(signature, expected_signature):
        return None

    try:
        payload = json.loads(b64url_decode(payload_part).decode("utf-8"))
    except Exception:
        return None

    if int(payload.get("exp", 0)) < int(utc_now().timestamp()):
        return None
    return payload


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user.get("role") or "admin",
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
    }


def get_user_by_username(username: str) -> dict[str, Any] | None:
    with connection() as conn:
        return conn.execute(
            """
            SELECT id, username, email, password_hash, role, created_at
            FROM admin_users
            WHERE lower(username) = lower(%s)
            LIMIT 1
            """,
            (username,),
        ).fetchone()


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    with connection() as conn:
        return conn.execute(
            """
            SELECT id, username, email, password_hash, role, created_at
            FROM admin_users
            WHERE id = %s
            LIMIT 1
            """,
            (user_id,),
        ).fetchone()


def current_user_from_cookie(token: str | None) -> dict[str, Any] | None:
    payload = verify_session(token)
    if not payload:
        return None

    user = get_user_by_id(payload["sub"])
    if not user or (user.get("role") or "admin") not in MANAGER_ROLES:
        return None
    return user


def current_user_from_request(request: Request, cookie_token: str | None) -> dict[str, Any] | None:
    bearer_token = ""
    authorization = request.headers.get("authorization", "")
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() == "bearer" and value:
        bearer_token = value.strip()

    return current_user_from_cookie(bearer_token or cookie_token)


def require_current_user(token: str | None) -> dict[str, Any]:
    user = current_user_from_cookie(token)
    if not user:
        raise HTTPException(status_code=401, detail="Admin user manager session is invalid or expired.")
    return user


def require_request_user(request: Request, cookie_token: str | None) -> dict[str, Any]:
    user = current_user_from_request(request, cookie_token)
    if not user:
        raise HTTPException(status_code=401, detail="Admin user manager session is invalid or expired.")
    return user


def find_conflict(username: str, email: str, exclude_id: str | None = None) -> str | None:
    params: list[Any] = [username, email]
    where_exclude = ""
    if exclude_id:
        where_exclude = "AND id <> %s"
        params.append(exclude_id)

    with connection() as conn:
        row = conn.execute(
            f"""
            SELECT username, email
            FROM admin_users
            WHERE (lower(username) = lower(%s) OR lower(email) = lower(%s))
            {where_exclude}
            LIMIT 1
            """,
            tuple(params),
        ).fetchone()

    if not row:
        return None
    if row["username"].lower() == username.lower():
        return "Username is already in use."
    return "Email is already in use."


def list_admin_users() -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT id, username, email, role, created_at
            FROM admin_users
            ORDER BY created_at DESC, username ASC
            """
        ).fetchall()
    return [public_user(row) for row in rows]


def create_admin_user(data: CreateAdminRequest) -> dict[str, Any]:
    username = validate_username(data.username)
    role = validate_role(data.role)
    email = data.email.strip().lower()
    conflict = find_conflict(username, email)
    if conflict:
        raise ValueError(conflict)

    password_hash = hash_password(data.password)
    with connection() as conn:
        row = conn.execute(
            """
            INSERT INTO admin_users (username, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
            RETURNING id, username, email, role, created_at
            """,
            (username, email, password_hash, role),
        ).fetchone()
        conn.commit()
    return public_user(row)


def update_admin_user(user_id: str, data: UpdateAdminRequest) -> dict[str, Any]:
    username = validate_username(data.username)
    role = validate_role(data.role)
    email = data.email.strip().lower()
    conflict = find_conflict(username, email, exclude_id=user_id)
    if conflict:
        raise ValueError(conflict)

    with connection() as conn:
        row = conn.execute(
            """
            UPDATE admin_users
            SET username = %s, email = %s, role = %s
            WHERE id = %s
            RETURNING id, username, email, role, created_at
            """,
            (username, email, role, user_id),
        ).fetchone()
        conn.commit()

    if not row:
        raise ValueError("Admin user was not found.")
    return public_user(row)


def update_admin_password(user_id: str, password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")

    password_hash = hash_password(password)
    with connection() as conn:
        result = conn.execute(
            """
            UPDATE admin_users
            SET password_hash = %s
            WHERE id = %s
            """,
            (password_hash, user_id),
        )
        conn.commit()
    if result.rowcount == 0:
        raise ValueError("Admin user was not found.")


def delete_admin_user(user_id: str, current_user_id: str) -> None:
    if user_id == current_user_id:
        raise ValueError("You cannot delete the signed-in account.")

    with connection() as conn:
        count_row = conn.execute("SELECT count(*) AS total FROM admin_users").fetchone()
        if int(count_row["total"]) <= 1:
            raise ValueError("Cannot delete the last admin user.")

        result = conn.execute("DELETE FROM admin_users WHERE id = %s", (user_id,))
        conn.commit()

    if result.rowcount == 0:
        raise ValueError("Admin user was not found.")


def ensure_schema() -> None:
    with connection() as conn:
        conn.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(30) DEFAULT 'admin',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        conn.commit()


def ensure_bootstrap_user() -> None:
    if os.getenv("ADMIN_USERS_BOOTSTRAP_ENABLED", "true").lower() not in {"1", "true", "yes", "on"}:
        return

    username = validate_username(os.getenv("ADMIN_USERS_BOOTSTRAP_USERNAME", "admin"))
    email = os.getenv("ADMIN_USERS_BOOTSTRAP_EMAIL", "admin@wave.local").strip().lower()
    password = os.getenv("ADMIN_USERS_BOOTSTRAP_PASSWORD", "admin")
    role = validate_role(os.getenv("ADMIN_USERS_BOOTSTRAP_ROLE", "admin"))

    if get_user_by_username(username):
        return

    with connection() as conn:
        conn.execute(
            """
            INSERT INTO admin_users (username, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (username) DO NOTHING
            """,
            (username, email, hash_password(password), role),
        )
        conn.commit()


def page(title: str, body: str, user: dict[str, Any] | None = None) -> HTMLResponse:
    signed_in = bool(user)
    nav = ""
    if signed_in:
        nav = f"""
        <form method="post" action="/logout">
          <span>{escape(user["username"])} ({escape(user.get("role") or "admin")})</span>
          <button class="ghost" type="submit">Sign out</button>
        </form>
        """

    return HTMLResponse(
        f"""
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>{escape(title)}</title>
          <style>
            :root {{
              color-scheme: light;
              --bg: #f8fafc;
              --panel: #ffffff;
              --text: #0f172a;
              --muted: #64748b;
              --border: #dbe3ee;
              --accent: #1f2937;
              --danger: #b91c1c;
              --danger-bg: #fef2f2;
              --ok: #166534;
              --ok-bg: #f0fdf4;
            }}
            * {{ box-sizing: border-box; }}
            body {{
              margin: 0;
              background: var(--bg);
              color: var(--text);
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              font-size: 14px;
            }}
            header {{
              background: var(--panel);
              border-bottom: 1px solid var(--border);
              padding: 14px 24px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
            }}
            header h1 {{ margin: 0; font-size: 16px; line-height: 1.2; }}
            header p {{ margin: 3px 0 0; color: var(--muted); font-size: 12px; }}
            header form {{ display: flex; align-items: center; gap: 12px; color: var(--muted); font-size: 12px; }}
            main {{ width: min(1120px, calc(100vw - 32px)); margin: 24px auto 48px; }}
            .panel {{
              background: var(--panel);
              border: 1px solid var(--border);
              border-radius: 8px;
              padding: 18px;
              margin-bottom: 18px;
            }}
            .grid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }}
            .actions {{ display: flex; align-items: end; gap: 8px; flex-wrap: wrap; }}
            label {{ display: block; color: var(--muted); font-size: 12px; margin-bottom: 5px; }}
            input, select {{
              width: 100%;
              border: 1px solid var(--border);
              border-radius: 6px;
              padding: 9px 10px;
              font: inherit;
              background: white;
              color: var(--text);
            }}
            button {{
              border: 1px solid var(--accent);
              border-radius: 6px;
              padding: 9px 12px;
              font: inherit;
              font-weight: 600;
              background: var(--accent);
              color: white;
              cursor: pointer;
              white-space: nowrap;
            }}
            button.ghost {{ background: white; color: var(--accent); }}
            button.danger {{ border-color: var(--danger); background: var(--danger); }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ border-bottom: 1px solid var(--border); padding: 12px 8px; text-align: left; vertical-align: top; }}
            th {{ color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }}
            td form {{ margin: 0; }}
            .inline-fields {{ display: grid; grid-template-columns: 1fr 1.4fr 140px auto; gap: 8px; align-items: end; }}
            .password-fields {{ display: grid; grid-template-columns: minmax(180px, 1fr) auto; gap: 8px; align-items: end; margin-top: 8px; }}
            .row-actions {{ min-width: 360px; }}
            .notice {{ border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; }}
            .notice.ok {{ color: var(--ok); background: var(--ok-bg); border: 1px solid #bbf7d0; }}
            .notice.error {{ color: var(--danger); background: var(--danger-bg); border: 1px solid #fecaca; }}
            .muted {{ color: var(--muted); font-size: 12px; }}
            .login {{ max-width: 420px; margin: 48px auto; }}
            @media (max-width: 800px) {{
              header {{ align-items: flex-start; flex-direction: column; }}
              .grid, .inline-fields, .password-fields {{ grid-template-columns: 1fr; }}
              table, tbody, tr, td {{ display: block; width: 100%; }}
              thead {{ display: none; }}
              tr {{ border-bottom: 1px solid var(--border); padding: 10px 0; }}
              td {{ border: 0; padding: 8px 0; }}
              .row-actions {{ min-width: 0; }}
            }}
          </style>
        </head>
        <body>
          <header>
            <div>
              <h1>WAVE Admin Users</h1>
              <p>Manage accounts stored in the Docker PostgreSQL admin_users table.</p>
            </div>
            {nav}
          </header>
          <main>{body}</main>
        </body>
        </html>
        """
    )


def render_notice(success: str | None, error: str | None) -> str:
    if error:
        return f'<div class="notice error">{escape(error)}</div>'
    if success:
        return f'<div class="notice ok">{escape(success)}</div>'
    return ""


def role_options(selected: str) -> str:
    return "".join(
        f'<option value="{escape(role)}"{" selected" if role == selected else ""}>{escape(role)}</option>'
        for role in ALLOWED_ROLES
    )


def redirect_with_message(path: str, key: str, message: str) -> RedirectResponse:
    separator = "&" if "?" in path else "?"
    return RedirectResponse(f"{path}{separator}{key}={quote(message)}", status_code=303)


@app.on_event("startup")
def startup() -> None:
    ensure_schema()
    ensure_bootstrap_user()


@app.get("/health")
def health() -> dict[str, str]:
    with connection() as conn:
        conn.execute("SELECT 1")
    return {"ok": "true", "database": "postgres"}


@app.get("/", response_class=HTMLResponse)
def root(wave_admin_users_session: str | None = Cookie(default=None)) -> RedirectResponse:
    if current_user_from_cookie(wave_admin_users_session):
        return RedirectResponse("/users", status_code=303)
    return RedirectResponse("/login", status_code=303)


@app.get("/login", response_class=HTMLResponse)
def login_page(error: str | None = None, success: str | None = None) -> HTMLResponse:
    body = f"""
    <section class="panel login">
      {render_notice(success, error)}
      <h2 style="margin-top:0">Sign in</h2>
      <p class="muted">Use an existing account from the <code>admin_users</code> table.</p>
      <form method="post" action="/login">
        <div style="margin-bottom:12px">
          <label>Username</label>
          <input name="username" value="admin" autocomplete="username" required>
        </div>
        <div style="margin-bottom:16px">
          <label>Password</label>
          <input name="password" type="password" autocomplete="current-password" required>
        </div>
        <button type="submit">Sign in</button>
      </form>
    </section>
    """
    return page("Sign in - WAVE Admin Users", body)


@app.post("/login")
def login(username: str = Form(...), password: str = Form(...)) -> RedirectResponse:
    user = get_user_by_username(normalize_username(username))
    if not user or not verify_password(password, user["password_hash"]):
        return redirect_with_message("/login", "error", "Invalid username or password.")

    if (user.get("role") or "admin") not in MANAGER_ROLES:
        return redirect_with_message("/login", "error", "This account is not allowed to manage admin users.")

    response = RedirectResponse("/users", status_code=303)
    response.set_cookie(
        COOKIE_NAME,
        sign_session(user),
        httponly=True,
        samesite="lax",
        max_age=SESSION_HOURS * 60 * 60,
    )
    return response


@app.post("/logout")
def logout() -> RedirectResponse:
    response = RedirectResponse("/login?success=Signed out.", status_code=303)
    response.delete_cookie(COOKIE_NAME)
    return response


@app.get("/users", response_class=HTMLResponse)
def users_page(
    error: str | None = None,
    success: str | None = None,
    wave_admin_users_session: str | None = Cookie(default=None),
) -> HTMLResponse:
    user = require_current_user(wave_admin_users_session)
    users = list_admin_users()
    rows = []
    for item in users:
        created = item["created_at"] or ""
        rows.append(
            f"""
            <tr>
              <td>
                <strong>{escape(item["username"])}</strong><br>
                <span class="muted">{escape(item["id"])}</span>
              </td>
              <td>{escape(item["email"])}</td>
              <td>{escape(item["role"])}</td>
              <td><span class="muted">{escape(created[:19].replace("T", " "))}</span></td>
              <td class="row-actions">
                <form method="post" action="/users/{escape(item["id"])}/update">
                  <div class="inline-fields">
                    <div>
                      <label>Username</label>
                      <input name="username" value="{escape(item["username"])}" required>
                    </div>
                    <div>
                      <label>Email</label>
                      <input name="email" type="email" value="{escape(item["email"])}" required>
                    </div>
                    <div>
                      <label>Role</label>
                      <select name="role">{role_options(item["role"])}</select>
                    </div>
                    <button class="ghost" type="submit">Save</button>
                  </div>
                </form>
                <form method="post" action="/users/{escape(item["id"])}/password">
                  <div class="password-fields">
                    <div>
                      <label>New password</label>
                      <input name="password" type="password" minlength="8" autocomplete="new-password" required>
                    </div>
                    <button class="ghost" type="submit">Reset password</button>
                  </div>
                </form>
                <form method="post" action="/users/{escape(item["id"])}/delete" style="margin-top:8px">
                  <button class="danger" type="submit">Delete</button>
                </form>
              </td>
            </tr>
            """
        )

    body = f"""
    {render_notice(success, error)}
    <section class="panel">
      <h2 style="margin-top:0">Create admin user</h2>
      <form method="post" action="/users">
        <div class="grid">
          <div>
            <label>Username</label>
            <input name="username" placeholder="district-admin" required>
          </div>
          <div>
            <label>Email</label>
            <input name="email" type="email" placeholder="officer@example.gov" required>
          </div>
          <div>
            <label>Password</label>
            <input name="password" type="password" minlength="8" autocomplete="new-password" required>
          </div>
          <div>
            <label>Role</label>
            <select name="role">{role_options("admin")}</select>
          </div>
        </div>
        <div style="margin-top:14px">
          <button type="submit">Create account</button>
        </div>
      </form>
    </section>
    <section class="panel">
      <h2 style="margin-top:0">Existing admin users</h2>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>{"".join(rows)}</tbody>
      </table>
    </section>
    """
    return page("WAVE Admin Users", body, user)


@app.post("/users")
def create_user(
    username: str = Form(...),
    email: EmailStr = Form(...),
    password: str = Form(...),
    role: str = Form("admin"),
    wave_admin_users_session: str | None = Cookie(default=None),
) -> RedirectResponse:
    require_current_user(wave_admin_users_session)
    try:
        create_admin_user(CreateAdminRequest(username=username, email=email, password=password, role=role))
    except ValueError as exc:
        return redirect_with_message("/users", "error", str(exc))
    return redirect_with_message("/users", "success", f"Created admin user {normalize_username(username)}.")


@app.post("/users/{user_id}/update")
def update_user(
    user_id: str,
    username: str = Form(...),
    email: EmailStr = Form(...),
    role: str = Form("admin"),
    wave_admin_users_session: str | None = Cookie(default=None),
) -> RedirectResponse:
    require_current_user(wave_admin_users_session)
    try:
        update_admin_user(user_id, UpdateAdminRequest(username=username, email=email, role=role))
    except ValueError as exc:
        return redirect_with_message("/users", "error", str(exc))
    return redirect_with_message("/users", "success", f"Updated admin user {normalize_username(username)}.")


@app.post("/users/{user_id}/password")
def reset_user_password(
    user_id: str,
    password: str = Form(...),
    wave_admin_users_session: str | None = Cookie(default=None),
) -> RedirectResponse:
    require_current_user(wave_admin_users_session)
    try:
        update_admin_password(user_id, password)
    except ValueError as exc:
        return redirect_with_message("/users", "error", str(exc))
    return redirect_with_message("/users", "success", "Password updated.")


@app.post("/users/{user_id}/delete")
def delete_user(
    user_id: str,
    wave_admin_users_session: str | None = Cookie(default=None),
) -> RedirectResponse:
    user = require_current_user(wave_admin_users_session)
    try:
        delete_admin_user(user_id, str(user["id"]))
    except ValueError as exc:
        return redirect_with_message("/users", "error", str(exc))
    return redirect_with_message("/users", "success", "Admin user deleted.")


@app.post("/api/login")
def api_login(payload: LoginRequest) -> JSONResponse:
    user = get_user_by_username(normalize_username(payload.username))
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    if (user.get("role") or "admin") not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="This account is not allowed to manage admin users.")
    return JSONResponse({"token": sign_session(user), "user": public_user(user)})


@app.get("/api/admin-users")
def api_list_admin_users(
    request: Request,
    wave_admin_users_session: str | None = Cookie(default=None),
) -> list[dict[str, Any]]:
    require_request_user(request, wave_admin_users_session)
    return list_admin_users()


@app.post("/api/admin-users")
def api_create_admin_user(
    request: Request,
    payload: CreateAdminRequest,
    wave_admin_users_session: str | None = Cookie(default=None),
) -> dict[str, Any]:
    require_request_user(request, wave_admin_users_session)
    try:
        return create_admin_user(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/api/admin-users/{user_id}")
def api_update_admin_user(
    request: Request,
    user_id: str,
    payload: UpdateAdminRequest,
    wave_admin_users_session: str | None = Cookie(default=None),
) -> dict[str, Any]:
    require_request_user(request, wave_admin_users_session)
    try:
        return update_admin_user(user_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/admin-users/{user_id}/password")
def api_update_admin_password(
    request: Request,
    user_id: str,
    payload: PasswordUpdateRequest,
    wave_admin_users_session: str | None = Cookie(default=None),
) -> dict[str, str]:
    require_request_user(request, wave_admin_users_session)
    try:
        update_admin_password(user_id, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "password_updated"}


@app.delete("/api/admin-users/{user_id}")
def api_delete_admin_user(
    request: Request,
    user_id: str,
    wave_admin_users_session: str | None = Cookie(default=None),
) -> dict[str, str]:
    user = require_request_user(request, wave_admin_users_session)
    try:
        delete_admin_user(user_id, str(user["id"]))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "deleted"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
