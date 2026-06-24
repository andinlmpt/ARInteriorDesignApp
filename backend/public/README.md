# AR Interior Design App - Web View

## Overview

This web view provides an interactive interface to explore and visualize the MongoDB document model for the AR Interior Design App system.

## Features

- **Overview Tab**: System overview with architecture diagram
- **Collections Tab**: Detailed view of each MongoDB collection with schema and indexes
- **Relationships Tab**: Visual representation of collection relationships
- **Examples Tab**: MongoDB query examples

## Accessing the Web View

1. Start the backend server:
   ```bash
   cd backend
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/
   ```

## Collections

The web view displays information about the following MongoDB collections:

1. **users** - User accounts with embedded preferences
2. **projects** - Design projects with room specifications
3. **layouts** - Generated layouts with embedded furniture and images
4. **themes** - Design themes with color palettes and materials
5. **spatial_mappings** - AR scan data with detected planes and obstacles

## Technologies Used

- HTML5
- CSS3 (with modern gradients and animations)
- Vanilla JavaScript
- Mermaid.js (for diagram rendering)

## File Structure

```
public/
├── index.html    # Main HTML file
├── styles.css    # Styling
├── app.js        # Interactive functionality
└── README.md     # This file
```

