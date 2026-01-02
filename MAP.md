# Code Navigation Map

Quick reference for key functions and entry points.

## Data Providers

### Sleeper (`lib/providers/sleeper.ts`)
- `sleeper.getAllPlayers()` - Get all NFL players (cache 24h)
- `sleeper.getPlayer(id)` - Get single player
- `sleeper.getLeague(leagueId)` - Get league settings
- `sleeper.getRosters(leagueId)` - Get all rosters in league
- `sleeper.getMatchups(leagueId, week)` - Get weekly matchups
- `sleeper.getNflState()` - Get current week/season
- `sleeper.getTrendingPlayers(type)` - Get trending adds/drops

### Weather (`lib/providers/weather.ts`)
- `weather.getGameWeather(homeTeam, gameTime)` - Get forecast for game
- `weather.getStadium(team)` - Get stadium info
- `weather.isDome(team)` - Check if dome stadium
- `weather.hasWeatherImpact(weather)` - Check if conditions are significant
- `NFL_STADIUMS` - Stadium data with lat/lng for all 32 teams

### ESPN (`lib/providers/espn.ts`)
- `espn.getTeamInjuries(team)` - Get injuries for team
- `espn.getAllInjuries()` - Get all NFL injuries
- `espn.getOLInjuries(team)` - Get OL-specific injuries
- `espn.getCurrentWeek()` - Get current NFL week
- `espn.getWeekGames(season, week)` - Get schedule

### Odds (`lib/providers/odds.ts`)
- `odds.getNFLOdds()` - Get all NFL game odds
- `odds.getGameOdds(home, away)` - Get specific game odds
- `odds.getImpliedTotal(team)` - Get team's implied point total
- `odds.isBlowoutRisk(odds)` - Check for blowout scenario
- `odds.getHighScoringGames(threshold)` - Find shootout games

## Edge Detectors

### Main Orchestrator (`lib/edge-detector.ts`)
- `analyzePlayer(playerName, week)` - Full analysis with all 10 detectors
- `printAnalysis(result)` - Console output formatting
- `WEEK_18_SCHEDULE` - Hardcoded Week 18 2025 matchups

### Weather Impact (`lib/edge/weather-impact.ts`)
- `detectWeatherEdge(player, opponent, isHome, gameTime, week)` - Main detector
- `detectWeatherEdgeBatch(players, week)` - Batch detection

### Travel/Rest (`lib/edge/travel-rest.ts`)
- `detectTravelEdge(context, week)` - Main detector
- `isThursdayTrap(prevGame, currGame)` - Check for trap game

### OL Injury (`lib/edge/ol-injury.ts`)
- `detectOLInjuryEdge(team, week)` - Main detector
- `getOLInjuryFantasyImpact(result)` - Get position impacts

### Betting Signals (`lib/edge/betting-signals.ts`)
- `detectBettingEdge(team, week)` - Main detector
- `getShootoutGames()` - Find high-total games

### Defense vs Position (`lib/edge/defense-vs-position.ts`) ⚠️ Approximate data
- `detectDefenseMatchupEdge(player, opponent, week)` - Main detector
- `getSmashSpots(position)` - Find weak defenses
- `DEFENSE_RANKINGS` - Hardcoded rankings (needs real source)

### Opposing Defense Injuries (`lib/edge/opposing-defense-injuries.ts`)
- `detectOpposingDefenseEdge(player, opponent, week)` - Main detector
- `getPositionBoostVsTeam(position, team)` - Position-specific boost

### Usage Trends (`lib/edge/usage-trends.ts`) ⚠️ Sample data
- `detectUsageTrendEdge(player, week)` - Main detector
- `getEmergingPlayers()` - Find rising usage
- `USAGE_DATA` - Sample data (needs nflfastR)

### Contract Incentives (`lib/edge/contract-incentives.ts`)
- `detectContractIncentiveEdge(player, week)` - Main detector
- `getPlayersWithIncentives()` - All verified incentives
- `CONTRACT_INCENTIVES` - Verified from Spotrac/NFL.com

### Revenge Games (`lib/edge/revenge-games.ts`) ⚠️ Incomplete
- `detectRevengeGameEdge(player, week)` - Main detector
- `getActiveRevengeGames()` - This week's revenge games
- `REVENGE_GAMES` - Hardcoded player history

### Red Zone Usage (`lib/edge/red-zone-usage.ts`) ⚠️ Sample data
- `detectRedZoneEdge(player, week)` - Main detector
- `getGoalLineBacks()` - Elite GL backs
- `RED_ZONE_USAGE` - Sample data (needs nflfastR)

## Types (`types/index.ts`)
- `Player` - Normalized player data
- `League` - League settings
- `Roster` - Team roster
- `EdgeSignal` - Edge detection output
- `GameWeather` - Weather data
- `GameOdds` - Betting data
- `InjuryReport` - Injury data
- `Stadium` - Stadium metadata
