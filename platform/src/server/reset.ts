/** Delete the local database and uploaded files (the .data folder). */
import { rmSync } from 'node:fs';
import { loadConfig } from './config';

const { dataDir } = loadConfig();
rmSync(dataDir, { recursive: true, force: true });
console.log(`Removed ${dataDir}. Run "npm run seed" to add the sample decks again.`);
