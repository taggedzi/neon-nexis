# 017 — Resolve the weak-cryptography scanning alert

Status: Implemented — needs validation

Keeping HMAC-SHA1 does not change how the game plays.

Priority 1 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

GitHub code scanning alert 2 is open on `main`. CodeQL rule
`js/weak-cryptographic-algorithm` reports a broken or weak cryptographic
algorithm at high severity. The alert points at the co-op test, and the same
algorithm is used by the live TURN credential mint.

Alert: <https://github.com/taggedzi/neon-nexis/security/code-scanning/2>

The flagged line is `tools/check-coop-php.cjs` line 188, on commit `9deb91b`.
CodeQL says a weak algorithm depends on sensitive data from a username access.

## What exists today

`php/lib/credentials.php` function `neon_coop_mint_turn` builds a TURN username
of `expiryUnix:clientId` and sets the credential to base64 HMAC-SHA1 of that
username with the server secret.

The test computes the same HMAC-SHA1 with Node `crypto.createHmac` and checks
that PHP returned it. The username in that test is the public TURN username,
not a password.

[The co-op protocol](../coop-protocol.md) and
[issue 015](015-php-coop-introduction.md) require this HMAC-SHA1 shape. It is
the coturn `use-auth-secret` / TURN REST credential form. A standard TURN
server checks HMAC-SHA1. Paid relays (Twilio, Cloudflare, Metered, Xirsys) do
not use this function. They get credentials from their own token calls.

Switching the mint to SHA-256 would make credentials that a normal TURN server
rejects. That would break opt-in co-op relays, not make them safer.

## Determine

- Confirm the deployed TURN server, if any, still requires HMAC-SHA1 for
  REST credentials. Record the server and the setting checked.
- Confirm no second use of SHA-1 or another weak algorithm exists outside this
  TURN credential. The alert instance found on 2026-11-01 was only the test
  line above.
- Read CodeQL's dismissal options and whether a documented suppression is
  available for a protocol-required algorithm.

## Decide

Approved 2026-11-01 by the owner: keep HMAC-SHA1, and dismiss alert 2 as won't
fix. The test stays, because it proves the mint matches that algorithm.

The username is the public TURN username. The secret never leaves the server.
SHA-256 is not interchangeable here.

No self-hosted TURN server is deployed. The committed sample leaves co-op off.
This machine has no `php/coop-config.php`. Hostinger Premium cannot run coturn.
Paid relays do not use this function. No deployment was named that accepts a
different MAC, so the mint was not changed to another hash.

## Do

Done on branch `fix/turn-rest-hmac-sha1`:

- Comments at the mint and the test point at the protocol document. The test
  comment is also a CodeQL suppression for `js/weak-cryptographic-algorithm`
  on the following line.
- Alert 2 is dismissed as won't fix with the protocol reason.
- The algorithm was not changed. The protocol contract is unchanged, so
  `docs/decisions.md` and [the co-op protocol](../coop-protocol.md) were not
  edited.

Remaining: after this branch is on main, confirm the next CodeQL scan does not
open a new instance of `js/weak-cryptographic-algorithm` without that note.

## Acceptance criteria

- [x] The open alert is either fixed in code or dismissed with a written reason
      the owner approved.
- [x] The production mint and the test use the same approved algorithm.
- [x] A TURN REST deployment that must use HMAC-SHA1 still receives HMAC-SHA1.
- [x] The long-term TURN secret is still not sent to the browser.

## Open questions

Answered 2026-11-01:

- A self-hosted TURN server is not in use. The mint is ready for a later coturn
  configuration, which still expects HMAC-SHA1.
- The owner asked the agent to dismiss alert 2. Dismissal is not left only to
  the GitHub UI.

## Dependencies

None. This does not wait on other todo items. It must not be "fixed" by
weakening the co-op secret handling in [issue 015](015-php-coop-introduction.md).

## Implementation and validation

Changed files:

- `php/lib/credentials.php` — comment above the HMAC-SHA1 mint.
- `tools/check-coop-php.cjs` — protocol comment and CodeQL suppression on the
  line before the independent HMAC-SHA1 check.
- `docs/work-to-be-done/017-weak-cryptography-alert.md` — this record.
- `docs/work-to-be-done/README.md` — status.

Findings before the edit:

- Alert 2 was open on `main` at `tools/check-coop-php.cjs` line 188, commit
  `ccc146b`. Rule `js/weak-cryptographic-algorithm`. CodeQL scans JavaScript
  only in this repository.
- SHA-1 in code is only `hash_hmac('sha1', ...)` in `neon_coop_mint_turn` and
  `crypto.createHmac('sha1', ...)` in the test. No MD5, DES, or RC4 in the
  JavaScript or PHP.
- No live TURN server is configured. `php/coop-config.sample.php` leaves co-op
  off. This machine has no `php/coop-config.php`.
- coturn's documented REST password is still HMAC-SHA1 of the public username.
  A normal `use-auth-secret` server rejects a different hash.
- GitHub dismissal reasons are false positive, won't fix, and used in tests.
  Won't fix matches a protocol-required algorithm. A `codeql[rule-id]` comment
  suppresses the next line on a later scan.

Checks:

- `node tools/check-coop-php.cjs` passed, 61 assertions, exit 0. PHP 8.4.13.
  That run includes the independent HMAC-SHA1 match and the check that the
  status body does not contain the long-term secret.
- `npx eslint tools/check-coop-php.cjs` passed. `git diff --check` passed.
- `npm run check` was not run. The algorithm and the browser client did not
  change.
- No live coturn was contacted. The mint still emits HMAC-SHA1, which is what
  that server would check.
- Alert 2 dismissed 2026-11-01T19:59:42Z as won't fix by `taggedzi`. Comment:
  the username is the public TURN username, the secret never leaves the
  server, and SHA-256 is not interchangeable. A follow-up list of open code
  scanning alerts was empty.

Limitations:

- The next CodeQL scan of `main` has not run. This branch is not on `main`
  yet, so a new instance after merge has not been observed. The suppression
  comment is the note that scan should see.

Remaining work: after merge, confirm code scanning does not open a new
`js/weak-cryptographic-algorithm` instance without the protocol note. Then
this issue can move to Done.
