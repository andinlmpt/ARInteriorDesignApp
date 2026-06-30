/**
 * Image Generation Controller
 * Uses Pexels API to search for interior design photos based on user input
 * 
 * Moved from: frontend/services/DesignImageGenerationService.ts
 * 
 * SECURITY: API keys are stored on the server, never exposed to frontend
 */

import dotenv from 'dotenv';
import groqService from '../services/groqService.js';
import { filterInteriorPhotos } from '../utils/interiorImageFilter.js';
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const PEXELS_API_URL = 'https://api.pexels.com/v1/search';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;

// Get Pexels API key from environment
const getPexelsApiKey = () => {
  // Pexels API key for theme recommendation
  const pexelsKey = process.env.PEXELS_API_KEY || process.env.THEME_RECOMMENDATION_API_KEY || 'OdfpmqRFbKh3StVE19NieMW9QYAhDuQWSftDvYd0rPQRBMowMAjILJ9O';
  if (pexelsKey && pexelsKey.trim().length > 20) {
    console.log('[ImageGeneration] Using Pexels API key');
    return pexelsKey.trim();
  }
  console.warn('[ImageGeneration] No valid Pexels API key configured');
  return null;
};

// ============================================================================
// SEARCH QUERY BUILDER
// ============================================================================

const INTERIOR_SEARCH_MODIFIERS = [
  'interior design',
  'home interior',
  'room decor',
  'furniture',
  'living space',
];

/**
 * Build search query for Pexels API from user input
 */
function buildSearchQuery(proposal, preferences) {
  const {
    roomType = 'living room',
    style = 'modern',
    colors = [],
    mood,
    materials = [],
    customDesign, // Custom design text from user
  } = preferences;

  // Select a random modifier to ensure variety even for identical prompts
  const randomModifier = INTERIOR_SEARCH_MODIFIERS[Math.floor(Math.random() * INTERIOR_SEARCH_MODIFIERS.length)];

  // If user provided custom design text, use it as the primary search query
  if (customDesign && customDesign.trim().length > 0) {
    // Extract key terms from custom design text
    const customText = customDesign.trim();
    // Remove common words and keep key design terms
    const keywords = customText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 3 && !['the', 'with', 'and', 'for', 'from', 'look'].includes(word))
      .slice(0, 5)
      .join(' ');

    const coreQuery = keywords || customText;
    
    // Check if the query already has interior keywords
    const hasInteriorContext = /\b(interior|room|bedroom|kitchen|living|bathroom|furniture|home|decor|house|apartment|office|studio|lobby|lounge)\b/i.test(coreQuery);

    if (hasInteriorContext) {
      return `${coreQuery} ${randomModifier}`.substring(0, 100);
    } else {
      // Missing context, map bare words by adding roomType + style
      return `${roomType} ${style} interior design ${coreQuery}`.substring(0, 100);
    }
  }

  // Build search query from preferences
  const queryParts = [];

  if (roomType) {
    queryParts.push(roomType);
  }

  if (style) {
    queryParts.push(style);
  }

  queryParts.push(randomModifier);

  if (mood) {
    queryParts.push(mood);
  }

  // Add first color if available
  if (colors.length > 0) {
    queryParts.push(colors[0]);
  }

  // Add first material if available
  if (materials.length > 0) {
    queryParts.push(materials[0]);
  }

  // Ensure "interior design" context is always there
  if (!queryParts.some(p => p.includes('interior') || p.includes('room') || p.includes('home'))) {
    queryParts.push('interior design');
  }

  return queryParts.join(' ').substring(0, 100);
}

// ============================================================================
// MAIN CONTROLLER FUNCTIONS
// ============================================================================

/**
 * Search for design images using Pexels API
 */
export async function generateDesignImage(req, res, next) {
  try {
    const { proposal, preferences } = req.body;

    if (!proposal || !preferences) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'proposal and preferences are required',
      });
    }

    const apiKey = getPexelsApiKey();
    if (!apiKey) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Image search service is not configured. Please contact administrator.',
      });
    }

    const searchQuery = buildSearchQuery(proposal, preferences);
    console.log(`[ImageGeneration] Request for: ${proposal.title || 'Untitled'}`);

    // Track if we successfully used Groq+HF image flow
    let resultImage = null;

    // 1. Attempt Groq+HF image generation if configured (skip for Pexels stock photo search)
    if (process.env.GROQ_API_KEY && !preferences.forcePexels && proposal.id !== 'explore-search') {
      try {
        console.log('[ImageGeneration] Attempting Groq+HF image flow...');
        const groqResult = await groqService.generateImage(proposal, preferences);

        if (groqResult && groqResult.type === 'generated') {
          console.log('[ImageGeneration] ✅ Hugging Face generated image successfully');
          return res.json({
            success: true,
            imageUrl: groqResult.data,
            thumbnailUrl: groqResult.data,
            prompt: groqResult.prompt,
            generatedAt: Date.now(),
            attribution: {
              source: 'Hugging Face (FLUX.1-schnell)',
            },
          });
        }

        if (groqResult && groqResult.type === 'prompt-only') {
          console.log('[ImageGeneration] 🔄 Using Groq-enhanced prompt for search fallback');
          const enhancedSearchQuery = groqResult.prompt.substring(0, 150);
          return await performPexelsSearch(enhancedSearchQuery, proposal, res);
        }
      } catch (groqError) {
        console.warn('[ImageGeneration] Groq flow failed, falling back to Pexels:', groqError.message);
      }
    }

    // 2. Fallback to standard Pexels Search
    return await performPexelsSearch(searchQuery, proposal, res);
  } catch (error) {
    console.error('[ImageGeneration] Error:', error);
    next(error);
  }
}

