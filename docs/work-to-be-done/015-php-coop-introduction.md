# 015 — PHP co-op introduction with opt-in STUN

Status: Implemented — needs validation

## Feature summary

Let two friends play co-op when the site is hosted on ordinary PHP, including
free plans that cannot run Node. PHP only introduces the browsers. The hosting
player's browser runs the lobby and the match. A STUN or TURN server, chosen by
the person who uploaded the game, is required before the co-op button works.

This document records the request and the implementation on `feat/php-coop-introduction`.

## Problem and current behavior

Co-op introduction is `server/coop-server.cjs`, started with `npm run signal`.
It is a long-running Node process. It accepts incoming WebSocket connections on
port 8787, creates room codes, forwards WebRTC setup, can relay gameplay, and
owns shared pause. Shared PHP hosting cannot keep that process running, and it
cannot accept incoming WebSockets.

The browser does not use a STUN server unless something sets
`NEON.Net.iceServers` first. That list is empty by default, so two players on
different home networks usually cannot open a direct link. The match then
continues over the Node relay.

The start menu always shows **CO-OP UPLINK** (`#btn-coop` in `index.html`).
Solo play does not need the signaling server.

[Issue 014](014-coop-lobby-and-revival.md) already defines the lobby, revival,
and rejoin behavior. The Node process is still the authority for lobby
membership, ready-up, launch, and shared pause. See
[the protocol](../coop-protocol.md) and the 2026-10-30 decision that pause is
server-owned.

## Owner-requested behavior

### One co-op path

When this issue is built, co-op has one path: PHP, SQLite, the admin's STUN or
TURN list, and a WebRTC data channel. `server/coop-server.cjs` and
`npm run signal` are removed as a way to play. Lobby and pause rules are not
maintained twice.

Until that work lands, the Node server remains the running path. This request
does not disable it.

Local co-op uses the same PHP scripts as the public site, for example PHP's
built-in server. There is no second development-only server.

### What each part does

| Part | Role |
| --- | --- |
| The static game files | The site. Any PHP host can serve them. |
| PHP and one SQLite file | Room code, connection cards, and host check-ins. |
| The admin's STUN or TURN servers | Help the browsers learn a public address, or relay only when a direct link cannot open. |
| The hosting player's browser | Lobby, ready-up, launch countdown, shared pause, resume, and the world. |
| The guest's browser | That player's ship, and the messages the host already accepts. |

PHP does not simulate the game, store shots or positions, or decide pause.
If the direct link never opens, both players stay on the connecting screen.
There is no PHP gameplay relay. That drops today's fallback, where a failed
WebRTC link keeps playing through the Node server.

A dropped direct link can exchange a new connection card through PHP while the
lobby row still exists. The host keeps the run.

### Admin configuration

The person who uploads the game is the admin for that copy. They edit a PHP
config file on the server. The implementation commits a sample with co-op
turned off and an empty address list. The real file is not committed. Secrets
stay in the real file.

Intended shape of that file:

```php
<?php
return [
  'enabled' => false,
  'credentialTtlSeconds' => 7200,
  'iceServers' => [
    // ['urls' => 'stun:stun.example.com:3478'],
    // [
    //   'urls' => ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
    //   'secret' => 'shared-secret-kept-on-the-server',
    // ],
    // ['provider' => 'twilio', 'accountSid' => '', 'authToken' => ''],
  ],
];
```

Co-op stays off unless `enabled` is true and the list has at least one STUN or
TURN URL. The browser asks PHP for this status. PHP returns the address list
the browser should use. List order is the fallback order. WebRTC tries a
same-machine address, then a STUN public address, then a TURN relay.

The **CO-OP UPLINK** button stays visible and is disabled when co-op is off,
when the list is empty, or when the status request fails. The menu shows that
co-op is unavailable until the site admin enables it. A solo run still works.

### Keys and paid relays

A STUN URL has no username or password. The browser only needs the address.

