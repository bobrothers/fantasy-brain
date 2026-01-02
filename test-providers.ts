/**
 * Test script to verify data providers are working
 */

// Load environment variables from .env file
import 'dotenv/config';

import { sleeper } from './lib/providers/sleeper';
import { weather, NFL_STADIUMS } from './lib/providers/weather';
import { espn } from './lib/providers/espn';
import { odds } from './lib/providers/odds';

async function testSleeper() {
  console.log('\n=== Testing Sleeper API ===');
  
  try {
    const state = await sleeper.getNflState();
    console.log('Current NFL state:', state);
    
    const trending = await sleeper.getTrendingPlayers('add', 24, 5);
    console.log('Top 5 trending adds:', trending);
    
    console.log('Fetching player database (this takes a few seconds)...');
    const players = await sleeper.getAllPlayers();
    console.log(`Loaded ${players.size} players`);
    
    const mahomes = Array.from(players.values()).find(p => 
      p.name.toLowerCase().includes('mahomes')
    );
    if (mahomes) {
      console.log('Found player:', mahomes);
    }
    
    console.log('Sleeper tests PASSED');
  } catch (error) {
    console.error('Sleeper test FAILED:', error);
  }
}

async function testWeather() {
  console.log('\n=== Testing Weather API ===');
  
  try {
    console.log('Stadium count:', Object.keys(NFL_STADIUMS).length);
    console.log('Is Dallas a dome?', weather.isDome('DAL'));
    console.log('Is Green Bay a dome?', weather.isDome('GB'));
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(13, 0, 0, 0);
    
    console.log('Fetching weather for Buffalo game...');
    const bufWeather = await weather.getGameWeather('BUF', tomorrow.toISOString());
    console.log('Buffalo weather:', bufWeather);
    
    console.log('Weather tests PASSED');
  } catch (error) {
    console.error('Weather test FAILED:', error);
  }
}

async function testESPN() {
  console.log('\n=== Testing ESPN API ===');
  
  try {
    const week = await espn.getCurrentWeek();
    console.log('Current week:', week);
    
    console.log('Fetching KC injuries...');
    const kcInjuries = await espn.getTeamInjuries('KC');
    console.log(`KC injuries (${kcInjuries.length} total):`, kcInjuries.slice(0, 3));
    
    console.log('ESPN tests PASSED');
  } catch (error) {
    console.error('ESPN test FAILED:', error);
  }
}

async function testOdds() {
  console.log('\n=== Testing Odds API ===');
  console.log('API Key present:', !!process.env.ODDS_API_KEY);
  
  if (!odds.isConfigured()) {
    console.log('Odds API key not configured. Skipping.');
    return;
  }
  
  try {
    console.log('Fetching NFL odds...');
    const nflOdds = await odds.getNFLOdds();
    console.log(`Found ${nflOdds.length} games with odds`);
    
    if (nflOdds.length > 0) {
      console.log('First game:', nflOdds[0]);
    }
    
    const shootouts = await odds.getHighScoringGames(47);
    console.log(`High-scoring games (O/U 47+): ${shootouts.length}`);
    
    console.log('Odds tests PASSED');
  } catch (error) {
    console.error('Odds test FAILED:', error);
  }
}

async function main() {
  console.log('Fantasy Brain - Provider Tests');
  console.log('================================');
  
  await testSleeper();
  await testWeather();
  await testESPN();
  await testOdds();
  
  console.log('\n================================');
  console.log('All tests complete!');
}

main().catch(console.error);
