# Fantasy Brain - Claude Instructions

## Project Overview
Fantasy Brain is an in-season fantasy football assistant that surfaces "hidden edge" signals that mainstream projections ignore: weather impact, travel/rest disadvantages, OL injuries, betting line movements, usage trends, and more.

## Current State (Updated January 2026)

### What's Working
- **Web UI** at https://fantasy-brain.vercel.app
- **CLI tool** for player analysis: `npm run analyze "Player Name"`
- **15 edge detectors** integrated into single analysis
- **5 data providers** connected (Sleeper, Weather, ESPN, Odds API, nflfastR)
- **Trade Analyzer** at /trade - Dynasty and Redraft modes with ACCEPT/REJECT verdicts
- **Waiver Wire Scanner** at /waivers - Real trending data from Sleeper API
- **Dynamic schedule** from ESPN API (supports any week, not just Week 18)

### Features

#### Trade Analyzer (/trade)
- **Dynasty mode**: Age curves by position, injury history, situation stability
- **Redraft mode**: Playoff schedule (Wks 15-17), availability, usage trends
- Verdict system: ACCEPT / REJECT / SLIGHT EDGE / TOSS-UP
- "Gun to head" recommendation for close calls
- Position-specific valuations (RBs decline at 27, WRs peak 26-30)

#### Waiver Wire Scanner (/waivers)
- Real trending adds from Sleeper API (not fabricated roster %)
- Edge scores from actual edge detector analysis
- Position filters (QB/RB/WR/TE/ALL)
- Hidden gems: High adds + positive edge score
- Key factors extracted from real edge signals

### How to Run
```bash
npm run dev                              # Start web UI (localhost:3000)
npm run analyze "Player Name"            # Single player CLI analysis
npm run compare "P1" "P2" "P3"           # Compare multiple players
npm run test-providers                   # Verify API connections
```

### Edge Detector Status

| Module | Source | Status |
|--------|--------|--------|
| weather-impact | Open-Meteo API | ✅ Real data |
| travel-rest | Schedule | ✅ Working |
| ol-injury | ESPN API | ✅ Real data |
| betting-signals | Odds API | ✅ Real data |
| defense-vs-position | Hardcoded | ⚠️ Approximate rankings |
| opposing-defense-injuries | Sleeper API | ✅ Real data |
| usage-trends | nflfastR CSV | ✅ Real data (WR/RB/TE only) |
| contract-incentives | Manual | ⚠️ Limited player coverage |
| revenge-games | Hardcoded | ⚠️ ~5 players only |
| red-zone-usage | nflfastR CSV | ⚠️ Estimated from TDs |
| home-away-splits | Hardcoded | ⚠️ Sample data |
| primetime-performance | Hardcoded | ⚠️ Sample data |
| division-rivalry | Schedule | ✅ Working |
| rest-advantage | Schedule | ✅ Working |
| indoor-outdoor-splits | Hardcoded | ⚠️ Sample data |

### Known Issues
1. Defense rankings are approximate, not from live source (uses end-of-season 2024-25 data)
2. Home/away, primetime, indoor/outdoor splits use sample performance data
3. Revenge games only has ~7 players hardcoded
4. Contract incentives limited to manually researched players
5. Usage trends shows "N/A" for QBs (by design - no target/carry share)

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Hosting**: Vercel
- **CLI**: tsx for TypeScript execution
- **Data Sources**:
  - Sleeper API (players, injuries)
  - Open-Meteo (weather forecasts)
  - The Odds API (betting lines)
  - ESPN API (OL injuries)
  - nflfastR CSV (usage stats - 2024 season)

## Code Guidelines

### Data Quality Rules (IMPORTANT)
- **Never fabricate data** - only use verified sources
- **Add source comments** to any manual/hardcoded data
- **Add disclaimers** in file headers for approximate data
- **Search and verify** before adding player-specific info

### General
- Always use TypeScript for new files
- Include error handling in all API calls
- Keep edge detector modules independent
- Each module returns EdgeSignal[] with impact, magnitude, confidence

### Project Structure
```
/app
  /api/analyze/     # API route for player analysis
  /api/trade/       # Trade analyzer API
  /api/waivers/     # Waiver scanner API
  /trade/           # Trade analyzer UI
  /waivers/         # Waiver scanner UI
  page.tsx          # Main UI (player analysis)
/lib
  /providers/       # sleeper.ts, espn.ts, weather.ts, odds.ts, nflfastr.ts
  /edge/            # 15 edge detector modules
  /trade/           # dynasty-value.ts, redraft-value.ts
  schedule.ts       # Dynamic schedule service (ESPN API)
  edge-detector.ts  # Main orchestrator
/types/             # TypeScript interfaces
/data/nflfastr/     # Cached CSV data (gitignored)
analyze.ts          # CLI entry point
```

## API Keys
```
ODDS_API_KEY=your_key_here   # Required for betting signals
```
- Weather API: free, no key needed
- Sleeper API: free, no key needed
- ESPN API: free, no key needed
- nflfastR: free CSV download, no key needed

## Deployment
- **GitHub**: https://github.com/bobrothers/fantasy-brain
- **Vercel**: https://fantasy-brain.vercel.app
- Environment variable `ODDS_API_KEY` must be set in Vercel dashboard
