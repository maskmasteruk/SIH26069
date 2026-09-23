<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/50ecf1f9-e4a4-4323-a1f6-426abcb506b8

## Run Locally

**Prerequisites:** Node.js and Docker


1. Install dependencies:
   `npm install`
2. Start PostgreSQL from the project root:
   `docker compose -f postgres/docker-compose.yml up -d`
3. Copy [.env.example](.env.example) to `.env.local` and keep the default `DATABASE_URL` for the local Docker database.
4. Run the app and admin API together:
   `npm run dev`

The admin console is at `/admin`. The local Docker seed account is `admin / admin`.
