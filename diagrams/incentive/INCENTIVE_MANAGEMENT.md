# Incentive Management - Comprehensive Diagrams

This document provides comprehensive Mermaid diagrams for the Incentive Management implementation in Demos blockchain, covering point systems and referral mechanics.

## Table of Contents
1. [Incentive Architecture Overview](#1-incentive-architecture-overview)
2. [Point System Class Structure](#2-point-system-class-structure)
3. [User Points Data Model](#3-user-points-data-model)
4. [Award Points Flow](#4-award-points-flow)
5. [Deduct Points Flow](#5-deduct-points-flow)
6. [Referral Code Generation](#6-referral-code-generation)
7. [Referral Processing Flow](#7-referral-processing-flow)
8. [Eligibility & Validation Rules](#8-eligibility--validation-rules)
9. [GCR Integration & Identity Management](#9-gcr-integration--identity-management)
10. [Complete Incentive Lifecycle](#10-complete-incentive-lifecycle)

---

## 1. Incentive Architecture Overview

```mermaid
graph TB
    subgraph "Incentive Management System"
        PS[PointSystem Singleton]
        REF[Referrals Static Class]
        PV[Point Values Config]
    end

    subgraph "Point Values"
        WEB3[LINK_WEB3_WALLET: 0.5]
        TWITTER[LINK_TWITTER: 2]
        GITHUB[LINK_GITHUB: 1]
        TELEGRAM[LINK_TELEGRAM: 1]
        DISCORD[LINK_DISCORD: 1]
        FOLLOW[FOLLOW_DEMOS: 1]
    end

    subgraph "Referral System"
        REFBONUS[REFERRER_BONUS: 2 pts]
        USERBONUS[REFERRED_USER_BONUS: 1 pt]
        CODEGEN[Referral Code Generator]
    end

    subgraph "GCR Integration"
        GCRMain[(GCRMain Entity)]
        Points[points.totalPoints]
        Breakdown[points.breakdown]
        ReferralInfo[referralInfo]
        Identities[identities.xm & web2]
    end

    subgraph "Identity Management"
        IM[IdentityManager]
        XMID[XM Chain Identities]
        WEB2ID[Web2 Identities]
    end

    subgraph "External Services"
        TwitterAPI[Twitter API]
        TelegramAttest[Telegram Attestation]
        GithubAPI[Github API]
        DiscordAPI[Discord API]
    end

    PS --> PV
    PS --> GCRMain
    PS --> IM
    REF --> GCRMain
    REF --> CODEGEN

    PV --> WEB3
    PV --> TWITTER
    PV --> GITHUB
    PV --> TELEGRAM
    PV --> DISCORD
    PV --> FOLLOW

    GCRMain --> Points
    GCRMain --> Breakdown
    GCRMain --> ReferralInfo
    GCRMain --> Identities

    IM --> XMID
    IM --> WEB2ID

    Breakdown --> |web3Wallets| XMID
    Breakdown --> |socialAccounts| WEB2ID
    Breakdown --> |referrals| ReferralInfo
    Breakdown --> |demosFollow| TwitterAPI

    PS --> TwitterAPI
    PS --> TelegramAttest
    PS --> GithubAPI
    PS --> DiscordAPI

    style PS fill:#e1f5ff
    style REF fill:#fff4e1
    style GCRMain fill:#e8f5e9
    style IM fill:#f3e5f5
```

---

## 2. Point System Class Structure

```mermaid
classDiagram
    class PointSystem {
        -static instance: PointSystem
        -constructor()
        +static getInstance() PointSystem
        -getUserIdentitiesFromGCR(userId: string) Promise~Identities~
        -getUserPointsInternal(userId: string) Promise~UserPoints~
        -addPointsToGCR(userId, points, type, platform) Promise~void~
        +getUserPoints(userId: string) Promise~RPCResponse~
        +awardWeb3WalletPoints(userId, walletAddress, chain, referralCode?) Promise~RPCResponse~
        +awardTwitterPoints(userId, twitterUserId, referralCode?) Promise~RPCResponse~
        +awardGithubPoints(userId, githubUserId, referralCode?) Promise~RPCResponse~
        +awardTelegramPoints(userId, telegramUserId, referralCode?, attestation?) Promise~RPCResponse~
        +awardDiscordPoints(userId, referralCode?) Promise~RPCResponse~
        +deductWeb3WalletPoints(userId, walletAddress, chain) Promise~RPCResponse~
        +deductTwitterPoints(userId) Promise~RPCResponse~
        +deductGithubPoints(userId, githubUserId) Promise~RPCResponse~
        +deductTelegramPoints(userId) Promise~RPCResponse~
        +deductDiscordPoints(userId) Promise~RPCResponse~
    }

    class Referrals {
        +static readonly REFERRER_BONUS: 2
        +static readonly REFERRED_USER_BONUS: 1
        -static calculateBytesForLength(targetLength: number) number
        -static generateChecksum(publicKey: string) string
        +static generateReferralCode(publicKey, options?) string
        +static findAccountByReferralCode(referralCode) Promise~GCRMain~
        +static isAlreadyReferred(referrerAccount, newUserPubkey) boolean
        +static isEligibleForReferral(account) boolean
        +static processReferral(newAccount, referralCode, repository) Promise~void~
        -static awardReferralPoints(referrerAccount, newUserAccount, repository) Promise~void~
    }

    class UserPoints {
        +string userId
        +string referralCode
        +number totalPoints
        +Breakdown breakdown
        +string[] linkedWallets
        +LinkedSocials linkedSocials
        +Date lastUpdated
        +any flagged
        +string flaggedReason
    }

    class Breakdown {
        +object web3Wallets
        +SocialAccounts socialAccounts
        +number referrals
        +number demosFollow
    }

    class SocialAccounts {
        +number twitter
        +number github
        +number telegram
        +number discord
    }

    class LinkedSocials {
        +string twitter
        +string discord
    }

    class IdentityManager {
        +static getIdentities(userId) Promise~XMIdentities~
        +static getWeb2Identities(userId, platform) Promise~Web2Identity[]~
    }

    PointSystem --> Referrals : uses
    PointSystem --> UserPoints : returns
    PointSystem --> IdentityManager : queries
    UserPoints --> Breakdown : contains
    Breakdown --> SocialAccounts : contains

    note for PointSystem "Singleton pattern\nManages all point operations"
    note for Referrals "Static utility class\nHandles referral mechanics"
    note for UserPoints "Complete user profile\nwith points and identities"
```

---

## 3. User Points Data Model

```mermaid
erDiagram
    GCRMain {
        TEXT pubkey PK
        JSONB points
        JSONB referralInfo
        JSONB identities
        BOOLEAN flagged
        TEXT flaggedReason
    }

    Points {
        NUMBER totalPoints
        JSONB breakdown
        TIMESTAMP lastUpdated
    }

    Breakdown {
        JSONB web3Wallets
        JSONB socialAccounts
        NUMBER referrals
        NUMBER demosFollow
    }

    Web3Wallets {
        NUMBER eth
        NUMBER bsc
        NUMBER polygon
        NUMBER solana
        NUMBER aptos
        TEXT additional_chains
    }

    SocialAccounts {
        NUMBER twitter
        NUMBER github
        NUMBER telegram
        NUMBER discord
    }

    ReferralInfo {
        NUMBER totalReferrals
        TEXT referralCode
        JSONB referrals
        TEXT referredBy
    }

    Referral {
        TEXT referredUserId
        TEXT referredAt
        NUMBER pointsAwarded
    }

    Identities {
        JSONB xm
        JSONB web2
    }

    XMIdentities {
        JSONB eth
        JSONB bsc
        JSONB solana
        JSONB aptos
        TEXT additional_chains
    }

    Web2Identities {
        ARRAY twitter
        ARRAY github
        ARRAY telegram
        ARRAY discord
    }

    GCRMain ||--|| Points : "has points"
    GCRMain ||--|| ReferralInfo : "has referralInfo"
    GCRMain ||--|| Identities : "has identities"
    Points ||--|| Breakdown : "contains breakdown"
    Breakdown ||--|| Web3Wallets : "web3Wallets by chain"
    Breakdown ||--|| SocialAccounts : "socialAccounts by platform"
    ReferralInfo ||--o{ Referral : "contains referrals array"
    Identities ||--|| XMIdentities : "xm chain identities"
    Identities ||--|| Web2Identities : "web2 social identities"
```

---

## 4. Award Points Flow

```mermaid
sequenceDiagram
    participant User
    participant RPC as RPC Handler
    participant PS as PointSystem
    participant IM as IdentityManager
    participant GCR as GCRMain Repository
    participant Twitter as Twitter API
    participant Telegram as Telegram Attestation
    participant Ref as Referrals

    rect rgb(200, 220, 240)
        Note over User,Ref: Award Web3 Wallet Points Flow
        User->>RPC: Link wallet (chain, address, referralCode?)
        RPC->>PS: awardWeb3WalletPoints(userId, address, chain, referralCode)
        PS->>PS: getUserPointsInternal(userId)
        PS->>IM: getIdentities(userId)
        IM-->>PS: Return XM chain identities
        PS->>PS: Check if Twitter linked (required)
        alt No Twitter linked
            PS-->>RPC: 400 "Twitter account not linked"
        end
        PS->>PS: Check if wallet already linked
        PS->>PS: Check if chain wallet already exists
        PS->>PS: addPointsToGCR(userId, 0.5, "web3Wallets", chain, referralCode)
        PS->>GCR: Load account from database
        GCR-->>PS: Return GCRMain account
        PS->>Ref: isEligibleForReferral(account)
        Ref-->>PS: Eligibility result
        alt Eligible and has referral code
            PS->>Ref: processReferral(account, referralCode, repository)
            Ref->>Ref: Award referrer 2 pts, new user 1 pt
        end
        PS->>GCR: Save updated account
        PS->>PS: getUserPointsInternal(userId)
        PS-->>RPC: Return updated points
        RPC-->>User: 200 OK with points
    end

    rect rgb(220, 240, 200)
        Note over User,Ref: Award Twitter Points Flow
        User->>RPC: Link Twitter (twitterUserId, referralCode?)
        RPC->>PS: awardTwitterPoints(userId, twitterUserId, referralCode)
        PS->>PS: getUserPointsInternal(userId)
        PS->>PS: Check if Twitter points already awarded
        alt Already awarded
            PS-->>RPC: 200 "Twitter points already awarded"
        end
        PS->>PS: addPointsToGCR(userId, 2, "socialAccounts", "twitter", referralCode, twitterUserId)
        PS->>Twitter: checkFollow(twitterUsername)
        Twitter-->>PS: isFollowingDemos
        alt Following Demos
            PS->>PS: Add 1 bonus point for FOLLOW_DEMOS
        end
        PS->>Ref: Process referral if eligible
        PS->>GCR: Save account
        PS-->>RPC: 200 OK with 2 points awarded
    end

    rect rgb(240, 220, 200)
        Note over User,Ref: Award Telegram Points Flow
        User->>RPC: Link Telegram (telegramUserId, referralCode?, attestation)
        RPC->>PS: awardTelegramPoints(userId, telegramUserId, referralCode, attestation)
        PS->>GCR: ensureGCRForUser(userId)
        PS->>PS: Verify Telegram ownership
        alt Not owner
            PS-->>RPC: 400 "Telegram account not linked"
        end
        PS->>PS: Check if Telegram points already awarded
        PS->>Telegram: Check group_membership from attestation
        alt Not in required group
            PS-->>RPC: 200 "Must join group to earn points"
        end
        PS->>PS: addPointsToGCR(userId, 1, "socialAccounts", "telegram", referralCode)
        PS->>Ref: Process referral if eligible
        PS->>GCR: Save account
        PS-->>RPC: 200 OK with 1 point awarded
    end

    rect rgb(240, 240, 200)
        Note over User,GCR: Award GitHub/Discord Points Flow
        User->>RPC: Link GitHub/Discord
        RPC->>PS: awardGithubPoints() / awardDiscordPoints()
        PS->>GCR: Verify account ownership
        PS->>PS: Check if points already awarded
        PS->>PS: addPointsToGCR(userId, 1, "socialAccounts", platform, referralCode)
        PS->>Ref: Process referral if eligible
        PS->>GCR: Save account
        PS-->>RPC: 200 OK with 1 point awarded
    end
```

---

## 5. Deduct Points Flow

```mermaid
flowchart TD
    Start([Unlink Account Request]) --> CheckType{Account Type?}

    CheckType -->|Web3 Wallet| Web3Flow[Web3 Wallet Deduction]
    CheckType -->|Twitter| TwitterFlow[Twitter Deduction]
    CheckType -->|GitHub| GitHubFlow[GitHub Deduction]
    CheckType -->|Telegram| TelegramFlow[Telegram Deduction]
    CheckType -->|Discord| DiscordFlow[Discord Deduction]

    Web3Flow --> GetUserPoints1[Get user points]
    GetUserPoints1 --> DeductWeb3[addPointsToGCR -0.5 points]
    DeductWeb3 --> UpdateChainPoints[Update web3Wallets breakdown]
    UpdateChainPoints --> SaveWeb3[Save to GCRMain]
    SaveWeb3 --> ReturnWeb3[Return updated totalPoints]
    ReturnWeb3 --> Success([Operation Complete])

    TwitterFlow --> GetUserPoints2[Get user points]
    GetUserPoints2 --> CheckTwitterPoints{Current Twitter points > 0?}
    CheckTwitterPoints -->|No| NoTwitterPoints[Return 0 points deducted]
    CheckTwitterPoints -->|Yes| DeductTwitter[addPointsToGCR -2 points]
    DeductTwitter --> DeductFollowBonus{Has FOLLOW_DEMOS bonus?}
    DeductFollowBonus -->|Yes| RemoveFollowBonus[Deduct -1 FOLLOW_DEMOS]
    DeductFollowBonus -->|No| SaveTwitter[Save to GCRMain]
    RemoveFollowBonus --> SaveTwitter
    SaveTwitter --> ReturnTwitter[Return -2 or -3 points deducted]
    ReturnTwitter --> Success
    NoTwitterPoints --> Success

    GitHubFlow --> GetUserPoints3[Get user points]
    GetUserPoints3 --> CheckGitHubPoints{Current GitHub points > 0?}
    CheckGitHubPoints -->|No| NoGitHubPoints[Return 0 points deducted]
    CheckGitHubPoints -->|Yes| DeductGitHub[addPointsToGCR -1 point]
    DeductGitHub --> SaveGitHub[Save to GCRMain]
    SaveGitHub --> ReturnGitHub[Return -1 point deducted]
    ReturnGitHub --> Success
    NoGitHubPoints --> Success

    TelegramFlow --> GetUserPoints4[Get user points]
    GetUserPoints4 --> CheckTelegramPoints{Current Telegram points > 0?}
    CheckTelegramPoints -->|No| NoTelegramPoints[Return 0 points deducted]
    CheckTelegramPoints -->|Yes| DeductTelegram[addPointsToGCR -1 point]
    DeductTelegram --> SaveTelegram[Save to GCRMain]
    SaveTelegram --> ReturnTelegram[Return -1 point deducted]
    ReturnTelegram --> Success
    NoTelegramPoints --> Success

    DiscordFlow --> GetUserPoints5[Get user points]
    GetUserPoints5 --> CheckDiscordPoints{Current Discord points > 0?}
    CheckDiscordPoints -->|No| NoDiscordPoints[Return 0 points deducted]
    CheckDiscordPoints -->|Yes| DeductDiscord[addPointsToGCR -1 point]
    DeductDiscord --> SaveDiscord[Save to GCRMain]
    SaveDiscord --> ReturnDiscord[Return -1 point deducted]
    ReturnDiscord --> Success
    NoDiscordPoints --> Success

    style Start fill:#e1f5ff
    style Success fill:#c8e6c9
    style CheckType fill:#fff9c4
    style CheckTwitterPoints fill:#fff9c4
    style CheckGitHubPoints fill:#fff9c4
    style CheckTelegramPoints fill:#fff9c4
    style CheckDiscordPoints fill:#fff9c4
    style DeductFollowBonus fill:#ffecb3
```

---

## 6. Referral Code Generation

```mermaid
flowchart TD
    Start([Generate Referral Code]) --> Input[Input: ed25519 public key 0x...]
    Input --> ValidateKey{Valid 64 hex chars?}
    ValidateKey -->|No| Error([Throw Invalid Key Error])
    ValidateKey -->|Yes| CleanKey[Remove 0x prefix]

    CleanKey --> HashKey[SHA256 hash of clean key]
    HashKey --> CalcBytes[Calculate bytes for length]

    CalcBytes --> BytesMap{Target Length?}
    BytesMap -->|8 chars| Use8Bytes[Use 8 bytes ~56 bits]
    BytesMap -->|10 chars| Use9Bytes[Use 9 bytes ~63 bits]
    BytesMap -->|12 chars| Use10Bytes[Use 10 bytes ~70 bits]
    BytesMap -->|16 chars| Use14Bytes[Use 14 bytes ~98 bits]

    Use8Bytes --> ExtractBytes[Extract bytes from hash]
    Use9Bytes --> ExtractBytes
    Use10Bytes --> ExtractBytes
    Use14Bytes --> ExtractBytes

    ExtractBytes --> EncodeBase58[Encode with Base58]
    EncodeBase58 --> TruncateLength[Truncate to exact length]

    TruncateLength --> CheckChecksum{Include Checksum?}
    CheckChecksum -->|No| AddPrefix[Add optional prefix]
    CheckChecksum -->|Yes| GenChecksum[Generate 2-char checksum]

    GenChecksum --> ChecksumFlow[SHA256 of key + CHECKSUM]
    ChecksumFlow --> EncodeChecksum[Base58 encode checksum]
    EncodeChecksum --> ReplaceLastTwo[Replace last 2 chars with checksum]
    ReplaceLastTwo --> AddPrefix

    AddPrefix --> Return([Return Referral Code])

    style Start fill:#e1f5ff
    style Return fill:#c8e6c9
    style Error fill:#ffcdd2
    style ValidateKey fill:#fff9c4
    style BytesMap fill:#fff9c4
    style CheckChecksum fill:#fff9c4
    style EncodeBase58 fill:#e8f5e9
    style GenChecksum fill:#f3e5f5

    Note1[Example Code: 12 chars\n10 bytes SHA256\nBase58 encoded\nCollision-resistant]
    Note1 -.-> Return

    Note2[Properties:\n- Human-friendly Base58\n- No ambiguous chars 0,O,I,l\n- Deterministic from pubkey\n- Optional validation checksum]
    Note2 -.-> EncodeBase58
```

---

## 7. Referral Processing Flow

```mermaid
sequenceDiagram
    participant NewUser as New User
    participant PS as PointSystem
    participant Ref as Referrals
    participant GCR as GCRMain Repository
    participant Referrer as Referrer Account

    rect rgb(200, 220, 240)
        Note over NewUser,Referrer: Referral Processing Flow
        NewUser->>PS: Award points with referralCode
        PS->>Ref: isEligibleForReferral(newUserAccount)

        Ref->>Ref: Check if already has referredBy
        alt Already referred
            Ref-->>PS: Not eligible (has referredBy)
        end

        Ref->>Ref: Check if has existing referrals
        alt Has referrals
            Ref-->>PS: Not eligible (has referrals)
        end

        Ref->>Ref: Check if totalReferrals > 0
        alt Has total referrals
            Ref-->>PS: Not eligible (totalReferrals > 0)
        end

        Ref->>Ref: Check if totalPoints > 0 before current award
        alt Has existing points
            Ref-->>PS: Not eligible (has points)
        end

        Ref-->>PS: Eligible for referral
    end

    rect rgb(220, 240, 200)
        Note over PS,Referrer: Process Valid Referral
        PS->>Ref: processReferral(newUserAccount, referralCode, repository)
        Ref->>GCR: findAccountByReferralCode(referralCode)
        GCR-->>Ref: Return referrer account or null

        alt Referral code not found
            Ref-->>PS: Invalid code, return
        end

        Ref->>Ref: Check if self-referral
        alt Referrer == New User
            Ref-->>PS: Self-referral blocked, return
        end

        Ref->>Ref: isAlreadyReferred(referrer, newUserPubkey)
        alt Already referred by this referrer
            Ref-->>PS: Duplicate referral, return
        end

        Ref->>Ref: awardReferralPoints(referrer, newUser, repository)
    end

    rect rgb(240, 220, 200)
        Note over Ref,Referrer: Award Points to Both Parties
        Ref->>Referrer: Add REFERRER_BONUS (2 pts) to totalPoints
        Ref->>Referrer: Add 2 pts to breakdown.referrals
        Ref->>Referrer: Increment totalReferrals count
        Ref->>Referrer: Push referral to referrals array
        Ref->>Referrer: Update lastUpdated timestamp

        Ref->>NewUser: Set referredBy = referrer.pubkey
        Ref->>NewUser: Add REFERRED_USER_BONUS (1 pt) to totalPoints
        Ref->>NewUser: Add 1 pt to breakdown.referrals
        Ref->>NewUser: Update lastUpdated timestamp

        Ref->>GCR: Save referrer account
        GCR-->>Ref: Saved (auto-saves new user in parent flow)

        Ref-->>PS: Referral processed successfully
    end

    rect rgb(240, 240, 200)
        Note over NewUser,PS: Return to Original Flow
        PS->>GCR: Save new user account with referral bonus
        PS-->>NewUser: Return points with referral bonus included
    end
```

---

## 8. Eligibility & Validation Rules

```mermaid
stateDiagram-v2
    [*] --> ValidateRequest: Award Points Request

    state ValidateRequest {
        [*] --> CheckTwitterRequired
        CheckTwitterRequired --> TwitterLinked: Web3 wallet award?
        TwitterLinked --> CheckDuplicates: Yes, Twitter linked
        CheckTwitterRequired --> CheckDuplicates: Other awards
        TwitterLinked --> [*]: No Twitter linked (reject)
    }

    ValidateRequest --> CheckDuplicates: Validation passed

    state CheckDuplicates {
        [*] --> CheckWalletDuplicate
        CheckWalletDuplicate --> WalletAlreadyLinked: Web3 wallet?
        WalletAlreadyLinked --> [*]: Already linked (reject)
        CheckWalletDuplicate --> CheckChainLimit: Not linked

        CheckChainLimit --> ChainLimitExceeded: Has wallet on chain?
        ChainLimitExceeded --> [*]: Chain limit reached (reject)
        CheckChainLimit --> CheckSocialDuplicate: No wallet on chain

        CheckSocialDuplicate --> SocialAlreadyAwarded: Social account?
        SocialAlreadyAwarded --> [*]: Points already awarded (reject)
        CheckSocialDuplicate --> CheckOwnership: Not awarded yet
    }

    CheckDuplicates --> CheckOwnership: No duplicates

    state CheckOwnership {
        [*] --> VerifyGitHub
        VerifyGitHub --> GitHubVerified: GitHub award?
        GitHubVerified --> CheckTelegramAttest: Verified
        VerifyGitHub --> CheckTelegramAttest: Other awards
        GitHubVerified --> [*]: Not verified (reject)

        CheckTelegramAttest --> TelegramGroupCheck: Telegram award?
        TelegramGroupCheck --> GroupMembershipValid: Check attestation
        GroupMembershipValid --> CheckDiscord: Member of group
        TelegramGroupCheck --> [*]: Not in group (no points)
        CheckTelegramAttest --> CheckDiscord: Other awards

        CheckDiscord --> DiscordVerified: Discord award?
        DiscordVerified --> EligibilityCheck: Verified
        CheckDiscord --> EligibilityCheck: Other awards
        DiscordVerified --> [*]: Not verified (reject)
    }

    CheckOwnership --> EligibilityCheck: Ownership verified

    state EligibilityCheck {
        [*] --> HasReferralCode
        HasReferralCode --> CheckEligibility: Yes, has code
        HasReferralCode --> AwardPoints: No code

        CheckEligibility --> CheckReferredBy: Check eligibility
        CheckReferredBy --> NotEligible1: Has referredBy
        CheckReferredBy --> CheckExistingReferrals: No referredBy

        CheckExistingReferrals --> NotEligible2: Has referrals[]
        CheckExistingReferrals --> CheckTotalReferrals: No referrals

        CheckTotalReferrals --> NotEligible3: totalReferrals > 0
        CheckTotalReferrals --> CheckExistingPoints: totalReferrals == 0

        CheckExistingPoints --> NotEligible4: totalPoints > 0
        CheckExistingPoints --> ProcessReferral: totalPoints == 0

        NotEligible1 --> AwardPoints: Skip referral
        NotEligible2 --> AwardPoints: Skip referral
        NotEligible3 --> AwardPoints: Skip referral
        NotEligible4 --> AwardPoints: Skip referral

        ProcessReferral --> ValidateReferralCode: Eligible
        ValidateReferralCode --> InvalidCode: Code not found
        ValidateReferralCode --> CheckSelfReferral: Valid code

        InvalidCode --> AwardPoints: Skip referral

        CheckSelfReferral --> SelfReferral: Same pubkey?
        SelfReferral --> AwardPoints: Skip self-referral
        CheckSelfReferral --> CheckDuplicateReferral: Different user

        CheckDuplicateReferral --> DuplicateReferral: Already in referrals[]?
        DuplicateReferral --> AwardPoints: Skip duplicate
        CheckDuplicateReferral --> AwardReferralBonus: Not duplicate

        AwardReferralBonus --> AwardPoints: +1 pt for user, +2 pts for referrer
    }

    EligibilityCheck --> AwardPoints: Validation complete

    AwardPoints --> UpdateGCR: Add points to totalPoints
    UpdateGCR --> UpdateBreakdown: Update breakdown
    UpdateBreakdown --> CheckDemosFollow: Twitter award?
    CheckDemosFollow --> QueryTwitterAPI: Check follow status
    QueryTwitterAPI --> AddFollowBonus: Following @Demos
    QueryTwitterAPI --> SaveToDatabase: Not following
    AddFollowBonus --> SaveToDatabase: +1 bonus point
    CheckDemosFollow --> SaveToDatabase: Other awards
    SaveToDatabase --> [*]: Points awarded

    note right of ValidateRequest
        First validation layer
        Platform-specific requirements
    end note

    note right of CheckDuplicates
        Prevent duplicate awards
        One wallet per chain rule
    end note

    note right of CheckOwnership
        Verify account ownership
        Telegram group membership
    end note

    note right of EligibilityCheck
        Complex referral eligibility
        Multiple blocking conditions
    end note
```

---

## 9. GCR Integration & Identity Management

```mermaid
sequenceDiagram
    participant PS as PointSystem
    participant IM as IdentityManager
    participant EG as ensureGCRForUser
    participant GCR as GCRMain Repository
    participant DB as PostgreSQL Database
    participant Twitter as Twitter API

    rect rgb(200, 220, 240)
        Note over PS,DB: Get User Identities from GCR
        PS->>IM: getIdentities(userId)
        IM->>GCR: Query GCRMain by pubkey
        GCR->>DB: SELECT identities.xm FROM GCRMain
        DB-->>GCR: Return XM identities JSON
        GCR-->>IM: Return xm chain identities

        IM->>IM: Parse XM chain structure
        loop For each chain (eth, bsc, solana, aptos)
            IM->>IM: Extract subchain identities
            IM->>IM: Build wallet array: chain:address
        end
        IM-->>PS: Return linkedWallets[] array
    end

    rect rgb(220, 240, 200)
        Note over PS,DB: Get Web2 Identities from GCR
        PS->>IM: getWeb2Identities(userId, "twitter")
        IM->>GCR: Query GCRMain by pubkey
        GCR->>DB: SELECT identities.web2.twitter FROM GCRMain
        DB-->>GCR: Return Twitter identities array
        GCR-->>IM: Return twitter identities
        IM-->>PS: Return [{userId, username}]

        PS->>IM: getWeb2Identities(userId, "discord")
        IM->>GCR: Query GCRMain by pubkey
        GCR->>DB: SELECT identities.web2.discord FROM GCRMain
        DB-->>GCR: Return Discord identities array
        GCR-->>IM: Return discord identities
        IM-->>PS: Return [{userId, username}]
    end

    rect rgb(240, 220, 200)
        Note over PS,DB: Ensure GCR Account Exists
        PS->>EG: ensureGCRForUser(userId)
        EG->>GCR: findOneBy({pubkey: userId})
        GCR->>DB: SELECT * FROM GCRMain WHERE pubkey = ?
        DB-->>GCR: Return account or null

        alt Account exists
            GCR-->>EG: Return existing account
        else Account does not exist
            EG->>GCR: HandleGCR.createAccount(userId)
            GCR->>DB: INSERT INTO GCRMain (pubkey, points, referralInfo, identities)
            DB-->>GCR: New account created
            GCR-->>EG: Return new account
        end

        EG->>EG: Check if referralInfo exists
        alt Missing referralInfo
            EG->>EG: Initialize referralInfo with generated code
            EG->>GCR: save(account)
        end

        EG-->>PS: Return account with referralInfo
    end

    rect rgb(240, 240, 200)
        Note over PS,Twitter: Check Twitter Follow Status
        PS->>GCR: Load user account
        GCR-->>PS: Return account with web2.twitter identities
        PS->>PS: Find Twitter identity by twitterUserId

        alt Has Twitter identity
            PS->>Twitter: checkFollow(twitterUsername)
            Twitter->>Twitter: Query Twitter API for follow relationship
            Twitter-->>PS: Return isFollowingDemos boolean

            alt Following @Demos
                PS->>PS: Add 1 point to breakdown.demosFollow
                PS->>PS: Add 1 point to totalPoints
                PS->>GCR: save(account)
            end
        end
    end

    rect rgb(200, 240, 240)
        Note over PS,DB: Complete getUserPointsInternal Flow
        PS->>GCR: findOneBy({pubkey: userId})
        GCR->>DB: SELECT * FROM GCRMain
        DB-->>GCR: Return account

        alt Account not found
            PS->>GCR: HandleGCR.createAccount(userId)
        end

        PS->>IM: Get XM and Web2 identities
        PS->>PS: Build UserPoints response object
        PS->>PS: Include totalPoints, breakdown, linkedWallets, linkedSocials
        PS->>PS: Include referralCode, lastUpdated, flagged status
        PS-->>PS: Return complete UserPoints object
    end
```

---

## 10. Complete Incentive Lifecycle

```mermaid
stateDiagram-v2
    [*] --> SystemInit: Initialize Incentive System

    SystemInit --> GetSingleton: Get PointSystem instance
    GetSingleton --> InitializeGCR: Initialize GCR connection
    InitializeGCR --> SystemReady: System ready for operations

    SystemReady --> NewUserRegistration: New user registers
    SystemReady --> ExistingUserOperation: Existing user operation

    state NewUserRegistration {
        [*] --> EnsureGCR: Ensure GCR account
        EnsureGCR --> GenerateReferralCode: Generate referral code
        GenerateReferralCode --> InitializePoints: Initialize points = 0
        InitializePoints --> InitializeBreakdown: Initialize breakdown structure
        InitializeBreakdown --> InitializeReferralInfo: Initialize referralInfo
        InitializeReferralInfo --> SaveNewAccount: Save to GCRMain
        SaveNewAccount --> [*]
    }

    NewUserRegistration --> ReadyForLinking: Account created

    state ExistingUserOperation {
        [*] --> LoadAccount: Load GCRMain account
        LoadAccount --> CheckOperation: Determine operation
    }

    ExistingUserOperation --> ReadyForLinking: Account loaded

    state ReadyForLinking {
        [*] --> ChooseLinkType
        ChooseLinkType --> LinkWeb3: Link Web3 wallet
        ChooseLinkType --> LinkTwitter: Link Twitter
        ChooseLinkType --> LinkGitHub: Link GitHub
        ChooseLinkType --> LinkTelegram: Link Telegram
        ChooseLinkType --> LinkDiscord: Link Discord
    }

    ReadyForLinking --> AwardPointsFlow: Link account

    state AwardPointsFlow {
        [*] --> ValidateRequest
        ValidateRequest --> CheckTwitterReq: Web3 wallet?
        CheckTwitterReq --> TwitterRequired: Require Twitter first
        TwitterRequired --> [*]: Reject if no Twitter
        CheckTwitterReq --> CheckDuplicates: Has Twitter or other platform

        CheckDuplicates --> DuplicateDetected: Already linked?
        DuplicateDetected --> [*]: Reject duplicate
        CheckDuplicates --> CheckOwnership: No duplicate

        CheckOwnership --> OwnershipFailed: Not owner?
        OwnershipFailed --> [*]: Reject non-owner
        CheckOwnership --> CheckAttestation: Ownership verified

        CheckAttestation --> TelegramAttest: Telegram?
        TelegramAttest --> GroupNotMember: Not in group?
        GroupNotMember --> [*]: No points awarded
        TelegramAttest --> AddPoints: In group
        CheckAttestation --> AddPoints: Other platforms

        AddPoints --> UpdateTotalPoints: Add platform points
        UpdateTotalPoints --> UpdateBreakdown: Update breakdown
        UpdateBreakdown --> CheckReferral: Has referral code?

        CheckReferral --> ProcessReferralFlow: Yes, check eligibility
        CheckReferral --> CheckFollowBonus: No referral code

        ProcessReferralFlow --> ReferralProcessed: Award referral bonus
        ReferralProcessed --> CheckFollowBonus: +1 pt user, +2 pts referrer

        CheckFollowBonus --> TwitterFollowCheck: Twitter link?
        TwitterFollowCheck --> QueryTwitterAPI: Check follow status
        QueryTwitterAPI --> FollowingDemos: Following @Demos?
        FollowingDemos --> AddFollowBonus: Add 1 bonus point
        FollowingDemos --> SaveAccount: Not following
        TwitterFollowCheck --> SaveAccount: Other platforms
        AddFollowBonus --> SaveAccount: demosFollow bonus

        SaveAccount --> ReturnResponse: Save to GCRMain
        ReturnResponse --> [*]: Return RPCResponse
    }

    AwardPointsFlow --> AccountUpdated: Points awarded

    AccountUpdated --> QueryPoints: User queries points
    AccountUpdated --> UnlinkAccount: User unlinks account
    AccountUpdated --> ReadyForLinking: Link more accounts

    state QueryPoints {
        [*] --> GetUserPointsInternal
        GetUserPointsInternal --> LoadFromGCR: Load account
        LoadFromGCR --> GetIdentities: Get XM + Web2 identities
        GetIdentities --> BuildResponse: Build UserPoints object
        BuildResponse --> ReturnUserPoints: Return complete profile
        ReturnUserPoints --> [*]
    }

    QueryPoints --> AccountUpdated: Points returned

    state UnlinkAccount {
        [*] --> ChooseUnlinkType
        ChooseUnlinkType --> UnlinkWeb3: Unlink wallet
        ChooseUnlinkType --> UnlinkTwitter: Unlink Twitter
        ChooseUnlinkType --> UnlinkGitHub: Unlink GitHub
        ChooseUnlinkType --> UnlinkTelegram: Unlink Telegram
        ChooseUnlinkType --> UnlinkDiscord: Unlink Discord

        UnlinkWeb3 --> DeductWeb3Points: Deduct 0.5 points
        UnlinkTwitter --> DeductTwitterPoints: Deduct 2 points
        UnlinkGitHub --> DeductGitHubPoints: Deduct 1 point
        UnlinkTelegram --> DeductTelegramPoints: Deduct 1 point
        UnlinkDiscord --> DeductDiscordPoints: Deduct 1 point

        DeductWeb3Points --> UpdateAfterDeduct
        DeductTwitterPoints --> CheckFollowDeduct: Remove follow bonus?
        CheckFollowDeduct --> DeductFollowBonus: Yes, deduct 1 more
        CheckFollowDeduct --> UpdateAfterDeduct: No follow bonus
        DeductFollowBonus --> UpdateAfterDeduct: Total -3 points
        DeductGitHubPoints --> UpdateAfterDeduct
        DeductTelegramPoints --> UpdateAfterDeduct
        DeductDiscordPoints --> UpdateAfterDeduct

        UpdateAfterDeduct --> SaveDeduction: Update breakdown & total
        SaveDeduction --> ReturnDeduction: Save to GCRMain
        ReturnDeduction --> [*]: Return updated points
    }

    UnlinkAccount --> AccountUpdated: Points deducted

    state ReferralOperations {
        [*] --> GenerateCode: Generate referral code
        GenerateCode --> ShareCode: Share with friends
        ShareCode --> WaitForReferral: Wait for referral
        WaitForReferral --> ReferralTriggered: New user uses code
        ReferralTriggered --> CheckEligibility: Validate eligibility
        CheckEligibility --> NotEligible: Failed checks
        NotEligible --> [*]: Skip referral
        CheckEligibility --> AwardBothParties: Eligible
        AwardBothParties --> Referrer2Points: Referrer +2 pts
        AwardBothParties --> NewUser1Point: New user +1 pt
        Referrer2Points --> UpdateReferralInfo: Update referral lists
        NewUser1Point --> UpdateReferralInfo
        UpdateReferralInfo --> SaveBothAccounts: Save both accounts
        SaveBothAccounts --> [*]: Referral complete
    }

    AccountUpdated --> ReferralOperations: User shares referral code
    ReferralOperations --> AccountUpdated: Referral processed

    AccountUpdated --> FlagAccount: Suspicious activity detected

    state FlagAccount {
        [*] --> DetectSuspicious
        DetectSuspicious --> SetFlaggedTrue: Set flagged = true
        SetFlaggedTrue --> SetFlaggedReason: Set flaggedReason
        SetFlaggedReason --> SaveFlagged: Save to GCRMain
        SaveFlagged --> BlockOperations: Block future point operations
        BlockOperations --> [*]
    }

    FlagAccount --> SystemShutdown: Account flagged

    AccountUpdated --> SystemShutdown: Graceful shutdown
    QueryPoints --> SystemShutdown: Shutdown requested
    ReadyForLinking --> SystemShutdown: Shutdown requested

    SystemShutdown --> CloseConnections: Close GCR connections
    CloseConnections --> [*]: System stopped

    note right of SystemInit
        Initialize PointSystem singleton
        Connect to GCR database
    end note

    note right of NewUserRegistration
        First-time user setup
        Generate referral code
        Initialize all fields
    end note

    note right of AwardPointsFlow
        Multi-stage validation
        Platform-specific rules
        Referral processing
        Bonus calculations
    end note

    note right of ReferralOperations
        Two-party point award
        Eligibility checks
        Anti-gaming measures
    end note

    note right of FlagAccount
        Anti-abuse mechanism
        Suspicious pattern detection
    end note
```

---

## Summary

These diagrams provide comprehensive coverage of the Incentive Management implementation:

1. **Architecture Overview** - Complete system with PointSystem, Referrals, GCR integration, Identity Management
2. **Class Structure** - TypeScript classes for PointSystem (singleton), Referrals (static), UserPoints, Breakdown
3. **Data Model** - GCRMain entity with points, referralInfo, identities in PostgreSQL with JSONB fields
4. **Award Points Flow** - Complete sequence for Web3, Twitter, GitHub, Telegram, Discord with validation
5. **Deduct Points Flow** - Flowchart for unlinking accounts with proper point deduction
6. **Referral Code Generation** - Collision-resistant Base58 encoding from ed25519 public key with SHA256
7. **Referral Processing** - Two-party bonus award with eligibility checks and anti-gaming measures
8. **Eligibility & Validation** - State machine showing all validation rules and blocking conditions
9. **GCR Integration** - Complete identity management with XM chain and Web2 platform queries
10. **Complete Lifecycle** - End-to-end state machine from initialization to flagging and shutdown

### Key Features Documented:
- **Point Values**: Web3 (0.5), Twitter (2), GitHub (1), Telegram (1), Discord (1), Follow Demos (1)
- **Referral Bonuses**: Referrer (+2), Referred User (+1)
- **Validation Rules**: Twitter required for Web3, one wallet per chain, ownership verification
- **Telegram Attestation**: Group membership required via attestation payload
- **Referral Eligibility**: No prior referredBy, no existing referrals, no existing points
- **Anti-Gaming**: Self-referral blocked, duplicate referrals blocked, flagging system
- **Identity Management**: XM chain wallets (ETH, BSC, Solana, Aptos), Web2 socials (Twitter, GitHub, Telegram, Discord)
- **GCR Integration**: PostgreSQL with JSONB fields for points, breakdown, referralInfo, identities
- **Referral Code**: Deterministic, collision-resistant, Base58 encoded, optional checksum

### Files Referenced:
- `src/features/incentive/PointSystem.ts` - Singleton class managing all point operations
- `src/features/incentive/referrals.ts` - Static utility class for referral mechanics

This documentation enables developers to understand the complete incentive system architecture, from point allocation to referral mechanics to anti-gaming measures.
