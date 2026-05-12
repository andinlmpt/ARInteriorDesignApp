# Save Functionality Guide

## Overview

The save functionality has been fully integrated into the app, allowing users to save furniture items, designs, projects, and themes to their saved items list.

---

## Components & Hooks

### 1. `useSaveItem` Hook

A reusable hook for saving/unsaving items anywhere in the app.

**Location:** `frontend/hooks/useSaveItem.ts`

**Usage:**
```typescript
import { useSaveItem } from '@/hooks/useSaveItem';

function MyComponent() {
  const { saveItem, unsaveItem, toggleSave, checkIfSaved, isSaving } = useSaveItem();

  const handleSave = async () => {
    const success = await saveItem({
      id: 'item-123',
      name: 'Modern Sofa',
      type: 'furniture',
      price: '$1,299',
      iconName: 'bed-outline',
      iconColor: '#6366F1',
      description: 'Comfortable modern sofa',
    }, {
      showAlert: true, // Show success/error alerts
      onSaved: () => {
        console.log('Item saved!');
      },
    });
  };

  return (
    <Button onPress={handleSave} disabled={isSaving}>
      {isSaving ? 'Saving...' : 'Save Item'}
    </Button>
  );
}
```

**API:**
- `saveItem(item, options?)` - Save an item
- `unsaveItem(itemId, itemName?, options?)` - Remove an item from saved
- `toggleSave(item, options?)` - Toggle save/unsave status
- `checkIfSaved(itemId)` - Check if item is saved
- `isSaving` - Loading state
- `isChecking` - Checking state

---

### 2. `SaveButton` Component

A ready-to-use button component for saving items.

**Location:** `frontend/components/SaveButton.tsx`

**Usage:**
```typescript
import { SaveButton } from '@/components/SaveButton';
import { furnitureToSavedItem } from '@/utils/saveItemHelpers';

function FurnitureCard({ furniture }) {
  return (
    <View>
      <Text>{furniture.name}</Text>
      <SaveButton
        itemId={furniture.id}
        item={furnitureToSavedItem(furniture)}
        size={24}
        showLabel={false}
        onSaved={() => console.log('Saved!')}
        onUnsaved={() => console.log('Unsaved!')}
      />
    </View>
  );
}
```

**Props:**
- `itemId` (string) - Unique item identifier
- `item` (object) - Item data to save
- `size` (number, optional) - Icon size (default: 24)
- `showLabel` (boolean, optional) - Show "Save"/"Saved" text (default: false)
- `onSaved` (function, optional) - Callback when item is saved
- `onUnsaved` (function, optional) - Callback when item is unsaved

---

### 3. Helper Functions

**Location:** `frontend/utils/saveItemHelpers.ts`

Convert different item types to saved item format:

```typescript
import {
  furnitureToSavedItem,
  projectToSavedItem,
  designToSavedItem,
  themeToSavedItem,
} from '@/utils/saveItemHelpers';

// Convert furniture
const savedItem = furnitureToSavedItem(furnitureLibraryItem);

// Convert project
const savedItem = projectToSavedItem(project);

// Convert design
const savedItem = designToSavedItem(design);

// Convert theme
const savedItem = themeToSavedItem(theme);
```

---

## Integration Examples

### Example 1: Save Furniture from AR View

```typescript
import { SaveButton } from '@/components/SaveButton';
import { furnitureToSavedItem } from '@/utils/saveItemHelpers';
import { FURNITURE_LIBRARY } from '@/constants/furniture-library';

function FurnitureListItem({ furnitureId }) {
  const furniture = FURNITURE_LIBRARY.find(f => f.id === furnitureId);
  
  if (!furniture) return null;

  return (
    <View style={styles.item}>
      <Text>{furniture.name}</Text>
      <Text>{furniture.price}</Text>
      <SaveButton
        itemId={furniture.id}
        item={furnitureToSavedItem(furniture)}
      />
    </View>
  );
}
```

### Example 2: Save Project

```typescript
import { useSaveItem } from '@/hooks/useSaveItem';
import { projectToSavedItem } from '@/utils/saveItemHelpers';

function ProjectCard({ project }) {
  const { saveItem, isSaving } = useSaveItem();

  const handleSave = async () => {
    const savedItem = projectToSavedItem(project);
    await saveItem(savedItem);
  };

  return (
    <TouchableOpacity onPress={handleSave} disabled={isSaving}>
      <Ionicons name="bookmark-outline" />
      <Text>{isSaving ? 'Saving...' : 'Save Project'}</Text>
    </TouchableOpacity>
  );
}
```

### Example 3: Save Design from AI Design Screen

```typescript
import { SaveButton } from '@/components/SaveButton';
import { designToSavedItem } from '@/utils/saveItemHelpers';

function DesignCard({ design }) {
  return (
    <View>
      <Image source={{ uri: design.imageUrl }} />
      <Text>{design.name}</Text>
      <SaveButton
        itemId={design.id}
        item={designToSavedItem(design)}
        showLabel={true}
      />
    </View>
  );
}
```

---

## Saved Items Service

**Location:** `frontend/services/SavedItemsService.ts`

The service handles all CRUD operations for saved items:

```typescript
import { savedItemsService } from '@/services/SavedItemsService';

// Get all saved items
const items = await savedItemsService.getSavedItems();

// Get items by type
const furniture = await savedItemsService.getSavedItemsByType('furniture');

// Check if item is saved
const isSaved = await savedItemsService.isItemSaved('item-id');

// Save an item
await savedItemsService.saveItem({
  id: 'item-id',
  name: 'Item Name',
  type: 'furniture',
  // ... other properties
});

// Remove an item
await savedItemsService.removeSavedItem('item-id');

// Search items
const results = await savedItemsService.searchSavedItems('sofa');

// Get statistics
const stats = await savedItemsService.getSavedItemsStats();
```

---

## Initialization

The app automatically initializes with sample saved items on first launch:

**Location:** `frontend/utils/initializeSavedItems.ts`

- Runs automatically when the Saved screen is first opened
- Adds 3 sample furniture items
- Only runs once per app installation
- Can be reset for testing: `resetInitialization()`

---

## Data Persistence

- Saved items are persisted to AsyncStorage
- Data survives app restarts
- Maximum 500 items (oldest are removed when limit is reached)
- Items are sorted by most recently updated

---

## Item Types

Supported item types:
- `furniture` - Furniture items from the library
- `design` - AI-generated designs
- `project` - User projects
- `theme` - Design themes

---

## Best Practices

1. **Use SaveButton Component**: For consistent UI/UX, use the `SaveButton` component instead of custom implementations.

2. **Use Helper Functions**: Always use the helper functions (`furnitureToSavedItem`, etc.) to ensure consistent data format.

3. **Handle Loading States**: Check `isSaving` or `isChecking` before showing save buttons.

4. **Error Handling**: The hook and service handle errors internally, but you can add custom error handling in callbacks.

5. **User Feedback**: The `SaveButton` component provides visual feedback. For custom implementations, show alerts or toasts.

---

## Testing

To test the save functionality:

1. **Reset Initialization** (for testing):
   ```typescript
   import { resetInitialization } from '@/utils/initializeSavedItems';
   await resetInitialization();
   ```

2. **Clear All Saved Items**:
   ```typescript
   import { savedItemsService } from '@/services/SavedItemsService';
   await savedItemsService.clearAllSavedItems();
   ```

---

## Future Enhancements

Potential improvements:
- Sync saved items with backend
- Share saved items with other users
- Organize saved items into collections/folders
- Export saved items list
- Import saved items from other sources

---

**Last Updated:** 2025-01-27
