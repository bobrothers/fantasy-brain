# TODO - Fantasy Brain

## Next Up

### Multi-Player Trades
- [ ] Support 2-for-1, 3-for-2 trades in trade analyzer
- [ ] Sum values for trade packages
- [ ] Show which side is giving up more

### Roster Integration
- [ ] Connect to Sleeper league by league ID
- [ ] Import user's roster
- [ ] "Analyze My Team" - batch analyze all roster players
- [ ] Start/sit recommendations based on edge scores

### Data Quality
- [ ] Replace hardcoded defense rankings with live source (FantasyPros/NFL.com)
- [ ] Build home/away splits from nflfastR historical data
- [ ] Expand revenge games database (currently ~7 players)

## Future Ideas

- [ ] Player search autocomplete in UI
- [ ] Mobile responsive improvements
- [ ] Supabase for caching API responses
- [ ] Historical edge accuracy tracking
- [ ] Snap count trends (requires play-by-play)

## Completed

- [x] 15 edge detectors implemented
- [x] Web UI deployed to Vercel
- [x] Trade Analyzer with Dynasty/Redraft modes
- [x] Waiver Wire Scanner with real Sleeper trending data
- [x] ACCEPT/REJECT verdict system with "gun to head" recommendation
- [x] Position-specific age curves (RB decline at 27, WR peak 26-30)
- [x] Edge factors extracted from real signals (no fabricated data)
- [x] Dynamic schedule from ESPN API (supports any week)
