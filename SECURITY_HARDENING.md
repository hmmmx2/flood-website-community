# Security Hardening Notes

## Google Maps API Key Restrictions

Restrict browser Google Maps keys in Google Cloud Console before production:

- Application restriction: HTTP referrers only.
- Allowed referrers: production community/CRM domains, staging domains, and localhost only for development keys.
- API restriction: Maps JavaScript API only unless a separate backend key is created for server APIs.
- Quotas: set daily request caps and alerting for unexpected spikes.
- Do not reuse the browser key for backend geocoding or mobile builds.

## Required Production Environment

- `AUTH_SECRET`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `AI_SERVICE_API_KEY`
- `AI_API_URL`
- explicit `ALLOWED_ORIGINS` / `app.cors.allowed-origins`
- `HIBERNATE_DDL_AUTO=validate`