A self-hosted TURN server, usually coturn, uses the TURN REST pattern from
draft-uberti-behave-turn-rest. coturn is configured with `use-auth-secret` and
the same shared secret as the config file. PHP mints a username of
`expiryUnix:clientId` and a credential of base64 HMAC-SHA1 over that username.
coturn checks the HMAC and rejects an expired username. The default lifetime is
`credentialTtlSeconds` (2 hours). The admin can change that number. A leaked
password stops working when it expires. The shared secret is never sent to the
browser.

A paid relay uses an API key or account secret in the config file. PHP calls
that vendor's token endpoint and passes the returned `iceServers` list to the
browser. Twilio Network Traversal, Cloudflare Realtime TURN, Metered, and
Xirsys already issue short-lived credentials this way. The API key stays on
the server.

Do not put a long-lived TURN password in JavaScript, the sample config, or the
repository.

### Lobby storage

SQLite is one file on the server. It is stored outside the public download
path, or direct download is denied. A row exists only while that lobby is
hosted. It holds the room code, the two connection cards, and the host's last
check-in. It does not hold the world, pause state, or shots.

- The host's browser checks in about every 30 seconds. The check-in means the
  lobby is still hosted. It is not gameplay.
- The host closing the lobby, or leaving, deletes the row immediately.
- A guest leaving does not delete the lobby. The host keeps the code, matching
  the current game.
- If check-ins stop for 10 minutes, PHP deletes the lobby. Every PHP request
  runs this cleanup, so a missed daily job still removes a crashed host.
- A once-a-day cron deletes any row still left 24 hours after it was created.
  That covers an unused lobby whose 10-minute cleanup never ran because nobody
  sent another request. The admin schedules it on the host. The command shape
  is `php /absolute/path/to/coop-cleanup.php`, once a day. The exact path
  depends on the account.

### Relationship to issue 014

Issue 014's lobby, ship and color choices, ready-up, shared respawns, revival,
return to the same lobby, and guest rejoin stay. The host browser enforces
them over the data channel. The Node process no longer does.

Issue 014's gameplay-relay fallback does not stay. A failed direct link does
not keep the match going through PHP.

`docs/coop-protocol.md` is updated when this issue is implemented. It is not
rewritten by the request itself.

### Later implementation notes

These are part of building the issue, not part of writing this request:

- Add the PHP introduction scripts, the cleanup script, the sample config, and
  a gitignore rule for the real config file and the SQLite file.
- Teach `js/net.js` to use the PHP introduction and to send lobby and pause
  control over the data channel once it is open. `Net.sendControl` today sends
  only on the signaling socket.
- Retarget co-op checks that start the Node server, including
  `tools/check-coop-server.cjs`, `npm run signal`, and
  `tools/ci/coop-smoke.spec.cjs`.
- Remove the `ws` dependency if nothing else needs it.

## Acceptance criteria

- [x] With the sample config, with co-op switched off, or with an empty address
  list, **CO-OP UPLINK** is visible and disabled, and a solo run still works.
- [x] The same disabled result happens when the PHP status request fails.
- [ ] With co-op on and at least one STUN URL, two players on different home
  networks can exchange a code, open a data channel, play, pause together, and
  return to the same lobby. The host's browser is the authority for lobby and
  pause.
- [x] A TURN entry uses a server-side secret or vendor API key and short-lived
  credentials. The browser never receives the long-term secret or the API key.
- [x] The host closing the lobby deletes it immediately. A host crash deletes it
  within about 10 minutes. A once-a-day cleanup removes rows older than 24
  hours.
- [x] A guest leaving does not delete the host's lobby.
- [x] A dropped direct link can be introduced again through PHP while the lobby
  row exists, without a gameplay relay.
- [x] If the direct link never opens, the players stay on the connecting screen.
- [x] The Node signaling process is not a supported play path, and the co-op
  checks no longer depend on it.
- [x] Single-player, saves, settings, controls, and appearance stay as they are.

## Decisions and scope record

