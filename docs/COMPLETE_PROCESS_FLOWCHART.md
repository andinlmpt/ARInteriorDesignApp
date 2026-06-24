# Complete Process Flowchart - AR Interior Design App

## 1. Main User Journey Flowchart

```mermaid
flowchart TD
    START([User Opens App]) --> LOGIN{User Logged In?}
    LOGIN -->|No| LOGIN_SCREEN[Login/Signup Screen]
    LOGIN -->|Yes| HOME[Home Screen]
    LOGIN_SCREEN --> AUTH{Authentication}
    AUTH -->|Success| HOME
    AUTH -->|Fail| LOGIN_SCREEN
    
    HOME --> CHOICE{User Action}
    CHOICE -->|Create Project| CREATE_PROJ[Create Project Flow]
    CHOICE -->|AI Design| AI_DESIGN[AI Design Screen]
    CHOICE -->|AR Scan| AR_SCAN[AR Room Scan]
    CHOICE -->|Theme Recommend| THEME[Theme Recommendation]
    CHOICE -->|View Saved| SAVED[Saved Designs]
    
    CREATE_PROJ --> PROJ_STEPS[4-Step Project Creation]
    PROJ_STEPS --> PROJ_DONE{Project Created?}
    PROJ_DONE -->|Yes| CONFIRM[Confirmation Dialog]
    PROJ_DONE -->|No| PROJ_STEPS
    CONFIRM -->|Start Designing| AI_DESIGN
    CONFIRM -->|Go Home| HOME
    
    AR_SCAN --> SCAN_START[Start Spatial Mapping]
    SCAN_START --> PLANE_DETECT[Plane Detection]
    PLANE_DETECT --> ROOM_UNDERSTAND[Room Understanding]
    ROOM_UNDERSTAND --> ROOM_DATA[Room Dimensions & Data]
    ROOM_DATA --> AI_DESIGN
    
    THEME --> THEME_INPUT[User Preferences Input]
    THEME_INPUT --> THEME_ML[ML Recommendation System]
    THEME_ML --> THEME_OUT[Theme Recommendations]
    THEME_OUT --> THEME_SELECT{User Selects Theme?}
    THEME_SELECT -->|Yes| AI_DESIGN
    THEME_SELECT -->|No| HOME
    
    AI_DESIGN --> AI_INPUT[Input Design Preferences]
    AI_INPUT --> AI_GENERATE[Generate Designs]
    
    style START fill:#90EE90
    style HOME fill:#E1F5FF
    style AI_DESIGN fill:#FFE1F5
    style AI_GENERATE fill:#FFB6C1
```

## 2. AI Design Generation Flowchart (Detailed)

