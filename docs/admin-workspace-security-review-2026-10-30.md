# DBX History S1 — Admin Workspace & Security Review

Date: 30 October 2026

## PRD coverage reviewed

The S1 admin workspace exposes management sections for tournaments, Debatters, champion titles, matches, characters, match-character usage, participations, official tiers, and Audit Log. These correspond to the PRD's structured entities and content-management flow (FR-02 through FR-10 and FR-17/FR-18).

The Audit Log was implemented in the database and frontend, but the admin route selector only accepted keys in the CRUD section map. Since `audit` is intentionally not a CRUD entity, selecting it silently fell back to the tournaments section. The route selector has been corrected so `#/admin/audit` opens the existing audit viewer.

## Database/security findings

- RLS is enabled on all public tables inspected, including `admin_users`, `admin_usernames`, `admin_login_rate_limits`, `audit_logs`, and all archive entities.
- Founder write policies protect every content entity; the predicate checks the authenticated user's `admin_users.role = 'founder'`.
- The public read policies are limited to published tournaments/Debatters, active or referenced tiers, verified titles, completed matches with a winner, and related published match/participation data.
- `audit_logs` has a Founder-only SELECT policy. Competitive content tables have database triggers that write INSERT/UPDATE/DELETE snapshots to the audit table.
- Login uses a server-side Edge Function. It restricts browser origins, rejects non-POST requests, limits request size, returns generic credential errors, and applies rate limits of 5 attempts per username and 20 per IP per 15-minute window. The service-role secret is read from server-side function secrets, not embedded in the browser.
- Storage writes/deletes are limited to authenticated Founders; public access is read-only for the public asset bucket.
- Vercel serves security headers including CSP, HSTS, frame denial, MIME sniffing protection, and a restrictive Permissions Policy.

## Remaining hardening / operational recommendations

- Multi-factor authentication (MFA) is not currently enforced for Founder accounts. Enroll all Founders in an authenticator/passkey factor and then enforce AAL2 after confirming each account can complete MFA; enforcing it before enrollment risks locking administrators out.
- Rotate Founder passwords, especially any credential that may have been shared in chat or reused elsewhere. Use unique long passwords and do not send them in messages.
- Review Supabase Auth password policy and leaked-password protection in the dashboard; those settings are not exposed by the database policy inspection performed for this review.
- Keep production content separate from test data. The production archive tables were empty during this inspection, so no fake records were inserted for testing.

## Verification boundary

The route regression is covered by the repository's static validation workflow. Database policies, triggers, and deployed Edge Function code were inspected directly. A full authenticated browser end-to-end test (create/edit/delete, upload, sign-in, and audit entry) was not performed because there are no production archive records and no isolated staging environment was verified. This review therefore does not claim that every browser interaction has passed an end-to-end test.
