# Fantasy Brain - Claude Instructions

## Project Overview
Fantasy Brain is an in-season fantasy football assistant that surfaces "hidden edge" signals that mainstream projections ignore: weather impact, travel/rest disadvantages, OL injuries, betting line movements, usage trends, and more.

## Current State (Updated January 3, 2026)

### What's Working
- **Web UI** at https://fantasy-brain.vercel.app
- **CLI tool** for player analysis: `npm run analyze "Player Name"`
- **16 edge detectors** integrated into single analysis
- **5 data providers** connected (Sleeper, Weather, ESPN, Odds API, nflfastR)
- **Prediction Accuracy Tracking** with Supabase + learning algorithm
- **4 AI Agents** for trade negotiation, lineup optimization, draft assistance, league analysis
- **Cost Tracking Dashboard** at /admin/costs
- **Trade Analyzer** at /trade - Dynasty and Redraft modes with multi-player support
- **Team Diagnosis** at /diagnose - Dynasty roster evaluation
- **Waiver Wire Scanner** at /waivers - Real trending data from Sleeper API
- **Live Scores Ticker** - ESPN scoreboard with seamless animation

### AI Agents (NEW)

| Agent | Endpoint | Purpose |
|-------|----------|---------|
| League Context | `POST /api/agent/league-context` | Analyzes Sleeper league, profiles owner trading styles |
| Trade Negotiator | `POST /api/agent/trade-negotiator` | Generates 3 trade tiers (lowball/fair/overpay) |
| Lineup Optimizer | `POST /api/agent/lineup-optimizer` | Creates optimal lineup based on edge scores |
| Draft Assistant | `POST /api/agent/draft-assistant` | Tracks picks, detects runs, recommends picks |

### Prediction Accuracy System

- **Automatic logging** of predictions before games
- **Outcome tracking** from Sleeper API after games
- **Learning algorithm** adjusts edge weights based on accuracy
- **Self-improvement agent** analyzes patterns and proposes code changes
- **Vercel cron jobs** run Tuesday mornings

### MCP Servers Configured

| Server | Purpose |
|--------|---------|
| Supabase | Direct database queries and management |
| GitHub | Create issues, PRs, manage repository |

### Sub-Agents Available

Invoke with `@agent-name`:
- `@code-reviewer` - Reviews code quality before commits
- `@security-auditor` - Scans for vulnerabilities
- `@performance-optimizer` - Finds slow queries & bottlenecks
- `@data-analyst` - Analyzes prediction accuracy patterns

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
| defense-vs-position | Sleeper + ESPN | ✅ Live |
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
| coverage-matchup | Sharp Football | ✅ Live tendencies, ~50 players tagged |

### Known Issues
1. Home/away, indoor/outdoor splits use sample data (need historical game logs)
2. Revenge games only has ~7 players hardcoded
3. Dynasty trade metrics limited coverage - need Pro-Football-Reference, Spotrac for more
4. Usage trends shows "N/A" for QBs (by design - no target/carry share)
5. Defense rankings calculation takes ~5-10 seconds on first load (cached 1 hour)

## Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **AI**: Claude API (Sonnet 4 for agents)
- **Hosting**: Vercel
- **CLI**: tsx for TypeScript execution
- **Data Sources**:
  - Sleeper API (players, injuries, weekly stats, trending, leagues)
  - Open-Meteo (weather forecasts)
  - The Odds API (betting lines)
  - ESPN API (OL injuries, schedule, live scores)
  - nflfastR CSV (historical usage stats)

## Database Tables

### Core Tables
- `predictions` - Pre-game predictions with edge signals
- `outcomes` - Actual fantasy points after games
- `edge_accuracy` - Aggregated accuracy by edge type
- `edge_weights` - Configurable weights for each edge detector

### Learning System
- `prediction_analysis` - Deep analysis of each prediction
- `detected_patterns` - AI-discovered patterns in misses
- `improvement_proposals` - Proposed code/weight changes
- `applied_improvements` - History of applied changes
- `agent_decisions` - Audit log of agent decisions
- `weight_history` - Rollback history for edge weights

### Agent Tables
- `league_profiles` - Sleeper league settings and tendencies
- `owner_profiles` - Owner trading styles and roster needs
- `trade_suggestions` - Generated trade offer tiers
- `lineup_recommendations` - Optimal lineup suggestions
- `draft_sessions` - Draft state tracking
- `draft_picks` - Individual picks with ADP comparison
- `draft_recommendations` - AI pick suggestions

### Monitoring
- `api_costs` - Claude API token usage and costs
- `news_monitor_state` - News monitoring run logs
- `weekly_schedule` - NFL game schedule
- `alerts` - Player news/injury alerts

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
- Use `createTrackedClient()` for Claude API calls to log costs

### Project Structure
```
/app
  /api/agent/           # AI agent endpoints
  /api/analyze/         # Player analysis API
  /api/accuracy/        # Accuracy + learning pipeline
  /api/trade/           # Trade analyzer API
  /admin/costs/         # Cost dashboard
  page.tsx              # Main UI
/lib
  /agent/               # AI agent logic
  /db/                  # Supabase clients and queries
  /providers/           # External API clients
  /edge/                # 16 edge detector modules
  /trade/               # Trade value calculations
  /news/                # News monitoring
/.claude/agents/        # Custom sub-agents
/db/migrations/         # SQL migrations
```

## Environment Variables
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# APIs
ODDS_API_KEY=xxx
ANTHROPIC_API_KEY=xxx

# Vercel Cron
CRON_SECRET=xxx
```

## Deployment
- **GitHub**: https://github.com/bobrothers/fantasy-brain
- **Vercel**: https://fantasy-brain.vercel.app
- All environment variables must be set in Vercel dashboard
