#!/usr/bin/env node

import { Runtime } from './runtime.js';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function main() {
  // Get configuration from environment or defaults
  const dbPath = process.env.AIOS_DB_PATH || resolve(process.cwd(), 'data/aios.db');
  const wsPort = parseInt(process.env.AIOS_WS_PORT || '9876');

  // Ensure data directory exists
  const dataDir = resolve(dbPath, '..');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const runtime = new Runtime(dbPath, wsPort);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await runtime.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await runtime.stop();
    process.exit(0);
  });

  // Start the runtime
  await runtime.start();

  // Keep process alive
  console.log('Press Ctrl+C to stop');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
