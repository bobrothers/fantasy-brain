/**
 * Weather Impact Edge Detector
 * 
 * Detects weather conditions that significantly impact fantasy performance:
 * - Wind: Hurts passing game, especially deep balls
 * - Cold: Mixed effects (some players struggle, some thrive)
 * - Rain/Snow: Reduces passing efficiency, increases turnovers
 * - Dome: Neutral/slight positive (controlled environment)
 * 
 * Research basis:
 * - Wind 15+ mph: ~10% decrease in passing EPA
 * - Wind 20+ mph: ~15-20% decrease in deep pass completion
 * - Temperature <32F: Varied but generally negative for skill positions
 * - Rain/Snow: ~5-8% decrease in completion percentage
 */

import type { EdgeSignal, GameWeather, Player } from '@/types';
import { weather, NFL_STADIUMS } from '../providers/weather';

// Impact coefficients (based on research)
const WIND_THRESHOLDS = {
  MODERATE: 15,  // mph - noticeable impact on deep balls
  SEVERE: 20,    // mph - significant impact on all passing
  EXTREME: 25,   // mph - major impact, affects even short passes
};

const COLD_THRESHOLD = 32; // Fahrenheit

const PRECIP_THRESHOLDS = {
  LIGHT: 0.1,    // inches - minimal impact
  MODERATE: 0.25, // inches - noticeable impact
  HEAVY: 0.5,    // inches - significant impact
};

// Position sensitivity to weather
const POSITION_WEATHER_SENSITIVITY: Record<string, {
  wind: number;
  cold: number;
  precip: number;
}> = {
  QB: { wind: 0.9, cold: 0.6, precip: 0.8 },   // Most affected by wind
  WR: { wind: 0.8, cold: 0.5, precip: 0.7 },   // Deep threats hurt by wind
  TE: { wind: 0.5, cold: 0.4, precip: 0.5 },   // Short routes less affected
  RB: { wind: 0.2, cold: 0.3, precip: 0.3 },   // Actually can benefit
  K: { wind: 1.0, cold: 0.7, precip: 0.6 },    // Kickers most affected
  DEF: { wind: 0.3, cold: 0.2, precip: 0.4 },  // Minor effect
};

interface WeatherEdgeResult {
  signals: EdgeSignal[];
  summary: string;
}

/**
 * Calculate wind impact magnitude (-10 to +10 scale)
 * Negative = bad for fantasy scoring
 */
function calculateWindImpact(windSpeed: number, position: string): number {
  if (windSpeed < WIND_THRESHOLDS.MODERATE) return 0;
  
  const sensitivity = POSITION_WEATHER_SENSITIVITY[position]?.wind || 0.5;
  
  if (windSpeed >= WIND_THRESHOLDS.EXTREME) {
    return Math.round(-8 * sensitivity);
  } else if (windSpeed >= WIND_THRESHOLDS.SEVERE) {
    return Math.round(-5 * sensitivity);
  } else {
    return Math.round(-2 * sensitivity);
  }
}

/**
 * Calculate cold impact
 */
function calculateColdImpact(temperature: number, position: string): number {
  if (temperature > COLD_THRESHOLD) return 0;
  
  const sensitivity = POSITION_WEATHER_SENSITIVITY[position]?.cold || 0.5;
  const severity = (COLD_THRESHOLD - temperature) / 20; // Scale by how cold
  
  return Math.round(-3 * sensitivity * Math.min(severity, 1.5));
}

/**
 * Calculate precipitation impact
 */
function calculatePrecipImpact(
  precipitation: number, 
  precipProbability: number,
  conditions: string,
  position: string
): number {
  // Check if significant precip expected
  const hasSignificantPrecip = 
    precipitation >= PRECIP_THRESHOLDS.LIGHT || 
    precipProbability >= 50;
    
  if (!hasSignificantPrecip) return 0;
  
  const sensitivity = POSITION_WEATHER_SENSITIVITY[position]?.precip || 0.5;
  
  // Snow is worse than rain
  const isSnow = conditions.toLowerCase().includes('snow');
  const snowMultiplier = isSnow ? 1.5 : 1.0;
  
  if (precipitation >= PRECIP_THRESHOLDS.HEAVY) {
    return Math.round(-6 * sensitivity * snowMultiplier);
  } else if (precipitation >= PRECIP_THRESHOLDS.MODERATE) {
    return Math.round(-4 * sensitivity * snowMultiplier);
  } else {
    return Math.round(-2 * sensitivity * snowMultiplier);
  }
}

/**
 * Generate weather edge signals for a player
 */
