/**
 * Gemini AI Service
 * Google Gemini API integration for AI-powered design generation
 */

import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Call Gemini API to generate content
 */
async function callGeminiAPI(prompt, systemPrompt = null, temperature = 0.7, maxTokens = 1000) {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini] API key not configured');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    const requestBody = {
      contents: [{
        parts: [{
          text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
        }]
      }],
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
      },
    };

    const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text.trim();
    }

    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('[Gemini] Request timeout');
    } else {
      console.error('[Gemini] Request error:', error.message);
    }
    return null;
  }
}

/**
 * Analyze design prompt and extract structured information
 */
export async function analyzeDesignPrompt(prompt, userPreferences = null) {
  const personalizedContext = userPreferences
    ? `User's typical preferences: Style: ${userPreferences.preferredStyle || 'none'}, Room: ${userPreferences.preferredRoomType || 'none'}, Budget: ${userPreferences.preferredBudget || 'medium'}. Consider these preferences when analyzing.`
    : '';

  const systemPrompt = `You are an interior design assistant. Analyze the user's design prompt and extract structured information. Return ONLY a valid JSON object with the following structure:
{
  "roomType": "Living Room" | "Bedroom" | "Kitchen" | "Office" | "Bathroom" | "Dining Room",
  "style": "Modern" | "Minimalist" | "Scandinavian" | "Industrial" | "Bohemian" | "Traditional" | "Contemporary",
  "dimensions": { "width": number, "length": number, "height": number },
  "colors": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "budget": "low" | "medium" | "high" | "luxury"
}
${personalizedContext}

Return ONLY the JSON object, no additional text or markdown formatting.`;

  const result = await callGeminiAPI(prompt, systemPrompt, 0.3, 300);

  if (!result) {
    return null;
  }

  try {
    // Extract JSON from response (remove markdown code blocks if present)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(result);
  } catch (error) {
    console.warn('[Gemini] Failed to parse JSON response:', error);
    return null;
  }
}

/**
 * Generate design ideas using Gemini
 */
export async function generateDesignIdeas(input) {
  const systemPrompt = `You are an expert interior designer. Generate 3 practical, actionable design ideas based on the user's requirements. Each idea should have:
- A clear, descriptive title (10-15 words)
- A detailed description (2-3 sentences) explaining the concept, layout strategy, and key elements

Format your response as a JSON array of objects:
[
  {
    "title": "Title of idea 1",
    "description": "Detailed description of idea 1..."
  },
  {
    "title": "Title of idea 2",
    "description": "Detailed description of idea 2..."
  },
  {
    "title": "Title of idea 3",
    "description": "Detailed description of idea 3..."
  }
]

Return ONLY the JSON array, no additional text.`;

  const userPrompt = `Room Type: ${input.roomType}
Design Style: ${input.designStyle}
Dimensions: ${input.dimensions.width}m × ${input.dimensions.length}m × ${input.dimensions.height}m
Budget: ${input.budget}
Additional Requirements: ${input.userPrompt || 'None'}

Generate 3 distinct design ideas that are practical, budget-appropriate, and aligned with the specified style.`;

  const result = await callGeminiAPI(userPrompt, systemPrompt, 0.7, 500);

  if (!result) {
    return null;
  }

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(result);
  } catch (error) {
    console.warn('[Gemini] Failed to parse ideas JSON:', error);
    return null;
  }
}

/**
 * Generate enhanced design description using Gemini
 */
export async function generateDesignDescription(designData) {
  const systemPrompt = `You are an interior design expert. Generate a compelling, detailed description for an interior design proposal. The description should:
- Be 2-3 sentences long
- Highlight key features and design elements
- Emphasize the style, color palette, and furniture layout
- Be engaging and professional

Return ONLY the description text, no additional formatting or quotes.`;

  const userPrompt = `Room Type: ${designData.roomType}
Design Style: ${designData.designStyle || 'Modern'}
Room Dimensions: ${designData.dimensions.width}m × ${designData.dimensions.length}m × ${designData.dimensions.height}m
Furniture Count: ${designData.furnitureCount || 0} items
Color Palette: ${(designData.colorPalette || []).join(', ')}
Budget: ${designData.budget || 'medium'}

Generate a compelling description for this design proposal.`;

  const result = await callGeminiAPI(userPrompt, systemPrompt, 0.8, 200);

  return result || null;
}

/**
 * Generate design title using Gemini
 */
