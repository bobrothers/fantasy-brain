# Fantasy Brain - Build Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FANTASY BRAIN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   Next.js App   │    │  Python Engine  │    │    Postgres     │         │
│  │   (Frontend +   │◄──►│  (Hidden Edge   │◄──►│   (Supabase)    │         │
│  │   API Routes)   │    │   Detector)     │    │                 │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                     │                      ▲                    │
│           │                     │                      │                    │
│           ▼                     ▼                      │                    │
│  ┌─────────────────────────────────────────────────────┴───────┐           │
│  │                     DATA PROVIDERS (Adapters)                │           │
│  ├─────────────┬─────────────┬─────────────┬─────────────┬─────┤           │
│  │   Sleeper   │  nflfastR   │ Open-Meteo  │  Odds API   │ ESPN│           │
│  │   (League)  │  (Stats)    │  (Weather)  │  (Lines)    │(Inj)│           │
│  └─────────────┴─────────────┴─────────────┴─────────────┴─────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Hidden Edge Detector Modules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HIDDEN EDGE DETECTOR                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   WEATHER    │  │   TRAVEL/    │  │   OL INJURY  │  │   BETTING    │    │
│  │   IMPACT     │  │   REST       │  │   FLAGS      │  │   SIGNALS    │    │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤    │
│  │ • Wind >15mph│  │ • East→West  │  │ • LT out     │  │ • Line move  │    │
│  │ • Precip     │  │ • Short week │  │ • RT out     │  │ • Implied    │    │
│  │ • Temp <32°F │  │ • London     │  │ • C out      │  │   total      │    │
│  │ • Dome vs Out│  │ • Denver alt │  │ • Multiple   │  │ • Sharp $    │    │
│  │ • Historical │  │ • Bye week   │  │   starters   │  │              │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐                                        │
│  │   USAGE      │  │   SCHEME     │                                        │
│  │   TRENDS     │  │   CHANGE     │                                        │
│  ├──────────────┤  ├──────────────┤                                        │
│  │ • Target %   │  │ • New OC/DC  │                                        │
│  │ • Snap trend │  │ • Pass rate  │                                        │
│  │ • RZ looks   │  │ • Formation  │                                        │
│  │ • Route part │  │ • Pace delta │                                        │
│  └──────────────┘  └──────────────┘                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Build Phases

### Phase 1: Foundation (Current)
- [x] Project scaffolding
- [ ] Data provider adapters (Sleeper, nflfastR, Open-Meteo, Odds API, ESPN)
- [ ] Database schema
- [ ] Basic API endpoints

### Phase 2: Hidden Edge Detector MVP
- [ ] Weather impact module
- [ ] Travel/rest disadvantage module
- [ ] OL injury flags module
- [ ] Betting signals module

### Phase 3: Core Features
- [ ] Usage trends from play-by-play
- [ ] Scheme change detection
- [ ] Start/Sit recommendations
- [ ] Waiver wire suggestions

### Phase 4: UI
- [ ] League connection (Sleeper)
- [ ] My Team view
- [ ] Weekly recommendations
- [ ] Chat interface

---

## File Structure

```
fantasy-brain/
├── app/                      # Next.js app router
│   ├── api/                  # API routes
│   │   ├── league/          
│   │   ├── players/         
│   │   └── edge/            # Hidden edge endpoints
│   ├── (dashboard)/         # Protected routes
│   └── page.tsx             # Landing
├── components/               # React components
├── lib/                      
│   ├── providers/           # Data source adapters
│   │   ├── sleeper.ts       
│   │   ├── nfl-data.ts      # nflfastR wrapper
│   │   ├── weather.ts       # Open-Meteo
│   │   ├── odds.ts          # The Odds API
│   │   └── espn.ts          # ESPN hidden API
│   ├── edge/                # Hidden edge detector modules
│   │   ├── weather-impact.ts
│   │   ├── travel-rest.ts
│   │   ├── ol-injury.ts
│   │   ├── betting-signals.ts
│   │   ├── usage-trends.ts
│   │   └── scheme-change.ts
│   ├── engine/              # Core logic
│   │   ├── start-score.ts
│   │   ├── projections.ts
│   │   └── recommendations.ts
│   └── db/                  # Database utilities
├── python/                   # Python backend for heavy analytics
│   ├── nfl_data/            # nfl_data_py wrappers
│   ├── edge_detector/       # Python edge calculations
│   └── api.py               # FastAPI for Python endpoints
├── db/                       # Database
│   ├── schema.sql
│   └── migrations/
├── types/                    # Shared TypeScript types
├── CLAUDE.md                 # Project instructions for Claude
├── MAP.md                    # Code navigation index
└── TODO.md                   # Current tasks
```

---

## Data Flow

```
1. INGESTION (Daily/Hourly Cron Jobs)
   ┌─────────┐     ┌─────────┐     ┌─────────┐
   │ Sleeper │     │nflfastR │     │Open-Meteo│
   │ Players │     │ Stats   │     │ Weather │
   └────┬────┘     └────┬────┘     └────┬────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
              ┌─────────────────┐
              │   Normalize &   │
              │   Store in DB   │
              └────────┬────────┘
                       │
2. EDGE DETECTION      ▼
              ┌─────────────────┐
              │  Run Edge       │
              │  Detector       │
              │  Modules        │
              └────────┬────────┘
                       │
3. SCORING             ▼
              ┌─────────────────┐
              │  Compute        │
              │  Start Scores   │
              │  + Confidence   │
              └────────┬────────┘
                       │
4. SERVE               ▼
              ┌─────────────────┐
              │  API Returns    │
              │  Recommendations│
              │  + Explanations │
              └─────────────────┘
```

---

## Current Task

Starting with Phase 1: Build the data provider adapters so we have real data to work with.

Order:
1. Sleeper adapter (league/roster data) 
2. nfl_data_py setup (historical stats)
3. Open-Meteo adapter (weather)
4. ESPN adapter (injuries)
5. Odds API adapter (betting lines)

Then we'll have the data foundation to build the edge detector modules.
