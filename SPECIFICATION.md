# Nicholson Dorm Ping-Pong ELO Ranking System
## Comprehensive System Specification & Implementation Plan

---

### Executive Overview
The **Nicholson Dorm Ping-Pong ELO Ranking System** ("Nicholson Pong") is a dedicated, web-based competitive ladder designed for college dorm residents. It solves the classic issues of casual dorm gaming: informal arguments over who is the best, forgotten game records, and fraudulent or erroneous score claims. 

The core trust model relies on a **Two-Phase Mutual Confirmation Protocol**: Match submissions by a winner or loser remain pending and have zero rating impact until the listed opponent explicitly confirms the result.

---

## 1. System Architecture & Recommended Tech Stack

### 1.1 Architecture Overview
A modern, lightweight, full-stack architecture is selected to ensure:
1. **Zero/Low Cost**: Runs comfortably within generous free tiers (Vercel + Supabase/Neon).
2. **Mobile-First UX**: Dorm players log matches at the table using mobile smartphones.
3. **Transactional Safety**: Strict ACID compliance prevents ELO calculation race conditions.
4. **Real-Time Responsiveness**: Instant notifications when match confirmations are requested.

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Mobile & Desktop Web)"]
        UI["Next.js 14+ React Client (Tailwind + shadcn/ui)"]
        PWA["Mobile Responsive / PWA Viewport"]
    end

    subgraph Edge ["Application Server Layer"]
        API["Next.js App Router (Server Actions & Route Handlers)"]
        AUTH["Auth.js / NextAuth (Session & JWT Validation)"]
        ENGINE["ELO Rating Engine (Provisional K-Factor Calibrator)"]
    end

    subgraph Data ["Persistence & Services Layer"]
        DB[(PostgreSQL on Supabase / Neon)]
        PRISMA["Prisma ORM / Connection Pooler (PgBouncer)"]
        NOTIF["Notification Gateway (Email / Webhook / In-App)"]
    end

    UI -->|HTTPS / REST & Server Actions| API
    PWA -->|HTTPS / REST & Server Actions| API
    API --> AUTH
    API --> ENGINE
    API --> PRISMA
    PRISMA --> DB
    API -.-> NOTIF
