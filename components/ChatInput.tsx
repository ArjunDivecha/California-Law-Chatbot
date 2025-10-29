
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
    <div className="bg-white border-t border-gray-200 p-4 sm:p-6">
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Please wait..." : "Ask a question about California law..."}
          className="w-full h-12 p-3 pr-20 text-gray-700 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-shadow disabled:bg-gray-100"
          disabled={disabled}
          rows={1}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
      <div className="mt-3 space-y-2">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-yellow-800 mb-1">
            ⚠️ NOT LEGAL ADVICE • REQUIRES ATTORNEY REVIEW
          </p>
          <p className="text-xs text-yellow-700">
            This tool uses <strong>Google Gemini AI</strong> and may produce inaccurate or incomplete information. 
            All outputs must be reviewed by a qualified attorney. <strong>Do NOT input confidential client information.</strong>
          </p>
        </div>
        <p className="text-xs text-center text-gray-500">
          For court filings: Verify all citations and check local court rules for AI disclosure requirements.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
