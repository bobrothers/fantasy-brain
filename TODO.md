# TODO - Fantasy Brain

## Next Steps

### Test the AI Agents
- [ ] Test League Context Agent with your Sleeper league ID
- [ ] Test Trade Negotiator to get trade offers
- [ ] Test Lineup Optimizer with a roster
- [ ] Test Draft Assistant in a mock draft

### Build Agent UIs
- [ ] League analyzer page at /league - enter league ID, see owner profiles
- [ ] Trade assistant page - select target player, get offer suggestions
- [ ] Lineup optimizer page - import roster, get start/sit recommendations
- [ ] Draft room page - real-time draft assistant

### News Monitoring
- [ ] Set up Vercel cron for `/api/cron/news-monitor` (every 3 hours)
- [ ] Add pre-game checks 30 min before kickoffs
- [ ] Build alerts UI to show recent player news

### Data Coverage
- [ ] Expand ADP data in draft-assistant (currently ~10 players)
- [ ] Add more injury history data (currently ~50 players)
- [ ] More revenge game matchups (currently ~7 players)
- [ ] Use Sleeper's depth_chart_order for dynamic depth chart threats

### Monetization
- [ ] Configure Stripe products (Pro Monthly $7.99, Yearly $79.99)
- [ ] Test checkout flow end-to-end
- [ ] Add usage limits for free tier

---

## Completed (January 3, 2026)

### Session 5 - AI Agents & Infrastructure
- [x] **4 AI Agents Built**
  - League Context Agent - analyzes Sleeper leagues, profiles owners
  - Trade Negotiator Agent - generates 3 trade tiers (lowball/fair/overpay)
  - Lineup Optimizer Agent - creates optimal lineup from edge scores
  - Draft Assistant Agent - tracks picks, detects runs, recommends picks
- [x] **Database Tables** for all agents (migration 006)
  - league_profiles, owner_profiles, trade_suggestions
  - lineup_recommendations, draft_sessions, draft_picks, draft_recommendations
- [x] **Cost Tracking System**
  - api_costs table tracks all Claude API calls
  - Cost dashboard at /admin/costs
  - Daily/weekly/monthly spend tracking
  - Projected monthly spend
- [x] **News Monitoring System**
  - weekly_schedule table for NFL games
  - alerts table for player news
  - news_monitor_state for tracking runs
  - Smart monitoring windows based on game times
- [x] **MCP Servers Configured**
  - Supabase MCP - direct database access
  - GitHub MCP - create issues and PRs
- [x] **Sub-Agents Created**
  - @code-reviewer - code quality checks
  - @security-auditor - vulnerability scanning
  - @performance-optimizer - find bottlenecks
  - @data-analyst - analyze prediction patterns

### Session 4 - Prediction Tracking
- [x] **Prediction Accuracy Tracking** - Supabase + Vercel Cron
- [x] **Learning Algorithm** - adjusts edge weights based on accuracy
- [x] **Self-Improvement Agent** - analyzes patterns, proposes changes
- [x] **Paywall/Freemium System** - Stripe integration
- [x] **Roster Screenshot Upload** - Claude Vision parsing

### Session 3 - Dynasty Features
- [x] **Durability Analysis** - injury history, ratings
- [x] **Coverage Matchup** - zone vs man beaters

### Session 2 - Trade Analyzer
- [x] **Sell Window Alerts** - SELL NOW, BUY LOW signals
- [x] **Team Diagnosis** - roster evaluation
- [x] **Multi-Player Trades** - up to 4 per side
- [x] **Draft Pick Values** - 2026-2028

### Session 1 - Core Features
- [x] 16 edge detectors
- [x] Trade analyzer (Dynasty/Redraft)
- [x] Waiver Wire Scanner
- [x] Live scores ticker
