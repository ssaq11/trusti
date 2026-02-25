# Trusti Product Documentation

## Core Concept
Trust-based restaurant recommendation network. "Replacing the text message, not Yelp."
- Domain: trusti.es
- Max 10 trusted friends (hard limit)
- Stoplight ratings: 🟢 go / 🟡 meh / 🔴 skip
- Flags: 🚩 want to go / ⚠️ heard things
- Reviews: 150 char limit with bullet-point auto-formatting
- Chips for structured tags (e.g. "Date night", "Must order...")
- Map-first UI

## V1 MVP (Current Build)
- [x] Firebase auth (email + Google)
- [x] Google Places search
- [x] Stoplight + flag reviews
- [x] Follow system (Trusti 9, X/9 counter)
- [x] Map view with custom markers (stoplight dots + balloon/string intent markers)
- [x] Review cards with stoplight display
- [x] Chip-based tags on reviews
- [x] Review banner slides up over map
- [x] Filter tabs (All / Trusti Reviews / Want to Go)
- [x] Inline read mode (left-tap card expands reviews grouped by user)
- [x] Multi-visit stacking (Updated/Original labels, dotted dividers)
- [x] Deployed on Vercel

## V2 Features (Future)
- AI taste profile learning
- Celebrity curator imports (Kenji, Gritzer, Boccato)
- AI recommendations when network weak
- Six Degrees of Trusti (friend-of-friend)
- Contextual messaging in reviews
- Restaurant re-review workflow with private feedback
- Bot/scam prevention
- Expanded review panel slides up over map (parity with write banner)

## Revenue Ideas
- Restaurant claim listings
- Featured placement
- Consulting service for flagged restaurants
- Sponsored deals/promos (clearly labeled, separate section, doesn't dilute core trust)

## Design System
- Dark mode map, orange accents (Mets colors)
- Lowercase, conversational copy
- Hamburger menu (not bottom nav)
- Custom Trusti markers (stoplight dots, balloon-on-string for flags)
- Chip-based structured tags
- Review banner and read panel both eat into map space — content is the star

## Future Vertical Ideas (Unranked)

### Healthcare
- Trusti Docs - Doctors, dentists, therapists

### Travel & Hospitality
- Trusti Stay - Hotels, Airbnbs

### E-commerce
- Trusti Shop - Product recommendations (counter to fake Amazon reviews)

### Media & Entertainment
- Trusti Watch/Listen/Read/Play - Movies, TV, music, books, games

### Services
- Trusti Hire - Freelancers, contractors, service providers
- Trusti Kids - Daycare, pediatricians, family activities
- Trusti Learn - Online courses, bootcamps

### Other
- Trusti Move - Neighborhood recommendations
- Trusti Date - Friend-vetted dating
- Trusti Invest - Where friends invest

### Separate Product Concepts
- Trusti News - Spin-free news aggregator

All verticals would use same core: stoplight ratings, max 10 friends, 150-char reviews
