# NEON NEXUS

A browser-based, top-down survival shooter with neon wireframe visuals,
procedural sectors, and synthesized audio. Survive enemy waves, collect equipment,
choose upgrades, and push into increasingly difficult sectors.

This is a solo hobby project, built with plain JavaScript, HTML5 Canvas, CSS,
and Web Audio. Development and support happen as time allows.

## Run locally

Clone or download this repository, then serve its root with a static HTTP server.
For example, with Python 3 installed:

```sh
git clone https://github.com/taggedzi/neon-nexis.git
cd neon-nexis
python3 -m http.server --bind 127.0.0.1 8000
```

Open [localhost:8000](http://localhost:8000/), click **Engage**, and choose
**New Run**. Stop the server with Ctrl+C. If port 8000 is occupied, choose another
port and use it in the browser URL. No package installation or build step is
required. Graphics and audio are generated locally; there is no game backend.

Use a current desktop browser with Canvas and Web Audio support. Gamepad support
depends on the browser and device; physical-controller validation is still pending.

## Browser support targets

These are development goals, not compatibility or performance guarantees. Browser
checks must record the actual version and environment tested.

| Browser | Desired target | Validation status |
| --- | --- | --- |
| Firefox | Current stable desktop release | Cross-browser acceptance pending |
| Google Chrome | Current stable desktop release | Cross-browser acceptance pending |
| Chromium | Current stable desktop release | Cross-browser acceptance pending |

This matrix does not promise support for every operating system, controller,
mobile device, or older browser version.

## Play

Choose a ship and color, stay mobile, and build your loadout from weapons,
modules, and protocol upgrades. Clear a sector by destroying its Null Anchors
or surviving the sector timer.

| Default keyboard / mouse input | Action |
| --- | --- |
| W / A / S / D | Move |
| Mouse | Aim |
| Left mouse button or F | Fire |
| Space | Dash |
| Q / E | Previous / next weapon |
| I | Inventory |
| R | Pending rewards |
| Escape | Pause |

Keyboard and controller bindings, movement and firing modes, audio, and visual
options are available in **Settings**. The in-game control reference reflects
your current bindings. Controllers use the left stick to move and the right
stick to aim, with configurable buttons for other actions.

Saves and settings use the browser's local storage. Continue in the same browser
profile and at the same address, including port. Clearing site data can remove
progress; saves do not sync between devices.

Unsupported or unreadable saves offer **Export and remove** or **Remove without
export**. Compatible saves continue to work; developers own format compatibility.
Settings are kept. Export starts a browser download before removing the checkpoint.

## Development and releases

Run `npm ci --ignore-scripts`, install the Playwright browsers, then use
`npm run check` for syntax, lint, regression and browser smoke tests. These are
development tools; playing locally still requires no package installation.

GitHub Actions checks pull requests and main. The **Publish game** workflow
publishes to GitHub Pages only when manually run on main. Versions use
`YYYY.MM.DD.####` (New York date and a four-digit workflow run number). Hosted
deployment has not yet been validated. See the
[development and release guide](docs/development-and-releases.md) for setup,
save policy, limitations and deferred work. There is no rollback procedure during
this development phase.

## Project status and contributions

The game is under active hobby development. Some implemented features still
need player, controller, or performance validation. See the
[local backlog](docs/work-to-be-done/README.md) for current status and known work.

Release versions use the date convention described above. No public deployment
has been performed. Changelog setup remains pending deployment validation; see
[issue 013](docs/work-to-be-done/013-deployment-and-changelog.md).

Bug reports, focused improvements, and documentation fixes are welcome. Read
[Contributing](CONTRIBUTING.md) before opening a pull request and follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities using the
[Security Policy](SECURITY.md), rather than a public issue.

## Source layout

- `index.html` — page shell and script loading.
- `css/` — interface styling.
- `js/` — game logic, procedural assets, input, rendering, and interface.
- `tools/` — development checks and performance tooling.
- `docs/work-to-be-done/` — local issue tracker and validation records.

Developers and AI contributors should read the
[web development style guide](docs/web-development-style-guide.md).

## License

[MIT](LICENSE). Copyright © 2026 Matthew Craig.
