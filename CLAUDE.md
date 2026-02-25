# Trusti Development Context

## Core Product
Trust-based restaurant recommendations. Max 10 friends. Stoplight ratings (🔴🟡🟢). Reviews: 150 chars max with bullet points. Chips for structured tags.

## Tech Stack
React + Vite + Tailwind CSS + Firebase (Auth & Firestore) + Google Maps/Places API + Vercel hosting

## Design System
- Dark mode map, orange accents (#FF6B35 - Mets colors)
- Lowercase, conversational copy throughout
- Mobile-first, map-centric UI
- Review banner/cards slide up over map (~50% height)
- Balloon markers with colored string tethers for flags

## Key Patterns
- Primary action color: Trusti blue (#3B82F6)
- Character limits: 150 for reviews
- Sort order: most recent first
- Snap scrolling for stacked reviews
- Left tap card = read, right tap = write

## File Structure
- /components - React components (MapView, RecommendationCard, etc.)
- /services - API integrations (Firebase, Google Places)
- /contexts - React context (AuthContext)

Refer to PRODUCT_NOTES.md for feature roadmap and product decisions.