/**
 * Internal helper for Pexels search
 */
async function performPexelsSearch(query, proposal, res) {
  const apiKey = getPexelsApiKey();
  if (!apiKey) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Image search service is not configured.',
    });
  }

  console.log(`[ImageGeneration] Searching Pexels for: "${query}"`);

  let currentQuery = query;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const url = new URL(PEXELS_API_URL);
      url.searchParams.append('query', currentQuery);
      url.searchParams.append('per_page', '40'); // Fetch more to allow filtering space
      url.searchParams.append('orientation', 'landscape'); // Landscape aspect ratio room shots preferred

      // Keep page number between 1 and 3 for highly relevant top results
      const randomPage = Math.floor(Math.random() * 3) + 1;
      url.searchParams.append('page', randomPage.toString());

      console.log(`[ImageGeneration] Pexels Search Attempt ${attempt + 1}/${MAX_RETRIES + 1} (Page ${randomPage}) for: "${currentQuery}"`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Authorization': apiKey },
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
          // Post-filter to ensure only interior photos are processed
          const filteredPhotos = filterInteriorPhotos(data.photos);

          console.log(`[ImageGeneration] Pexels fetched ${data.photos.length} photos, filtered down to ${filteredPhotos.length} interior-relevant photos`);

          // If we got too few interior design photos, try to retry with a stricter/enriched query
          if (filteredPhotos.length < 6 && attempt < MAX_RETRIES) {
            console.log(`[ImageGeneration] ⚠️ Only ${filteredPhotos.length} photos passed filter. Retrying with stricter interior query.`);
            
            // Enrich query by adding interior keywords if not already present
            if (!currentQuery.toLowerCase().includes('interior') && !currentQuery.toLowerCase().includes('room')) {
              currentQuery = `${currentQuery} living room interior design`;
            } else {
              // If context was already present, rotate page or search query
              currentQuery = `living room interior design ${currentQuery}`;
            }
            continue;
          }

          if (filteredPhotos.length > 0) {
            // Return photos as-is — Pexels CDN URLs are pre-signed; adding timestamps breaks them
            const enhancedPhotos = filteredPhotos.map(photo => ({
              ...photo,
              src: {
                ...photo.src,
                large: photo.src?.large || photo.src?.original || '',
                medium: photo.src?.medium || photo.src?.large || photo.src?.original || '',
              }
            }));

            const bestPhoto = enhancedPhotos[0];

            console.log(`[ImageGeneration] ✅ Returning ${enhancedPhotos.length} filtered photos`);
            return res.json({
              success: true,
              photos: enhancedPhotos,
              imageUrl: bestPhoto.src.large,
              thumbnailUrl: bestPhoto.src.medium,
              prompt: currentQuery,
              generatedAt: Date.now(),
              attribution: {
                photographer: bestPhoto.photographer,
                source: `Pexels / ${bestPhoto.photographer}`,
              },
            });
          }

        }

        console.warn(`[ImageGeneration] ⚠️ No photos found on random page ${randomPage}, retrying with another...`);
        lastError = new Error('Empty results on page');
        continue;
      }

      if (response.status === 429 && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) continue;
    }
  }
  throw lastError || new Error('Search failed');
}


/**
 * Check if image search service is available
 */
export async function checkServiceStatus(req, res) {
  res.json({
    available: !!apiKey || !!process.env.GROQ_API_KEY,
    model: process.env.HF_API_KEY ? 'huggingface-flux' : (process.env.GROQ_API_KEY ? 'groq-enhanced-pexels' : 'pexels-search'),
    maxPromptLength: 1000,
    supportedSizes: ['1024x1024', 'large', 'medium'],
    supportedQualities: ['hd', 'standard', 'original'],
  });
}

/**
 * Preview search query (for debugging)
 */
export async function previewPrompt(req, res) {
  try {
    const { proposal, preferences } = req.body;
    const searchQuery = buildSearchQuery(proposal || {}, preferences || {});
    res.json({
      prompt: searchQuery,
      length: searchQuery.length,
      truncated: searchQuery.length > 100,
    });
  } catch (error) {
    res.status(400).json({
      error: 'Invalid request',
      message: error.message,
    });
  }
}

export default {
  generateDesignImage,
  checkServiceStatus,
  previewPrompt,
};

