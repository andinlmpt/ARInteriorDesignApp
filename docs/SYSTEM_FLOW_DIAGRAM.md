# Complete System Flow Diagram

## 1. End-to-End System Flow (High-Level)

```mermaid
flowchart TD
    START([User Opens App]) --> AUTH{Authenticated?}
    AUTH -->|No| LOGIN[Login/Signup]
    AUTH -->|Yes| HOME[Home Screen]
    LOGIN --> HOME
    
    HOME --> USER_ACTION{User Action}
    USER_ACTION -->|Create Project| CREATE[Create Project]
    USER_ACTION -->|AI Design| AI_FLOW[AI Design Flow]
    USER_ACTION -->|AR Scan| AR_FLOW[AR Scan Flow]
    USER_ACTION -->|Theme| THEME_FLOW[Theme Flow]
    
    CREATE --> PROJ_DATA[Project Data]
    PROJ_DATA --> AI_FLOW
    
    AR_FLOW --> AR_SCAN[Start AR Scanning]
    AR_SCAN --> CV_LAYER[Computer Vision Layer]
    CV_LAYER --> PLANE[Plane Detection]
    PLANE --> SPATIAL[Spatial Mapping]
    SPATIAL --> ROOM_DATA[Room Dimensions]
    ROOM_DATA --> AI_FLOW
    
    THEME_FLOW --> THEME_INPUT[User Preferences]
    THEME_INPUT --> ML_LAYER[ML Recommendation Layer]
    ML_LAYER --> THEME_OUT[Theme Recommendations]
    THEME_OUT --> AI_FLOW
    
    AI_FLOW --> AI_INPUT[Design Preferences]
    AI_INPUT --> AI_LAYER[AI/ML Layer]
    AI_LAYER --> GA[Genetic Algorithm]
    GA --> SPATIAL_LAYER[Spatial Reasoning Layer]
    SPATIAL_LAYER --> GEN_LAYER[Design Generation Layer]
    GEN_LAYER --> OUTPUT[Design Output]
    OUTPUT --> USER_VIEW[User Views Designs]
    USER_VIEW --> FEEDBACK{User Action}
    FEEDBACK -->|Like| LEARN[Learning System]
    FEEDBACK -->|Save| SAVE[Save Design]
    FEEDBACK -->|Regenerate| AI_FLOW
    FEEDBACK -->|Exit| END([End])
    
    LEARN --> UPDATE[Update Models]
    UPDATE --> AI_LAYER
    
    style START fill:#90EE90
    style END fill:#90EE90
    style AI_LAYER fill:#E1F5FF
    style SPATIAL_LAYER fill:#FFF4E1
    style GEN_LAYER fill:#FFE1F5
    style CV_LAYER fill:#F0E1FF
    style ML_LAYER fill:#E1FFE1
```

## 2. Complete System Flow with All Layers

