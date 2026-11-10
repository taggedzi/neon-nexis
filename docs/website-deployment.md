# Personal website deployment

`npm run build:website` prepares `dist/` for upload, including optional recorded
music. It does not upload files, change the live site or create a release.
PHP files are copied as source for execution by the host, not minified or compiled.

## Conditional co-op packaging

The website command passes `--with-coop` to the packager. It reads the local
`php/coop-config.php`, falling back to `php/coop-config.sample.php`. Set
`NEON_COOP_CONFIG` to select a different deployment config, including one outside
the repository. Relative override paths resolve from the repository root.

- Boolean `'enabled' => true` includes `php/coop.php`, `php/coop-cleanup.php`,
  `php/lib/`, `php/coop-config.sample.php`, `php/.htaccess`, and the selected
  config renamed to `php/coop-config.php`.
- A missing enabled flag, boolean false, or the unchanged sample omits PHP.
  The build reports which result it chose. Strings such as `'true'` do not enable it.
- The build checks only the enabled flag. An empty or unusable STUN/TURN list
  still leaves co-op unavailable at runtime. It does not contact relay vendors
  or validate live connectivity during packaging.
- PHP must be available locally on PATH, or selected with `PHP_PATH`. Invalid
  config or an unavailable PHP interpreter fails before replacing `dist/`.
- Databases, backups, local data directories and development routers are excluded
  by a fixed file allowlist. Existing source config and databases are untouched.

The selected config is copied unchanged. Use a self-contained PHP array; relative
includes, environment variables and paths must also work on the production host.
The build does not replace a local database path with a hosting-specific path.
An enabled build contains secrets: keep `dist/` and any upload archive private,
and do not leave an upload ZIP in a publicly downloadable location.

Normal `node tools/ci/package.cjs --minify` and GitHub release packages still
exclude PHP and private config. `--with-coop` is rejected in GitHub Actions.
Each successful build recreates `dist/`, removing previously staged PHP if
co-op has since been disabled. Uploads must also remove stale hosted files;
omitting PHP locally does not disable an already uploaded service.

## Hostinger upload

Hostinger provides [File Manager](https://www.hostinger.com/support/4548688-basic-actions-in-the-file-manager-in-hostinger/)
for custom PHP/HTML websites. Its servers support
[`.htaccess` rules](https://www.hostinger.com/support/1583307-how-to-create-an-htaccess-file-at-hostinger/).

1. Run `npm run build:website`. Check the co-op staging message and, when
   enabled, confirm `dist/php/.htaccess` exists.
2. In the site's File Manager, upload the contents of `dist/` into the game's
   public folder (`public_html` for the domain root, or a chosen subfolder).
   Include hidden dotfiles. Keep existing unrelated website files intact.

Co-op requires HTTPS and PHP with PDO SQLite. Configure at least one valid
STUN/TURN entry in the selected config. Set its `database` key to an absolute
server path outside `public_html`, in a directory PHP can write. SQLite creates
the database automatically; do not upload a local lobby database. The default
database location is one directory above the game root, which can still be
public when the game is installed in a subfolder.

Schedule the host's daily cron to run:

```text
php /absolute/server/path/to/game/php/coop-cleanup.php
```

Use the actual PHP CLI executable and game path from the hosting account.
Verify `https://your-domain/your-game/php/coop.php?action=status` returns JSON
with `enabled: true`, and direct access to `php/coop-config.php` is denied.
The included access rules belong in `php/.htaccess`; do not replace an existing
root `.htaccess` used by another site. Live Hostinger execution and multiplayer
connectivity still require deployment checks on the owner's account.

## Implementation and validation

Maintenance follow-up to [015](work-to-be-done/015-php-coop-introduction.md),
authorized by the owner on 2026-11-10. Changed `package.json`,
`tools/ci/package.cjs`, added `tools/ci/website-coop.cjs`, and extended
`tools/check-package.cjs`. The music and development guides link this workflow.

Local packaging maintenance is implemented and verified on Windows with
Node 26.13.0 and PHP 8.4.13:

- `node tools/check-package.cjs` passed, including both minification modes,
  enabled/disabled/sample config handling, explicit config selection, the PHP
  allowlist and dotfile, private-config exclusion from public builds, CI refusal,
  malformed config and missing PHP failures, and preservation of earlier output
  on config failure. The fixture's packaged status endpoint and daily cleanup
  script ran with an isolated temporary SQLite database.
- `node tools/check-music.cjs`, `npm.cmd run check:syntax`,
  `npm.cmd run lint`, and `git diff --check` passed.
- `npm.cmd run build:website` passed with the owner's existing enabled config
  and six recorded tracks. Confirmed `dist/php/.htaccess`, the service, library,
  sample, cleanup and config were present. No source config or live database
  was changed. `npm.cmd` avoids this shell's restriction on PowerShell scripts.

Prepared on `fix/website-coop-package`. The owner subsequently authorized a
local commit and fast-forward merge into `personal-server`, which stays local
and must not be pushed to GitHub. Ignored server config and recordings remain
outside Git. The owner later authorized public GitHub delivery of the packaging
changes, excluding `personal-server` and ignored personal files.

The pre-push `npm run check` passed on `53918b9` on 2026-11-10: syntax, lint,
all registered Node checks, and 220 browser tests passed in 13.5 minutes, with
the two opt-in performance cases skipped. Functional browser environments were
Chromium 156.0.8078.4 and Firefox 157.0 on Windows, served by PHP 8.4.13.
This does not establish real-player performance or resolve reported guest jitter.
Hostinger PHP execution, enforcement of
`.htaccess`, upload, cron and live co-op remain untested. Issue 015's status
remains Implemented — needs validation; different-network acceptance is pending.
