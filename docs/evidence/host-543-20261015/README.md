# flowsmartly#543 — first-login host and artifact evidence (read-only), 2026-10-15T20:46–20:49Z

Taken by the local Claude session through the owner-authorized host access, **read-only**. Commands used: `curl`
GETs, and over SSH `nginx -T`, `readlink`, `ls`, `sha256sum` and `find`. Nothing was edited, promoted or restarted. No
sign-in, credentials or customer data were involved.

## 1. Currently SERVED: public routing (EXECUTED, `curl -s -L` from the workstation, 20:46:42Z)
| Path | HTTP | Redirects | `<title>` | Entry bundle | Body sha256 (first 16) |
|---|---|---|---|---|---|
| `/` | 200 | 0 | The Agentic Business Operating System — FlowSmartly | `entry-92820097…` (marketing) | `2a86146233f513dd` |
| `/login` | 200 | 0 | Sign in · FlowSmartly | `entry-45626115…` (portal) | `3dc767bc7aafb2d8` |
| `/register` | 200 | 0 | Create your account · FlowSmartly | portal | `9c2c4e81653c51f8` |
| `/verify` | 200 | 0 | Confirm your email address · FlowSmartly | portal | `f1e955b9d0bc8bac` |
| `/forgot` | 200 | 0 | Reset your password · FlowSmartly | portal | `d9f5bcdc21ae7869` |
| `/reset` | 200 | 0 | Choose a new password · FlowSmartly | portal | `801444abaa9f45ed` |
| `/auth/callback` | 200 | 0 | Finishing your sign-in · FlowSmartly | portal | `3d04a29cb7bfd1da` |
| `/home` | 200 | 0 | Home · FlowSmartly | portal | `7f57ec1f7f5210a8` |
| `/early-access` | 200 | 0 | Early access — FlowSmartly | marketing | `d095f4259302eb5b` |
| `api.flowsmartly.com/health/ready` | 200 | — | — | — | — |

## 2. nginx routing for the apex HTTPS vhost (`server_name flowsmartly.com;`, `nginx -T`, EXECUTED)
- Default `root /var/www/flowsmartly-v5/current`, the marketing export.
- **`location ~ ^/(accept-invitation|activity|approvals|auth|connections|flowagent|forgot|home|listsmartly|login|onboarding|register|reset|verify)(/|$)`** → `root /var/www/flowagent-portal/current`, `try_files $uri $uri.html $uri/index.html =404`.
- **Override check:** every `location` in the block was listed. The only `^~` prefixes are `/_expo/`, `/assets/` and `/fonts/`. The exact matches are `= /`, legal redirects and static files. **Nothing can pre-empt the auth regex.**
- The marketing export DOES contain a `login.html` (`780582f5ed8288ba`, the known self-redirect page), but **`/login` can never reach it**. The public `/login` hash equals the PORTAL file.

## 3. Served → on-disk → source identity (EXECUTED)
| Surface | Active root | Release folder | Served bytes = disk bytes | Source |
|---|---|---|---|---|
| Portal | `/var/www/flowagent-portal/current` | `releases/9b01014b` | all 7 auth/home pages identical (sha256 above) | `jeanyves777/flowsmartly-v5@9b01014b4ff3425a963fb6717b0a764d33be7e19` (2026-09-19); the API runs the same release (`/opt/flowagent-v5/current`) |
| Marketing | `/var/www/flowsmartly-v5/current` | `releases/20260829T015240Z-dc7b9093` | `/` and `/early-access` identical | `jeanyves777/flowsmartly@dc7b9093effd72ac9e2e4ec9d90e0760a6717956` (2026-08-28), older than #543's `58214b2b` |

## Gaps (stated, not inferred)
- **No immutable release manifest or receipt exists on the host** for either release folder. `find -iname "*manifest*.json"` found only the PWA `site.webmanifest`. The source↔build link is **the folder name only**; byte identity is proven only from served to disk.
- **The marketing release folder is not immutable:** `site.webmanifest` inside `20260829T015240Z-dc7b9093` is dated **2026-09-09**, 11 days after the release.
- **There is no candidate origin.** #543 `58214b2b` and the selected portal candidate (trunk `166a0838`) are **not served anywhere** approved. Candidate proof therefore exists only as local builds: flowsmartly `apps/v5` via `npm ci && npm run build:web`, and the portal via `pnpm install --frozen-lockfile && pnpm proof:build`. The earlier local audit is comment 6183444463, with evidence on `evidence/claude-local/marketing-audit-20261015`. An approved non-production preview origin is an **owner decision** (#184 comment 6201921286).
- `/early-access` (the waitlist) is still live, which is expected until #543 is deployed.
