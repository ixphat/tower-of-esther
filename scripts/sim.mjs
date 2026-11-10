// Usage: npm run sim -- [seed] [runs] [level]
// Loads the simulator through Vite so it uses the game's code and data unchanged.
import { createServer } from 'vite';

const [seed = 1, runs = 1000, level = 1] = process.argv.slice(2).map(Number);
const server = await createServer({ appType: 'custom', logLevel: 'error', server: { middlewareMode: true, hmr: false } });
try {
  const { formatReport, simulate } = await server.ssrLoadModule('/src/lib/sim.ts');
  console.log(formatReport(simulate(seed, runs, level)));
} finally {
  await server.close();
}
