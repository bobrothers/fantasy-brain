/**
 * Open-Meteo Weather Adapter
 * 
 * Free API, no key required. 10k calls/day limit.
 * Docs: https://open-meteo.com/
 * 
 * Used for game-day weather forecasts to detect wind/precip/cold impacts.
 */

import type { GameWeather, Stadium } from '@/types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// NFL Stadium data - coordinates and dome status
// Only outdoor/retractable stadiums matter for weather impact
export const NFL_STADIUMS: Record<string, Stadium> = {
  // AFC East
  BUF: {
    team: 'BUF',
    name: 'Highmark Stadium',
    city: 'Orchard Park',
    state: 'NY',
    lat: 42.7738,
    lng: -78.7870,
    isDome: false,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/New_York',
    elevation: 597,
  },
  MIA: {
    team: 'MIA',
    name: 'Hard Rock Stadium',
    city: 'Miami Gardens',
    state: 'FL',
    lat: 25.9580,
    lng: -80.2389,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 7,
  },
  NE: {
    team: 'NE',
    name: 'Gillette Stadium',
    city: 'Foxborough',
    state: 'MA',
    lat: 42.0909,
    lng: -71.2643,
    isDome: false,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/New_York',
    elevation: 256,
  },
  NYJ: {
    team: 'NYJ',
    name: 'MetLife Stadium',
    city: 'East Rutherford',
    state: 'NJ',
    lat: 40.8136,
    lng: -74.0745,
    isDome: false,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/New_York',
    elevation: 7,
  },
  
  // AFC North
  BAL: {
    team: 'BAL',
    name: 'M&T Bank Stadium',
    city: 'Baltimore',
    state: 'MD',
    lat: 39.2780,
    lng: -76.6227,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 33,
  },
  CIN: {
    team: 'CIN',
    name: 'Paycor Stadium',
    city: 'Cincinnati',
    state: 'OH',
    lat: 39.0954,
    lng: -84.5160,
    isDome: false,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/New_York',
    elevation: 459,
  },
  CLE: {
    team: 'CLE',
    name: 'Cleveland Browns Stadium',
    city: 'Cleveland',
    state: 'OH',
    lat: 41.5061,
    lng: -81.6995,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 581,
  },
  PIT: {
    team: 'PIT',
    name: 'Acrisure Stadium',
    city: 'Pittsburgh',
    state: 'PA',
    lat: 40.4468,
    lng: -80.0158,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 748,
  },
  
  // AFC South
  HOU: {
    team: 'HOU',
    name: 'NRG Stadium',
    city: 'Houston',
    state: 'TX',
    lat: 29.6847,
    lng: -95.4107,
    isDome: true,
    isRetractable: true,
    surface: 'Turf',
    timezone: 'America/Chicago',
    elevation: 43,
  },
  IND: {
    team: 'IND',
    name: 'Lucas Oil Stadium',
    city: 'Indianapolis',
    state: 'IN',
    lat: 39.7601,
    lng: -86.1639,
    isDome: true,
    isRetractable: true,
    surface: 'Turf',
    timezone: 'America/Indiana/Indianapolis',
    elevation: 715,
  },
  JAX: {
    team: 'JAX',
    name: 'EverBank Stadium',
    city: 'Jacksonville',
    state: 'FL',
    lat: 30.3239,
    lng: -81.6373,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 10,
  },
  TEN: {
    team: 'TEN',
    name: 'Nissan Stadium',
    city: 'Nashville',
    state: 'TN',
    lat: 36.1665,
    lng: -86.7713,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/Chicago',
    elevation: 433,
  },
  
  // AFC West
  DEN: {
    team: 'DEN',
    name: 'Empower Field at Mile High',
    city: 'Denver',
    state: 'CO',
    lat: 39.7439,
    lng: -105.0201,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/Denver',
    elevation: 5280, // MILE HIGH - altitude matters!
  },
  KC: {
    team: 'KC',
    name: 'GEHA Field at Arrowhead Stadium',
    city: 'Kansas City',
    state: 'MO',
    lat: 39.0489,
    lng: -94.4839,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/Chicago',
    elevation: 820,
  },
  LAC: {
    team: 'LAC',
    name: 'SoFi Stadium',
    city: 'Inglewood',
    state: 'CA',
    lat: 33.9535,
    lng: -118.3392,
    isDome: true,
    isRetractable: false, // Open-air but covered
    surface: 'Turf',
    timezone: 'America/Los_Angeles',
    elevation: 131,
  },
  LV: {
    team: 'LV',
    name: 'Allegiant Stadium',
    city: 'Las Vegas',
    state: 'NV',
    lat: 36.0909,
    lng: -115.1833,
    isDome: true,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/Los_Angeles',
    elevation: 2001,
  },
  
  // NFC East
  DAL: {
    team: 'DAL',
    name: 'AT&T Stadium',
    city: 'Arlington',
    state: 'TX',
    lat: 32.7473,
    lng: -97.0945,
    isDome: true,
    isRetractable: true,
    surface: 'Turf',
    timezone: 'America/Chicago',
    elevation: 594,
  },
  NYG: {
    team: 'NYG',
    name: 'MetLife Stadium',
    city: 'East Rutherford',
    state: 'NJ',
    lat: 40.8136,
    lng: -74.0745,
    isDome: false,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/New_York',
    elevation: 7,
  },
  PHI: {
    team: 'PHI',
    name: 'Lincoln Financial Field',
    city: 'Philadelphia',
    state: 'PA',
    lat: 39.9008,
    lng: -75.1675,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 39,
  },
  WAS: {
    team: 'WAS',
    name: 'Northwest Stadium',
    city: 'Landover',
    state: 'MD',
    lat: 38.9076,
    lng: -76.8645,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 72,
  },
  
  // NFC North
  CHI: {
    team: 'CHI',
    name: 'Soldier Field',
    city: 'Chicago',
    state: 'IL',
    lat: 41.8623,
    lng: -87.6167,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/Chicago',
    elevation: 597,
  },
  DET: {
    team: 'DET',
    name: 'Ford Field',
    city: 'Detroit',
    state: 'MI',
    lat: 42.3400,
    lng: -83.0456,
    isDome: true,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/Detroit',
    elevation: 600,
  },
  GB: {
    team: 'GB',
    name: 'Lambeau Field',
    city: 'Green Bay',
    state: 'WI',
    lat: 44.5013,
    lng: -88.0622,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/Chicago',
    elevation: 640,
  },
  MIN: {
    team: 'MIN',
    name: 'U.S. Bank Stadium',
    city: 'Minneapolis',
    state: 'MN',
    lat: 44.9736,
    lng: -93.2575,
    isDome: true,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/Chicago',
    elevation: 830,
  },
  
  // NFC South
  ATL: {
    team: 'ATL',
    name: 'Mercedes-Benz Stadium',
    city: 'Atlanta',
    state: 'GA',
    lat: 33.7553,
    lng: -84.4006,
    isDome: true,
    isRetractable: true,
    surface: 'Turf',
    timezone: 'America/New_York',
    elevation: 1050,
  },
  CAR: {
    team: 'CAR',
    name: 'Bank of America Stadium',
    city: 'Charlotte',
    state: 'NC',
    lat: 35.2258,
    lng: -80.8528,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 751,
  },
  NO: {
    team: 'NO',
    name: 'Caesars Superdome',
    city: 'New Orleans',
    state: 'LA',
    lat: 29.9511,
    lng: -90.0812,
    isDome: true,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/Chicago',
    elevation: 3,
  },
  TB: {
    team: 'TB',
    name: 'Raymond James Stadium',
    city: 'Tampa',
    state: 'FL',
    lat: 27.9759,
    lng: -82.5033,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/New_York',
    elevation: 36,
  },
  
  // NFC West
  ARI: {
    team: 'ARI',
    name: 'State Farm Stadium',
    city: 'Glendale',
    state: 'AZ',
    lat: 33.5276,
    lng: -112.2626,
    isDome: true,
    isRetractable: true,
    surface: 'Grass',
    timezone: 'America/Phoenix',
    elevation: 1118,
  },
  LAR: {
    team: 'LAR',
    name: 'SoFi Stadium',
    city: 'Inglewood',
    state: 'CA',
    lat: 33.9535,
    lng: -118.3392,
    isDome: true,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/Los_Angeles',
    elevation: 131,
  },
  SF: {
    team: 'SF',
    name: "Levi's Stadium",
    city: 'Santa Clara',
    state: 'CA',
    lat: 37.4033,
    lng: -121.9694,
    isDome: false,
    isRetractable: false,
    surface: 'Grass',
    timezone: 'America/Los_Angeles',
    elevation: 43,
  },
  SEA: {
    team: 'SEA',
    name: 'Lumen Field',
    city: 'Seattle',
    state: 'WA',
    lat: 47.5952,
    lng: -122.3316,
    isDome: false,
    isRetractable: false,
    surface: 'Turf',
    timezone: 'America/Los_Angeles',
    elevation: 20,
  },
};

