# trusti — Product Notes

Restaurant recommendations from people you trust, not strangers on the internet.

---

## V1 — Current Build

### Core Features
- **Stoplight Rating System** — Red (don't go), Yellow (it's okay), Green (must try). Simple, opinionated, no 1-5 star ambiguity.
- **Map-Based Home Feed** — Interactive Google Map centered on user's location showing nearby restaurants. Trusti-reviewed places show colored dots on the map. Places listed below the map with photos, names, and addresses.
- **Search Nearby** — Search bar on home page ("tacos", "coffee", "sushi") filters the map and list to show matching nearby restaurants.
- **Tap-to-Review** — Tap any place on the map or in the list to open the review flow. Restaurant name, address, and zip code auto-fill from Google Places data.
- **Manual Entry** — Option to manually enter a restaurant if it's not found via search.
- **Follow System** — Follow other users to see their recommendations. Search for people by name. Follow/unfollow from search results or profile pages.
- **User Profiles** — View your own profile with stats (recs, followers, following), your recommendations list, and logout. View other users' profiles with their recs and a follow/unfollow button.
- **Discover Mode** — When you have no followers or no recs in your feed, see all recent recommendations from everyone.

### Auth
- Email/password signup and login
- Google sign-in
- Firebase Authentication

### Data
- Firestore for users, recommendations, and follows
- Google Places API for restaurant search and nearby discovery
- Geolocation API for user location detection

### Tech Stack
- React 19 + Vite 7
- Tailwind CSS 4
- Firebase (Auth + Firestore)
- Google Maps JavaScript API + Places Library
- lucide-react icons
- Mobile-first responsive design

### Known Limitations (V1)
- Google Places API requires billing enabled on Google Cloud project
- Location detection depends on browser/OS permissions
- People search requires typing the beginning of a display name (case-insensitive)
- No push notifications
- No image uploads for reviews
- No pagination on feeds (limited to 50 most recent)
- Follower/following counts can drift if operations fail mid-transaction

---

## V2 — Future Features

### Social
- **Activity Feed** — See when someone you follow adds a new review in real-time
- **Share Recommendations** — Share a recommendation link via text, social media, or DM
- **Invite Friends** — Invite people by phone number or email, with a referral system
- **Comments & Reactions** — React to or comment on a friend's recommendation
- **Private Groups** — Create invite-only groups (e.g., "Foodie Friends", "Work Lunch Crew") with shared rec lists
- **Suggested Follows** — "People you may know" based on mutual follows or shared taste

### Discovery
- **Trending Nearby** — Show most-reviewed or top-rated places near you across all users
- **Taste Match Score** — Show how much your ratings align with another user's (e.g., "You agree on 80% of places")
- **Cuisine Filters** — Filter map and feed by cuisine type (Mexican, Italian, Coffee, etc.)
- **Saved/Wishlist** — Save places you want to try from others' recommendations
- **"Ask for Recs"** — Post a question ("Best tacos in 78701?") and get answers from your network

### Reviews
- **Photo Reviews** — Add photos to your recommendations
- **Multi-Visit Tracking** — Update your rating over time, see rating history
- **Detailed Tags** — Add tags like "date night", "cheap eats", "outdoor seating", "kid-friendly"
- **Menu Item Recs** — Recommend specific dishes, not just the restaurant

### Map & Location
- **Live Map Clustering** — Cluster markers when zoomed out, expand when zoomed in
- **Map Filters** — Toggle to show only green-rated, only followed users' recs, etc.
- **Neighborhood Boundaries** — Show neighborhood outlines on the map
- **Directions Integration** — One-tap to open Google Maps/Apple Maps for directions

### Profile & Settings
- **Edit Profile** — Change display name, bio, profile photo
- **Privacy Settings** — Make profile private, approve follow requests
- **Notification Preferences** — Push notifications for new followers, recs from followed users
- **Export Data** — Download all your recommendations as CSV

### Platform
- **PWA / Native App** — Installable as a Progressive Web App, eventually native iOS/Android
- **Offline Mode** — Cache recent feed data for offline browsing
- **Dark Mode** — System-aware dark/light theme toggle
- **Onboarding Flow** — Guided first-run experience: set location, follow suggested users, add first rec
- **Admin Dashboard** — Content moderation, user management, analytics
