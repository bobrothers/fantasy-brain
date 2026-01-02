# Fantasy Brain - Claude Instructions

## Project Overview
Fantasy Brain is an in-season fantasy football assistant that surfaces "hidden edge" signals that mainstream projections ignore: weather impact, travel/rest disadvantages, OL injuries, betting line movements, usage trends, and scheme changes.

## Current State (Updated January 2026)

### What's Working
- **CLI tool** for player analysis: `npm run analyze "Player Name"`
- **10 edge detectors** integrated into single analysis
- **4 data providers** connected (Sleeper, Weather, ESPN, Odds API)
- **Week 18 2025** schedule and data

### How to Run
```bash
npm run analyze "Player Name"           # Single player analysis
npm run compare "P1" "P2" "P3"          # Compare multiple players
npm run test-providers                   # Verify API connections
```

### Edge Detector Status

| Module | Source | Status |
|--------|--------|--------|
| weather-impact | Open-Meteo API | ✅ Real data |
| travel-rest | Schedule | ✅ Working |
| ol-injury | ESPN API | ✅ Real data |
| betting-signals | Odds API | ✅ Real data |
| defense-vs-position | Hardcoded | ⚠️ Approximate |
| opposing-defense-injuries | ESPN API | ⚠️ Incomplete |
| usage-trends | Sample | ⚠️ Needs nflfastR |
| contract-incentives | Manual | ✅ Verified (limited) |
| revenge-games | Hardcoded | ⚠️ Incomplete |
| red-zone-usage | Sample | ⚠️ Needs nflfastR |

### Known Data Quality Issues
1. Defense rankings are approximate, not from live source
2. Usage/red zone data is sample data, not real stats
3. Revenge games only has ~5 players hardcoded
4. ESPN injuries API misses some players
5. Schedule is hardcoded for Week 18 2025 only

### Next Priority
**nflfastR integration** - Fixes usage trends, red zone, historical matchups with verified play-by-play data.

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind
- **CLI**: tsx for TypeScript execution
- **Database**: Postgres via Supabase (not yet connected)
- **Data Sources**: Sleeper API, nfl_data_py, Open-Meteo, The Odds API, ESPN

## Code Guidelines

### Data Quality Rules (IMPORTANT)
- **Never fabricate data** - only use verified sources
- **Add source comments** to any manual/hardcoded data
- **Add disclaimers** in file headers for approximate data
- **Search and verify** before adding player-specific info (incentives, revenge games)

### General
- Always use TypeScript for new files
- Include error handling in all API calls
- Run linter before considering code complete
- Never edit more than 50 lines in a single change

### Data Providers
- All external APIs go through `/lib/providers/`
- Handle rate limits and errors gracefully
- Cache responses where appropriate
- Normalize to internal types in `/types/`

### Edge Detector Modules
- Each module in `/lib/edge/` returns EdgeSignal[]
- Signals include: type, impact, magnitude, confidence, description
- Confidence scores 0-100
- Source field for data attribution

## API Keys (in .env)
```
ODDS_API_KEY=your_key_here
```
- Weather API: free, no key
- Sleeper API: free, no key  
- ESPN API: free, no key

## Project Structure
```
/lib
  /providers/     # sleeper.ts, espn.ts, weather.ts, odds.ts
  /edge/          # 10 edge detector modules
  edge-detector.ts  # Main orchestrator
/types/           # TypeScript interfaces
/app/             # Next.js app (UI not built yet)
analyze.ts        # CLI entry point
```

## File Navigation
See MAP.md for code index
