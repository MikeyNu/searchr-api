# Scriptory API

Node API for South African job ingestion, matching, application kits, and application tracking.

## Sources

The API uses permissioned or official sources:

- Adzuna South Africa API through `/jobs/za/search`.
- Public ATS job boards for Greenhouse and Lever when employer board slugs are configured.
- Partner JSON feeds controlled by employers, agencies, training providers, or job boards.
- Admin job feed upload for private partner imports.

PNet, CareerJunction, LinkedIn, Indeed, and ESSA are not scraped by default. They are important South African job discovery surfaces, but they should be used through partner access, public feeds, official API agreements, or user-facing outbound links only.

## South African Job Data

Start with Adzuna ZA because it has an official jobs API. Add Greenhouse and Lever board slugs for South African employers that publish roles through those ATS platforms. For PNet, CareerJunction, and ESSA, use partner feeds or formal access before ingestion.

Useful source links:

- https://developer.adzuna.com/docs/search
- https://developers.greenhouse.io/job-board.html
- https://github.com/lever/postings-api
- https://www.pnet.co.za/
- https://www.careerjunction.co.za/
- https://essa.labour.gov.za/EssaOnline/WebBeans/

## Configure

```bash
cd api
copy .env.example .env
```

Set at least one ingestion source:

```text
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
```

`npm start` and `npm run ingest` read `api/.env` automatically. Environment variables still take priority over `.env` values.

The API ingests on startup by default and refreshes every six hours:

```text
INGEST_ON_START=true
INGEST_INTERVAL_MINUTES=360
```

Optional source lists:

```text
GREENHOUSE_BOARDS=companyslug
LEVER_COMPANIES=companyslug
PARTNER_FEED_URLS=https://partner.example/jobs.json
```

## Run

```bash
npm start
```

Default URL:

```text
http://127.0.0.1:4000
```

## Ingest

```bash
npm run ingest
```

Or call:

```bash
curl -X POST http://127.0.0.1:4000/v1/ingest/run
```

## Endpoints

- `GET /health`
- `GET /v1/sources`
- `POST /v1/ingest/run`
- `GET /v1/jobs`
- `GET /v1/jobs/:id`
- `POST /v1/matches`
- `POST /v1/application-kits`
- `GET /v1/applications`
- `POST /v1/applications`
- `POST /v1/admin/jobs`

## Test

```bash
npm test
```
