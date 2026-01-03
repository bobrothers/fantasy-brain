# Verify App Agent

An agent that verifies features work from a user perspective.

## Purpose
Test the application as a user would, verifying that features work correctly end-to-end.

## Instructions

When verifying the application:

### 1. Start the App
```bash
npm run dev
```
Confirm the server starts without errors.

### 2. Test Core User Flows

For Fantasy Brain, test these flows:

#### Player Analysis (/)
- [ ] Search for a player (e.g., "Jalen Hurts")
- [ ] Autocomplete shows suggestions after 2 chars
- [ ] Analysis loads with edge signals
- [ ] Lock timer shows correct game time
- [ ] Resting players banner appears (if any)

#### Trade Analyzer (/trade)
- [ ] Enter two player names
- [ ] Toggle Dynasty/Redraft mode
- [ ] Analysis shows verdict (ACCEPT/REJECT)
- [ ] Player cards show scores and factors

#### Waiver Scanner (/waivers)
- [ ] Page loads with trending players
- [ ] Position filter works
- [ ] Edge scores display
- [ ] Hidden gems highlighted

### 3. Test API Endpoints

```bash
# Player analysis
curl "http://localhost:3000/api/analyze?player=Patrick%20Mahomes"

# Trade analysis
curl "http://localhost:3000/api/trade?player1=Josh%20Allen&player2=Lamar%20Jackson&mode=dynasty"

# Waiver targets
curl "http://localhost:3000/api/waivers?position=RB&limit=10"

# Resting players
curl "http://localhost:3000/api/resting"

# Player search
curl "http://localhost:3000/api/players/search?q=mah"
```

### 4. Check for Errors

- Browser console errors
- Network request failures
- Unhandled exceptions
- Missing data/null values

### 5. Verify Data Quality

- No "undefined" or "null" displayed to users
- Numbers formatted correctly
- Dates/times make sense
- No obviously wrong data

## Output Format

```
# App Verification Report

## Environment
- URL: http://localhost:3000
- Node: [version]
- Time: [timestamp]

## User Flow Tests

| Flow | Status | Notes |
|------|--------|-------|
| Player Analysis | ✅/❌ | [details] |
| Trade Analyzer | ✅/❌ | [details] |
| Waiver Scanner | ✅/❌ | [details] |

## API Tests

| Endpoint | Status | Response Time |
|----------|--------|---------------|
| /api/analyze | ✅/❌ | Xms |
| /api/trade | ✅/❌ | Xms |
| /api/waivers | ✅/❌ | Xms |

## Issues Found

### Critical
- [Issues that block usage]

### Minor
- [Issues that degrade experience]

### Cosmetic
- [Visual/UX issues]

## Overall: ✅ WORKING / ⚠️ ISSUES / ❌ BROKEN
```

## When to Use
- After deploying changes
- Before releasing to users
- When users report issues
- After dependency updates
