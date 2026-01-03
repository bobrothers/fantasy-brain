# Fantasy Brain - Claude Instructions

## Project Overview
Fantasy Brain is an in-season fantasy football assistant that surfaces "hidden edge" signals that mainstream projections ignore: weather impact, travel/rest disadvantages, OL injuries, betting line movements, usage trends, and more.

## Current State (Updated January 3, 2026)

### What's Working
- **Web UI** at https://fantasy-brain.vercel.app
- **CLI tool** for player analysis: `npm run analyze "Player Name"`
- **15 edge detectors** integrated into single analysis
- **5 data providers** connected (Sleeper, Weather, ESPN, Odds API, nflfastR)
- **Trade Analyzer** at /trade - Dynasty and Redraft modes
- **Waiver Wire Scanner** at /waivers - Real trending data from Sleeper API
- **Live Scores Ticker** - ESPN scoreboard with seamless animation
- **Dynamic schedule** from ESPN API (supports any week)

### Features

#### Player Analysis (/)
- 15 edge signals analyzed per player
- Usage trend chart (last 6 weeks from Sleeper API)
- Cold weather performance tracking
- Deep stats: Snap trend, Air yards share, Target premium, Divisional performance, Second half surge
- Lock countdown timer (shows "Locks in Xh Xm", red under 1hr)
- Resting/Suspended player banner (suspended shows in red)
- **Edge Impact tooltip** - hover to see score scale explanation
- **Live scores ticker** - shows game scores or upcoming matchups (BAL @ PIT SNF)

#### Trade Analyzer (/trade)
- **Dynasty mode**:
  - Core: Age curves by position, injury history, situation stability
  - Draft capital (1st rounders get bonus), Breakout age (early = longer prime)
  - Offensive ranking (elite offenses boost value), Depth chart threat
- **Redraft mode**:
  - Core: Playoff schedule (Wks 15-17), availability, usage trends
  - **Hot/cold streak** - LIVE from Sleeper weekly stats (last 4 games PPG)
  - Vegas implied points (team scoring environment)
  - Playoff weather (cold weather games), Positional scarcity (TE premium)
  - **Primetime schedule** - LIVE from ESPN API (SNF/MNF/TNF detection)
- Verdict system: ACCEPT / REJECT / SLIGHT EDGE / TOSS-UP
- "Gun to head" recommendation for close calls

#### Waiver Wire Scanner (/waivers)
- Real trending adds from Sleeper API
- Edge scores from actual edge detector analysis
- Position filters (QB/RB/WR/TE/ALL)
- Hidden gems: High adds + positive edge score

### How to Run
```bash
npm run dev                              # Start web UI (localhost:3000)
npm run analyze "Player Name"            # Single player CLI analysis
npm run compare "P1" "P2" "P3"           # Compare multiple players
npm run test-providers                   # Verify API connections
```

### Data Source Status

#### Edge Detectors
| Module | Source | Status |
|--------|--------|--------|
| weather-impact | Open-Meteo API | ✅ Live |
| travel-rest | ESPN Schedule | ✅ Live |
| ol-injury | ESPN API | ✅ Live |
| betting-signals | Odds API | ✅ Live |
| defense-vs-position | **Sleeper + ESPN** | ✅ **LIVE** |
| opposing-defense-injuries | Sleeper API | ✅ Live |
| usage-trends | Sleeper weekly stats | ✅ Live |
| contract-incentives | Manual | ⚠️ ~15 players |
| revenge-games | Hardcoded | ⚠️ ~7 players |
| red-zone-usage | nflfastR CSV | ⚠️ Estimated |
| home-away-splits | Hardcoded | ⚠️ Sample data |
| primetime-performance | ESPN + Manual | ⚠️ Schedule live, history manual |
| division-rivalry | ESPN Schedule | ✅ Live |
| rest-advantage | ESPN Schedule | ✅ Live |
| indoor-outdoor-splits | Hardcoded | ⚠️ Sample data |

#### Trade Value Metrics
| Metric | Source | Coverage |
|--------|--------|----------|
| Age curves | Position formulas | ✅ All positions |
| **Hot/cold streak** | **Sleeper API** | ✅ **ALL PLAYERS** |
| **Primetime schedule** | **ESPN API** | ✅ **ALL TEAMS** |
| Injury history | Manual | ⚠️ ~25 players |
| Situation/contract | Manual | ⚠️ ~15 players |
| Draft capital | Manual | ⚠️ ~35 players |
| Breakout age | Manual | ⚠️ ~20 players |
| Offensive ranking | Static 2024-25 | ⚠️ All teams |
| Depth chart threat | Manual | ⚠️ ~11 players |
| Vegas implied | Static estimates | ⚠️ All teams |
| Positional scarcity | Manual tiers | ⚠️ ~11 players |

### Known Issues
1. Home/away, indoor/outdoor splits use sample data
2. Revenge games only has ~7 players hardcoded
3. Dynasty trade metrics (injury history, situation, draft capital) limited to top ~25-35 players
   - Sleeper API lacks: historical injuries, draft round/pick, contract data
   - Would need: Pro-Football-Reference, Spotrac, OverTheCap
4. Usage trends shows "N/A" for QBs (by design)
5. Defense rankings calculation takes ~5-10 seconds on first load (cached for 1 hour after)

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Hosting**: Vercel
- **CLI**: tsx for TypeScript execution
- **Data Sources**:
  - Sleeper API (players, injuries, weekly stats, trending)
  - Open-Meteo (weather forecasts)
  - The Odds API (betting lines)
  - ESPN API (OL injuries, schedule, live scores)
  - nflfastR CSV (historical usage stats)

## Code Guidelines

### Data Quality Rules (IMPORTANT)
- **Never fabricate data** - only use verified sources
- **Add source comments** to any manual/hardcoded data
- **Standardize team abbreviations** - use `WAS` not `WSH` (Sleeper standard)

### General
- Always use TypeScript for new files
- Include error handling in all API calls
- Keep edge detector modules independent
- Each module returns EdgeSignal[] with impact, magnitude, confidence

### Project Structure
```
/app
  /api/analyze/       # Player analysis API
  /api/trade/         # Trade analyzer API
  /api/waivers/       # Waiver scanner API
  /api/scores/        # Live ESPN scores API
  /api/deep-stats/    # Deep stats API
  /api/usage-trend/   # Usage trend chart API
  /api/resting/       # Resting/suspended players API
  /trade/             # Trade analyzer UI
  /waivers/           # Waiver scanner UI
  page.tsx            # Main UI (player analysis)
/components
  PlayerAutocomplete.tsx
  LockTimer.tsx
  UsageTrendChart.tsx
  ColdWeatherPerformance.tsx
  DeepStats.tsx
/lib
  /providers/         # sleeper.ts, espn.ts, weather.ts, odds.ts, nflfastr.ts
  /edge/              # 15 edge detector modules
  /trade/             # dynasty-value.ts, redraft-value.ts
  /data/              # resting-players.ts (manual data)
  schedule.ts         # Dynamic schedule service (ESPN API)
  edge-detector.ts    # Main orchestrator
/types/               # TypeScript interfaces
```

## API Keys
```
ODDS_API_KEY=your_key_here   # Required for betting signals
```
- Weather API: free, no key needed
- Sleeper API: free, no key needed
- ESPN API: free, no key needed

## Deployment
- **GitHub**: https://github.com/bobrothers/fantasy-brain
- **Vercel**: https://fantasy-brain.vercel.app
- Environment variable `ODDS_API_KEY` must be set in Vercel dashboard
