# Theoretical Framework Diagrams

## 1. System Architecture & Theoretical Framework Overview

```mermaid
graph TB
    subgraph "User Interaction Layer"
        UI[User Interface]
        AR[AR Visualization]
        FB[User Feedback]
    end
    
    subgraph "AI/ML Layer - Generative Design"
        GA[Genetic Algorithm Engine]
        ML[ML Recommendation System]
        OPT[Multi-Objective Optimization]
        FIT[Fitness Evaluation]
    end
    
    subgraph "Spatial Reasoning Layer"
        SPAT[Spatial Mapping]
        COLL[Collision Detection]
        CONST[Constraint Validation]
        GEOM[Computational Geometry]
    end
    
    subgraph "Computer Vision & AR Layer"
        CV[Image Analysis]
        PLANE[Plane Detection]
        ROOM[Room Understanding]
        TRACK[Coordinate Tracking]
    end
    
    subgraph "Data & Learning Layer"
        HIST[User History]
        PREF[Preference Learning]
        TRAIN[Model Training]
        REFINE[Model Refinement]
    end
    
    subgraph "Design Generation Layer"
        GEN[Layout Generation]
        THEME[Theme Recommendation]
        IMG[Image Generation]
        SCORE[Performance Scoring]
    end
    
    UI --> GA
    UI --> ML
    AR --> PLANE
    AR --> TRACK
    FB --> HIST
    
    GA --> GEN
    ML --> THEME
    OPT --> FIT
    FIT --> SCORE
    
    SPAT --> COLL
    COLL --> CONST
    CONST --> GEOM
    
    CV --> ROOM
    PLANE --> SPAT
    ROOM --> GEN
    
    HIST --> PREF
    PREF --> TRAIN
    TRAIN --> REFINE
    REFINE --> ML
    
    GEN --> SCORE
    THEME --> GEN
    SCORE --> UI
    IMG --> UI
    
    style GA fill:#e1f5ff
    style ML fill:#e1f5ff
    style SPAT fill:#fff4e1
    style CV fill:#f0e1ff
    style HIST fill:#e1ffe1
    style GEN fill:#ffe1f5
```

## 2. Genetic Algorithm Process Flow

```mermaid
flowchart TD
    START([Start Design Generation]) --> INIT[Initialize Population<br/>Size: 20 layouts]
    INIT --> EVAL[Evaluate Fitness<br/>Multi-objective Scoring]
    EVAL --> SORT[Sort by Fitness]
    SORT --> ELITE[Select Elite<br/>Top 3 layouts]
    ELITE --> CHECK{Iteration < 100?}
    
    CHECK -->|Yes| SELECT[Tournament Selection<br/>Select Parents]
    SELECT --> CROSS{Crossover?<br/>Rate: 0.7}
    CROSS -->|Yes| CROSSOP[Crossover Operation<br/>Combine Parent Layouts]
    CROSS -->|No| COPY[Copy Parent]
    CROSSOP --> MUTATE[Mutation Operation<br/>Rate: 0.15]
    COPY --> MUTATE
    MUTATE --> VALID[Validate Constraints]
    VALID --> EVAL
    
    CHECK -->|No or Converged| RANK[Rank Final Proposals]
    RANK --> SCORE[Calculate Performance Scores]
    SCORE --> OUTPUT([Output Best Designs])
    
    style START fill:#90EE90
    style OUTPUT fill:#90EE90
    style EVAL fill:#FFE4B5
    style CROSSOP fill:#E1F5FF
    style MUTATE fill:#FFE1F5
```

## 3. ML Recommendation System Architecture

```mermaid
graph LR
    subgraph "Input Layer"
        USER[User Preferences]
        IMG[Room Image]
        HIST[User History]
    end
    
    subgraph "Feature Extraction"
        RT[Room Type<br/>Weight: 25%]
        MOOD[Mood<br/>Weight: 30%]
        STYLE[Style<br/>Weight: 25%]
        COLOR[Colors<br/>Weight: 10%]
        MAT[Materials<br/>Weight: 10%]
    end
    
    subgraph "ML Processing"
        FILTER[Theme Filtering]
        SCORE[Confidence Scoring]
        PERSON[Personalization]
        THRESH[Threshold Check<br/>≥ 0.60]
    end
    
    subgraph "Output Layer"
        REC[Recommendations<br/>Top 5]
        CONF[Confidence Level]
    end
    
    USER --> RT
    USER --> MOOD
    USER --> STYLE
    USER --> COLOR
    USER --> MAT
    IMG --> FILTER
    HIST --> PERSON
    
    RT --> SCORE
    MOOD --> SCORE
    STYLE --> SCORE
    COLOR --> SCORE
    MAT --> SCORE
    
    FILTER --> SCORE
    SCORE --> PERSON
    PERSON --> THRESH
    THRESH --> REC
    THRESH --> CONF
    
    style SCORE fill:#E1F5FF
    style PERSON fill:#FFE1F5
    style THRESH fill:#FFE4B5
```

## 4. Spatial Reasoning & Constraint System