```mermaid
flowchart TD
    START([User Clicks Generate]) --> VALIDATE{Validate Inputs}
    VALIDATE -->|Invalid| ERROR[Show Error Message]
    ERROR --> START
    VALIDATE -->|Valid| CHECK_API{API Key Available?}
    
    CHECK_API -->|No| API_ERROR[Show API Key Error]
    API_ERROR --> START
    CHECK_API -->|Yes| SET_PREFS[Set Design Preferences]
    
    SET_PREFS --> SET_CONST[Set Design Constraints]
    SET_CONST --> SET_OPT[Set Optimization Options]
    
    SET_OPT --> INIT_GA[Initialize Genetic Algorithm]
    INIT_GA --> INIT_POP[Initialize Population<br/>Size: 20 layouts]
    
    INIT_POP --> GA_LOOP[GA Optimization Loop]
    GA_LOOP --> EVAL_FIT[Evaluate Fitness<br/>Multi-objective Scoring]
    EVAL_FIT --> SORT_FIT[Sort by Fitness]
    SORT_FIT --> SELECT_ELITE[Select Elite<br/>Top 3 layouts]
    
    SELECT_ELITE --> CHECK_ITER{Iteration < 100<br/>AND<br/>Fitness < 0.95?}
    
    CHECK_ITER -->|Yes| TOURNAMENT[Tournament Selection<br/>Select Parents]
    TOURNAMENT --> CROSS_CHECK{Crossover?<br/>Rate: 0.7}
    CROSS_CHECK -->|Yes| CROSSOVER[Crossover Operation<br/>Combine Parent Layouts]
    CROSS_CHECK -->|No| COPY_PARENT[Copy Parent]
    CROSSOVER --> MUTATE[Mutation Operation<br/>Rate: 0.15]
    COPY_PARENT --> MUTATE
    MUTATE --> VALIDATE_CONST[Validate Constraints]
    VALIDATE_CONST --> SPATIAL_CHECK{Spatial Validation}
    SPATIAL_CHECK -->|Fail| MUTATE
    SPATIAL_CHECK -->|Pass| GA_LOOP
    
    CHECK_ITER -->|No| RANK_PROP[Rank Final Proposals]
    RANK_PROP --> SCORE_PERF[Calculate Performance Scores]
    SCORE_PERF --> CREATE_PROP[Create Design Proposals]
    
    CREATE_PROP --> TRACK_USAGE[Track User Usage]
    TRACK_USAGE --> UPDATE_HIST[Update User History]
    UPDATE_HIST --> TRAIN_AI[Train AI from User Data]
    TRAIN_AI --> REFINE_MODEL[Refine Model]
    
    REFINE_MODEL --> DISPLAY_PROP[Display Proposals to User]
    DISPLAY_PROP --> GEN_IMG{Generate Images?}
    
    GEN_IMG -->|Yes| IMG_LOOP[Image Generation Loop]
    IMG_LOOP --> IMG_BATCH[Process Batch<br/>Size: 2-3 images]
    IMG_BATCH --> IMG_API[Call DALL-E API]
    IMG_API --> IMG_CHECK{Success?}
    IMG_CHECK -->|No| IMG_ERROR[Log Error]
    IMG_ERROR --> IMG_NEXT{More Proposals?}
    IMG_CHECK -->|Yes| SAVE_IMG[Save Image URL]
    SAVE_IMG --> IMG_NEXT
    IMG_NEXT -->|Yes| IMG_LOOP
    IMG_NEXT -->|No| UPDATE_UI[Update UI with Images]
    
    GEN_IMG -->|No| UPDATE_UI
    UPDATE_UI --> USER_VIEW[User Views Designs]
    USER_VIEW --> USER_FEEDBACK{User Feedback?}
    
    USER_FEEDBACK -->|Like/Dislike| UPDATE_LEARN[Update Learning System]
    USER_FEEDBACK -->|Save| SAVE_DESIGN[Save to Saved Designs]
    USER_FEEDBACK -->|Regenerate| START
    USER_FEEDBACK -->|Exit| END([End])
    
    UPDATE_LEARN --> REFINE_MODEL
    SAVE_DESIGN --> END
    
    style START fill:#90EE90
    style END fill:#90EE90
    style EVAL_FIT fill:#FFE4B5
    style CROSSOVER fill:#E1F5FF
    style MUTATE fill:#FFE1F5
    style SPATIAL_CHECK fill:#FFF4E1
    style IMG_API fill:#F0E1FF
    style USER_FEEDBACK fill:#E1FFE1
```

## 3. Genetic Algorithm Detailed Flowchart

