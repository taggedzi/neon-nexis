# Performance checks for issue 001

Serve the repository on localhost. `benchmark.js` is development tooling, is not
loaded by `index.html`, and has no package/build dependency.

Use a **new, isolated browser context**, 1920×1080, device scale factor 1. Do not
reuse the owner's browser profile or clear its storage. Disable the normal main
loop before navigation with this Playwright init script:

```js
await context.addInitScript(() => {
  window.__benchmarkRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = () => 0;
});
await page.goto('http://127.0.0.1:8000/');
await page.addScriptTag({url: '/tools/performance/benchmark.js'});
await page.evaluate(() => NeonBenchmark.start({scenario:'normal', frames:600}));
```

Poll `NeonBenchmark.running`; when null, collect `NeonBenchmark.result` as JSON.
Run scenarios sequentially without other actively rendering tabs. Use the same
browser, machine, viewport, DPR, quality, seed, warmup, frame count and harness on
both revisions. Record the revision, browser version, OS/CPU/GPU and actual
rendering mode separately. The result includes exact graphics settings.

- Normal play: `scenario:'normal', frames:600` (10 measured simulation seconds).
- Large wave: `scenario:'large-wave', frames:600` (120 initial enemies before
  warmup; record actual count samples, since enemies can die normally).
- Accelerated retention: `scenario:'normal', frames:72000, renderEvery:60`
  (20 simulation minutes; only one rendered frame per simulation second).
- Full extended run: `scenario:'normal', frames:72000, renderEvery:1` (20
  simulation minutes with every frame rendered; wall duration depends on speed).

Warmup defaults to 120 simulation frames and is excluded from all timing totals.
The benchmark uses a fixed 1/60 simulation step, seeded movement/aiming, normal
weapons, native spawning, invulnerability so death cannot end a run, automatic
first-protocol choice, declining overflow, and advancing completed sectors. These
are test fixtures only. Save writes are suppressed. Simulation and rendering use
separate random streams so render sampling does not alter the combat workload.
DOM overlays remain active. Audio remains in its initial locked state (the harness
does not send the user gesture that unlocks audio); audio costs require a separate
interactive check. This is repeatable scripted play, not an
assertion that the scenario covers every human playstyle, weapon or encounter.

The accelerated check exercises simulation, entity cleanup and sector transitions;
it **does not validate 20 minutes of continuous rendering or real-time memory
behavior**. Heap snapshots are uncollected used-JS-heap samples, not retained
memory measurements, and omit canvas/GPU backing stores. Use browser memory/GC
tools and a full run before claiming the memory acceptance criterion.

`timing.raf` reports frame callback intervals including scheduling and rendering;
`timing.render` is synchronous Canvas submission time, not total raster/compositor
time. Profiling wrappers add overhead. On a software-rendered/headless browser,
these results cannot establish the agreed real-player 16.7 ms p95 target.
For accelerated retention, `timing.raf` also includes microtask simulation ticks;
ignore that metric in accelerated results. Use the every-frame scenarios for
frame-interval comparisons.

Run `node tools/performance/check-glow-cache.cjs` to check allocation-free hits,
parameter isolation, preserved gradient stops and eviction under color churn.

For player confirmation, run the normal game at 1080p/high quality on the agreed
machine with developer-tool frame recording. Capture normal combat, a large wave,
and a full 20-minute run, recording counts, browser/GPU, frame-time percentiles,
memory trend and visual observations. Keep enemy cadence and effects unchanged.
