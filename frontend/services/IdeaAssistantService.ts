/**
 * Idea Assistant Service
 * 
 * REFACTORED: Now calls backend API instead of direct OpenAI calls
 * Backend logic moved to: backend/src/controllers/ideaAssistantController.js
 * 
 * SECURITY: OpenAI API calls are now server-side only
 */

import { callApi } from './apiClient';

type IdeaInput = {
  roomType: string;
  designStyle: string;
  dimensions: { width: number; length: number; height: number };
  budget: 'low' | 'medium' | 'high' | 'luxury';
  userPrompt?: string;
};

export type Idea = {
  title: string;
  description: string;
};

export type PromptAnalysis = {
  roomType?: string;
  style?: string;
  dimensions?: { width: number; length: number; height: number };
  colors?: string[];
  budget?: string;
};

export type UserPreferences = {
  preferredRoomType?: string;
  preferredStyle?: string;
  preferredBudget?: string;
  preferredColors?: string[];
};

export class IdeaAssistantService {
  /**
   * Analyze design prompt via backend API
   */
  async analyzePrompt(
    prompt: string,
    usePersonalization = true
  ): Promise<PromptAnalysis> {
    if (!prompt || prompt.length < 10) {
      return {};
    }

    try {
      // Get user preferences for personalization context
      let userPreferences: UserPreferences | null = null;
      if (usePersonalization) {
        try {
          const { userPreferenceService } = await import('./UserPreferenceService');
          const prefs = await userPreferenceService.getPersonalizedSuggestions();
          userPreferences = {
            preferredRoomType: prefs.preferredRoomType,
            preferredStyle: prefs.preferredStyle,
            preferredBudget: prefs.preferredBudget,
            preferredColors: prefs.preferredColors,
          };
        } catch (error) {
          console.warn('[IdeaAssistantService] Could not load user preferences:', error);
        }
      }

      const response = await callApi<PromptAnalysis>('/ideas/analyze', {
        method: 'POST',
        body: {
          prompt,
          userPreferences,
        },
      });

      return response;
    } catch (error) {
      console.warn('[IdeaAssistantService] API analysis failed, using local fallback:', error);
      return this.analyzePromptLocally(prompt);
    }
  }

  /**
   * Generate design ideas via backend API
   */
  async generateIdeas(input: IdeaInput): Promise<Idea[]> {
    try {
      const response = await callApi<{ ideas: Idea[] }>('/ideas/suggest', {
        method: 'POST',
        body: {
          roomType: input.roomType,
          designStyle: input.designStyle,
          dimensions: input.dimensions,
          budget: input.budget,
          userPrompt: input.userPrompt,
        },
      });

      if (response?.ideas && response.ideas.length > 0) {
        return response.ideas;
      }
    } catch (error) {
      console.warn('[IdeaAssistantService] API idea generation failed:', error);
    }

    // Fallback to local ideas
    return this.localIdeas(input);
  }

  /**
   * Get color harmony suggestions via backend API
   */
  async suggestColorHarmony(primaryColor: string, style: string): Promise<string[]> {
    try {
      const response = await callApi<{ colors: string[] }>(
        `/ideas/colors?primaryColor=${encodeURIComponent(primaryColor)}&style=${encodeURIComponent(style)}`,
        { method: 'GET' }
      );
      return response.colors;
    } catch (error) {
      console.warn('[IdeaAssistantService] Color harmony API failed:', error);
      // Fallback harmonies
      const harmonies: Record<string, string[]> = {
        '#FFFFFF': ['#F5F5F5', '#E8E8E8', '#2C3E50', '#3498DB'],
        '#2C3E50': ['#34495E', '#ECF0F1', '#3498DB', '#FFFFFF'],
        '#3498DB': ['#2980B9', '#ECF0F1', '#FFFFFF', '#34495E'],
        '#E8D5C4': ['#F5E6D3', '#8B7355', '#D4AF37', '#FFFFFF'],
      };
      return harmonies[primaryColor] || ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#2C3E50'];
    }
  }

