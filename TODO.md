# TODO - Fantasy Brain

## High Priority

### Live Data Sources (Replace Hardcoded)
- [x] Hot/cold streak from Sleeper weekly stats API ✅ NOW LIVE
- [x] Primetime schedule from ESPN API ✅ NOW LIVE
- [x] Deep stats (snap trend, air yards, target premium, divisional, 2nd half) ✅ ALREADY LIVE
- [ ] Defense rankings from FantasyPros or NFL.com API
- [ ] Offensive rankings from ESPN/PFF (currently static 2024-25)

### Trade Value Data (Assessed - requires external sources)
- Injury history: Sleeper only has current status, NOT historical (would need PFR/ESPN injury history)
- Draft capital: Sleeper has rookie_year but NOT draft round/pick (would need NFL.com data)
- Contract years: Would need Spotrac/OverTheCap API (often paid)
- Depth chart threats: Could use Sleeper's depth_chart_order (improvement opportunity)

### Multi-Player Trades
- [ ] Support 2-for-1, 3-for-2 trades in trade analyzer
- [ ] Sum values for trade packages
- [ ] Show which side is giving up more

### Roster Integration
- [ ] Connect to Sleeper league by league ID
- [ ] Import user's roster
- [ ] "Analyze My Team" - batch analyze all roster players
- [ ] Start/sit recommendations based on edge scores

## Medium Priority

### Data Coverage Expansion
- [ ] Expand trade value data beyond top ~25 players
- [ ] More revenge game matchups (currently ~7 players)
- [ ] More contract incentive data
- [ ] More depth chart threat data (currently ~11 players)

### Live Alerts
- [ ] Injury alerts (push notification when star player status changes)
- [ ] Line movement alerts (significant spread/total changes)
- [ ] Resting player alerts (auto-detect from news)

### UX Improvements
- [ ] Mobile responsive improvements
- [ ] Dark/light mode toggle
- [ ] Comparison view (side-by-side players)

## Low Priority / Future Ideas

- [ ] Supabase for caching API responses
- [ ] Historical edge accuracy tracking (did our edges predict outcomes?)
- [ ] Playoff bracket simulator
- [ ] Draft assistant mode (dynasty rookie drafts)
- [ ] League-specific scoring (PPR vs Standard vs Half-PPR adjustments)

## Completed

### January 2026 Session - Data Quality Fixes
- [x] **Hot/cold streak now LIVE** - pulls from Sleeper weekly stats API (was hardcoded for ~20 players)
- [x] **Primetime schedule now LIVE** - uses ESPN API dynamically (was hardcoded for Weeks 15-17)
- [x] Deep stats verified - already using live Sleeper data for all 5 metrics
- [x] Assessed trade value data - documented what can/cannot be automated

### January 2026 Session - Earlier
- [x] Trade analyzer with Dynasty/Redraft modes
- [x] Dynasty metrics: Draft capital, breakout age, offensive ranking, depth chart threat
- [x] Redraft metrics: Hot/cold streak, Vegas implied, playoff weather, positional scarcity, primetime
- [x] Player search autocomplete prioritizes active players
- [x] Suspended players show in red (vs purple for resting)
- [x] Usage trend chart from real Sleeper 2025 data
- [x] Cold weather performance tracking
- [x] Deep stats: Snap trend, Air yards, Target premium, Divisional, Second half surge
- [x] Navigation bar on all pages
- [x] SNF/MNF primetime detection fixed (UTC timezone issue)
- [x] DK Metcalf updated to PIT, marked as Suspended

### Previous Sessions
- [x] 15 edge detectors implemented
- [x] Web UI deployed to Vercel
- [x] Waiver Wire Scanner with real Sleeper trending data
- [x] ACCEPT/REJECT verdict system with "gun to head" recommendation
- [x] Position-specific age curves (RB decline at 27, WR peak 26-30)
- [x] Dynamic schedule from ESPN API (supports any week)
- [x] Lock countdown timer
- [x] Resting starters detection banner
