export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type?: 'text' | 'image' | 'loading' | 'error';
  text?: string;
  imageUrl?: string;
  prompt?: string;
  label?: string;
  message?: string;
  createdAt: number;
}
