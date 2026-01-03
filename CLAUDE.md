# Fantasy Brain - Claude Instructions

## Project Overview
Fantasy Brain is an in-season fantasy football assistant that surfaces "hidden edge" signals that mainstream projections ignore: weather impact, travel/rest disadvantages, OL injuries, betting line movements, usage trends, and more.

## Current State (Updated January 2026)

### What's Working
- **Web UI** at https://fantasy-brain.vercel.app
- **CLI tool** for player analysis: `npm run analyze "Player Name"`
- **15 edge detectors** integrated into single analysis
- **5 data providers** connected (Sleeper, Weather, ESPN, Odds API, nflfastR)
- **Trade Analyzer** at /trade - Dynasty and Redraft modes with enhanced metrics
- **Waiver Wire Scanner** at /waivers - Real trending data from Sleeper API
- **Dynamic schedule** from ESPN API (supports any week, not just Week 18)

### Features

#### Player Analysis (/)
- 15 edge signals analyzed per player
- Usage trend chart (last 6 weeks from Sleeper API)
- Cold weather performance tracking
- Deep stats: Snap trend, Air yards share, Target premium, Divisional performance, Second half surge
- Lock countdown timer (shows "Locks in Xh Xm", red under 1hr)
- Resting/Suspended player banner (suspended shows in red)

#### Trade Analyzer (/trade)
- **Dynasty mode**:
  - Core: Age curves by position, injury history, situation stability
  - NEW: Draft capital (1st rounders get bonus), Breakout age (early = longer prime)
  - NEW: Offensive ranking (elite offenses boost value), Depth chart threat
- **Redraft mode**:
  - Core: Playoff schedule (Wks 15-17), availability, usage trends
  - NEW: Hot/cold streak (last 4 games PPG with fire/ice indicators)
  - NEW: Vegas implied points (team scoring environment)
  - NEW: Playoff weather (cold weather games), Positional scarcity (TE premium)
  - NEW: Primetime schedule (SNF/MNF/TNF playoff games)
- Verdict system: ACCEPT / REJECT / SLIGHT EDGE / TOSS-UP
- "Gun to head" recommendation for close calls

#### Waiver Wire Scanner (/waivers)
- Real trending adds from Sleeper API (not fabricated roster %)
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
| revenge-games | Hardcoded | ⚠️ ~7 players only |
| red-zone-usage | nflfastR CSV | ⚠️ Estimated from TDs |
| home-away-splits | Hardcoded | ⚠️ Sample data |
| primetime-performance | Hardcoded | ⚠️ Sample data |
| division-rivalry | Schedule | ✅ Working |
| rest-advantage | Schedule | ✅ Working |
| indoor-outdoor-splits | Hardcoded | ⚠️ Sample data |

### Trade Value Data Status

| Metric | Source | Coverage |
|--------|--------|----------|
| Age curves | Position-specific formulas | ✅ All positions |
| Injury history | Manual research | ⚠️ ~25 top players |
| Situation/contract | Manual research | ⚠️ ~15 top players |
| Draft capital | Manual research | ⚠️ ~35 players |
| Breakout age | Manual research | ⚠️ ~20 players |
| Offensive ranking | 2024-25 end of season | ⚠️ Static rankings |
| Depth chart threat | Manual research | ⚠️ ~11 players |
| Hot/cold streak | Manual research | ⚠️ ~20 players |
| Vegas implied | 2025 playoff estimates | ⚠️ All teams |
| Positional scarcity | Manual tiers | ⚠️ ~11 elite players |
| Primetime schedule | 2025 Wk 15-17 | ⚠️ Hardcoded |

### Known Issues
1. Defense rankings are approximate, not from live source
2. Home/away, primetime, indoor/outdoor splits use sample data
3. Revenge games only has ~7 players hardcoded
4. Contract incentives limited to manually researched players
5. Usage trends shows "N/A" for QBs (by design - no target/carry share)
6. Trade value data (injury history, situation, draft capital, etc.) only covers top ~20-35 players
7. Hot/cold streak data is manually entered, not live from API

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Hosting**: Vercel
- **CLI**: tsx for TypeScript execution
- **Data Sources**:
  - Sleeper API (players, injuries, weekly stats, trending)
  - Open-Meteo (weather forecasts)
  - The Odds API (betting lines)
  - ESPN API (OL injuries, schedule)
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
  /api/analyze/       # API route for player analysis
  /api/trade/         # Trade analyzer API
  /api/waivers/       # Waiver scanner API
  /api/cold-weather/  # Cold weather performance API
  /api/deep-stats/    # Deep stats API
  /api/usage-trend/   # Usage trend chart API
  /api/resting/       # Resting/suspended players API
  /trade/             # Trade analyzer UI
  /waivers/           # Waiver scanner UI
  page.tsx            # Main UI (player analysis)
/components
  PlayerAutocomplete.tsx  # Search with dropdown
  LockTimer.tsx           # Game lock countdown
  UsageTrendChart.tsx     # Last 6 weeks usage
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
/data/nflfastr/       # Cached CSV data (gitignored)
analyze.ts            # CLI entry point
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

## Claude Code Agents

Custom agents are available in `.claude/agents/`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `build-validator.md` | Runs build, tests, lint and reports pass/fail | Before commits, PRs, after merges |
| `code-architect.md` | Plans architecture with ASCII diagrams | Before implementing new features |
| `code-simplifier.md` | Identifies and removes unnecessary complexity | After shipping, during refactors |
| `verify-app.md` | Tests features from user perspective | After deploys, when issues reported |

### Usage
Reference agents in conversation: "Use the build-validator agent to check the build"

## Working Files

- `TODO.md` - Track work in progress and planned features
- `scratch.md` - Notes, ideas, temporary work