```mermaid
flowchart TB
    subgraph "PHASE 1: Input Collection"
        USER[User] --> UI[User Interface]
        UI --> PREF[Preferences Input]
        UI --> AR_BTN[AR Scan Button]
        AR_BTN --> AR_CAM[AR Camera]
    end
    
    subgraph "PHASE 2: Environment Understanding"
        AR_CAM --> CV[Computer Vision]
        CV --> PLANE[Plane Detection]
        PLANE --> ROOM[Room Understanding]
        ROOM --> DIMENSIONS[Room Dimensions]
        ROOM --> FURNITURE_DETECT[Furniture Detection]
    end
    
    subgraph "PHASE 3: Theme Recommendation"
        PREF --> ML_INPUT[ML Input Processing]
        ML_INPUT --> FEATURE[Feature Extraction]
        FEATURE --> WEIGHT[Weighted Scoring<br/>25/30/25/10/10]
        WEIGHT --> PERSONAL[Personalization]
        PERSONAL --> THEME_REC[Theme Recommendations]
    end
    
    subgraph "PHASE 4: Design Generation"
        DIMENSIONS --> GA_INIT[GA Initialization]
        PREF --> GA_INIT
        THEME_REC --> GA_INIT
        
        GA_INIT --> POP[Initialize Population<br/>N=20]
        POP --> GA_LOOP[GA Optimization Loop]
        
        GA_LOOP --> SPATIAL_IN[Spatial Reasoning Input]
        SPATIAL_IN --> CONSTRAINTS[Constraint Validation]
        CONSTRAINTS --> COLLISION[Collision Detection]
        COLLISION --> GEOMETRIC[Geometric Optimization]
        GEOMETRIC --> MULTI_OBJ[Multi-Objective Evaluation]
        
        MULTI_OBJ --> FITNESS[Fitness Calculation]
        FITNESS --> SELECT[Selection & Crossover]
        SELECT --> MUTATE[Mutation]
        MUTATE --> VALIDATE[Validate Constraints]
        VALIDATE -->|Invalid| MUTATE
        VALIDATE -->|Valid| GA_LOOP
        
        GA_LOOP -->|Converged| RANK[Rank Proposals]
        RANK --> SCORE[Performance Scoring]
    end
    
    subgraph "PHASE 5: Image Generation"
        SCORE --> IMG_INPUT[Image Generation Input]
        IMG_INPUT --> PROMPT[Build Prompt]
        PROMPT --> DALL_E[DALL-E 3 API]
        DALL_E --> IMG_OUT[Design Images]
    end
    
    subgraph "PHASE 6: Output & Learning"
        IMG_OUT --> DISPLAY[Display to User]
        SCORE --> DISPLAY
        DISPLAY --> USER_VIEW[User Views]
        USER_VIEW --> FEEDBACK{User Feedback}
        
        FEEDBACK -->|Like| TRACK[Track Usage]
        FEEDBACK -->|Dislike| TRACK
        FEEDBACK -->|Save| SAVE[Save Design]
        FEEDBACK -->|Regenerate| GA_INIT
        
        TRACK --> HISTORY[Update User History]
        HISTORY --> TRAIN[Train AI Model]
        TRAIN --> REFINE[Refine Model]
        REFINE --> ML_INPUT
    end
    
    style USER fill:#90EE90
    style GA_LOOP fill:#E1F5FF
    style CONSTRAINTS fill:#FFF4E1
    style DALL_E fill:#F0E1FF
    style FEEDBACK fill:#E1FFE1
```

## 3. Data Flow Through System Layers

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant UI as UI Layer
    participant CV as Computer Vision
    participant SPAT as Spatial Mapping
    participant ML as ML Recommendation
    participant GA as Genetic Algorithm
    participant SR as Spatial Reasoning
    participant GEN as Layout Generator
    participant SCORE as Performance Scorer
    participant IMG as Image Generator
    participant LEARN as Learning System
    
    Note over U,LEARN: Phase 1: Input Collection
    U->>UI: Open App & Navigate
    U->>UI: Start AR Scan (Optional)
    UI->>CV: Activate Camera
    CV->>CV: Detect Planes
    CV->>SPAT: Plane Data
    SPAT->>SPAT: Calculate Dimensions
    SPAT->>UI: Room Dimensions
    
    U->>UI: Enter Preferences
    UI->>ML: User Preferences
    
    Note over U,LEARN: Phase 2: Theme Recommendation
    ML->>ML: Extract Features
    ML->>ML: Calculate Scores
    ML->>ML: Apply Personalization
    ML->>UI: Theme Recommendations
    UI->>U: Display Themes
    
    Note over U,LEARN: Phase 3: Design Generation
    U->>UI: Generate Designs
    UI->>GA: Preferences + Room Data
    GA->>GA: Initialize Population (20)
    
    loop GA Optimization (Max 100 iterations)
        GA->>SR: Validate Constraints
        SR->>SR: Check Boundaries
        SR->>SR: Check Collisions
        SR->>SR: Check Ergonomics
        SR->>GA: Validation Result
        
        GA->>GA: Calculate Fitness
        GA->>GA: Select Elite (Top 3)
        GA->>GA: Tournament Selection
        GA->>GA: Crossover (70% rate)
        GA->>GA: Mutation (15% rate)
    end
    
    GA->>GEN: Optimized Layouts
    GEN->>GEN: Apply Themes
    GEN->>SCORE: Layout Proposals
    SCORE->>SCORE: Multi-objective Scoring
    SCORE->>UI: Ranked Proposals
    
    Note over U,LEARN: Phase 4: Image Generation
    UI->>IMG: Generate Images
    IMG->>IMG: Build Prompts
    IMG->>IMG: Call DALL-E API
    IMG->>UI: Design Images
    
    Note over U,LEARN: Phase 5: Display & Learning
    UI->>U: Display Complete Designs
    U->>UI: User Feedback
    UI->>LEARN: Track Usage
    LEARN->>LEARN: Update History
    LEARN->>LEARN: Train Model
    LEARN->>LEARN: Refine Model
    LEARN->>ML: Updated Model
