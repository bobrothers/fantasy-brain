# TODO

## Phase 1: Data Provider Adapters

### Sleeper Adapter
- [ ] Create base adapter with rate limiting
- [ ] Implement getPlayer(id)
- [ ] Implement getAllPlayers()
- [ ] Implement getLeague(leagueId)
- [ ] Implement getRosters(leagueId)
- [ ] Implement getMatchups(leagueId, week)
- [ ] Test with real league ID

### NFL Data (nfl_data_py)
- [ ] Set up Python environment
- [ ] Create FastAPI endpoint for stats queries
- [ ] Implement getWeeklyStats(playerId, season, week)
- [ ] Implement getSeasonStats(playerId, season)
- [ ] Implement getPlayByPlay(gameId)
- [ ] Build historical weather performance query

### Open-Meteo (Weather)
- [ ] Create adapter with stadium coordinates mapping
- [ ] Implement getGameWeather(gameId)
- [ ] Implement getForecast(lat, lng, datetime)
- [ ] Map all 32 stadiums (outdoor only matter)

### ESPN (Injuries)
- [ ] Document working endpoints
- [ ] Create adapter for injury status
- [ ] Implement getTeamInjuries(teamId)
- [ ] Implement getPlayerInjury(playerId)

### The Odds API
- [ ] Sign up for free API key (500 req/month)
- [ ] Create adapter for NFL odds
- [ ] Implement getGameOdds(gameId)
- [ ] Implement getSpread(gameId)
- [ ] Implement getTotal(gameId)

## Next Up (Phase 2)
- [ ] Weather impact edge module
- [ ] Travel/rest edge module
