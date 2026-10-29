const { test, expect } = require('@playwright/test');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');

const suites = [
  ['camera', 'camera', 'cameraResult'],
  ['controller', 'controller', 'controllerResult'],
  ['discarded-items', 'discarded-items', 'discardedItemsResult'],
  ['discarded-items', 'rewards', 'rewardsResult'],
  ['driving', 'driving', 'drivingResult'],
  ['firing', 'firing', 'firingResult'],
  ['map-combat', 'maps', 'mapCombatResult'],
  ['ships', 'ships', 'shipsResult'],
  ['spawning', 'spawning', 'spawningResult']
];

// Fail loudly when a new browser regression script has not been registered.
test('all browser regression scripts are registered', () => {
  const files = readdirSync('tools').filter(name => /^check-.*\.js$/.test(name)).sort();
  expect([...new Set(suites.map(([file]) => 'check-' + file + '.js'))].sort()).toEqual(files);
});

for (const [file, query, resultName] of suites) {
  test('regression: ' + query, async ({ page, browser }) => {
    console.log('Browser: ' + browser.browserType().name() + ' ' + browser.version());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto('/?test=' + query);
    await expect(page.locator('#btn-boot')).toBeEnabled();
    // evaluate awaits async IIFEs and reports rejected assertions immediately.
    await page.evaluate(readFileSync(path.resolve('tools/check-' + file + '.js'), 'utf8'));
    const result = await page.evaluate(name => window[name], resultName);
    expect(result.passed).toBeGreaterThan(0);
    console.log(query + ': ' + result.passed + ' assertions');
    expect(errors).toEqual([]);
  });
}