- Date: 2026-10-31.
- Approval source: Owner instructions in chat on 2026-10-31, including the
  answers that the address list lives in a server config file, crashed lobbies
  expire after about 10 minutes plus a daily sweep, and the store is SQLite.
- Accepted requirements: one co-op path through PHP, SQLite, opt-in STUN or
  TURN, and WebRTC; the hosting browser does the lobby and match work; co-op
  stays off until the admin enables at least one address; lobbies exist only
  while hosted.
- Rationale: Friends on ordinary PHP hosting, including free plans, should be
  able to play together without running Node or maintaining two servers.
- Consequences: Building this issue removes the Node signaling play path and
  the gameplay relay. Some networks still fail when the admin lists only STUN
  and the direct link cannot open. The host's tab is the game server; closing
  it ends the session after the 10-minute cleanup.
- Not approved by the original request text: writing the PHP scripts or
  changing the client. Superseded on 2026-10-31 by the owner instruction to
  implement this issue. That instruction approves the PHP scripts and the
  client change. The Node signaling process is no longer a play path.
- Supersedes: the 2026-10-30 decision that the signaling server owns shared
  pause, and the Node process as the co-op introduction. Recorded in
  `docs/decisions.md`.

## Implementation and validation

Status: Implemented — needs validation. Automated checks below passed on this
branch. Two players on different home networks were not tested, so that box
stays open and the issue is not Done.

### Decisions recorded with the implementation — 2026-10-31

- Approval source: owner instruction on 2026-10-31 to implement this issue.
  That instruction approves writing the PHP scripts and changing the client.
  It supersedes the original request note that writing PHP was not approved.
- The hosting browser owns lobby membership, ship and color, ready-up, launch
  countdown, shared pause, respawns, revival, return to the same lobby, and
  guest rejoin. PHP only introduces the browsers. There is no gameplay relay.
- A guest ignores an answer whose session does not match its current offer.
  The host forgets the previous card revision when the guest id changes, and
  restarts the about-10-second offline grace when it answers a new offer from
  an offline guest, and clears that guest if the link does not open. A
  same-guest reconnect receives the current pause epoch.
  A later session sync does not replace a newer epoch.

### Changed files

PHP introduction, sample config, router, cleanup, and gitignore; client
introduction and host authority in `js/net.js`, `js/coop-host.js`,
`js/coop-session.js`, and `js/ui.js`; Playwright served by
`tools/ci/serve-php.cjs`. Removed `server/coop-server.cjs`,
`tools/check-coop-server.cjs`, `npm run signal`, and the `ws` dependency.
Protocol, decisions, `COOP_PROGRESS.md`, and this issue describe the PHP path.

Commits on `feat/php-coop-introduction`: `b0f2239`, `50c05dc`, `ab76e16`,
`1b37819`, `ad07a44`, `5990649`, `3b8ad70`, `de86567`, `52870d3`, `b5003ed`,
`ba07c5e`.

### Checks and results

- `node tools/check-coop-php.cjs` passed twice (57 assertions, exit 0). The
  log is the implementation scratch `php-coop-unit.log`. `npm run check`
  ran the same script again and it passed. The test drives the shipped PHP
  front script: disabled and empty gates, independent HMAC-SHA1, paid-relay
  stand-in token calls, row contents, download denial, host delete, guest
  leave, a 10-minute deletion from an aged timestamp, the daily cleanup of a
  row older than 24 hours, and a replacement card. Secrets are absent from
  the response, the client, and the sample. Production defaults stay 30
  seconds, 10 minutes, 7200 seconds, and 24 hours.
- `npm run check` passed on `3b8ad70`: syntax, lint, unit checks, and the
  browser suite. Result: `88 passed (12.9m)`, exit 0. Playwright 1.64.1 on
  Chromium 156.0.8078.4 and Firefox 157.0. PHP 8.4.13 served the site on
  127.0.0.1 ports 4173 and 4174. The co-op page gate passed on Chromium
  156.0.8078.4. The gate's assertion count includes each status JSON key, so
  the count is not a stable requirement.
