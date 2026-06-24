# Simplified Theoretical Framework Diagram

## Quick Visual Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTION LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Preferences  │  │ AR View      │  │ Feedback     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI/ML LAYER                                   │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │ Genetic Algorithm│      │ ML Recommendation│                │
│  │ • Population: 20 │      │ • Hybrid Scoring │                │
│  │ • Iterations: 100│      │ • Personalization│                │
│  │ • Mutation: 15%  │      │ • Confidence: 60%│                │
│  └────────┬─────────┘      └────────┬─────────┘                │
│           │                          │                           │
│           └──────────┬───────────────┘                           │
│                      ▼                                            │
│           ┌──────────────────────┐                               │
│           │ Multi-Objective      │                               │
│           │ Optimization         │                               │
│           │ • Space Efficiency   │                               │
│           │ • Comfort            │                               │
│           │ • Aesthetics         │                               │
│           │ • Accessibility      │                               │
│           │ • Ergonomics         │                               │
│           └──────────┬───────────┘                               │
└──────────────────────┼───────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              SPATIAL REASONING LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Constraints  │→ │ Collision     │→ │ Geometric    │          │
│  │ Validation   │  │ Detection     │  │ Optimization │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  • Walkway: 0.9m   • Furniture: 0.6m  • Position Finding       │
│  • Door: 0.8m      • Wall: 0.3m       • Rotation Optimization  │
└─────────────────────────────────────────────────────────────────┘
                       ▲
                       │
┌──────────────────────┼───────────────────────────────────────────┐
│              AR/COMPUTER VISION LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Plane        │→ │ Room         │→ │ Image        │          │
│  │ Detection    │  │ Understanding │  │ Analysis     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  • Horizontal      • Dimensions      • Style Detection          │
│  • Vertical        • Furniture       • Color Analysis           │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              DESIGN GENERATION LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Layout       │  │ Theme        │  │ Performance  │          │
│  │ Generation   │  │ Application  │  │ Scoring      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│           │                │                │                    │
│           └────────────────┼────────────────┘                    │
│                            ▼                                     │
│                  ┌─────────────────┐                              │
│                  │ Design Proposals│                              │
│                  │ (Best + Alts)  │                              │
│                  └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │  USER INTERFACE  │
                  │  (Display Results)│
                  └─────────────────┘
```

## Key Components

### 1. Genetic Algorithm Engine
```
Initialization → Evaluation → Selection → Crossover → Mutation → Validation
     (20)          (Fitness)    (Elite)     (70%)      (15%)      (Constraints)
```

### 2. ML Recommendation Flow
```
User Input → Feature Extraction → Weighted Scoring → Personalization → Filtering → Output
             (Room/Mood/Style)     (25/30/25/10/10)   (User History)   (≥0.60)   (Top 5)
```

### 3. Spatial Constraint System
```
Room Data → Boundary Check → Collision Detection → Ergonomics → Accessibility → Valid Position
```

## Data Flow

```
User Preferences
    ↓
[ML System] → Theme Recommendations
    ↓
[GA Engine] → Initialize Population
    ↓
[Spatial Reasoning] → Validate Constraints
    ↓
[Optimization] → Evaluate Fitness
    ↓
[Generation] → Create Proposals
    ↓
[Scoring] → Rank Designs
    ↓
User Interface → Display Results
    ↓
User Feedback → Update Model
```

