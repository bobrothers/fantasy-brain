# TODO - Fantasy Brain

## High Priority

### Multi-Player Trades
- [ ] Support 2-for-1, 3-for-2 trades in trade analyzer
- [ ] Sum values for trade packages
- [ ] Show which side is giving up more

### Roster Integration
- [ ] Connect to Sleeper league by league ID
- [ ] Import user's roster
- [ ] "Analyze My Team" - batch analyze all roster players
- [ ] Start/sit recommendations based on edge scores

### Live Data Sources (Replace Hardcoded)
- [x] Defense rankings - NOW LIVE from Sleeper + ESPN ✅
- [ ] Offensive rankings from ESPN/PFF (currently static 2024-25)

## Medium Priority

### Data Coverage Expansion
- [ ] Expand trade value data beyond top ~25 players
- [ ] More revenge game matchups (currently ~7 players)
- [ ] More contract incentive data
- [ ] Use Sleeper's depth_chart_order for dynamic depth chart threats

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

## Completed (January 2026)

### This Session
- [x] Live scores ticker from ESPN (shows scores or "BAL @ PIT SNF" format)
- [x] Edge Impact tooltip explaining the score scale
- [x] Fixed Weekly Snap % chart not rendering bars
- [x] Fixed Washington team abbreviation (WSH → WAS)
- [x] Hot/cold streak now LIVE from Sleeper weekly stats API
- [x] Primetime schedule now LIVE from ESPN API
- [x] Deep stats verified - already using live Sleeper data

### Earlier This Session
- [x] Trade analyzer with Dynasty/Redraft modes
- [x] Dynasty metrics: Draft capital, breakout age, offensive ranking, depth chart threat
- [x] Redraft metrics: Hot/cold streak, Vegas implied, playoff weather, positional scarcity, primetime
- [x] Player search autocomplete prioritizes active players
- [x] Suspended players show in red (vs purple for resting)
- [x] DK Metcalf updated to PIT, marked as Suspended
- [x] Usage trend chart from real Sleeper 2025 data
- [x] Cold weather performance tracking
- [x] Deep stats: Snap trend, Air yards, Target premium, Divisional, Second half surge
- [x] Navigation bar on all pages
- [x] SNF/MNF primetime detection fixed (UTC timezone issue)

### Previous Sessions
- [x] 15 edge detectors implemented
- [x] Web UI deployed to Vercel
- [x] Waiver Wire Scanner with real Sleeper trending data
- [x] ACCEPT/REJECT verdict system with "gun to head" recommendation
- [x] Position-specific age curves (RB decline at 27, WR peak 26-30)
- [x] Dynamic schedule from ESPN API (supports any week)
- [x] Lock countdown timer
- [x] Resting starters detection banner
