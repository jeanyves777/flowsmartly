# Raw receipt, 2026-10-16T14:27:16Z–14:28:20Z (answers flowsmartly#543 6195699963, 20:58Z readback)

Read-only. Taken by the local Claude session through the owner-authorized host access. The three files here are the
**unedited command output**:

| file | what | exit |
|---|---|---|
| `workstation-curl.txt` | `curl -s -L` GETs from the workstation: status, redirect count and **full** body SHA-256 for 10 routes, the API health, and both entry bundles | every `curl_rc=0` |
| `host-ssh.txt` | over SSH: symlink targets, **full** disk SHA-256 of the same files, `nginx -t`, and the apex and API vhost path, hash and routing lines | `ssh_exit=0`, `nginx_t_rc=0` |
| `host-api.txt` | the process behind the API upstream port | `ssh_exit=0` |

The vhost excerpt was **filtered at the source** to `server_name|listen|root|location|try_files|proxy_pass|return|alias`
lines, so no `ssl_*` directive, key path or other configuration left the host. No file contents other than those lines,
no credentials, no cookies, no sign-in.

## Served bytes = disk bytes (full SHA-256)
Each row is the served body hash, which equals the disk file hash.

**Portal** (`/var/www/flowagent-portal/current` → `releases/9b01014b`):

| route | disk file | SHA-256 |
|---|---|---|
| `/login` | `login.html` | `3dc767bc7aafb2d85266bab7bbcdf84b9d0956084462986d6207162737320f73` |
| `/register` | `register.html` | `9c2c4e81653c51f83f3620128e514d47d2d737520d8c7ee486312f6437ca56c8` |
| `/verify` | `verify.html` | `f1e955b9d0bc8bac8d7768a3b7d8e7e3ea95d476be167c224767282018522c02` |
| `/forgot` | `forgot.html` | `d9f5bcdc21ae7869f7c36d8be33d87a05eede4f3b7d3db9e2b14822a2372a41c` |
| `/reset` | `reset.html` | `801444abaa9f45edd69e649a94ffa2abd593320d5b2a1f5c91dba29aa3cab41a` |
| `/auth/callback` | `auth/callback.html` | `3d04a29cb7bfd1da9dd0e8c1a466bb3efb69d46433610aa606f8e506cf2b7996` |
| `/home` | `home.html` | `7f57ec1f7f5210a8831f65e91c20266ea357efea195f50c51396301e0966e652` |
| **`/onboarding`** | `onboarding.html` | `6e9fac409f4979f145522675b7de849385da1f7a67a6ca80e074bcfb08373529` |
| entry bundle | `_expo/static/js/web/entry-456261150b909289c2fb694972efefdf.js` | `7ca856a0a3975f6e20a5020ceae369d59adf8292493cbcb6c584121177bbbcfd` |

**Marketing** (`/var/www/flowsmartly-v5/current` → `releases/20260829T015240Z-dc7b9093`):

| route | disk file | SHA-256 |
|---|---|---|
| `/` | `index.html` | `2a86146233f513dd6302fe70eae3da6c256b4df98d6903126c2ddcda225f6c5c` |
| `/early-access` | `early-access.html` | `d095f4259302eb5b18c63692fb6980721460f8b62445b1234c8a6c8cbe9de2d9` |
| entry bundle | `_expo/static/js/web/entry-92820097b614cc29b758b949024e170b.js` | `a6aca98c07ae5158f1d6a1d68c30223e51d4746162278b562039c25000c17b60` |

The marketing `login.html` (`780582f5ed8288bad08c7d2b4dcd2c0494628a491180b26aa26c5cacd7d7c6cc`, the known self-redirect)
is on disk, but **no route serves it**. `/login` is caught by the portal regex at vhost line 148 and returns the portal
file.

All 10 served hashes equal the 16-character prefixes recorded on 2026-10-15. **Nothing served has changed between the
two readings.**

## Routing (vhost `/etc/nginx/sites-available/flowsmartly-v5`, sha256 `1fdaebb96d9475d385ac96255f341ced4dfeb964482350a3091c185d24fcabf9`)
- **`:148`**: `location ~ ^/(accept-invitation|activity|approvals|auth|connections|flowagent|forgot|home|listsmartly|login|onboarding|register|reset|verify)(/|$)`
  → `root /var/www/flowagent-portal/current`, `try_files $uri $uri.html $uri/index.html =404`. It covers `/onboarding`.
- **`:158`**: the second portal regex (product doors such as `admin|ads|…|social`), with the same root.
- **Static:**
  - `^~ /_expo/` (`:175`) and `^~ /assets/` (`:182`) are served from the portal root, falling back to `@marketing_assets`
    (`:189`, the marketing root).
  - `^~ /fonts/` (`:196`) uses the server root, which is marketing.
- **Marketing:**
  - `= /` (`:205`), the marketing regex `:209` (`product|pricing|early-access|…`), legal 301s `:214–217`, and fixed static
    files `:220–230`;
  - the fallback `location /` at `:239` uses the server root `/var/www/flowsmartly-v5/current` (`:80`).
- **No `^~` prefix and no exact match can pre-empt `:148`** for the auth paths.

**API** (vhost `/etc/nginx/sites-available/api-flowsmartly`, sha256 `7053db69b302f8e20ece276ab5ed2c1e444292471cd8268de5234662dbeaa746`):
`location /` → `proxy_pass http://127.0.0.1:3210`. **Port 3210 is held by pid 3923977 = `flowagent-v5-beta-api.service`**,
whose cwd is `/opt/flowagent-v5/releases/9b01014b/api`. Note the naming: the unit whose description says "beta candidate
(loopback only)" is the one the **public** API vhost fronts. `flowagent-v5-api.service` (pid 805327) is a different
process.

**`nginx -t`**: syntax ok, test successful, rc 0. It printed two pre-existing `protocol options redefined for 0.0.0.0:443`
warnings, from `sites-enabled/flowsmartly-reserved:72` and `store-domains:39`.

## Still unproven (not manufactured)
- **Source → build identity.** No immutable manifest or receipt exists for either release folder; the link is the folder
  name only, as recorded on 2026-10-15. This receipt proves **served = disk** and **which folder is active**. It does
  not prove **disk = a build of that SHA**. That needs a reproducible build of `9b01014b` / `dc7b9093` hashed against
  these files, or a release manifest at deploy time.
- **Candidate proof.** #543 `58214b2b` and the portal candidate are not served anywhere approved. No preview origin is
  claimed.