```mermaid
flowchart TD
    START([GA Start]) --> INIT[Initialize Population<br/>N = 20 layouts]
    INIT --> GEN_RAND[Generate Random Layouts]
    GEN_RAND --> GEN_FURN[Generate Random Furniture]
    GEN_FURN --> VALID_POS[Validate Positions]
    VALID_POS --> CHECK_VALID{Valid?}
    CHECK_VALID -->|No| GEN_FURN
    CHECK_VALID -->|Yes| POP_READY[Population Ready]
    
    POP_READY --> ITER_START[Start Iteration Loop<br/>Max: 100]
    ITER_START --> EVAL_ALL[Evaluate All Layouts]
    EVAL_ALL --> CALC_FIT[Calculate Fitness<br/>Multi-objective]
    CALC_FIT --> SCORE_SPACE[Space Efficiency Score]
    SCORE_SPACE --> SCORE_COMFORT[Comfort Score]
    SCORE_COMFORT --> SCORE_AEST[Aesthetics Score]
    SCORE_AEST --> SCORE_ACCESS[Accessibility Score]
    SCORE_ACCESS --> SCORE_ERGO[Ergonomics Score]
    SCORE_ERGO --> WEIGHT_SCORE[Apply Weights<br/>Based on Goal]
    WEIGHT_SCORE --> TOTAL_FIT[Total Fitness Score]
    
    TOTAL_FIT --> SORT_POP[Sort Population by Fitness]
    SORT_POP --> SELECT_ELITE[Select Elite<br/>Top 3]
    SELECT_ELITE --> CHECK_CONV{Converged?<br/>Avg Fitness > 0.95}
    
    CHECK_CONV -->|Yes| FINAL_RANK[Final Ranking]
    CHECK_CONV -->|No| CHECK_ITER{Iteration < 100?}
    CHECK_ITER -->|No| FINAL_RANK
    CHECK_ITER -->|Yes| NEW_GEN[Create New Generation]
    
    NEW_GEN --> ADD_ELITE[Add Elite to New Gen]
    ADD_ELITE --> GEN_LOOP{New Gen Size < 20?}
    GEN_LOOP -->|Yes| TOURNAMENT[Tournament Selection<br/>Size: 3]
    TOURNAMENT --> SELECT_PARENT1[Select Parent 1]
    SELECT_PARENT1 --> SELECT_PARENT2[Select Parent 2]
    SELECT_PARENT2 --> CROSS_DEC{Crossover?<br/>Rate: 0.7}
    
    CROSS_DEC -->|Yes| CROSSOVER[Crossover Operation]
    CROSSOVER --> COMBINE_FURN[Combine Furniture from Parents]
    COMBINE_FURN --> COMBINE_POS[Combine Positions]
    COMBINE_POS --> OFFSPRING[Create Offspring]
    
    CROSS_DEC -->|No| OFFSPRING
    OFFSPRING --> MUTATE_DEC{Mutate?<br/>Rate: 0.15}
    MUTATE_DEC -->|Yes| MUTATE[Mutation Operation]
    MUTATE --> MUTATE_POS[Random Position Change]
    MUTATE_POS --> MUTATE_ROT[Random Rotation Change]
    MUTATE_ROT --> MUTATED[Mutated Layout]
    MUTATE_DEC -->|No| MUTATED
    
    MUTATED --> VALIDATE_NEW[Validate New Layout]
    VALIDATE_NEW --> CHECK_BOUND[Check Boundaries]
    CHECK_BOUND --> CHECK_COLL[Check Collisions]
    CHECK_COLL --> CHECK_ERGO[Check Ergonomics]
    CHECK_ERGO --> VALID_NEW{Valid?}
    
    VALID_NEW -->|No| GEN_LOOP
    VALID_NEW -->|Yes| ADD_NEW[Add to New Generation]
    ADD_NEW --> GEN_LOOP
    
    GEN_LOOP -->|No| ITER_START
    FINAL_RANK --> RANK_BEST[Rank by Fitness]
    RANK_BEST --> SELECT_TOP[Select Top N<br/>N = Variations]
    SELECT_TOP --> OUTPUT([Output Best Layouts])
    
    style START fill:#90EE90
    style OUTPUT fill:#90EE90
    style CALC_FIT fill:#FFE4B5
    style CROSSOVER fill:#E1F5FF
    style MUTATE fill:#FFE1F5
    style VALIDATE_NEW fill:#FFF4E1
```

