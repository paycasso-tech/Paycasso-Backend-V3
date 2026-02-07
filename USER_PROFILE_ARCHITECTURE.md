# User Profile System - Architecture & Design

## Overview
A production-grade user profile and reputation system designed for a stablecoin-powered escrow platform. Built with smart interlinking between profiles, ratings, escrows, and wallets.

---

## 🎯 Key Architectural Decisions

### 1. **Trust Score Engine** (Dynamic Reputation System)
- **Weighted Algorithm**: Recent ratings (< 90 days) have full weight, older ratings decay over time
- **Auto-Update**: Trust scores automatically recalculate when new ratings are submitted
- **Multi-Dimensional**: Overall + category ratings (communication, quality, professionalism, timeliness)
- **Business Logic**: Prevents rating spam - one rating per escrow, verified escrow completion required

### 2. **Profile Completeness Gamification**
Encourages users to complete profiles with weighted scoring:
```
Email Verified: 15%
Full Name: 10%
Bio (>50 chars): 15%
Profile Picture: 10%
Wallet Connected: 20%  ← Highest weight (core platform feature)
Skills: 15%
Country: 5%
Timezone: 5%
Language: 5%
```

### 3. **Badge System** (Achievement-based Trust Indicators)
Automatically awarded badges based on performance:
- `email_verified` - Email confirmed
- `wallet_connected` - Blockchain wallet linked
- `top_rated` - Trust score ≥ 4.8
- `experienced` - 10+ completed contracts
- `veteran` - 50+ completed contracts
- `high_volume` - $10,000+ USDC transacted

### 4. **Privacy-Layered Responses**
Different data visibility based on context:
- **Own Profile**: Full details (email, private wallet info, notification settings)
- **Public Profile**: Limited info (name, bio, trust score, public ratings)
- **Authenticated View**: Additional context if logged in

### 5. **Advanced Search with ML-Ready Filters**
```typescript
// Search supports:
- Text query (name, bio, skills)
- Role filter (client/freelancer)
- Trust score threshold
- Skills matching (array overlap)
- Country/location
- Sorting (trust_score, completed_contracts, created_at)
- Pagination
```

---

## 📊 Database Schema

### Rating Entity
```
ratings
├── id (uuid)
├── rated_user_id (uuid) ← User receiving rating
├── reviewer_id (uuid) ← User giving rating
├── escrow_id (uuid) ← Links to completed escrow
├── overall_rating (1-5)
├── communication_rating (1-5, optional)
├── quality_rating (1-5, optional)
├── professionalism_rating (1-5, optional)
├── timeliness_rating (1-5, optional)
├── comment (text)
├── private_feedback (text) ← Admin-only
├── is_public (boolean)
├── reviewer_role (client/freelancer)
└── created_at
```

### User Entity Updates
```
users (new fields)
├── profile_completeness (0-100%)
├── badges (string array)
├── skills (string array)
├── profile_picture_url
├── country
├── language
├── trust_score (decimal, auto-calculated)
├── total_ratings (int, auto-updated)
├── completed_contracts (int)
└── total_volume_usdc (decimal)
```

---

## 🔗 API Endpoints

### 1. GET `/api/v1/users/me` 🔒
**Own Profile - Full Access**
- Returns complete profile including email, wallet, private data
- Auto-calculates and updates profile_completeness
- Includes recent ratings summary

### 2. PATCH `/api/v1/users/me` 🔒
**Update Profile**
- Updates profile fields
- Automatically recalculates profile_completeness
- Updates badges based on new data
- Returns updated completeness score for frontend feedback

### 3. GET `/api/v1/users/:user_id`
**Public Profile View**
- Anyone can view public profiles
- Hides email and private info
- Shows trust score, badges, completed contracts
- Includes rating breakdown

### 4. GET `/api/v1/users/search`
**Advanced User Search** (Great for Client → Freelancer matching)
```typescript
Query Parameters:
{
  query: "web developer",
  role: "freelancer",
  min_trust_score: 4.5,
  skills: ["React", "Node.js"],
  country: "United States",
  page: 1,
  limit: 20,
  sort: "-trust_score" // - prefix for DESC
}
```

### 5. GET `/api/v1/users/:user_id/ratings`
**User Ratings & Reviews**
- Paginated list of ratings
- Includes reviewer info (name, role, profile pic)
- Rating breakdown by category
- Distribution histogram (5★: 80%, 4★: 15%, etc.)

### 6. POST `/api/v1/users/ratings` 🔒
**Submit Rating** (Post-Escrow)
```typescript
{
  escrow_id: "esc_abc123",
  rated_user_id: "usr_xyz789",
  overall_rating: 5,
  communication_rating: 5,
  quality_rating: 5,
  professionalism_rating: 5,
  timeliness_rating: 5,
  comment: "Excellent work!",
  private_feedback: "Could improve X" // Admin-only
}
```
**Business Rules:**
- ✅ Only after escrow completion
- ✅ One rating per escrow per user
- ✅ Automatically updates trust score
- ✅ Triggers badge recalculation

---

## 🧠 Smart Interlinking Examples

