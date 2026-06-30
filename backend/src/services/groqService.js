/**
 * Groq AI Service
 * Groq API integration for lightning-fast AI-powered design generation using Llama 3
 */

import '../loadEnv.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Call Groq API to generate content
 */
async function callGroqAPI(prompt, systemPrompt = 'You are a helpful assistant.', temperature = 0.7, maxTokens = 1000, isJson = false) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    console.warn('[Groq] API key not configured');
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    const requestBody = {
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature,
      max_tokens: maxTokens,
    };

    // Use JSON object response format if requested
    if (isJson) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Groq] API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    }

    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('[Groq] Request timeout');
    } else {
      console.error('[Groq] Request error:', error.message);
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
${personalizedContext}`;

  const result = await callGroqAPI(prompt, systemPrompt, 0.3, 500, true);

  if (!result) {
    return null;
  }

  try {
    return JSON.parse(result);
  } catch (error) {
    console.warn('[Groq] Failed to parse JSON response:', error);
    return null;
  }
}

/**
 * Generate design ideas using Groq
 */
export async function generateDesignIdeas(input) {
  const systemPrompt = `You are an expert interior designer. Generate 3 practical, actionable design ideas based on the user's requirements. Each idea should have:
- A clear, descriptive title (10-15 words)
- A detailed description (2-3 sentences) explaining the concept, layout strategy, and key elements

Format your response as a JSON object with an "ideas" array containing objects with "title" and "description" keys.`;

  const userPrompt = `Room Type: ${input.roomType}
Design Style: ${input.designStyle}
Dimensions: ${input.dimensions.width}m × ${input.dimensions.length}m × ${input.dimensions.height}m
Budget: ${input.budget}
Additional Requirements: ${input.userPrompt || 'None'}

Generate 3 distinct design ideas that are practical, budget-appropriate, and aligned with the specified style.`;

  const result = await callGroqAPI(userPrompt, systemPrompt, 0.7, 1000, true);

  if (!result) {
    return null;
  }

  try {
    const parsed = JSON.parse(result);
    // Handle both { ideas: [...] } and direct array if the model ignored instructions
    return Array.isArray(parsed) ? parsed : (parsed.ideas || []);
  } catch (error) {
    console.warn('[Groq] Failed to parse ideas JSON:', error);
    return null;
  }
}

/**
 * Generate enhanced design description using Groq
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

  const result = await callGroqAPI(userPrompt, systemPrompt, 0.8, 200, false);

  return result || null;
}

/**
 * Generate design title using Groq
 */
export async function generateDesignTitle(designData) {
  const systemPrompt = `You are an interior design expert. Generate a concise, attractive title for a design proposal (5-8 words). The title should:
- Include the design style
- Include the room type
- Be professional and engaging

Return ONLY the title text, no quotes.`;

  const userPrompt = `Design Style: ${designData.designStyle || 'Modern'}
Room Type: ${designData.roomType}
Key Features: ${designData.keyFeatures?.join(', ') || 'N/A'}

Generate an attractive title for this design proposal.`;

  const result = await callGroqAPI(userPrompt, systemPrompt, 0.9, 50, false);

  // Strip surrounding quotes if the model added them
  if (result && result.startsWith('"') && result.endsWith('"')) {
    return result.substring(1, result.length - 1);
  }

  return result || null;
}

/**
 * Suggest color palette using Groq
 */
export async function suggestColorPalette(style, primaryColor = null) {
  const systemPrompt = `You are a color theory expert. Suggest a harmonious color palette (4-5 hex colors) for interior design. Return ONLY a JSON object with a "colors" array containing the hex string codes. Example: { "colors": ["#hex1", "#hex2", "#hex3", "#hex4"] }`;

  const userPrompt = `Design Style: ${style}
${primaryColor ? `Primary Color: ${primaryColor}` : ''}

Suggest a harmonious color palette for this style.`;

  const result = await callGroqAPI(userPrompt, systemPrompt, 0.6, 200, true);

  if (!result) {
    return null;
  }

  try {
    const parsed = JSON.parse(result);
    return parsed.colors || null;
  } catch (error) {
    console.warn('[Groq] Failed to parse color palette JSON:', error);
    return null;
  }
}

/**
 * Enhance a design prompt into a highly detailed visual description for image generation/search
 */
export async function enhanceVisualPrompt(proposal, preferences) {
  const { roomType = 'room', style = 'modern', imageStyle = 'photorealistic' } = preferences;
  const title = proposal.title || `${style} ${roomType}`;
  const description = proposal.description || '';
  const colors = (proposal.colorPalette || []).join(', ');

  // Extract layout constraints if available
  let layoutInstructions = '';
  if (proposal.layout && proposal.layout.furniture && proposal.layout.furniture.length > 0) {
     // Parse dimensions from description (e.g. "A Minimalist design for a 5x4m Bedroom.")
     let roomW = 5;
     let roomD = 5;
     const dimMatch = description.match(/a ([\d.]+)x([\d.]+)m/);
     if (dimMatch) {
       roomW = parseFloat(dimMatch[1]);
       roomD = parseFloat(dimMatch[2]);
     }

     const getSpatialZone = (x, y, w, d) => {
       const thirdW = w / 3;
       const thirdD = d / 3;
       let xZone = x < thirdW ? 'left' : (x > thirdW * 2 ? 'right' : 'center');
       let yZone = y < thirdD ? 'back' : (y > thirdD * 2 ? 'foreground' : 'center');
       
       if (xZone === 'center' && yZone === 'center') return 'exactly in the center of the room';
       if (yZone === 'center') return `against the ${xZone} wall`;
       if (xZone === 'center') return `in the ${yZone} area`;
       return `in the ${yZone}-${xZone} corner`;
     };

     const items = proposal.layout.furniture.map(f => {
       const zone = getSpatialZone(f.x, f.y, roomW, roomD);
       return `A ${f.name} is placed ${zone}`;
     }).join('. ');
     
     layoutInstructions = `\nCRITICAL SPATIAL LAYOUT: The image MUST STRICTLY follow this architectural layout: ${items}. You MUST place these items exactly in the areas specified.`;
  }

  const systemPrompt = imageStyle === 'blueprint'
    ? `You are a professional interior design photographer and prompt engineer. 
    Your task is to take a design proposal and turn it into a highly detailed, descriptive visual prompt (50-70 words). 
    CRITICAL INSTRUCTION: You MUST ask for a "photorealistic, top-down, bird's-eye view 3D render" of the room so we can see the entire floor plan from above in photorealistic 3D.
    Focus on: 
    1. Top-Down Bird's-Eye Perspective (mandatory)
    2. Photorealistic lighting and textures
    Return ONLY the descriptive text, no intro/outro.`
    : `You are a professional interior design photographer and prompt engineer. 
    Your task is to take a design proposal and turn it into a highly detailed, descriptive visual prompt (50-70 words) for an image generator. 
    Focus on: 
    1. Lighting (natural, cinematic, soft)
    2. Textures and Materials
    3. Normal eye-level interior perspective
    4. Atmosphere
    Return ONLY the descriptive text, no intro/outro.`;

  const userPromptText = preferences.customDesign || `Design a ${style} ${roomType}. ${colors ? 'Use colors: ' + colors : ''} ${title} - ${description}${layoutInstructions}`;
  const result = await callGroqAPI(userPromptText, systemPrompt, 0.8, 150, false);

  if (!result) {
    const fallbackBase = `${style} ${roomType}`;
    const fallbackDetails = preferences.customDesign ? ` (${preferences.customDesign})` : '';
    return `${fallbackBase}${fallbackDetails} with ${colors} color palette, detailed interior design`;
  }

  return result;
}

/**
 * Generate design image using Hugging Face (Stable Diffusion) with Groq-enhanced prompts
 */
export async function generateImage(proposal, preferences) {
  try {
    // 1. Generate the highly detailed visual prompt with Groq
    const visualPrompt = await enhanceVisualPrompt(proposal, preferences);
    console.log(`[Groq+HF] Using visual prompt: "${visualPrompt.substring(0, 100)}..."`);
    
    // 2. Attempt direct generation with Hugging Face if key is available
    if (process.env.HF_API_KEY) {
      console.log(`[Groq+HF] Attempting Hugging Face image generation (FLUX)...`);
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
        {
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({ inputs: visualPrompt }),
        }
      );
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        console.log('[Groq+HF] ✅ Successfully generated image');
        return {
          type: 'generated',
          data: `data:image/jpeg;base64,${base64}`,
          prompt: visualPrompt
        };
      } else {
        const errorText = await response.text();
        console.warn(`[Groq+HF] Generation skipped (Status: ${response.status}). Reason: ${errorText}`);
      }
    }

    // 3. Fallback to prompt only if HF fails or is not configured
    console.log(`[Groq+HF] Note: Falling back to text prompt.`);
    return {
      type: 'prompt-only',
      prompt: visualPrompt
    };
  } catch (error) {
    console.error('[Groq+HF] Image logic error:', error);
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