## 4. Image Generation Flowchart

```mermaid
flowchart TD
    START([Design Proposals Ready]) --> CHECK_IMG{Generate Images?}
    CHECK_IMG -->|No| END([Skip Images])
    CHECK_IMG -->|Yes| CHECK_API{API Key Valid?}
    
    CHECK_API -->|No| API_ERROR[Show API Key Error]
    API_ERROR --> END
    CHECK_API -->|Yes| SORT_PROP[Sort Proposals by Score]
    SORT_PROP --> SELECT_TOP[Select Top Proposals]
    SELECT_TOP --> BATCH_SIZE[Set Batch Size<br/>2-3 images]
    
    BATCH_SIZE --> BATCH_LOOP[Batch Processing Loop]
    BATCH_LOOP --> GET_PROP[Get Next Proposal]
    GET_PROP --> BUILD_PROMPT[Build Image Prompt]
    BUILD_PROMPT --> EXTRACT_FURN[Extract Furniture List]
    EXTRACT_FURN --> EXTRACT_COLORS[Extract Color Palette]
    EXTRACT_COLORS --> EXTRACT_STYLE[Extract Style Descriptors]
    EXTRACT_STYLE --> EXTRACT_BUDGET[Extract Budget Quality]
    EXTRACT_BUDGET --> COMBINE_PROMPT[Combine into Prompt<br/>Max: 1000 chars]
    
    COMBINE_PROMPT --> CALL_API[Call DALL-E 3 API]
    CALL_API --> RETRY_CHECK{Retry Needed?<br/>Max: 2 retries}
    RETRY_CHECK -->|Yes| WAIT_RETRY[Wait & Retry]
    WAIT_RETRY --> CALL_API
    RETRY_CHECK -->|No| CHECK_RESPONSE{Response OK?}
    
    CHECK_RESPONSE -->|No| HANDLE_ERROR[Handle Error]
    HANDLE_ERROR --> ERROR_TYPE{Error Type?}
    ERROR_TYPE -->|Rate Limit| WAIT_RATE[Wait for Rate Limit]
    WAIT_RATE --> CALL_API
    ERROR_TYPE -->|Invalid Key| API_ERROR
    ERROR_TYPE -->|Network| WAIT_NET[Wait & Retry]
    WAIT_NET --> CALL_API
    ERROR_TYPE -->|Other| LOG_ERROR[Log Error]
    LOG_ERROR --> NEXT_PROP{More Proposals?}
    
    CHECK_RESPONSE -->|Yes| EXTRACT_URL[Extract Image URL]
    EXTRACT_URL --> EXTRACT_REVISED[Extract Revised Prompt]
    EXTRACT_REVISED --> SAVE_IMG[Save Image Data]
    SAVE_IMG --> UPDATE_UI[Update UI with Image]
    UPDATE_UI --> NEXT_PROP
    
    NEXT_PROP -->|Yes| BATCH_LOOP
    NEXT_PROP -->|No| CHECK_BATCH{More Batches?}
    CHECK_BATCH -->|Yes| WAIT_BATCH[Wait for Batch Complete]
    WAIT_BATCH --> BATCH_LOOP
    CHECK_BATCH -->|No| ALL_DONE[All Images Generated]
    ALL_DONE --> END
    
    style START fill:#90EE90
    style END fill:#90EE90
    style CALL_API fill:#F0E1FF
    style BUILD_PROMPT fill:#FFE4B5
    style ERROR_TYPE fill:#FFB6C1
```

## 5. Spatial Validation Flowchart

