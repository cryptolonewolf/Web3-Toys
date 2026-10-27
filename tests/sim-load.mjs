// Loads the simulator content and logic the same way the browser does.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const window = {};
vm.runInNewContext(readFileSync(new URL('../data/simulator.js', import.meta.url), 'utf8'), { window });

// A plain copy, so test comparisons are not confused by the separate context.
export const data = JSON.parse(JSON.stringify(window.WEB3TOYS_SIM));
export const engine = require('../js/sim-engine.js').create(data);
