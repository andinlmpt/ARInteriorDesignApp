import { FurnitureItem } from './ai-design';

export interface PromptAnalysis {
  roomType?: string;
  style?: string;
  dimensions?: {
    width: number;
    length: number;
    height: number;
  };
  colors?: string[];
  budget?: 'low' | 'medium' | 'high' | 'luxury';
  obstacles?: string[];
}

export interface ChatGeneratedLayout {
  id: string;
  furniture: FurnitureItem[];
  safety_warnings: string[];
  score: number;
}

export type ChatMessage =
  | { id: string; role: 'user'; text: string; createdAt: number }
  | { id: string; role: 'assistant'; type: 'text'; text: string; createdAt: number }
  | { id: string; role: 'assistant'; type: 'intent'; analysis: PromptAnalysis; createdAt: number }
  | { id: string; role: 'assistant'; type: 'layouts'; layouts: ChatGeneratedLayout[]; dimensions: { width: number; depth: number; height: number }; createdAt: number }
  | { id: string; role: 'assistant'; type: 'loading'; label: string; createdAt: number }
  | { id: string; role: 'assistant'; type: 'error'; message: string; createdAt: number };