export async function generateDesignTitle(designData) {
  const systemPrompt = `You are an interior design expert. Generate a concise, attractive title for a design proposal (5-8 words). The title should:
- Include the design style
- Include the room type
- Be professional and engaging

Return ONLY the title text, no additional formatting or quotes.`;

  const userPrompt = `Design Style: ${designData.designStyle || 'Modern'}
Room Type: ${designData.roomType}
Key Features: ${designData.keyFeatures?.join(', ') || 'N/A'}

Generate an attractive title for this design proposal.`;

  const result = await callGeminiAPI(userPrompt, systemPrompt, 0.9, 50);

  return result || null;
}

/**
 * Suggest color palette using Gemini
 */
export async function suggestColorPalette(style, primaryColor = null) {
  const systemPrompt = `You are a color theory expert. Suggest a harmonious color palette (4-5 hex colors) for interior design. Return ONLY a JSON array of hex color codes: ["#hex1", "#hex2", "#hex3", "#hex4"]`;

  const userPrompt = `Design Style: ${style}
${primaryColor ? `Primary Color: ${primaryColor}` : ''}

Suggest a harmonious color palette for this style.`;

  const result = await callGeminiAPI(userPrompt, systemPrompt, 0.6, 100);

  if (!result) {
    return null;
  }

  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(result);
  } catch (error) {
    console.warn('[Gemini] Failed to parse color palette JSON:', error);
    return null;
  }
}

/**
 * Enhance a design prompt into a highly detailed visual description for image generation/search
 */
export async function enhanceVisualPrompt(proposal, preferences) {
  const { roomType = 'room', style = 'modern' } = preferences;
  const title = proposal.title || `${style} ${roomType}`;
  const description = proposal.description || '';
  const colors = (proposal.colorPalette || []).join(', ');

  const systemPrompt = `You are a professional interior design photographer and prompt engineer. 
    Your task is to take a design proposal and turn it into a highly detailed, descriptive visual prompt (50-70 words). 
    Focus on: 
    1. Lighting (natural, cinematic, soft)
    2. Textures and Materials (velvet, oak, polished concrete)
    3. Composition (wide-angle, architectural)
    4. Atmosphere (cozy, luxurious, bright)
    Return ONLY the descriptive text, no intro/outro.`;

  const userPromptText = preferences.customDesign || '';
  const result = await callGeminiAPI(userPrompt, systemPrompt, 0.8, 150);

  // Smarter fallback that includes user input if Gemini fails
  if (!result) {
    const fallbackBase = `${style} ${roomType}`;
    const fallbackDetails = userPromptText ? ` (${userPromptText})` : '';
    return `${fallbackBase}${fallbackDetails} with ${colors} color palette, detailed interior design`;
  }

  return result;
}

/**
 * Generate design image using Gemini (Imagen 4) with multi-layered fallback
 */
export async function generateImage(proposal, preferences) {
  if (!GEMINI_API_KEY) {
    console.warn('[Gemini] API key not configured for image generation');
    return null;
  }

  try {
    // 1. Get an enhanced visual description first (useful for both Gen and Search)
    const visualPrompt = await enhanceVisualPrompt(proposal, preferences);
    console.log(`[Gemini] Using visual prompt: "${visualPrompt.substring(0, 100)}..."`);

    // 2. Attempt direct generation with Imagen 4.0
    // Note: We use a try-catch specifically for the fetch to handle 429s/404s gracefully
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${GEMINI_API_KEY}`;

    const body = {
      instances: [{ prompt: visualPrompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        outputMimeType: "image/jpeg"
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
        console.log('[Gemini] ✅ Successfully generated image');
        return {
          type: 'generated',
          data: `data:image/jpeg;base64,${data.predictions[0].bytesBase64Encoded}`,
          prompt: visualPrompt
        };
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.warn(`[Gemini] Generation skipped (Status: ${response.status}). Reason: ${errorData.error?.message || 'Unknown'}`);
    }

    // 3. If direct generation is unavailable, return the enhanced prompt for the controller to use in search
    return {
      type: 'prompt-only',
      prompt: visualPrompt
    };

  } catch (error) {
    console.error('[Gemini] Image logic error:', error.message);
    return null;
  }
}

export default {
  analyzeDesignPrompt,
  generateDesignIdeas,
  generateDesignDescription,
  generateDesignTitle,
  suggestColorPalette,
  enhanceVisualPrompt,
  generateImage,
};