### Example 1: Trust Score Auto-Update Flow
```
User completes escrow → Client rates freelancer (5★)
    ↓
Rating.create()
    ↓
updateUserTrustScore() triggered
    ↓
Fetches all ratings → Calculates weighted average → Updates User.trust_score
    ↓
calculateBadges() → User gets "top_rated" badge if score ≥ 4.8
    ↓
Frontend shows updated badge instantly
```

### Example 2: Profile Completeness Flow
```
User updates profile → Adds bio, skills, profile picture
    ↓
UpdateProfile endpoint
    ↓
calculateProfileCompleteness() runs
    ↓
Score jumps from 35% → 75%
    ↓
calculateBadges() → Checks if wallet_connected
    ↓
Returns updated completeness to frontend
    ↓
UI shows progress bar: "75% - Add wallet to reach 100%!"
```

### Example 3: Search with Trust Filter
```
Client searches: "React developer, trust ≥ 4.5"
    ↓
Query filters:
  - role = 'freelancer'
  - 'React' IN skills
  - trust_score >= 4.5
  - status = 'active'
    ↓
Results sorted by trust_score DESC
    ↓
Each result includes: badges, completed_contracts, total_volume_usdc
    ↓
Client can see verified, experienced developers instantly
```

---

## 🔐 Security & Validation

### Rating Submission Guards
- ✅ JWT authentication required
- ✅ Verify reviewer is part of the escrow
- ✅ Verify escrow status is 'completed' (TODO: implement when Escrow entity ready)
- ✅ Prevent duplicate ratings (one per escrow)
- ✅ Validate rating range (1-5)

### Profile Privacy
- ✅ Email only visible to self
- ✅ Private feedback only visible to admins
- ✅ Wallet addresses public (for blockchain trust)
- ✅ Soft-delete support (deleted_at column)

### Rate Limiting (via ThrottlerGuard)
- ✅ Global rate limit: 10 req/min
- ✅ Prevents rating spam
- ✅ Protects search endpoint from abuse

---

## 🚀 Performance Optimizations

### Database Indexes
```sql
CREATE INDEX idx_ratings_user_created ON ratings(rated_user_id, created_at);
CREATE INDEX idx_ratings_escrow ON ratings(escrow_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_trust_score ON users(trust_score);
```

### Caching Strategy (Future Enhancement)
```typescript
// Cache user profiles for 5 minutes
@Cacheable('user_profile', { ttl: 300 })
async getUserProfile(userId: string) { ... }

// Cache search results for 1 minute
@Cacheable('user_search', { ttl: 60 })
async searchUsers(searchDto: SearchUsersDto) { ... }
```

### Pagination Best Practices
- Default limit: 20 (configurable)
- Max limit: 100 (prevents abuse)
- Returns total_pages for frontend pagination UI

---

## 🧪 Testing Strategy

### Unit Tests (TODO)
```typescript
describe('UserProfileService', () => {
  it('should calculate profile completeness correctly')
  it('should award badges based on criteria')
  it('should prevent duplicate ratings')
  it('should update trust score with weighted algorithm')
  it('should filter search results correctly')
});
```

### Integration Tests (TODO)
```typescript
describe('POST /api/v1/users/ratings', () => {
  it('should submit rating and update trust score')
  it('should reject rating if already rated')
  it('should reject rating if escrow not completed')
});
```

---

## 🔮 Future Enhancements

### Phase 2
1. **Rating Disputes**: Allow users to contest unfair ratings
2. **Verification Levels**: KYC tiers (basic → advanced → enterprise)
3. **Portfolio System**: Link GitHub, Behance, etc.
4. **Skill Endorsements**: Other users can endorse skills
5. **Activity Feed**: Timeline of recent escrows, ratings, achievements

### Phase 3
1. **ML-Powered Matching**: Recommend freelancers based on client history
2. **Fraud Detection**: Flag suspicious rating patterns
3. **Reputation NFTs**: Mint trust scores as on-chain NFTs
4. **Multi-Language Profiles**: i18n support

---

## 📝 Implementation Checklist

✅ Rating entity with escrow linkage
✅ Profile completeness calculation (weighted)
✅ Badge system (6 badges)
✅ Trust score auto-update (weighted by recency)
✅ Advanced search with filters
✅ Privacy-layered responses
✅ Rating submission with validation
✅ Profile update with auto-recalculation
✅ Module integration (UserProfileModule)
⏳ Escrow completion verification (pending Escrow module)
⏳ Unit tests
⏳ Integration tests
⏳ API documentation (Swagger/OpenAPI)

---

## 🎓 Key Takeaways

This isn't just a "CRUD profile system" - it's a **reputation engine** that:
- Incentivizes quality work (ratings → trust score → more jobs)
- Gamifies profile completion (progress bars, badges)
- Enables smart matching (search by trust, skills, location)
- Builds trust through transparency (public ratings, verified badges)
- Scales efficiently (indexed queries, pagination, caching-ready)

The profile system is **tightly integrated** with escrows and ratings, creating a feedback loop that drives platform quality. This is the foundation for a trusted marketplace.
