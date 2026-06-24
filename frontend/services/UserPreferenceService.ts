import { getJson, setJson } from '@/utils/storage';

export type UserPreference = {
  favoriteStyles: string[];
  favoriteRoomTypes: string[];
  preferredColors: string[];
  budgetRange: 'low' | 'medium' | 'high' | 'luxury';
  optimizationPreference: 'space' | 'comfort' | 'aesthetics' | 'balanced';
  likedDesigns: string[];
  dislikedDesigns: string[];
  appliedDesigns: string[];
  usagePatterns: {
    roomTypeFrequency: Record<string, number>;
    styleFrequency: Record<string, number>;
    budgetFrequency: Record<string, number>;
  };
  lastUpdated: number;
};

export class UserPreferenceService {
  private readonly STORAGE_KEY = 'userPreferenceProfile';
  private preferences: UserPreference | null = null;

  async getUserPreferences(): Promise<UserPreference> {
    if (this.preferences) return this.preferences;
    
    const stored = await getJson<UserPreference | null>(this.STORAGE_KEY, null);
    if (stored) {
      this.preferences = stored;
      return stored;
    }

    // Initialize default preferences
    const defaultPrefs: UserPreference = {
      favoriteStyles: [],
      favoriteRoomTypes: [],
      preferredColors: [],
      budgetRange: 'medium',
      optimizationPreference: 'balanced',
      likedDesigns: [],
      dislikedDesigns: [],
      appliedDesigns: [],
      usagePatterns: {
        roomTypeFrequency: {},
        styleFrequency: {},
        budgetFrequency: {},
      },
      lastUpdated: Date.now(),
    };

    this.preferences = defaultPrefs;
    await this.savePreferences();
    return defaultPrefs;
  }

  async trackDesignInteraction(designId: string, action: 'like' | 'dislike' | 'apply'): Promise<void> {
    const prefs = await this.getUserPreferences();
    
    if (action === 'like') {
      if (!prefs.likedDesigns.includes(designId)) {
        prefs.likedDesigns.push(designId);
      }
      prefs.dislikedDesigns = prefs.dislikedDesigns.filter(id => id !== designId);
    } else if (action === 'dislike') {
      if (!prefs.dislikedDesigns.includes(designId)) {
        prefs.dislikedDesigns.push(designId);
      }
      prefs.likedDesigns = prefs.likedDesigns.filter(id => id !== designId);
    } else if (action === 'apply') {
      if (!prefs.appliedDesigns.includes(designId)) {
        prefs.appliedDesigns.push(designId);
      }
    }

    prefs.lastUpdated = Date.now();
    await this.savePreferences();
  }

  async trackUsage(roomType?: string, style?: string, budget?: string): Promise<void> {
    const prefs = await this.getUserPreferences();
    
    if (roomType) {
      prefs.usagePatterns.roomTypeFrequency[roomType] = 
        (prefs.usagePatterns.roomTypeFrequency[roomType] || 0) + 1;
    }
    
    if (style) {
      prefs.usagePatterns.styleFrequency[style] = 
        (prefs.usagePatterns.styleFrequency[style] || 0) + 1;
    }
    
    if (budget) {
      prefs.usagePatterns.budgetFrequency[budget] = 
        (prefs.usagePatterns.budgetFrequency[budget] || 0) + 1;
    }

    prefs.lastUpdated = Date.now();
    await this.savePreferences();
  }

  async updatePreferences(updates: Partial<UserPreference>): Promise<void> {
    const prefs = await this.getUserPreferences();
    Object.assign(prefs, updates);
    prefs.lastUpdated = Date.now();
    await this.savePreferences();
  }

  async getPersonalizedSuggestions(): Promise<{
    preferredStyle?: string;
    preferredRoomType?: string;
    preferredBudget?: string;
    preferredColors?: string[];
    optimizationGoal?: string;
  }> {
    const prefs = await this.getUserPreferences();
    const suggestions: any = {};

    // Get most used style
    const styleEntries = Object.entries(prefs.usagePatterns.styleFrequency);
    if (styleEntries.length > 0) {
      const topStyle = styleEntries.sort((a, b) => b[1] - a[1])[0];
      if (topStyle[1] >= 2) {
        suggestions.preferredStyle = topStyle[0];
      }
    }

    // Get most used room type
    const roomEntries = Object.entries(prefs.usagePatterns.roomTypeFrequency);
    if (roomEntries.length > 0) {
      const topRoom = roomEntries.sort((a, b) => b[1] - a[1])[0];
      if (topRoom[1] >= 2) {
        suggestions.preferredRoomType = topRoom[0];
      }
    }

    // Get most used budget
    const budgetEntries = Object.entries(prefs.usagePatterns.budgetFrequency);
    if (budgetEntries.length > 0) {
      const topBudget = budgetEntries.sort((a, b) => b[1] - a[1])[0];
      if (topBudget[1] >= 2) {
        suggestions.preferredBudget = topBudget[0];
      }
    }

    // Use stored preferences
    if (prefs.favoriteStyles.length > 0) {
      suggestions.preferredStyle = prefs.favoriteStyles[0];
    }
    if (prefs.favoriteRoomTypes.length > 0) {
      suggestions.preferredRoomType = prefs.favoriteRoomTypes[0];
    }
    if (prefs.preferredColors.length > 0) {
      suggestions.preferredColors = prefs.preferredColors;
    }
    if (prefs.budgetRange !== 'medium') {
      suggestions.preferredBudget = prefs.budgetRange;
    }
    if (prefs.optimizationPreference !== 'balanced') {
      suggestions.optimizationGoal = prefs.optimizationPreference;
    }

    return suggestions;
  }

  async learnFromFeedback(): Promise<void> {
    const prefs = await this.getUserPreferences();
    
    // Analyze liked designs to infer preferences
    // This could be enhanced to analyze actual design data
    // For now, we'll use frequency patterns
    
    // Update favorite styles based on usage
    const topStyles = Object.entries(prefs.usagePatterns.styleFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([style]) => style);
    
    if (topStyles.length > 0) {
      prefs.favoriteStyles = topStyles;
    }

    // Update favorite room types
    const topRooms = Object.entries(prefs.usagePatterns.roomTypeFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([room]) => room);
    
    if (topRooms.length > 0) {
      prefs.favoriteRoomTypes = topRooms;
    }

    prefs.lastUpdated = Date.now();
    await this.savePreferences();
  }

  private async savePreferences(): Promise<void> {
    if (this.preferences) {
      await setJson(this.STORAGE_KEY, this.preferences);
    }
  }

  async clearPreferences(): Promise<void> {
    this.preferences = null;
    // Reset to defaults
    const defaultPrefs: UserPreference = {
      favoriteStyles: [],
      favoriteRoomTypes: [],
      preferredColors: [],
      budgetRange: 'medium',
      optimizationPreference: 'balanced',
      likedDesigns: [],
      dislikedDesigns: [],
      appliedDesigns: [],
      usagePatterns: {
        roomTypeFrequency: {},
        styleFrequency: {},
        budgetFrequency: {},
      },
      lastUpdated: Date.now(),
    };
    await setJson(this.STORAGE_KEY, defaultPrefs);
  }
}

export const userPreferenceService = new UserPreferenceService();