// Wind direction to degrees
const WIND_DIRECTIONS: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
  E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
  W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

function degreesToDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// WMO weather code to conditions
function weatherCodeToConditions(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Rime Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Heavy Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    66: 'Freezing Rain',
    67: 'Heavy Freezing Rain',
    71: 'Light Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Light Showers',
    81: 'Showers',
    82: 'Heavy Showers',
    85: 'Light Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with Hail',
    99: 'Thunderstorm with Heavy Hail',
  };
  return conditions[code] || 'Unknown';
}

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
  };
}

export const weather = {
  /**
   * Get stadium info for a team
   */
  getStadium(team: string): Stadium | null {
    return NFL_STADIUMS[team] || null;
  },

  /**
   * Check if a stadium is a dome (weather doesn't matter)
   */
  isDome(team: string): boolean {
    const stadium = NFL_STADIUMS[team];
    return stadium?.isDome ?? false;
  },

  /**
   * Get weather forecast for a specific game
   * @param homeTeam - Home team abbreviation
   * @param gameTime - ISO datetime string for game start
   */
  async getGameWeather(homeTeam: string, gameTime: string): Promise<GameWeather | null> {
    const stadium = NFL_STADIUMS[homeTeam];
    if (!stadium) {
      console.warn(`Unknown team: ${homeTeam}`);
      return null;
    }

    // Dome games don't need weather
    if (stadium.isDome && !stadium.isRetractable) {
      return {
        gameId: `${homeTeam}-${gameTime}`,
        stadium: stadium.name,
        isDome: true,
        temperature: 72, // Dome temp
        windSpeed: 0,
        windDirection: 'N/A',
        precipitation: 0,
        precipProbability: 0,
        conditions: 'Dome',
      };
    }

    const gameDate = new Date(gameTime);
    const dateStr = gameDate.toISOString().split('T')[0];

    // Open-Meteo request
    const url = new URL(BASE_URL);
    url.searchParams.set('latitude', stadium.lat.toString());
    url.searchParams.set('longitude', stadium.lng.toString());
    url.searchParams.set('hourly', 'temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('wind_speed_unit', 'mph');
    url.searchParams.set('precipitation_unit', 'inch');
    url.searchParams.set('timezone', stadium.timezone);
    url.searchParams.set('start_date', dateStr);
    url.searchParams.set('end_date', dateStr);

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Open-Meteo error: ${response.status}`);
      }

      const data: OpenMeteoResponse = await response.json();
      
      // Find the game start hour and check weather across full game (3 hours)
      const gameHour = gameDate.getHours();
      const startIndex = data.hourly.time.findIndex(t => {
        const hour = new Date(t).getHours();
        return hour === gameHour;
      });

      if (startIndex === -1) {
        console.warn(`Could not find weather for game hour: ${gameHour}`);
        return null;
      }

      // Check 3-hour window (game duration) for worst conditions
      const endIndex = Math.min(startIndex + 3, data.hourly.time.length);
      let maxPrecip = 0;
      let maxPrecipProb = 0;
      let maxWind = 0;
      let minTemp = 999;
      let worstWeatherCode = 0;
      let worstWindDir = 0;

      for (let i = startIndex; i < endIndex; i++) {
        if (data.hourly.precipitation[i] > maxPrecip) {
          maxPrecip = data.hourly.precipitation[i];
          worstWeatherCode = data.hourly.weather_code[i];
        }
        maxPrecipProb = Math.max(maxPrecipProb, data.hourly.precipitation_probability[i]);
        if (data.hourly.wind_speed_10m[i] > maxWind) {
          maxWind = data.hourly.wind_speed_10m[i];
          worstWindDir = data.hourly.wind_direction_10m[i];
        }
        minTemp = Math.min(minTemp, data.hourly.temperature_2m[i]);
      }

      // Use worst conditions across game window
      return {
        gameId: `${homeTeam}-${gameTime}`,
        stadium: stadium.name,
        isDome: false,
        temperature: Math.round(minTemp),
        windSpeed: Math.round(maxWind),
        windDirection: degreesToDirection(worstWindDir),
        precipitation: maxPrecip,
        precipProbability: maxPrecipProb,
        conditions: weatherCodeToConditions(worstWeatherCode),
      };
    } catch (error) {
      console.error('Weather fetch failed:', error);
      return null;
    }
  },

  /**
   * Get weather impact thresholds
   * Returns true if conditions are significant enough to affect fantasy
   */
  hasWeatherImpact(weather: GameWeather): {
    wind: boolean;
    cold: boolean;
    precipitation: boolean;
    any: boolean;
  } {
    const wind = weather.windSpeed >= 15;
    const cold = weather.temperature <= 32;
    const precipitation = weather.precipitation > 0.1 || weather.precipProbability >= 50;
    
    return {
      wind,
      cold,
      precipitation,
      any: wind || cold || precipitation,
    };
  },

  /**
   * Get altitude impact (Denver)
   */
  hasAltitudeImpact(homeTeam: string): boolean {
    const stadium = NFL_STADIUMS[homeTeam];
    return (stadium?.elevation ?? 0) >= 5000;
  },
};

export default weather;