```

## 4. Component Interaction Flow

```mermaid
graph LR
    subgraph "User Interface"
        UI[UI Components]
        AR_VIEW[AR View]
        DISPLAY[Display Screen]
    end
    
    subgraph "Service Layer"
        PROJ_SVC[ProjectService]
        THEME_SVC[ThemeRecommendationService]
        AI_SVC[GenerativeAIDesignService]
        SPATIAL_SVC[SpatialMappingService]
        IMG_SVC[DesignImageGenerationService]
        PREF_SVC[UserPreferenceService]
        TRAIN_SVC[AITrainingService]
    end
    
    subgraph "Data Layer"
        STORAGE[AsyncStorage]
        CACHE[Cache]
        HISTORY[User History]
    end
    
    subgraph "External APIs"
        DALL_E_API[DALL-E 3 API]
        BACKEND_API[Backend API]
    end
    
    UI --> PROJ_SVC
    UI --> THEME_SVC
    UI --> AI_SVC
    AR_VIEW --> SPATIAL_SVC
    
    THEME_SVC --> STORAGE
    THEME_SVC --> HISTORY
    AI_SVC --> SPATIAL_SVC
    AI_SVC --> BACKEND_API
    IMG_SVC --> DALL_E_API
    
    AI_SVC --> PREF_SVC
    PREF_SVC --> TRAIN_SVC
    TRAIN_SVC --> STORAGE
    TRAIN_SVC --> HISTORY
    
    AI_SVC --> CACHE
    IMG_SVC --> CACHE
    
    AI_SVC --> DISPLAY
    IMG_SVC --> DISPLAY
    THEME_SVC --> DISPLAY
    
    style UI fill:#E1F5FF
    style AI_SVC fill:#FFE1F5
    style SPATIAL_SVC fill:#FFF4E1
    style IMG_SVC fill:#F0E1FF
    style DALL_E_API fill:#FFB6C1
```

## 5. System Flow with Decision Points

```mermaid
flowchart TD
    START([System Start]) --> INIT[Initialize Services]
    INIT --> WAIT_USER[Wait for User Input]
    
    WAIT_USER --> USER_INPUT{User Input Type}
    
    USER_INPUT -->|AR Scan| AR_FLOW[AR Flow]
    USER_INPUT -->|Create Project| PROJ_FLOW[Project Flow]
    USER_INPUT -->|Theme Recommend| THEME_FLOW[Theme Flow]
    USER_INPUT -->|Generate Design| DESIGN_FLOW[Design Flow]
    
    AR_FLOW --> AR_SCAN[Start Scanning]
    AR_SCAN --> PLANE_DETECT[Plane Detection]
    PLANE_DETECT --> PLANE_CHECK{Planes Found?}
    PLANE_CHECK -->|No| AR_SCAN
    PLANE_CHECK -->|Yes| ROOM_CALC[Calculate Room Data]
    ROOM_CALC --> STORE_ROOM[Store Room Data]
    STORE_ROOM --> WAIT_USER
    
    PROJ_FLOW --> PROJ_STEPS[4-Step Creation]
    PROJ_STEPS --> PROJ_SAVE[Save Project]
    PROJ_SAVE --> WAIT_USER
    
    THEME_FLOW --> THEME_INPUT[Get Preferences]
    THEME_INPUT --> THEME_ML[ML Processing]
    THEME_ML --> THEME_DISPLAY[Display Themes]
    THEME_DISPLAY --> WAIT_USER
    
    DESIGN_FLOW --> VALIDATE_INPUT{Validate Inputs}
    VALIDATE_INPUT -->|Invalid| ERROR[Show Error]
    ERROR --> WAIT_USER
    VALIDATE_INPUT -->|Valid| CHECK_CACHE{Check Cache}
    
    CHECK_CACHE -->|Found| USE_CACHE[Use Cached Design]
    USE_CACHE --> DISPLAY_CACHE[Display Cached]
    DISPLAY_CACHE --> WAIT_USER
    
    CHECK_CACHE -->|Not Found| CHECK_API{API Key Valid?}
    CHECK_API -->|No| API_ERROR[Show API Error]
    API_ERROR --> WAIT_USER
    CHECK_API -->|Yes| START_GA[Start GA]
    
    START_GA --> GA_PROCESS[GA Process]
    GA_PROCESS --> GA_CHECK{Converged?}
    GA_CHECK -->|No| GA_PROCESS
    GA_CHECK -->|Yes| GEN_LAYOUTS[Generate Layouts]
    
    GEN_LAYOUTS --> SCORE_LAYOUTS[Score Layouts]
    SCORE_LAYOUTS --> RANK_LAYOUTS[Rank Layouts]
    RANK_LAYOUTS --> GEN_IMG{Generate Images?}
    
    GEN_IMG -->|Yes| IMG_PROCESS[Image Generation]
    IMG_PROCESS --> IMG_CHECK{Success?}
    IMG_CHECK -->|No| IMG_ERROR[Log Error]
    IMG_ERROR --> DISPLAY_NO_IMG[Display Without Images]
    IMG_CHECK -->|Yes| DISPLAY_WITH_IMG[Display With Images]
    
    GEN_IMG -->|No| DISPLAY_NO_IMG
    DISPLAY_WITH_IMG --> USER_ACTION{User Action}
    DISPLAY_NO_IMG --> USER_ACTION
    
    USER_ACTION -->|Like| UPDATE_LIKE[Update Preferences]
    USER_ACTION -->|Dislike| UPDATE_DISLIKE[Update Preferences]
    USER_ACTION -->|Save| SAVE_DESIGN[Save to Storage]
    USER_ACTION -->|Regenerate| DESIGN_FLOW
    USER_ACTION -->|Exit| WAIT_USER
    
    UPDATE_LIKE --> TRAIN_MODEL[Train Model]
    UPDATE_DISLIKE --> TRAIN_MODEL
    SAVE_DESIGN --> WAIT_USER
    TRAIN_MODEL --> REFINE[Refine Model]
    REFINE --> WAIT_USER
    
    style START fill:#90EE90
    style GA_PROCESS fill:#E1F5FF
    style GEN_LAYOUTS fill:#FFE1F5
    style IMG_PROCESS fill:#F0E1FF
    style USER_ACTION fill:#E1FFE1
