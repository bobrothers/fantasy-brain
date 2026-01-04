# TODO - Fantasy Brain

## High Priority

### Roster Integration
- [ ] Connect to Sleeper league by league ID
- [ ] Import user's roster
- [ ] "Analyze My Team" - batch analyze all roster players
- [ ] Start/sit recommendations based on edge scores

### Live Alerts
- [ ] Injury alerts (push notification when star player status changes)
- [ ] Line movement alerts (significant spread/total changes)
- [ ] Resting player alerts (auto-detect from news/Sleeper)

### Data Coverage Expansion
- [ ] Expand injury data beyond current ~50 players
- [ ] More revenge game matchups (currently ~7 players)
- [ ] More contract incentive data
- [ ] Use Sleeper's depth_chart_order for dynamic depth chart threats
- [ ] Offensive rankings from ESPN/PFF (currently static 2024-25)

## Medium Priority

### UX Improvements
- [ ] Mobile responsive improvements
- [ ] Dark/light mode toggle
- [ ] Comparison view (side-by-side players)
- [ ] Waiver FAAB suggestions based on edge scores

### Data Quality
- [ ] Home/away splits from nflfastR play-by-play (currently hardcoded)
- [ ] Indoor/outdoor splits from nflfastR (currently hardcoded)
- [ ] Primetime historical performance from nflfastR

## Low Priority / Future Ideas

- [ ] Supabase for caching API responses
- [ ] Historical edge accuracy tracking (did our edges predict outcomes?)
- [ ] Playoff bracket simulator
- [ ] Draft assistant mode (dynasty rookie drafts)
- [ ] League-specific scoring (PPR vs Standard vs Half-PPR adjustments)
- [ ] Auction draft values

---

## Completed (January 2026)

### Session 3 (Jan 3)
- [x] **Durability Analysis** - Comprehensive injury tracking for dynasty
  - Games played % over 3 seasons with recency weighting
  - Injury types: soft tissue, ACL, concussions, ankle/foot
  - Ratings: IRON MAN, DURABLE, MODERATE, INJURY PRONE, GLASS
  - Age + injury combo risk detection
  - Major injury recovery status
  - ~50 players with injury history data
- [x] **Coverage Matchup Fix** - Corrected inverted logic (zone-beaters beat zone)
- [x] **Stefon Diggs Fix** - Updated to Patriots (was showing as Texans)

### Session 2 (Jan 2-3)
- [x] **Sell Window Alerts** - SELL NOW, SELL SOON, BUY LOW, BUY NOW
- [x] **Consolidation Analyzer** - "3 nickels ≠ 1 dollar" warnings
- [x] **Team Diagnosis** - Dynasty roster evaluation at /diagnose
- [x] **Contract Analysis** - Status, dead cap, rookie deal value
- [x] **Situation Analysis** - QB stability, target competition
- [x] **Multi-Player Trades** - Up to 4 players per side
- [x] **Draft Pick Values** - 2026-2028, rounds 1-4, player equivalents
- [x] **Coverage Matchup Edge** - Man vs zone from Sharp Football

### Session 1 (Dec-Jan)
- [x] Trade analyzer with Dynasty/Redraft modes
- [x] 16 edge detectors implemented
- [x] Web UI deployed to Vercel
- [x] Waiver Wire Scanner with Sleeper trending
- [x] Live scores ticker from ESPN
- [x] Dynamic schedule from ESPN API
- [x] Defense rankings from Sleeper + ESPN (live)
- [x] Hot/cold streak from Sleeper weekly stats
- [x] Primetime schedule from ESPN API
