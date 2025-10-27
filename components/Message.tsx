import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageRole } from '../types';
import type { ChatMessage, Source } from '../types';

interface MessageProps {
  message: ChatMessage;
}

const renderMessageContent = (text: string, sources?: Source[]) => {
  if (!sources || sources.length === 0) {
    return (
      <div className="prose prose-sm max-w-none prose-headings:mt-4 prose-p:my-3 prose-li:my-1 prose-strong:font-semibold prose-a:text-blue-700 prose-a:no-underline hover:prose-a:underline">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  }

  // Regex to find and capture citation numbers like [1], [2], etc.
  const parts = text.split(/(\[\d+\])/g);

  return (
    <div className="prose prose-sm max-w-none prose-headings:mt-4 prose-p:my-3 prose-li:my-1 prose-strong:font-semibold prose-a:text-blue-700 prose-a:no-underline hover:prose-a:underline">
      {parts.map((part, index) => {
        const citationMatch = part.match(/\[(\d+)\]/);
        if (citationMatch) {
          const sourceNumber = parseInt(citationMatch[1], 10);
          // Adjust for 0-based array index
          const source = sources[sourceNumber - 1];
          
          if (source) {
            return (
              <a
                key={`source-${index}`}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                title={source.title}
                className="inline-block align-super text-xs bg-blue-100 text-blue-800 font-semibold mx-1 px-2 py-0.5 rounded-full hover:bg-blue-200 transition-colors duration-200"
              >
                {sourceNumber}
              </a>
            );
          }
        }
        return <ReactMarkdown key={`text-${index}`} remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>;
      })}
    </div>
  );
};

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start space-x-4 max-w-xl">
          <div className="bg-blue-500 text-white rounded-lg rounded-br-none p-4 shadow-md">
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-blue-600"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        </div>
      </div>
    );
  }

  // Check if this response used CourtListener
  const usedCourtListener = message.sources && message.sources.some(source =>
    source.url.includes('courtlistener.com')
  );

  // Check if this response includes official legal sources
  const hasOfficialSources = message.sources && message.sources.some(source =>
    source.url.includes('leginfo.legislature.ca.gov') ||
    source.url.includes('courts.ca.gov') ||
    source.url.includes('courtlistener.com')
  );

  // Check if response needs verification (contains warning)
  const needsVerification = message.text.includes('Some claims in this response may require verification');

  // Conditionally render source list only if there are no inline citations
  const showSourceList = message.sources && message.sources.length > 0 && !message.text.match(/\[\d+\]/);

  return (
  <div className="flex justify-start">
      <div className="flex items-start space-x-4 max-w-xl">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-gray-600"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
        </div>
        <div className="bg-white rounded-lg rounded-bl-none p-5 border border-gray-200 shadow-md w-full">
        {usedCourtListener && (
        <div className="mb-3 flex items-center">
        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
        CourtListener Enhanced
        </div>
        </div>
        )}
          {!usedCourtListener && hasOfficialSources && !needsVerification && (
          <div className="mb-3 flex items-center">
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Legal Sources Included
          </div>
          </div>
          )}
          {needsVerification && (
            <div className="mb-3 flex items-center">
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                Verification Recommended
              </div>
            </div>
          )}
          {renderMessageContent(message.text, message.sources)}
          {showSourceList && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-green-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Sources
              </h4>
              <ol className="list-decimal list-inside space-y-2 pl-1">
                {message.sources.map((source, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={source.url}
                      className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-800 hover:underline transition-colors break-words"
                    >
                      <span className="font-medium">{source.title}</span>
                      <span className="text-xs text-gray-500">{new URL(source.url).hostname.replace('www.','')}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;
