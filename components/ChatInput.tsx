
import React, { useState } from 'react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text);
      setText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white border-t border-gray-100 p-4">
      <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Please wait..." : "Ask a question about California law..."}
          className="w-full min-h-[52px] max-h-32 p-4 pr-14 text-gray-800 bg-gray-50 border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white resize-none transition-all disabled:bg-gray-100 placeholder:text-gray-400"
          disabled={disabled}
          rows={1}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="absolute right-3 bottom-3 p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
