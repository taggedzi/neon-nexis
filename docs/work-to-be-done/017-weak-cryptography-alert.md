# 017 — Resolve the weak-cryptography scanning alert

Status: Planned

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

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

The owner chooses one outcome:

- Keep HMAC-SHA1, document why on the alert, and dismiss alert 2 as the
  required TURN REST algorithm. The test stays, because it proves the mint
  matches that algorithm.
- Or name a TURN deployment that accepts a different MAC, and only then change
  both the PHP mint and the independent test together.

Proposal, not approved: keep HMAC-SHA1 and dismiss the alert with the protocol
reason. Do not treat the test username as a secret.

A dismissal comment should say the username is the public TURN username, the
secret never leaves the server, and SHA-256 is not interchangeable here.

## Do

After the decision:

- If keeping SHA-1: add a short comment at the mint and the test that points at
  the protocol document, then dismiss alert 2 with that rationale. Re-check
  that a later scan does not open a new instance without a matching note.
- If changing algorithms: change PHP and the test together, name the server
  that will accept the new MAC, and run the co-op PHP checks against that
  behavior. Do not deploy a mint the server cannot verify.
- Record the choice in this issue. If it changes the protocol contract, add a
  decision entry and update [the co-op protocol](../coop-protocol.md).

## Acceptance criteria

- [ ] The open alert is either fixed in code or dismissed with a written reason
      the owner approved.
- [ ] The production mint and the test use the same approved algorithm.
- [ ] A TURN REST deployment that must use HMAC-SHA1 still receives HMAC-SHA1.
- [ ] The long-term TURN secret is still not sent to the browser.

## Open questions

- Is a self-hosted TURN server actually in use, or is this path only ready for
  later configuration?
- Should the dismissal be done by the owner in the GitHub UI?

## Dependencies

None. This does not wait on other todo items. It must not be "fixed" by
weakening the co-op secret handling in [issue 015](015-php-coop-introduction.md).

## Implementation and validation

Not started. No files have been changed for this issue. No checks have been run.
