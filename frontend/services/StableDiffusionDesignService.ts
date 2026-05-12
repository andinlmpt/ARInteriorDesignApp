/**
 * Stable Diffusion Design Service
 * Handles AI-powered interior design generation using Stable Diffusion
 */

export interface StableDiffusionRequest {
  prompt?: string;
  style: string;
  roomType: string;
  numImages?: number;
  model?: string;
  imageUrl?: string;
}

export interface StableDiffusionResponse {
  imageUrls: string[];
  prompt: string;
  style: string;
  roomType: string;
  model: string;
  generatedAt: number;
  processingTime: number;
}

class StableDiffusionDesignServiceClass {
  private baseUrl: string;

  constructor() {
    // Use backend API URL or default
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  }

  /**
   * Generate interior design images using Stable Diffusion
   */
  async generateDesign(request: StableDiffusionRequest): Promise<StableDiffusionResponse> {
    try {
      const startTime = Date.now();

      // Build prompt from style and room type
      const prompt = request.prompt || this.buildPrompt(request.style, request.roomType);

      // Prepare request body
      const requestBody = {
        prompt,
        style: request.style,
        roomType: request.roomType,
        numImages: request.numImages || 4,
        model: request.model || 'interior-design',
        imageUrl: request.imageUrl,
      };

      // Call backend API
      const response = await fetch(`${this.baseUrl}/api/stable-diffusion/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const processingTime = Date.now() - startTime;

      return {
        imageUrls: data.imageUrls || [],
        prompt: data.prompt || prompt,
        style: request.style,
        roomType: request.roomType,
        model: request.model || 'interior-design',
        generatedAt: Date.now(),
        processingTime,
      };
    } catch (error) {
      console.error('[StableDiffusionDesignService] Generation failed:', error);
      
      // Return mock data for development if backend is not available
      if (error instanceof Error && error.message.includes('fetch')) {
        console.warn('[StableDiffusionDesignService] Backend not available, returning mock data');
        return this.getMockResponse(request);
      }

      throw error;
    }
  }

  /**
   * Build a prompt from style and room type
   */
  private buildPrompt(style: string, roomType: string): string {
    const styleDescriptions: Record<string, string> = {
      modern: 'modern, sleek, minimalist',
      contemporary: 'contemporary, trendy, eclectic',
      minimalist: 'minimalist, simple, clean',
      scandinavian: 'Scandinavian, light colors, natural materials, hygge',
      industrial: 'industrial, raw materials, exposed elements',
      bohemian: 'bohemian, eclectic, colorful, artistic',
      traditional: 'traditional, classic, elegant',
      rustic: 'rustic, natural, weathered, cozy',
      'mid-century': 'mid-century modern, 1950s-60s design',
      eclectic: 'eclectic, mixed styles, diverse',
    };

    const styleDesc = styleDescriptions[style] || style;
    return `Interior design of a ${roomType} in ${styleDesc} style, high quality, photorealistic, professional photography, 4k`;
  }

  /**
   * Get mock response for development/testing
   */
  private getMockResponse(request: StableDiffusionRequest): StableDiffusionResponse {
    const numImages = request.numImages || 4;
    const mockImageUrls: string[] = [];

    // Generate placeholder image URLs
    for (let i = 0; i < numImages; i++) {
      // Using placeholder service
      mockImageUrls.push(`https://via.placeholder.com/512x512/6366f1/ffffff?text=${encodeURIComponent(request.style + ' ' + request.roomType + ' ' + (i + 1))}`);
    }

    return {
      imageUrls: mockImageUrls,
      prompt: this.buildPrompt(request.style, request.roomType),
      style: request.style,
      roomType: request.roomType,
      model: request.model || 'interior-design',
      generatedAt: Date.now(),
      processingTime: 2000, // Mock processing time
    };
  }
}

export const stableDiffusionDesignService = new StableDiffusionDesignServiceClass();
