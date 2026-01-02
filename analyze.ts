#!/usr/bin/env npx tsx
/**
 * Fantasy Brain CLI
 */

import 'dotenv/config';
import { analyzePlayer, printAnalysis, comparePlayers } from './lib/edge-detector';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Fantasy Brain - Hidden Edge Detector');
    console.log('=====================================\n');
    console.log('Usage:');
    console.log('  npm run analyze "Player Name"');
    console.log('  npm run compare "Player 1" "Player 2" "Player 3"');
    process.exit(0);
  }
  
  const command = args[0];
  
  if (command === '--compare' || command === '-c') {
    const players = args.slice(1);
    if (players.length < 2) {
      console.error('Compare mode requires at least 2 players');
      process.exit(1);
    }
    await comparePlayers(players);
  } else {
    const playerName = args.join(' ');
    console.log('\nAnalyzing ' + playerName + '...');
    const analysis = await analyzePlayer(playerName);
    
    if (analysis) {
      printAnalysis(analysis);
    } else {
      console.error('Could not analyze player: ' + playerName);
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