```mermaid
flowchart TD
    START([Layout to Validate]) --> GET_ROOM[Get Room Dimensions]
    GET_ROOM --> GET_FURN[Get Furniture Items]
    GET_FURN --> GET_CONST[Get Constraints]
    
    GET_CONST --> VALID_LOOP[Validation Loop<br/>For Each Furniture]
    VALID_LOOP --> GET_ITEM[Get Furniture Item]
    GET_ITEM --> CHECK_BOUND[Check Room Boundaries]
    
    CHECK_BOUND --> BOUND_X{Within X Bounds?<br/>+ Wall Clearance}
    BOUND_X -->|No| INVALID_BOUND[Invalid: Out of Bounds]
    BOUND_X -->|Yes| BOUND_Z{Within Z Bounds?<br/>+ Wall Clearance}
    BOUND_Z -->|No| INVALID_BOUND
    BOUND_Z -->|Yes| BOUND_Y{Within Y Bounds?<br/>Height Check}
    BOUND_Y -->|No| INVALID_BOUND
    BOUND_Y -->|Yes| CHECK_COLL[Check Collisions]
    
    CHECK_COLL --> COLL_LOOP[Check Against Other Items]
    COLL_LOOP --> GET_OTHER[Get Other Furniture]
    GET_OTHER --> CALC_DIST[Calculate Distance]
    CALC_DIST --> CHECK_MIN{Min Distance<br/>> 0.6m?}
    CHECK_MIN -->|No| INVALID_COLL[Invalid: Collision]
    CHECK_MIN -->|Yes| NEXT_OTHER{More Items?}
    NEXT_OTHER -->|Yes| COLL_LOOP
    NEXT_OTHER -->|No| CHECK_WALKWAY[Check Walkway Clearance]
    
    CHECK_WALKWAY --> WALK_CHECK{Walkway Clearance<br/>> 0.9m?}
    WALK_CHECK -->|No| INVALID_WALK[Invalid: Walkway Too Narrow]
    WALK_CHECK -->|Yes| CHECK_DOOR[Check Door Clearance]
    
    CHECK_DOOR --> DOOR_CHECK{Door Clearance<br/>> 0.8m?}
    DOOR_CHECK -->|No| INVALID_DOOR[Invalid: Door Blocked]
    DOOR_CHECK -->|Yes| CHECK_ERGO[Check Ergonomics]
    
    CHECK_ERGO --> ERGO_SEAT{Seat Height<br/>0.4-0.5m?}
    ERGO_SEAT -->|No| INVALID_ERGO[Invalid: Ergonomic Violation]
    ERGO_SEAT -->|Yes| ERGO_TABLE{Table Height<br/>0.7-0.76m?}
    ERGO_TABLE -->|No| INVALID_ERGO
    ERGO_TABLE -->|Yes| ERGO_REACH{Reach Distance<br/>< 0.7m?}
    ERGO_REACH -->|No| INVALID_ERGO
    ERGO_REACH -->|Yes| VALID_ITEM[Item Valid]
    
    VALID_ITEM --> NEXT_ITEM{More Items?}
    NEXT_ITEM -->|Yes| VALID_LOOP
    NEXT_ITEM -->|No| ALL_VALID[All Items Valid]
    
    INVALID_BOUND --> INVALID_RESULT([Invalid Layout])
    INVALID_COLL --> INVALID_RESULT
    INVALID_WALK --> INVALID_RESULT
    INVALID_DOOR --> INVALID_RESULT
    INVALID_ERGO --> INVALID_RESULT
    ALL_VALID --> VALID_RESULT([Valid Layout])
    
    style START fill:#90EE90
    style VALID_RESULT fill:#90EE90
    style INVALID_RESULT fill:#FFB6C1
    style CHECK_BOUND fill:#FFE4B5
    style CHECK_COLL fill:#E1F5FF
    style CHECK_ERGO fill:#FFF4E1
```

## 6. ML Recommendation System Flowchart