```

## 6. System Flow Summary Table

| Phase | Component | Input | Process | Output | Next Phase |
|-------|-----------|-------|---------|--------|------------|
| **1. Input** | UI Layer | User Actions | Collect Preferences | Preferences Data | Phase 2/3 |
| **2. AR Scan** | CV Layer | Camera Feed | Plane Detection | Room Dimensions | Phase 4 |
| **3. Theme** | ML Layer | User Preferences | Weighted Scoring | Theme Recommendations | Phase 4 |
| **4. Design** | GA + Spatial | Preferences + Room | Genetic Algorithm | Layout Proposals | Phase 5 |
| **5. Images** | Image Service | Layout Proposals | DALL-E API | Design Images | Phase 6 |
| **6. Learning** | Learning System | User Feedback | Model Training | Refined Model | Phase 3 |

## 7. Key Flow Characteristics

### **Linear Flow (Main Path)**
```
User Input → Theme Recommendation → Design Generation → Image Generation → Display
```

### **Parallel Processing**
- Theme recommendation can run in parallel with AR scanning
- Multiple layout proposals generated simultaneously
- Batch image generation (2-3 at a time)

### **Feedback Loops**
1. **Short Loop**: User feedback → Model refinement → Next recommendation
2. **Long Loop**: User feedback → Training → Model update → All future generations

### **Caching & Optimization**
- Design results cached for 24 hours
- Offline mode support with cached data
- Batch processing for memory management

### **Error Handling Flow**
```
Error → Retry (Max 2-3 times) → Fallback → User Notification → Continue/Abort
```

## 8. System Flow Metrics

| Metric | Value | Location |
|--------|-------|----------|
| **GA Population Size** | 20 layouts | GenerativeAIDesignService |
| **GA Max Iterations** | 100 | GenerativeAIDesignService |
| **Crossover Rate** | 70% | GenerativeAIDesignService |
| **Mutation Rate** | 15% | GenerativeAIDesignService |
| **Elite Count** | 3 | GenerativeAIDesignService |
| **Image Batch Size** | 2-3 images | ai-design.tsx |
| **Cache Duration** | 24 hours | ai-design.tsx |
| **Max Retries** | 2-3 attempts | Multiple services |
| **Theme Threshold** | 0.60 | ThemeRecommendationService |

## Summary

The system flows through **6 main phases**:
1. **Input Collection** - User preferences and AR scanning
2. **Environment Understanding** - Computer vision and spatial mapping
3. **Theme Recommendation** - ML-based personalization
4. **Design Generation** - Genetic algorithm with spatial reasoning
5. **Image Generation** - DALL-E API integration
6. **Learning & Refinement** - Continuous improvement from feedback

The flow includes **parallel processing**, **caching**, **error handling**, and **feedback loops** for continuous learning and optimization.

