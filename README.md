# Fantasy Brain

Fantasy football edge detection tool that surfaces hidden advantages mainstream projections miss.

## Quick Start

```bash
cd ~/fantasy-brain
npm install
npm run analyze "Saquon Barkley"
```

## What It Does

Analyzes players across 10 edge signals:

1. **Weather** - Wind, cold, precipitation impact
2. **Travel/Rest** - Timezone shifts, short weeks, altitude
3. **OL Injuries** - Offensive line health affecting RB/QB
4. **Betting Signals** - Implied totals, line movements
5. **Defense vs Position** - Matchup rankings
6. **Opposing D Injuries** - Missing CBs boost WRs, etc.
7. **Usage Trends** - Target share, carry share trajectories
8. **Contract Incentives** - Bonus chasing in Weeks 17-18
9. **Revenge Games** - Playing former team
10. **Red Zone Usage** - Goal line work, TD equity

## Example Output

```
EDGE ANALYSIS: Saquon Barkley (PHI RB)

📊 EDGE SIGNALS:
  ✓ Matchup: SMASH: WAS #31 vs RB
  ✓ Red Zone: Elite GL back: 87% goal line share
  ⚠️ OL Health: Lane Johnson (OT) Questionable

📈 OVERALL IMPACT: +6
💡 RECOMMENDATION: Strong environment. Start with confidence.
```

## Commands

```bash
npm run analyze "Player Name"           # Single player
npm run compare "P1" "P2" "P3"          # Compare players
npm run test-providers                   # Test API connections
```

## Data Sources

| Source | What It Provides | Status |
|--------|------------------|--------|
| Sleeper API | Players, rosters, schedules | ✅ Free |
| Open-Meteo | Weather forecasts | ✅ Free |
| ESPN API | Injuries, team data | ✅ Free |
| The Odds API | Betting lines | ✅ Free (500/month) |
| nflfastR | Play-by-play, usage | 🔜 Next |

## Project Status

**Working:**
- CLI analysis tool
- 4 data providers connected
- 10 edge detectors integrated
- Week 18 2025 schedule

**Needs Work:**
- Usage/red zone data is sample (need nflfastR)
- Defense rankings are approximate
- Only ~8 players have verified contract incentives
- Revenge games incomplete
- No UI yet

## Environment Setup

Create `.env` file:
```
ODDS_API_KEY=your_key_here
```

## For Claude Code / New Chat Context

Read `CLAUDE.md` for detailed instructions on:
- Current project state
- Code guidelines
- Data quality rules
- What's working vs what needs fixing

Key files:
- `/lib/edge-detector.ts` - Main analysis orchestrator
- `/lib/edge/*.ts` - Individual edge modules
- `/lib/providers/*.ts` - Data source adapters
- `/types/index.ts` - TypeScript interfaces

## Development History

Built January 2026. Key decisions:
- Free APIs only to start
- CLI-first, UI later
- Verify data before hardcoding (learned this the hard way)
- nflfastR integration is next priority for real usage data
