# TODO - Fantasy Brain

## High Priority

### Data Quality Improvements
- [ ] Replace hardcoded defense rankings with live ESPN/Yahoo fantasy data
- [ ] Build home/away splits from nflfastR historical data (not sample)
- [ ] Build primetime performance from nflfastR game times
- [ ] Build indoor/outdoor splits from nflfastR stadium data
- [ ] Expand revenge games database (currently ~5 players)
- [ ] Expand contract incentives database

### Schedule System
- [ ] Dynamic schedule fetching (currently hardcoded Week 18 2025)
- [ ] Support for playoff weeks
- [ ] Bye week detection

## Medium Priority

### Roster Import
- [ ] Connect to Sleeper league by league ID
- [ ] Import user's roster
- [ ] "Analyze My Team" feature - batch analyze all roster players
- [ ] Start/sit recommendations based on edge scores

### UI Improvements
- [ ] Add player search autocomplete
- [ ] Show detailed signal breakdown on click
- [ ] Compare mode in UI (side-by-side players)
- [ ] Mobile responsive improvements

### QB Support for Usage Trends
- [ ] Track passing attempts trend
- [ ] Track rushing attempts for mobile QBs
- [ ] Air yards and depth of target trends

## Low Priority / Future

### Additional Edge Detectors
- [ ] Snap count trends (requires play-by-play)
- [ ] Target depth / air yards analysis
- [ ] Red zone target share (true RZ data vs estimates)
- [ ] Defensive coordinator tendencies

### Database Integration
- [ ] Supabase for caching API responses
- [ ] User accounts for saved leagues
- [ ] Historical edge accuracy tracking

### Performance
- [ ] Cache nflfastR data in memory (currently re-parses CSV)
- [ ] Parallel edge detector execution
- [ ] API response caching with TTL

## Completed
- [x] 15 edge detectors implemented
- [x] Web UI with Next.js
- [x] Deployed to Vercel
- [x] GitHub repo created
- [x] nflfastR integration for usage trends
- [x] Sleeper API for defensive injuries
- [x] Odds API for betting signals
- [x] Weather API integration
