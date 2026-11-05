# 034 — Optional crash reports

Status: Planned (deferred by owner, 2026-11-04)

This document is a plan only. It does not change how the game plays.
Building the work is a separate later task.

Priority 18 of 21 in the proposed order in [the todo list](../TODO.md).

## Problem

If the client crashes, the player should be able to send a report that reaches
the developer. Sending must be voluntary. The game must run with no report and
with no report server.

## What exists today

The game is client-side. The PHP co-op service introduces peers and mints relay
credentials. It does not store gameplay, and it is not a mailbox. Adding "the
server" as a crash inbox would be a new backend. Project rules require a
concrete need and a discussion before a backend. This document is that
discussion, not approval to build one.

`window.onerror` and `unhandledrejection` can observe some script failures.
They do not observe a tab killed by the operating system, a GPU reset, or a
freeze that never returns to script. A report feature cannot promise those.

There is no telemetry. Credits currently say there is no tracking. A crash
sender, even an optional one, has to stay consistent with
[issue 030](030-about-page.md) and with
[issue 022](022-debug-logging.md).

Private vulnerability reports already have a path through GitHub security
advisories. A crash report is not that path. Players should not be steered to
paste a save file into a public issue by default.

## Determine

- Which failures the owner has actually seen: a red console, a stuck ship, a
  dead tab, or a co-op disconnect. The tool should match that failure.
- What a useful report contains: version, browser user agent, mode, last
  sector number, and the error message. Confirm a save, a room code, and ICE
  credentials are absent.
- Whether GitHub already solves delivery. A downloaded file that the player
  attaches to a private advisory or an issue needs no new server.

## Decide

- Local download only, or a receiving server.
- If a server is required, who operates it, how long reports are kept, and how
  it rejects a flood. That decision is separate from the report contents.
- Whether the prompt appears automatically after a caught error, or only from
  a menu item. Automatic prompts must still default to "do not send".

Proposal, not approved:

- Do not add a crash server in this issue.
- After a caught script error, show a dismissible notice. The default action
  is dismiss. A second action downloads a JSON report.
- The report holds version, user agent, mode, sector number if a run exists,
  and the error name and message. It does not hold the checkpoint, settings,
  room code, peer ids, or any credential.
- The notice tells the player they may attach the file to a GitHub issue or to
  a private security advisory if they believe it is sensitive. It does not
  upload anything.
- Uncaught tab death stays out of scope. The menu can still offer "download a
  diagnostic" with the same fields and no error message.
- If the owner later wants a server, write a new decision. Do not fold that
  server into the co-op PHP service without an explicit approval. The co-op
  service would then store player reports, which it does not do today.

## Do

If the local-download proposal is accepted:

- Add the notice and the menu action.
- Build the JSON from the approved fields only. Test that a sample save string
  and a sample room code do not appear.
- The game remains playable when the notice is dismissed and when downloads are
  blocked.
- Update the About / Credits tracking sentence only if issue 030's copy would
  become false. "No upload" remains true under this proposal.

If a server is approved instead:

- Stop and write the retention, abuse limit, and operator choices into this
  issue before any endpoint. Do not reuse the co-op actions as the inbox unless
  that was explicitly decided.
- The client path stays optional and the game still runs when the server is
  unreachable.

## Acceptance criteria

- [ ] The owner has chosen local download or a server.
- [ ] Playing never requires a report to be sent or saved.
- [ ] A caught error can produce a report that contains only the approved fields.
- [ ] A fixture proves a checkpoint and a room code are not in the file.
- [ ] Dismissing the notice returns the player to the game or the menu without
      data loss.
- [ ] No new backend exists unless a separate server decision was approved.

## Open questions

- Should the report include the last few player-visible notices?
- Is a co-op disconnect a "crash" for this feature, or only a script exception?

## Dependencies

Follow the [2026-11-02 debugging decision](../decisions.md#2026-11-02--add-debugging-only-when-needed):
the owner declined a logging subsystem and will add debugging only when needed.
[Issue 022](022-debug-logging.md) is closed as a decision, not a logging
implementation. Crash reporting remains unapproved under this issue. Copy must match
[issue 030](030-about-page.md). This does not depend on minification or on
four-player co-op.

## Implementation and validation

Owner decision, 2026-11-04: defer crash reports until a later project phase.
No implementation is authorized now, and no return date is set. The issue stays
Planned; it is not a dependency of issue 035. No runtime files changed or checks
required for this deferral.