```mermaid
flowchart TD
    START([User Requests Recommendations]) --> GET_PREFS[Get User Preferences]
    GET_PREFS --> GET_HIST[Get User History]
    GET_HIST --> GET_IMG{Image Analysis<br/>Available?}
    
    GET_IMG -->|Yes| ANALYZE_IMG[Analyze Room Image]
    ANALYZE_IMG --> EXTRACT_FEAT[Extract Features]
    GET_IMG -->|No| FILTER_THEMES[Filter Theme Database]
    
    EXTRACT_FEAT --> FILTER_THEMES
    FILTER_THEMES --> FILTER_ROOM[Filter by Room Type]
    FILTER_ROOM --> FILTER_STYLE{Style Filter?}
    FILTER_STYLE -->|Yes| FILTER_STYLE_OP[Apply Style Filter]
    FILTER_STYLE -->|No| SCORE_LOOP[Score Each Theme]
    
    FILTER_STYLE_OP --> SCORE_LOOP
    SCORE_LOOP --> GET_THEME[Get Theme Template]
    GET_THEME --> SCORE_ROOM[Score Room Type Match<br/>Weight: 25%]
    SCORE_ROOM --> SCORE_MOOD[Score Mood Match<br/>Weight: 30%]
    SCORE_MOOD --> SCORE_STYLE[Score Style Match<br/>Weight: 25%]
    SCORE_STYLE --> SCORE_COLOR[Score Color Match<br/>Weight: 10%]
    SCORE_COLOR --> SCORE_MAT[Score Material Match<br/>Weight: 10%]
    SCORE_MAT --> CALC_TOTAL[Calculate Total Score]
    CALC_TOTAL --> NEXT_THEME{More Themes?}
    NEXT_THEME -->|Yes| SCORE_LOOP
    NEXT_THEME -->|No| PERSONALIZE{Personalization<br/>Enabled?}
    
    PERSONALIZE -->|Yes| APPLY_PERSON[Apply Personalization]
    APPLY_PERSON --> BOOST_LIKED[Boost Liked Themes]
    BOOST_LIKED --> REDUCE_DISLIKED[Reduce Disliked Themes]
    REDUCE_DISLIKED --> APPLY_PREFS[Apply Preferred Colors/Materials]
    APPLY_PREFS --> PERSONALIZED[Personalized Scores]
    PERSONALIZE -->|No| PERSONALIZED
    
    PERSONALIZED --> FILTER_THRESH[Filter by Threshold<br/>≥ 0.60]
    FILTER_THRESH --> SORT_SCORE[Sort by Confidence Score]
    SORT_SCORE --> SELECT_TOP[Select Top 5]
    SELECT_TOP --> CHECK_COUNT{Count > 0?}
    
    CHECK_COUNT -->|No| LOWER_THRESH[Lower Threshold]
    LOWER_THRESH --> SELECT_TOP
    CHECK_COUNT -->|Yes| CALC_CONF[Calculate Confidence Level]
    CALC_CONF --> CONF_CHECK{Avg Confidence}
    CONF_CHECK -->|> 0.85| HIGH_CONF[High Confidence]
    CONF_CHECK -->|> 0.70| MED_CONF[Medium Confidence]
    CONF_CHECK -->|≤ 0.70| LOW_CONF[Low Confidence]
    
    HIGH_CONF --> OUTPUT([Output Recommendations])
    MED_CONF --> OUTPUT
    LOW_CONF --> OUTPUT
    
    style START fill:#90EE90
    style OUTPUT fill:#90EE90
    style SCORE_LOOP fill:#FFE4B5
    style PERSONALIZE fill:#E1F5FF
    style FILTER_THRESH fill:#FFF4E1
```

## Summary of Flowcharts

1. **Main User Journey**: Complete user flow from app start to design completion
2. **AI Design Generation**: Detailed step-by-step design generation process
3. **Genetic Algorithm**: Internal GA optimization loop with all operations
4. **Image Generation**: DALL-E API integration and error handling
5. **Spatial Validation**: Complete constraint checking process
6. **ML Recommendation**: Theme recommendation system flow

All flowcharts are based on the actual codebase implementation and show the correct sequence of operations.

