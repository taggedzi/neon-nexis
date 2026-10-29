# Security Policy

NEON NEXUS is a solo-maintained hobby game. Security reports are welcome, but
there is no dedicated security team, guaranteed response time, service-level
agreement, or bug bounty. Review and fixes happen as the maintainer's time allows.

## Supported code

Security fixes target the latest code on the repository's default branch.
Older snapshots, forks, and modified copies are not maintained separately.
Use the latest code when checking whether a problem still occurs.

## Report a vulnerability privately

Do not open a public issue or pull request containing exploit details, secrets,
or personal data. Use GitHub's
[Report a vulnerability](https://github.com/taggedzi/neon-nexis/security/advisories/new)
feature when it is available. You need a GitHub account to submit a private report.

If that option is unavailable, check the
[maintainer's profile](https://github.com/taggedzi) for a private contact method.
If none is listed, open a minimal issue titled **Private security contact
requested**, with no vulnerability details, and wait for a private reporting
route before sending them.

Include the affected commit or version, browser and operating system, reproduction
steps, expected and actual behavior, and likely impact. A small proof of concept
is helpful. Remove tokens, private information, and unrelated local data.

Please test only your own local copy or systems you have permission to test.
Avoid accessing other people's data or disrupting hosted copies. Coordinate
public disclosure with the maintainer where possible so a fix can be prepared.
If there is no response, keep exploit details out of public follow-ups and use
your judgment about responsible disclosure; no indefinite embargo is requested.

## Scope and expectations

The game runs client-side and stores saves and settings in browser local storage.
Issues such as script injection, unexpected data exposure, or unsafe handling of
imported data are appropriate security reports. Balance problems, local score or
save editing, ordinary crashes, and performance issues generally belong in the
public bug tracker unless they have a concrete security impact.

The maintainer may ask for more information, confirm impact, and publish a fix
or advisory when practical. Credit can be included with your consent. The
[MIT License](LICENSE) describes the software's warranty terms.