- `de86567` sets the room code in the smoke spec when Firefox drops
  `locator.fill`. That spec file was run before the commit and was not edited
  again: `npx playwright test tools/ci/coop-smoke.spec.cjs` passed on both
  browsers, `40 passed (11.1m)`, exit 0. The log is `playwright-coop-3.log`.
- `npm run check` passed again on the tree that contains `de86567`:
  `88 passed (12.9m)`, exit 0. Syntax, lint, unit checks, and the browser
  suite passed. PHP reported 57 assertions again. The co-op page gate passed
  on Chromium 156.0.8078.4. The log is `npm-check-tip.log`.
- With the sample config, the browser spec saw zero page errors, **CO-OP
  UPLINK** visible and disabled, the copy "Co-op is unavailable until the
  site admin enables it.", a solo new run, and `#game` at 1280×720 with at
  least 48 of 64 samples painted and at least 3 distinct colors.
- The same browser spec, on both browsers, covered shared pause, a link that
  never opens, a brief direct-link drop inside the host grace, guest leave
  keeping the lobby, and guest reload and replacement. A local two-browser
  run is not two home networks.
- Solo browser checks in that `npm run check` covered start, move, pause,
  save, reload, continue, save removal, and settings paths. No separate
  owner look-and-feel review was run. Rendering, saves, settings, and
  controls were not retargeted by this issue.
- `package.json` has no `signal` script and no `ws` dependency. No co-op
  check starts `server/coop-server.cjs`.
- `b5003ed` deletes a quiet lobby on every PHP entry, including status, an
  empty action, and a disabled request. `node tools/check-coop-php.cjs`
  passed twice afterward (61 assertions, exit 0). A recent lobby still
  survives status. The log is `php-coop-stale-status.log`.
- `ba07c5e` restarts the offline grace when a re-offer is taken.
  `node tools/check-coop-lobby.cjs` passed. The guest is still present after
  the original deadline, then cleared when the restarted grace ends. Opening
  the link cancels that grace. The log is `coop-lobby-grace.log`.
- `npm run check` passed again on this tree: `88 passed (12.9m)`, exit 0.
  The same run reported 61 PHP assertions and the hung re-offer lobby check.
  The log is `npm-check-sweep.log`.
- `npx playwright test tools/ci/coop-smoke.spec.cjs` passed again on both
  browsers after those fixes: `40 passed (11.2m)`, exit 0. The log is
  `playwright-coop-4.log`.

### Personal website packaging follow-up — 2026-11-10

The owner requested automatic PHP and `php/.htaccess` staging for a Hostinger
Premium website only when co-op is enabled. This focused maintenance change is
implemented on `fix/website-coop-package`. The owner subsequently authorized
a local commit and merge into `personal-server`; that branch must stay off
GitHub. `package.json` now opts
the local website build into conditional PHP staging in `tools/ci/package.cjs`
and the bounded helper `tools/ci/website-coop.cjs`. The selected enabled config
is copied as `php/coop-config.php`; public release builds exclude it. A fixed
allowlist excludes databases, backups and development routers. Source config
and production state are unchanged.

`node tools/check-package.cjs` passed enabled/disabled/config-override, dotfile,
allowlist, credential-isolation and failure cases, and executed the packaged
PHP status endpoint and cleanup script against temporary fixture state.
Music regression, syntax, lint, `git diff --check`, and the actual website
build with six tracks also passed. See [deployment and validation details](../website-deployment.md).
Hostinger upload, access-rule enforcement and live co-op are untested; this
does not complete the original different-home-networks acceptance criterion or
change this issue's Implemented — needs validation status.

### Limitations and remaining work

- The different-home-networks box is unchecked. No coturn install and no
  live Twilio, Cloudflare, Metered, or Xirsys call. The paid-relay check
  uses a local stand-in token endpoint.
- Owner playtesting of co-op feel is still open. That is why the status is
  not Done.
