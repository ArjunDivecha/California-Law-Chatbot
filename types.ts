export enum MessageRole {
  USER = 'user',
  BOT = 'bot',
}

export interface Source {
  title: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  sources?: Source[];
}