```mermaid
graph TD
    subgraph "Spatial Input"
        ROOM[Room Dimensions]
        FURN[Furniture Items]
        OBST[Obstacles]
    end
    
    subgraph "Constraint Definitions"
        WALK[Walkway: 0.9m]
        DOOR[Door Clearance: 0.8m]
        WALL[Wall Distance: 0.3m]
        FURN_DIST[Furniture Distance: 0.6m]
        ERGO[Ergonomics Rules]
    end
    
    subgraph "Validation Engine"
        BOUND[Boundary Check]
        COLL[Collision Detection]
        ERGO_CHECK[Ergonomics Check]
        ACCESS[Accessibility Check]
    end
    
    subgraph "Optimization"
        POS[Position Finding]
        ROT[Rotation Optimization]
        PLACE[Placement Algorithm]
    end
    
    ROOM --> BOUND
    FURN --> COLL
    OBST --> COLL
    
    WALK --> COLL
    DOOR --> COLL
    WALL --> BOUND
    FURN_DIST --> COLL
    ERGO --> ERGO_CHECK
    
    BOUND --> POS
    COLL --> POS
    ERGO_CHECK --> POS
    ACCESS --> POS
    
    POS --> ROT
    ROT --> PLACE
    PLACE --> VALID[Valid Layout]
    
    style COLL fill:#FFE4B5
    style POS fill:#E1F5FF
    style VALID fill:#90EE90
```

## 5. Complete System Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as UI Layer
    participant AR as AR/CV Layer
    participant SPAT as Spatial Mapping
    participant AI as AI Design Service
    participant ML as ML Recommendation
    participant GEN as Layout Generator
    participant EVAL as Evaluator
    
    U->>UI: Start Design Project
    UI->>AR: Scan Room
    AR->>SPAT: Detect Planes & Dimensions
    SPAT->>UI: Room Data
    
    U->>UI: Set Preferences
    UI->>ML: Get Theme Recommendations
    ML->>ML: Calculate Scores (Hybrid Algorithm)
    ML->>UI: Recommended Themes
    
    UI->>AI: Generate Designs
    AI->>GEN: Initialize Population (GA)
    GEN->>GEN: Crossover & Mutation
    GEN->>EVAL: Evaluate Fitness
    EVAL->>EVAL: Multi-objective Scoring
    EVAL->>GEN: Feedback
    GEN->>AI: Optimized Layouts
    AI->>UI: Design Proposals
    
    UI->>U: Display Designs
    U->>UI: Provide Feedback
    UI->>ML: Update User History
    ML->>ML: Refine Model
```

## 6. Theoretical Framework Layers

```mermaid
graph TB
    subgraph "Layer 1: User Interface & Interaction"
        L1A[User Preferences Input]
        L1B[AR Visualization]
        L1C[Feedback Collection]
    end
    
    subgraph "Layer 2: AI & Machine Learning"
        L2A[Genetic Algorithm]
        L2B[ML Recommendation System]
        L2C[Adaptive Learning]
        L2D[Model Training & Refinement]
    end
    
    subgraph "Layer 3: Spatial Reasoning"
        L3A[Constraint-Based Planning]
        L3B[Collision Detection]
        L3C[Geometric Optimization]
        L3D[Multi-Objective Evaluation]
    end
    
    subgraph "Layer 4: Computer Vision & AR"
        L4A[Plane Detection]
        L4B[Room Understanding]
        L4C[Image Analysis]
        L4D[Spatial Tracking]
    end
    
    subgraph "Layer 5: Design Generation"
        L5A[Layout Generation]
        L5B[Theme Application]
        L5C[Image Synthesis]
        L5D[Performance Scoring]
    end
    
    L1A --> L2A
    L1A --> L2B
    L1B --> L4A
    L1C --> L2C
    
    L2A --> L3A
    L2B --> L5B
    L2C --> L2D
    L2D --> L2B
    
    L3A --> L3B
    L3B --> L3C
    L3C --> L3D
    L3D --> L5A
    
    L4A --> L4B
    L4B --> L3A
    L4C --> L4B
    L4D --> L4A
    
    L5A --> L5D
    L5B --> L5A
    L5C --> L1B
    L5D --> L1A
    
    style L2A fill:#E1F5FF
    style L2B fill:#E1F5FF
    style L3A fill:#FFF4E1
    style L4A fill:#F0E1FF
    style L5A fill:#FFE1F5
```

## How to View These Diagrams

### Option 1: GitHub/GitLab
- These Mermaid diagrams will render automatically in GitHub/GitLab markdown files

### Option 2: VS Code
- Install "Markdown Preview Mermaid Support" extension
- Open this file and use markdown preview

### Option 3: Online Tools
- Copy diagram code to [Mermaid Live Editor](https://mermaid.live/)
- Or use [Mermaid.ink](https://mermaid.ink/) for image generation

### Option 4: Documentation Tools
- Many documentation platforms (Notion, Confluence, etc.) support Mermaid
- Can be exported as PNG/SVG from Mermaid Live Editor

## Diagram Types Explained

1. **System Architecture**: Shows all components and their relationships
2. **Genetic Algorithm Flow**: Detailed GA process flow
3. **ML Recommendation System**: How the recommendation engine works
4. **Spatial Reasoning**: Constraint validation and optimization
5. **Complete System Flow**: End-to-end sequence diagram
6. **Theoretical Framework Layers**: Layered architecture view