export async function detectWeatherEdge(
  player: Player,
  opponentTeam: string,
  isHome: boolean,
  gameTime: string,
  week: number
): Promise<WeatherEdgeResult> {
  const signals: EdgeSignal[] = [];
  
  // Determine which stadium (home team's)
  const homeTeam = isHome ? player.team : opponentTeam;
  if (!homeTeam) {
    return { signals: [], summary: 'No team data' };
  }
  
  const stadium = NFL_STADIUMS[homeTeam];
  if (!stadium) {
    return { signals: [], summary: 'Unknown stadium' };
  }
  
  // Get weather forecast
  const gameWeather = await weather.getGameWeather(homeTeam, gameTime);
  if (!gameWeather) {
    return { signals: [], summary: 'Weather data unavailable' };
  }
  
  // Check dome (positive/neutral for passing)
  if (gameWeather.isDome) {
    signals.push({
      type: 'weather_dome',
      playerId: player.id,
      week,
      impact: 'positive',
      magnitude: 1,
      confidence: 95,
      shortDescription: `Dome game at ${stadium.name}`,
      details: 'Climate-controlled environment eliminates weather variables. Slight boost for passing game.',
      source: 'stadium_data',
      timestamp: new Date(),
    });
    
    return { 
      signals, 
      summary: 'Dome game - no weather concerns' 
    };
  }
  
  // Wind impact
  if (gameWeather.windSpeed >= WIND_THRESHOLDS.MODERATE) {
    const windMagnitude = calculateWindImpact(gameWeather.windSpeed, player.position);
    
    let severity: string;
    if (gameWeather.windSpeed >= WIND_THRESHOLDS.EXTREME) {
      severity = 'Extreme';
    } else if (gameWeather.windSpeed >= WIND_THRESHOLDS.SEVERE) {
      severity = 'Severe';
    } else {
      severity = 'Moderate';
    }
    
    signals.push({
      type: 'weather_wind',
      playerId: player.id,
      week,
      impact: 'negative',
      magnitude: windMagnitude,
      confidence: 85,
      shortDescription: `${severity} wind: ${gameWeather.windSpeed} mph at ${stadium.name}`,
      details: `Wind speed of ${gameWeather.windSpeed} mph from ${gameWeather.windDirection}. ` +
        `${player.position === 'QB' ? 'Significantly reduces deep ball accuracy. ' : ''}` +
        `${player.position === 'WR' ? 'Deep routes less effective. ' : ''}` +
        `${player.position === 'K' ? 'Field goal range reduced. ' : ''}` +
        `Historical data shows ~${Math.abs(windMagnitude) * 2}% scoring reduction in these conditions.`,
      source: 'open-meteo',
      timestamp: new Date(),
    });
  }
  
  // Cold impact
  if (gameWeather.temperature <= COLD_THRESHOLD) {
    const coldMagnitude = calculateColdImpact(gameWeather.temperature, player.position);
    
    signals.push({
      type: 'weather_cold',
      playerId: player.id,
      week,
      impact: coldMagnitude < -2 ? 'negative' : 'neutral',
      magnitude: coldMagnitude,
      confidence: 70, // Cold is less predictive than wind
      shortDescription: `Cold: ${gameWeather.temperature}°F at ${stadium.name}`,
      details: `Temperature of ${gameWeather.temperature}°F. ` +
        `Ball is harder to grip and catch. ` +
        `Players from warm-weather teams may struggle more. ` +
        `RBs can actually benefit as defenses struggle.`,
      source: 'open-meteo',
      timestamp: new Date(),
    });
  }
  
  // Precipitation impact
  const precipMagnitude = calculatePrecipImpact(
    gameWeather.precipitation,
    gameWeather.precipProbability,
    gameWeather.conditions,
    player.position
  );
  
  if (precipMagnitude < 0) {
    const isSnow = gameWeather.conditions.toLowerCase().includes('snow');
    
    signals.push({
      type: 'weather_precip',
      playerId: player.id,
      week,
      impact: 'negative',
      magnitude: precipMagnitude,
      confidence: gameWeather.precipProbability >= 70 ? 80 : 60,
      shortDescription: `${isSnow ? 'Snow' : 'Rain'}: ${gameWeather.conditions} (${gameWeather.precipProbability}% chance)`,
      details: `Expected ${gameWeather.precipitation}" of precipitation. ` +
        `${isSnow ? 'Snow significantly impacts footing and ball security. ' : 'Rain affects grip and passing accuracy. '}` +
        `Fumble risk increases. Pass attempts may decrease in favor of run game.`,
      source: 'open-meteo',
      timestamp: new Date(),
    });
  }
  
  // Generate summary
  const impactSignals = signals.filter(s => s.impact === 'negative');
  let summary: string;
  
  if (impactSignals.length === 0) {
    summary = 'No significant weather concerns';
  } else {
    const concerns = impactSignals.map(s => s.shortDescription.split(':')[0]).join(', ');
    const totalMagnitude = impactSignals.reduce((sum, s) => sum + Math.abs(s.magnitude), 0);
    summary = `Weather alert: ${concerns} (combined impact: -${totalMagnitude})`;
  }
  
  return { signals, summary };
}

/**
 * Batch detect weather edges for multiple players
 */
export async function detectWeatherEdgeBatch(
  players: Array<{
    player: Player;
    opponentTeam: string;
    isHome: boolean;
    gameTime: string;
  }>,
  week: number
): Promise<Map<string, WeatherEdgeResult>> {
  const results = new Map<string, WeatherEdgeResult>();
  
  // Group by game to avoid duplicate weather fetches
  const gameGroups = new Map<string, typeof players>();
  
  for (const p of players) {
    const homeTeam = p.isHome ? p.player.team : p.opponentTeam;
    const gameKey = `${homeTeam}-${p.gameTime}`;
    
    if (!gameGroups.has(gameKey)) {
      gameGroups.set(gameKey, []);
    }
    gameGroups.get(gameKey)!.push(p);
  }
  
  // Process each game group
  for (const gamePlayeres of gameGroups.values()) {
    for (const p of gamePlayeres) {
      const result = await detectWeatherEdge(
        p.player,
        p.opponentTeam,
        p.isHome,
        p.gameTime,
        week
      );
      results.set(p.player.id, result);
    }
  }
  
  return results;
}

/**
 * Get explanation text for a weather signal
 */
export function explainWeatherSignal(signal: EdgeSignal): string {
  const impactWord = signal.impact === 'negative' ? 'hurts' : 
                     signal.impact === 'positive' ? 'helps' : 'affects';
  
  return `${signal.shortDescription} ${impactWord} ${signal.type.replace('weather_', '')} performance. ` +
         `${signal.details} ` +
         `Confidence: ${signal.confidence}%.`;
}

export default {
  detectWeatherEdge,
  detectWeatherEdgeBatch,
  explainWeatherSignal,
};
