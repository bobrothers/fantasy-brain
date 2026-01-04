# TODO - Fantasy Brain

## High Priority

### Supabase Setup (for Prediction Accuracy Tracking)
- [ ] Create Supabase project at https://supabase.com (free tier works)
- [ ] Run SQL migration from `/db/migrations/001_create_predictions.sql` in SQL Editor
- [ ] Add environment variables to Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL` (from Project Settings → API)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon public key)
  - `SUPABASE_SERVICE_ROLE_KEY` (service_role key)
  - `CRON_SECRET` (generate random string for Vercel cron auth)
- [ ] Verify cron jobs work (Vercel Pro plan required for crons)

### Stripe Setup (for Paywall)
- [ ] Create products in Stripe Dashboard:
  - Pro Monthly: $7.99/month
  - Pro Yearly: $79.99/year
- [ ] Add environment variables to Vercel:
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`
  - `NEXT_PUBLIC_STRIPE_PRICE_YEARLY`
  - `STRIPE_WEBHOOK_SECRET`
- [ ] Configure Stripe webhook endpoint → `/api/stripe/webhook`
- [ ] Test checkout flow end-to-end

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

- [ ] Playoff bracket simulator
- [ ] Draft assistant mode (dynasty rookie drafts)
- [ ] League-specific scoring (PPR vs Standard vs Half-PPR adjustments)
- [ ] Auction draft values

---

## Completed (January 2026)

### Session 4 (Jan 3)
- [x] **Prediction Accuracy Tracking** - Supabase + Vercel Cron system
  - Prediction logging when players analyzed (before games)
  - Outcome tracking from Sleeper API (after games)
  - Accuracy calculation by recommendation, position, confidence, edge type
  - Public `/accuracy` page with hit rates and leaderboards
  - Vercel cron: outcomes at Tuesday 10am UTC, accuracy at 11am UTC
  - Hit criteria: SMASH=top 5, START=top 12, FLEX=top 24
  - Biggest hits/misses examples
- [x] **Paywall/Freemium System** - Stripe integration for Pro subscriptions
  - Usage tracking with localStorage (resets daily)
  - Free tier: 3 analyses/day, 1 trade/day, 5 players in diagnosis
  - Pro tier: $7.99/mo or $79.99/yr for unlimited
  - `/pricing` page with tier comparison
  - `/pro/success` page for subscription activation
  - Pro badge in header for subscribers
  - Usage counters and upgrade prompts on all pages
- [x] **Roster Screenshot Upload** - Claude Vision for roster parsing
  - Drag-and-drop image upload on /diagnose
  - Fuzzy player name matching with 100+ aliases
  - Auto-populate roster from screenshot

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