```

### 1.2 Recommended Tech Stack
| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 14+ (App Router, React, TypeScript)** | Unified full-stack TypeScript codebase, server-rendered leaderboard for instant SEO/caching, fast client interactions. |
| **Styling & UI Kit** | **Tailwind CSS + shadcn/ui + Lucide Icons** | Accessible, sleek, dark-mode ready, mobile-optimized component library without heavy runtime overhead. |
| **Charts / Viz** | **Recharts** | Lightweight, responsive SVG-based charts for player rating history graphs. |
| **Backend & APIs** | **Next.js Route Handlers & Server Actions** | Type-safe RPC-style calls from client to server; eliminates API boilerplate while keeping standard REST routes accessible. |
| **Database** | **PostgreSQL (via Supabase or Neon)** | Relational integrity with row-level locks (`SELECT FOR UPDATE`), ACID transactions for balance calculations, foreign keys. |
| **ORM & Migrations** | **Prisma ORM** | Declarative schema, automatic TypeScript type generation, reliable migration runner. |
| **Authentication** | **NextAuth.js (Auth.js v5) or Supabase Auth** | Supports credentials (email/password with dorm domain check) or student Google OAuth (`@school.edu`). |
| **Hosting & Deploy** | **Vercel + Supabase Cloud** | $0/month free tier, automatic CI/CD on git push, global edge distribution, automated DB backups. |

---

## 2. Full Database Schema

The database model guarantees relational integrity, an immutable audit trail for rating changes, and dispute tracking.

```mermaid
erDiagram
    User ||--o{ Rating : has
    User ||--o{ Match : "submitted_as_p1"
    User ||--o{ Match : "received_as_p2"
    User ||--o{ RatingHistory : "records"
    User ||--o{ Dispute : "reported_by"
    User ||--o{ AuditLog : "performed_by"
    Match ||--o{ RatingHistory : "generates"
    Match ||--o| Dispute : "has"

    User {
        uuid id PK
        string email UK
        string password_hash
        string display_name
        string room_number
        string avatar_url
        enum role "PLAYER, ADMIN"
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    Rating {
        uuid id PK
        uuid user_id FK, UK
        float current_elo
        float peak_elo
        int matches_played
        int wins
        int losses
        int current_streak
        datetime last_match_at
        datetime updated_at
    }

    Match {
        uuid id PK
        uuid submitter_id FK
        uuid opponent_id FK
        int submitter_score
        int opponent_score
        enum status "PENDING, CONFIRMED, REJECTED, EXPIRED, DISPUTED"
        string notes
        float submitter_elo_before
        float submitter_elo_after
        float opponent_elo_before
        float opponent_elo_after
        datetime confirmed_at
        datetime expires_at
        datetime created_at
    }

    RatingHistory {
        uuid id PK
        uuid user_id FK
        uuid match_id FK
        float elo_before
        float elo_after
        float delta
        datetime created_at
    }

    Dispute {
        uuid id PK
        uuid match_id FK, UK
        uuid reporter_id FK
        string reason
        enum status "OPEN, RESOLVED, DISMISSED"
        string admin_notes
        uuid resolved_by FK
        datetime resolved_at
        datetime created_at
    }

    AuditLog {
        uuid id PK
        uuid actor_id FK
        string action
        jsonb metadata
        datetime created_at
    }
```

### 2.1 Complete Prisma Schema (`schema.prisma`)
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  PLAYER
  ADMIN
}

enum MatchStatus {
  PENDING
  CONFIRMED
  REJECTED
  EXPIRED
  DISPUTED
}

enum DisputeStatus {
  OPEN
  RESOLVED
  DISMISSED
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  displayName   String    @unique
  roomNumber    String?
  avatarUrl     String?
  role          Role      @default(PLAYER)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  rating        Rating?
  matchesAsP1   Match[]   @relation("Player1Matches")
  matchesAsP2   Match[]   @relation("Player2Matches")
  ratingHistory RatingHistory[]
  disputesFiled Dispute[] @relation("ReporterDisputes")
  disputesHandled Dispute[] @relation("AdminDisputes")
  auditLogs     AuditLog[]

  @@index([email])
  @@index([displayName])
}

model Rating {
  id            String    @id @default(uuid())
  userId        String    @unique
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentElo    Float     @default(1200.0)
  peakElo       Float     @default(1200.0)
  matchesPlayed Int       @default(0)
  wins          Int       @default(0)
  losses        Int       @default(0)
  currentStreak Int       @default(0) // Positive for win streak, negative for loss streak
  lastMatchAt   DateTime?
  updatedAt     DateTime  @updatedAt

  @@index([currentElo(sort: Desc)])
}

model Match {
  id              String       @id @default(uuid())
  submitterId     String
  submitter       User         @relation("Player1Matches", fields: [submitterId], references: [id])
  opponentId      String
  opponent        User         @relation("Player2Matches", fields: [opponentId], references: [id])
  
  submitterScore  Int
  opponentScore   Int
  status          MatchStatus  @default(PENDING)
  notes           String?      @db.VarChar(255)

  // Snapshots populated ONLY upon CONFIRMED status
  submitterEloBefore Float?
  submitterEloAfter  Float?
  opponentEloBefore  Float?
  opponentEloAfter   Float?

  expiresAt       DateTime     // Default: now() + 48 hours
  confirmedAt     DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  ratingHistories RatingHistory[]
  dispute         Dispute?

  @@index([submitterId, status])
  @@index([opponentId, status])
  @@index([createdAt(sort: Desc)])
}

model RatingHistory {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  matchId   String
  match     Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  eloBefore Float
  eloAfter  Float
  delta     Float
  createdAt DateTime @default(now())

  @@index([userId, createdAt(sort: Desc)])
}

model Dispute {
  id          String        @id @default(uuid())
  matchId     String        @unique
  match       Match         @relation(fields: [matchId], references: [id], onDelete: Cascade)
  reporterId  String
  reporter    User          @relation("ReporterDisputes", fields: [reporterId], references: [id])
  reason      String        @db.Text
  status      DisputeStatus @default(OPEN)
  adminNotes  String?       @db.Text
  resolvedById String?
  resolvedBy  User?         @relation("AdminDisputes", fields: [resolvedById], references: [id])
  resolvedAt  DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([status])
}

model AuditLog {
  id        String   @id @default(uuid())
  actorId   String
  actor     User     @relation(fields: [actorId], references: [id])
  action    String
  metadata  Json
  createdAt DateTime @default(now())

  @@index([actorId, createdAt(sort: Desc)])
}
```

---

## 3. ELO Rating System Formulation & Dynamics

### 3.1 Mathematical Formulation
The system implements the standard logistic distribution ELO model, with parameters calibrated specifically for casual table tennis.

#### 1. Expected Score Calculation
For Player A ($R_A$) and Player B ($R_B$):
$$E_A = \frac{1}{1 + 10^{(R_B - R_A) / 400}}$$
$$E_B = \frac{1}{1 + 10^{(R_A - R_B) / 400}} = 1 - E_A$$

Where:
- $E_A$: Probability of Player A winning (between 0.0 and 1.0).
- Scale factor $400$: A 400-point difference reflects a $10:1$ odds of winning ($\approx 91\%$ win probability).

#### 2. Rating Update Rule
$$R'_A = R_A + K_A \times (S_A - E_A)$$
$$R'_B = R_B + K_B \times (S_B - E_B)$$

Where:
- $S_A = 1$ if Player A wins, $0$ if Player A loses (table tennis does not have draws).
- $K$: The K-factor (sensitivity weight determining maximum points transferred).

---

### 3.2 K-Factor Recommendation for Nicholson Dorm
In competitive chess, $K=16$ or $K=32$ is standard because players play infrequent, long games. However, in **Nicholson Dorm**:
- Casual players play 3–10 rapid matches in a single evening.
- Novice players experience rapid skill acceleration within their first few weeks.
- High volatility during onboarding is necessary so a dorm "table tennis champion" doesn't have to grind 50 games to reach their true 1800+ rating.

#### Recommended Dynamic Tiered K-Factor:
| Match Experience / Rating Bracket | K-Factor | Purpose & Behavior |
| :--- | :---: | :--- |
| **Provisional Phase** ($< 10$ matches played) | **$K = 48$** | **Rapid Convergence**: Allows new players to quickly climb or drop toward their true skill bracket within 5–8 games. |
| **Developing Regular** ($10+$ matches, ELO $< 1600$) | **$K = 32$** | **Balanced Responsiveness**: Responsive to hot streaks while preventing wild 100-point single-night drops. |
| **Veteran / High Skill** ($10+$ matches, ELO $\ge 1600$) | **$K = 24$** | **Rating Stability**: Protects high-tier players from excessive rating swings and stabilizes top rankings. |
| **Nicholson Master** (ELO $\ge 2000$) | **$K = 16$** | **Elite Defense**: Requires consistent performance to maintain peak rank. |

> [!NOTE]
> **Asymmetric K-Factor Handling**: When a provisional player ($K=48$) plays an established player ($K=24$), each player's rating adjustment is computed using their own respective $K$. The exchange is zero-sum in skill probability expectation, but asymmetric in scaling: the newcomer gains/loses based on $K=48$, while the veteran gains/loses based on $K=24$.

---

### 3.3 Handling Upsets, Score Margins, & Rating Volatility

#### 1. Upset Amplification
- If a 1100-rated underdog beats an 1700-rated player:
  $$E_{underdog} \approx 0.03$$
  The underdog gains $32 \times (1 - 0.03) \approx +31.0$ points, while the favorite loses $-23.3$ points (if $K=24$). Upsets are organically rewarded to the mathematical maximum without requiring manual override formulas.

#### 2. Margin of Victory (Score Differential)
Dorm ping-pong games can end in a blowout ($21\text{--}3$ or $11\text{--}2$) or a nail-biter ($22\text{--}20$ or $12\text{--}10$). 
While an optional MOV multiplier can be added:
$$\text{Multiplier} = \ln(|\text{Score}_A - \text{Score}_B| + 1) \times \frac{2.2}{(R_{\text{winner}} - R_{\text{loser}}) \times 0.001 + 2.2}$$
**Recommendation for Nicholson Dorm: Do NOT use Margin of Victory in initial release.**
*Reasoning*:
- Score-margin multipliers encourage unsportsmanlike behavior (running up the score on beginner dorm-mates rather than letting them practice).
- It increases score dispute frequency (arguing over whether the score was 21–18 vs 21–17). Pure win/loss preserves camaraderie and simplicity.

#### 3. Rating Floor
- Strict rating floor of **$100.0$** to prevent negative ELO ratings or demoralizing sub-zero scores.

---

### 3.4 Production ELO Calculation Engine (`lib/elo.ts`)

```typescript
export interface EloCalculationInput {
  playerAId: string;
  playerARating: number;
  playerAMatchesCount: number;
  playerAScore: number;

  playerBId: string;
  playerBRating: number;
  playerBMatchesCount: number;
  playerBScore: number;
}

export interface EloCalculationResult {
  playerANewRating: number;
  playerADelta: number;
  playerBNewRating: number;
  playerBDelta: number;
  playerAExpected: number;
  playerBExpected: number;
}

/**
 * Returns the appropriate K-factor based on player experience and current rating.
 */
export function getKFactor(matchesPlayed: number, currentRating: number): number {
  if (matchesPlayed < 10) return 48; // Provisional tier
  if (currentRating < 1600) return 32; // Developing tier
  if (currentRating < 2000) return 24; // Veteran tier
  return 16; // Master tier
}

/**
 * Calculates win expectation probability using standard logistic curve.
 */
export function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Computes post-match ELO ratings with asymmetrical K-factors and rating floors.
 */
export function calculateElo(input: EloCalculationInput): EloCalculationResult {
  const {
    playerARating,
    playerAMatchesCount,
    playerAScore,
    playerBRating,
    playerBMatchesCount,
    playerBScore,
  } = input;

  if (playerAScore === playerBScore) {
    throw new Error("Table tennis matches cannot end in a draw.");
  }

  const isPlayerAWinner = playerAScore > playerBScore;
  const actualScoreA = isPlayerAWinner ? 1.0 : 0.0;
  const actualScoreB = isPlayerAWinner ? 0.0 : 1.0;

  const expectedA = getExpectedScore(playerARating, playerBRating);
  const expectedB = 1.0 - expectedA;

  const kA = getKFactor(playerAMatchesCount, playerARating);
  const kB = getKFactor(playerBMatchesCount, playerBRating);

  // Raw deltas
  const deltaA = Math.round(kA * (actualScoreA - expectedA) * 10) / 10;
  const deltaB = Math.round(kB * (actualScoreB - expectedB) * 10) / 10;

  // Enforce rating floor of 100.0
  const newRatingA = Math.max(100.0, Math.round((playerARating + deltaA) * 10) / 10);
  const newRatingB = Math.max(100.0, Math.round((playerBRating + deltaB) * 10) / 10);

  return {
    playerANewRating: newRatingA,
    playerADelta: Math.round((newRatingA - playerARating) * 10) / 10,
    playerBNewRating: newRatingB,
    playerBDelta: Math.round((newRatingB - playerBRating) * 10) / 10,
    playerAExpected: Math.round(expectedA * 1000) / 1000,
    playerBExpected: Math.round(expectedB * 1000) / 1000,
  };
}
```

---

## 4. Match Logging & Confirmation Workflow

The core invariant of the system is: **No player can unilaterally alter ELO ratings.**

```mermaid
sequenceDiagram
    autonumber
    actor A as Player A (Submitter)
    participant Web as Nicholson Web App
    participant DB as PostgreSQL DB
    actor B as Player B (Opponent)
    actor Admin as Dorm Admin

    A->>Web: Submits Match (Player B, 21-17, notes)
    Web->>DB: Validates inputs (Score validity, no pending collision)
    Web->>DB: Creates Match (Status = PENDING, Expires in 48h)
    Web-->>A: Match Submitted! Awaiting Player B confirmation.
    Web->>B: Notification: "Player A submitted score: 21-17. Confirm?"

    alt Player B Accepts
        B->>Web: Clicks "Accept"
        Web->>DB: BEGIN TRANSACTION (LOCK Player Ratings)
        Web->>DB: Calculate ELO with current ratings
        Web->>DB: Update Ratings, write RatingHistory, set Match CONFIRMED
        Web->>DB: COMMIT TRANSACTION
        Web-->>B: Match Confirmed! New rating shown.
        Web-->>A: Notification: "Match accepted! New rating updated."
    else Player B Rejects
        B->>Web: Clicks "Reject" (Incorrect score / false game)
        Web->>DB: Update Match status = REJECTED
        Web-->>B: Match discarded. No rating changes.
        Web-->>A: Notification: "Player B rejected the submitted match."
    else Player B Disputes
        B->>Web: Clicks "Dispute" (Enters reason: e.g. "I didn't play this")
        Web->>DB: Update Match status = DISPUTED, Create Dispute Record
        Web->>Admin: Alert: New match dispute in Nicholson Dorm
        Admin->>Web: Investigates & Resolves / Cancels match
    else 48h Timeout (Auto-Expire)
        DB->>DB: Cron Job flags Match as EXPIRED
        Note over DB: No ELO change occurs
    end
```

### 4.1 State Machine Rules
1. **`PENDING`**:
   - Scores recorded, but `eloBefore` and `eloAfter` remain `null`.
   - Neither player's win/loss record or current rating changes.
   - Submitter cannot edit the score after submission (must cancel and re-log if mistaken).
2. **`CONFIRMED`**:
   - Opponent accepts. 
   - Ratings updated atomically inside a DB transaction using `SELECT FOR UPDATE` to avoid race conditions.
   - Permanent rating ledger rows inserted into `RatingHistory`.
3. **`REJECTED`**:
   - Opponent denies the match result. Match is flagged `REJECTED` and remains permanently inactive.
4. **`EXPIRED`**:
   - If opponent takes no action within 48 hours, match is auto-expired.
5. **`DISPUTED`**:
   - Opponent marks match as fraudulent (e.g. repeated false logging by another resident). Triggers admin review queue.

---

## 5. API Design & Endpoint Specifications

All endpoints use standard JSON payloads, HTTP status codes, and Bearer Token / Session Cookie authentication.

### 5.1 Authentication Endpoints
- `POST /api/auth/register` — Create resident player account.
- `POST /api/auth/login` — Authenticate and receive session cookie/JWT.
- `GET /api/auth/me` — Return current session user details and permissions.

### 5.2 Players & Leaderboard Endpoints
#### `GET /api/leaderboard`
- **Query Params**: `page=1`, `limit=20`, `search=`, `provisional=false`
- **Response `200 OK`**:
```json
{
  "totalPlayers": 42,
  "leaderboard": [
    {
      "rank": 1,
      "userId": "d3b07384-d113-494a-a111-92e1069df16a",
      "displayName": "Alex Chen",
      "roomNumber": "304B",
      "avatarUrl": "https://images.dorm.edu/avatars/alex.png",
      "currentElo": 1845.2,
      "peakElo": 1890.0,
      "matchesPlayed": 38,
      "wins": 31,
      "losses": 7,
      "winRate": 0.816,
      "currentStreak": 5,
      "isProvisional": false
    }
  ]
}
```

#### `GET /api/players/:id`
Returns player profile, win/loss stats, head-to-head records against opponents, and historical rating data points for graphs.

---

### 5.3 Match Management Endpoints

#### `POST /api/matches`
Log a new match result.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "opponentId": "7e3b1c20-a619-4560-b184-c89b3fec21b3",
  "submitterScore": 21,
  "opponentScore": 17,
  "notes": "Intense game, deuce back and forth!"
}
```
- **Validation Rules**:
  - `submitterId != opponentId` (Cannot play yourself).
  - Scores must be non-negative integers.
  - Scores must satisfy table tennis win conditions (e.g., winner must have at least 11 or 21 points, with a minimum margin of 2).
  - Rate limit: Cannot have more than 3 pending matches at any time.
- **Response `201 Created`**:
```json
{
  "matchId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "PENDING",
  "expiresAt": "2026-10-16T20:30:00Z",
  "message": "Match submitted. Confirmation request sent to opponent."
}
```

#### `GET /api/matches/pending`
Retrieve all matches requiring confirmation by the authenticated user.
- **Response `200 OK`**:
```json
{
  "incomingRequests": [
    {
      "matchId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "submitter": {
        "id": "c1a2e3...",
        "displayName": "Marcus Miller",
        "roomNumber": "102A"
      },
      "yourScore": 17,
      "theirScore": 21,
      "notes": "Intense game, deuce back and forth!",
      "submittedAt": "2026-10-14T19:15:00Z",
      "expiresAt": "2026-10-16T19:15:00Z"
    }
  ],
  "outgoingPending": []
}
```

#### `POST /api/matches/:id/confirm`
Opponent accepts the score. Triggers the transactional ELO recalculation.
- **Request Body**: `{}`
- **Response `200 OK`**:
```json
{
  "success": true,
  "matchId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "CONFIRMED",
  "newRatings": {
    "yourNewElo": 1422.4,
    "yourDelta": -11.2,
    "opponentNewElo": 1588.6,
    "opponentDelta": +11.2
  }
}
```

#### `POST /api/matches/:id/reject`
Opponent rejects the score.
- **Request Body**: `{ "reason": "Score was 21-19, not 21-17" }`
- **Response `200 OK`**:
```json
{
  "success": true,
  "matchId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "REJECTED"
}
```

#### `POST /api/matches/:id/dispute`
File an official dispute for dorm admin mediation.
- **Request Body**: `{ "reason": "I did not play this match. User is falsely boosting." }`
- **Response `200 OK`**:
```json
{
  "success": true,
  "disputeId": "a9012e84-...",
  "status": "DISPUTED"
}
```

---

### 5.4 Admin Endpoints (Restricted to `Role.ADMIN`)
- `GET /api/admin/disputes` — List all active match disputes.
- `POST /api/admin/disputes/:id/resolve` — Resolve dispute (void match or force confirm).
- `POST /api/admin/players/:id/reset-rating` — Reset player rating to default ($1200.0$) with reason logged in `AuditLog`.
- `DELETE /api/admin/players/:id` — Ban or deactivate a player account.

---

## 6. Backend Transactional Logic & Concurrency Control

A critical flaw in many naive ELO systems is the **Stale Rating Race Condition**:
If Player A plays two matches in an afternoon and both get accepted at the same time, computing new ratings from memory will read outdated baseline numbers and overwrite each other.

To prevent this, the match confirmation service runs within a **PostgreSQL row-level lock** (`SELECT FOR UPDATE`).

### 6.1 Transactional Match Confirmation (`services/matchService.ts`)
```typescript
import { PrismaClient } from "@prisma/client";
import { calculateElo } from "../lib/elo";

const prisma = new PrismaClient();

export async function confirmMatch(matchId: string, currentUserId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch match and verify caller is the listed opponent
    const match = await tx.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error("Match not found.");
    }

    if (match.status !== "PENDING") {
      throw new Error(`Match is not pending (Current status: ${match.status}).`);
    }

    if (match.opponentId !== currentUserId) {
      throw new Error("Unauthorized: Only the designated opponent can accept this match.");
    }

    if (new Date() > match.expiresAt) {
      await tx.match.update({
        where: { id: matchId },
        data: { status: "EXPIRED" },
      });
      throw new Error("This match confirmation has expired.");
    }

    // 2. Lock both player rating records in consistent order (prevent deadlocks)
    const [firstId, secondId] = [match.submitterId, match.opponentId].sort();

    // Raw query to acquire exclusive row locks
    await tx.$queryRaw`
      SELECT id FROM "Rating" 
      WHERE "userId" IN (${firstId}::uuid, ${secondId}::uuid)
      FOR UPDATE
    `;

    const submitterRating = await tx.rating.findUniqueOrThrow({
      where: { userId: match.submitterId },
    });
    const opponentRating = await tx.rating.findUniqueOrThrow({
      where: { userId: match.opponentId },
    });

    // 3. Compute ELO with up-to-date locked ratings
    const eloResult = calculateElo({
      playerAId: match.submitterId,
      playerARating: submitterRating.currentElo,
      playerAMatchesCount: submitterRating.matchesPlayed,
      playerAScore: match.submitterScore,

      playerBId: match.opponentId,
      playerBRating: opponentRating.currentElo,
      playerBMatchesCount: opponentRating.matchesPlayed,
      playerBScore: match.opponentScore,
    });

    const isSubmitterWinner = match.submitterScore > match.opponentScore;

    // 4. Update Submitter's Rating
    await tx.rating.update({
      where: { userId: match.submitterId },
      data: {
        currentElo: eloResult.playerANewRating,
        peakElo: Math.max(submitterRating.peakElo, eloResult.playerANewRating),
        matchesPlayed: { increment: 1 },
        wins: isSubmitterWinner ? { increment: 1 } : undefined,
        losses: !isSubmitterWinner ? { increment: 1 } : undefined,
        currentStreak: isSubmitterWinner
          ? submitterRating.currentStreak >= 0 ? submitterRating.currentStreak + 1 : 1
          : submitterRating.currentStreak <= 0 ? submitterRating.currentStreak - 1 : -1,
        lastMatchAt: new Date(),
      },
    });

    // 5. Update Opponent's Rating
    await tx.rating.update({
      where: { userId: match.opponentId },
      data: {
        currentElo: eloResult.playerBNewRating,
        peakElo: Math.max(opponentRating.peakElo, eloResult.playerBNewRating),
        matchesPlayed: { increment: 1 },
        wins: !isSubmitterWinner ? { increment: 1 } : undefined,
        losses: isSubmitterWinner ? { increment: 1 } : undefined,
        currentStreak: !isSubmitterWinner
          ? opponentRating.currentStreak >= 0 ? opponentRating.currentStreak + 1 : 1
          : opponentRating.currentStreak <= 0 ? opponentRating.currentStreak - 1 : -1,
        lastMatchAt: new Date(),
      },
    });

    // 6. Record Historical Rating Ledger
    await tx.ratingHistory.createMany({
      data: [
        {
          userId: match.submitterId,
          matchId: match.id,
          eloBefore: submitterRating.currentElo,
          eloAfter: eloResult.playerANewRating,
          delta: eloResult.playerADelta,
        },
        {
          userId: match.opponentId,
          matchId: match.id,
          eloBefore: opponentRating.currentElo,
          eloAfter: eloResult.playerBNewRating,
          delta: eloResult.playerBDelta,
        },
      ],
    });

    // 7. Transition Match to CONFIRMED with snapshots
    const updatedMatch = await tx.match.update({
      where: { id: match.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        submitterEloBefore: submitterRating.currentElo,
        submitterEloAfter: eloResult.playerANewRating,
        opponentEloBefore: opponentRating.currentElo,
        opponentEloAfter: eloResult.playerBNewRating,
      },
    });

    return {
      match: updatedMatch,
      eloResult,
    };
  });
}
```

---

## 7. Security & Anti-Fraud Architecture

| Attack Vector / Risk | Threat Scenario | Mitigation Strategy |
| :--- | :--- | :--- |
| **Ghost Matches / Collusion** | Two roommates repeatedly submit matches to artificially inflate one player's ELO. | **Daily Mutual Cap**: Maximum 5 rated matches between the same two users within a 24-hour window. Subsequent matches are recorded as "Friendly / Unrated". |
| **Impersonation & Forgery** | Submitter submits on behalf of other players without their consent. | **Strict Session Binding**: `submitterId` is extracted solely from the cryptographically verified JWT/Session cookie; client cannot pass an arbitrary submitter ID. |
| **Pending Denial of Service** | A spammer submits 100 fake matches to flood an opponent's inbox. | **In-Flight Queue Limit**: A player can have at most **3 concurrent pending matches**. New submissions are rejected until existing ones are confirmed or rejected. |
| **Self-Play Vulnerability** | Player submits a match playing against themselves. | Enforced database check constraint: `CHECK (submitter_id <> opponent_id)`. |
| **Impossible Scores** | User submits `9999 - 0` or negative numbers. | Server-side validation enforcing ping-pong standard scores (e.g. 11 or 21 base win, margin of $\ge 2$, maximum score cap $\le 50$). |
| **Stale ELO Race Conditions** | Two matches confirmed within milliseconds desynchronize ratings. | Explicit row-level locking (`SELECT ... FOR UPDATE`) ordered by UUID to prevent deadlocks. |

---

## 8. Frontend UI / UX Flow & Wireframes

### 8.1 Core Screen Map
1. **Dorm Leaderboard (`/`)**:
   - Ranked list showing Rank, Player Name, Room #, ELO Badge, Streak, Win/Loss Record.
   - Live badge counter for pending match confirmations on top navbar.
   - Search bar with instant filter by player name or room number.
2. **Log Match Modal / Floating Action Button (`/matches/new`)**:
   - 2-step fast submission designed for smartphones right at the ping-pong table.
   - Step 1: Opponent search (shows recent opponents at top).
   - Step 2: Score input with quick-increment buttons (+1, +5, 11, 21) and optional banter note.
3. **Pending Confirmations Hub (`/matches/pending`)**:
   - Split view: "Awaiting Your Confirmation" (Actionable Cards with green **Accept** and red **Reject** buttons) vs. "Sent Requests" (Status badges).
4. **Player Profile & Rating Graph (`/players/:id`)**:
   - Interactive line chart (Recharts) showing ELO progression over time.
   - Head-to-Head win rate vs specific dorm opponents.
   - Recent match history list with colored delta pills (`+14.2`, `-12.0`).
5. **Admin Dispute Console (`/admin/disputes`)**:
   - Review reported false matches, inspect logs, void matches, or re-adjust ratings.

### 8.2 Component Prototype: Pending Match Card (React + Tailwind)
```tsx
import React, { useState } from "react";
import { Check, X, AlertTriangle } from "lucide-react";

interface PendingMatchCardProps {
  matchId: string;
  submitterName: string;
  submitterRoom: string;
  submitterScore: number;
  yourScore: number;
  notes?: string;
  onConfirm: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDispute: (id: string) => void;
}

export const PendingMatchCard: React.FC<PendingMatchCardProps> = ({
  matchId,
  submitterName,
  submitterRoom,
  submitterScore,
  yourScore,
  notes,
  onConfirm,
  onReject,
  onDispute,
}) => {
  const [loading, setLoading] = useState(false);
  const isWin = yourScore > submitterScore;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg max-w-md w-full">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
            Confirmation Required
          </span>
          <h3 className="text-lg font-bold text-white mt-1">
            Match vs {submitterName}
          </h3>
          <p className="text-xs text-slate-400">Room {submitterRoom}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-white">
            {submitterScore} - {yourScore}
          </div>
          <span className={`text-xs font-bold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
            {isWin ? "Recorded as Your Win" : "Recorded as Your Loss"}
          </span>
        </div>
      </div>

      {notes && (
        <div className="bg-slate-950/60 rounded-md p-2.5 text-xs text-slate-300 italic mb-4 border border-slate-800">
          "{notes}"
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-800">
        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await onConfirm(matchId);
            setLoading(false);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          <Check className="w-4 h-4" /> Accept Score
        </button>

        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            await onReject(matchId);
            setLoading(false);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 font-medium py-2 rounded-lg text-sm transition-colors border border-slate-700"
        >
          <X className="w-4 h-4" /> Reject
        </button>

        <button
          disabled={loading}
          onClick={() => onDispute(matchId)}
          title="Report false or malicious match"
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
```

---

## 9. Deployment & DevOps Plan

### 9.1 Hosting Architecture (100% Free / Ultra Low-Cost)
- **Frontend & Serverless Backend**: **Vercel** (Hobby plan: unlimited deployments, free SSL, edge caching).
- **Database**: **Supabase** (Free Tier: 500MB PostgreSQL, connection pooling with PgBouncer, automated SSL, built-in backups).
- **Background Cron**: **Vercel Cron Jobs** (Running once every 4 hours to sweep expired matches).

### 9.2 Environment Configuration (`.env.production`)
```env
# Database (Supabase / Neon Pooled Connection)
DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# NextAuth / Auth.js
NEXTAUTH_URL="https://nicholson-pong.vercel.app"
NEXTAUTH_SECRET="super-secure-random-32-byte-hex-string"

# App Settings
NEXT_PUBLIC_APP_NAME="Nicholson Dorm Pong"
MATCH_EXPIRATION_HOURS=48
MAX_DAILY_MUTUAL_MATCHES=5
```

### 9.3 Step-by-Step Deployment Instructions

#### Step 1: Database Setup on Supabase
1. Create a free project at [supabase.com](https://supabase.com) named `nicholson-pong`.
2. Navigate to **Project Settings -> Database** and copy the Connection String URI.

#### Step 2: Initialize Codebase & Run Migrations
```bash
# Clone or create project
npx create-next-app@latest nicholson-pong --typescript --tailwind --eslint --app
cd nicholson-pong

# Install dependencies
npm install @prisma/client lucide-react recharts clsx tailwind-merge
npm install -D prisma

# Initialize and apply schema
npx prisma init
# (Paste the schema.prisma from Section 2 into prisma/schema.prisma)
npx prisma migrate dev --name init_nicholson_schema
```

#### Step 3: Deploy to Vercel
1. Push your repository to GitHub (`git push origin main`).
2. Log into [vercel.com](https://vercel.com) and import the repository.
3. In **Environment Variables**, add `DATABASE_URL`, `DIRECT_URL`, and `NEXTAUTH_SECRET`.
4. Click **Deploy**. Vercel will build the Next.js app and issue an automated SSL certificate.

---

## 10. Summary Checklist for Implementation Phases

| Phase | Milestone | Deliverables |
| :---: | :--- | :--- |
| **Phase 1** | **Foundation & Auth** | Next.js setup, Prisma schema migration, user registration with dorm room number, session authentication. |
| **Phase 2** | **ELO Engine & Match Logging** | Core ELO mathematical functions with unit tests, match submission form, pending confirmation inbox. |
| **Phase 3** | **Transactional Settlement** | PostgreSQL row-locking confirmation service, rating history ledger, rejection and auto-expiration cron. |
| **Phase 4** | **Leaderboard & Player Profiles** | Live sorted dormitory leaderboard, player profile with Recharts rating graphs, head-to-head records. |
| **Phase 5** | **Security & Dispute Moderation** | Anti-collusion daily limits, admin dispute resolution panel, audit logging, production deployment to Vercel. |