  /**
   * Fuse two styles via backend API
   */
  async fuseStyles(style1: string, style2: string): Promise<string> {
    try {
      const response = await callApi<{ fusedStyle: string }>(
        `/ideas/fuse-styles?style1=${encodeURIComponent(style1)}&style2=${encodeURIComponent(style2)}`,
        { method: 'GET' }
      );
      return response.fusedStyle;
    } catch (error) {
      console.warn('[IdeaAssistantService] Style fusion API failed:', error);
      return `${style1} + ${style2}`;
    }
  }

  /**
   * Local prompt analysis fallback
   */
  private analyzePromptLocally(prompt: string): PromptAnalysis {
    const lower = prompt.toLowerCase();
    const suggestions: PromptAnalysis = {};

    // Detect room type
    if (lower.match(/\b(bedroom|bed|sleep|master)\b/)) suggestions.roomType = 'Bedroom';
    else if (lower.match(/\b(kitchen|cook|stove|oven|fridge)\b/)) suggestions.roomType = 'Kitchen';
    else if (lower.match(/\b(bathroom|bath|shower|toilet)\b/)) suggestions.roomType = 'Bathroom';
    else if (lower.match(/\b(office|work|desk|study)\b/)) suggestions.roomType = 'Office';
    else if (lower.match(/\b(dining|dinner|table|eat)\b/)) suggestions.roomType = 'Dining Room';
    else if (lower.match(/\b(living|sofa|couch|tv|entertainment)\b/)) suggestions.roomType = 'Living Room';

    // Detect style
    if (lower.match(/\b(minimal|minimalist|clean|simple)\b/)) suggestions.style = 'Minimalist';
    else if (lower.match(/\b(modern|contemporary|sleek)\b/)) suggestions.style = 'Modern';
    else if (lower.match(/\b(scandinavian|scandi|nordic|light wood)\b/)) suggestions.style = 'Scandinavian';
    else if (lower.match(/\b(industrial|loft|exposed|metal)\b/)) suggestions.style = 'Industrial';
    else if (lower.match(/\b(bohemian|boho|eclectic|vibrant)\b/)) suggestions.style = 'Bohemian';
    else if (lower.match(/\b(traditional|classic|vintage)\b/)) suggestions.style = 'Traditional';

    // Detect budget
    if (lower.match(/\b(cheap|budget|affordable|low cost|economy)\b/)) suggestions.budget = 'low';
    else if (lower.match(/\b(luxury|premium|high-end|expensive|deluxe)\b/)) suggestions.budget = 'luxury';
    else if (lower.match(/\b(moderate|mid-range|standard)\b/)) suggestions.budget = 'medium';

    return suggestions;
  }

  /**
   * Local idea generation fallback
   */
  private localIdeas(input: IdeaInput): Idea[] {
    const { roomType, designStyle, dimensions, budget } = input;
    const area = Math.round(dimensions.width * dimensions.length);

    return [
      {
        title: `Zoned ${designStyle} ${roomType}`,
        description: `Divide the ${area}m² space into clear zones (primary, secondary, circulation). Anchor with a focal piece and keep walkways ≥ 90cm. Use a 60/30/10 color balance to stay on-style.`,
      },
      {
        title: `Light-first layout`,
        description: `Place seating/work surfaces within 2m of natural light; float larger pieces to keep sightlines open. Layer task + ambient lighting; mirror opposite the brightest wall to amplify light.`,
      },
      {
        title: `Budget-smart material mix (${budget})`,
        description: `Prioritize touchpoints (sofa/desk) and save on storage/decor. Select 2 main materials and 1 accent; repeat them 3× for cohesion. Keep furniture 30cm off walls where possible for depth.`,
      },
    ];
  }
}

export const ideaAssistantService = new IdeaAssistantService();
