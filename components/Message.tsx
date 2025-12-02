import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageRole } from '../types';
import type { ChatMessage, Source, CEBSource } from '../types';
import CEBBadge from './CEBBadge';

interface MessageProps {
  message: ChatMessage;
}

// Copy and Print button icons
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const PrintIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect width="12" height="8" x="6" y="14"/>
  </svg>
);

// Helper to apply strikethrough to unsupported claims
const applyStrikethrough = (text: string, unsupportedClaims: string[]): string => {
  if (!unsupportedClaims || unsupportedClaims.length === 0) return text;
  
  let result = text;
  for (const claim of unsupportedClaims) {
    // Escape special regex characters in the claim
    const escapedClaim = claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Try to find and wrap the claim in strikethrough
    const regex = new RegExp(`(${escapedClaim})`, 'gi');
    result = result.replace(regex, '~~$1~~');
  }
  return result;
};

const renderMessageContent = (text: string, sources?: Source[], unsupportedClaims?: string[]) => {
  const serifFont = { fontFamily: 'Georgia, "Times New Roman", serif' };
  
  // Apply strikethrough to unsupported claims if any
  const processedText = applyStrikethrough(text, unsupportedClaims || []);
  
  if (!sources || sources.length === 0) {
    return (
      <>
        <style>{`
          .prose-content {
            font-family: Georgia, "Times New Roman", serif;
          }
          .prose-content h1,
          .prose-content h2,
          .prose-content h3,
          .prose-content h4 {
            font-family: Georgia, "Times New Roman", serif;
            font-weight: bold;
            margin-top: 2rem;
            margin-bottom: 1rem;
          }
          .prose-content h2 {
            font-size: 1.5rem;
            margin-top: 2.5rem;
          }
          .prose-content h3 {
            font-size: 1.25rem;
            margin-top: 2rem;
          }
          .prose-content p {
            margin-bottom: 1.5rem !important;
            margin-top: 0 !important;
            line-height: 1.7;
          }
          .prose-content p:last-child {
            margin-bottom: 0 !important;
          }
          .prose-content ul,
          .prose-content ol {
            margin-top: 1rem;
            margin-bottom: 1.5rem;
            padding-left: 1.5rem;
          }
          .prose-content li {
            margin-bottom: 0.75rem;
            line-height: 1.7;
          }
          .prose-content ul ul,
          .prose-content ol ol,
          .prose-content ul ol,
          .prose-content ol ul {
            margin-top: 0.5rem;
            margin-bottom: 0.75rem;
          }
          .prose-content strong {
            font-weight: 600;
            color: #1a1a1a;
          }
          .prose-content del {
            color: #dc2626;
            text-decoration: line-through;
            background-color: #fee2e2;
            padding: 0 2px;
            border-radius: 2px;
          }
        `}</style>
        <div className="prose prose-sm max-w-none prose-content"
          style={serifFont}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{processedText}</ReactMarkdown>
        </div>
      </>
    );
  }

  // Regex to find and capture citation numbers like [1], [2], etc.
  const parts = processedText.split(/(\[\d+\])/g);

  return (
    <>
      <style>{`
        .prose-content {
          font-family: Georgia, "Times New Roman", serif;
        }
        .prose-content h1,
        .prose-content h2,
        .prose-content h3,
        .prose-content h4 {
          font-family: Georgia, "Times New Roman", serif;
          font-weight: bold;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .prose-content h2 {
          font-size: 1.5rem;
          margin-top: 2.5rem;
        }
        .prose-content h3 {
          font-size: 1.25rem;
          margin-top: 2rem;
        }
        .prose-content p {
          margin-bottom: 1.5rem !important;
          margin-top: 0 !important;
          line-height: 1.7;
        }
        .prose-content p:last-child {
          margin-bottom: 0 !important;
        }
        .prose-content ul,
        .prose-content ol {
          margin-top: 1rem;
          margin-bottom: 1.5rem;
          padding-left: 1.5rem;
        }
        .prose-content li {
          margin-bottom: 0.75rem;
          line-height: 1.7;
        }
        .prose-content ul ul,
        .prose-content ol ol,
        .prose-content ul ol,
        .prose-content ol ul {
          margin-top: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .prose-content strong {
          font-weight: 600;
          color: #1a1a1a;
        }
        .prose-content del {
          color: #dc2626;
          text-decoration: line-through;
          background-color: #fee2e2;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
      <div className="prose prose-sm max-w-none prose-content"
        style={serifFont}>
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
    </>
  );
};

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;
  const [copied, setCopied] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  // Copy message text to clipboard
  const handleCopy = async () => {
    try {
      // Get plain text version (strip markdown for cleaner copy)
      const plainText = message.text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italic
        .replace(/#{1,6}\s/g, '') // Headers
        .replace(/\[(\d+)\]/g, '[$1]'); // Keep citations
      
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Print message
  const handlePrint = () => {
    const printContent = messageRef.current;
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }

    // Get sources for the footer
    const sourcesHtml = message.sources && message.sources.length > 0
      ? `<div class="sources">
          <h3>Sources</h3>
          <ol>
            ${message.sources.map((s, i) => `<li><strong>${s.title}</strong><br/><a href="${s.url}">${s.url}</a></li>`).join('')}
          </ol>
        </div>`
      : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>California Law Chatbot - Response</title>
        <style>
          body {
            font-family: Georgia, "Times New Roman", serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.7;
            color: #333;
          }
          h1, h2, h3, h4 {
            font-family: Georgia, "Times New Roman", serif;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }
          h1 { font-size: 1.8em; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { font-size: 1.4em; }
          h3 { font-size: 1.2em; }
          p { margin-bottom: 1em; }
          ul, ol { margin: 1em 0; padding-left: 2em; }
          li { margin-bottom: 0.5em; }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #ccc;
          }
          .header h1 { border: none; margin-bottom: 5px; }
          .header .date { color: #666; font-size: 0.9em; }
          .sources {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
          }
          .sources h3 { margin-top: 0; }
          .sources ol { font-size: 0.9em; }
          .sources a { color: #0066cc; }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.8em;
            margin-right: 8px;
            margin-bottom: 15px;
          }
          .badge-ceb { background: #fef3c7; color: #92400e; }
          .badge-verified { background: #d1fae5; color: #065f46; }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
            font-size: 0.8em;
            color: #666;
            text-align: center;
          }
          @media print {
            body { margin: 0; padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>California Law Chatbot</h1>
          <div class="date">Generated: ${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</div>
        </div>
        ${message.isCEBBased ? '<span class="badge badge-ceb">CEB Verified</span>' : ''}
        ${message.verificationStatus === 'verified' ? '<span class="badge badge-verified">Verified</span>' : ''}
        <div class="content">
          ${printContent.innerHTML}
        </div>
        ${sourcesHtml}
        <div class="footer">
          <p>This document was generated by California Law Chatbot. Please verify all legal information with a qualified attorney.</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start space-x-4 w-full max-w-[90%]">
          <div className="bg-blue-500 text-white rounded-lg rounded-br-none p-4 shadow-md" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            <p className="whitespace-pre-wrap">{message.text}</p>
          </div>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-blue-600"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
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

  // Get verification status
  const verificationStatus = message.verificationStatus || 'unverified';
  
  // Determine verification badge
  const getVerificationBadge = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1 animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Verifying...
          </div>
        );
      case 'verified':
        return (
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Verified
          </div>
        );
      case 'partially_verified':
        return (
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Partially Verified
          </div>
        );
      case 'refusal':
        return (
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Cannot Verify
          </div>
        );
      default:
        return null;
    }
  };

  // Conditionally render source list only if there are no inline citations
  const showSourceList = message.sources && message.sources.length > 0 && !message.text.match(/\[\d+\]/);

  // Check if this is a CEB-based response
  const isCEBBased = message.isCEBBased || (message.sources && message.sources.some(s => 'isCEB' in s && s.isCEB));
  const cebCategory = message.cebCategory || (message.sources && message.sources.find(s => 'isCEB' in s && s.isCEB) as CEBSource)?.category;
  
  // Get source mode
  const sourceMode = message.sourceMode || 'hybrid';
  
  // Get mode badge
  const getModeBadge = () => {
    switch (sourceMode) {
      case 'ceb-only':
        return (
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
            CEB Only
          </div>
        );
      case 'ai-only':
        return (
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 9h.01"/>
              <path d="M15 9h.01"/>
              <path d="M9 15c.5.5 1.5 1 3 1s2.5-.5 3-1"/>
            </svg>
            AI Only
          </div>
        );
      case 'hybrid':
        return (
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1">
              <path d="M12 2v20M2 12h20"/>
            </svg>
            Hybrid Mode
          </div>
        );
      default:
        return null;
    }
  };

  return (
  <div className="flex justify-start">
      <div className="flex items-start space-x-4 w-full max-w-[90%]">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-gray-600"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
        </div>
        <div className="bg-white rounded-lg rounded-bl-none p-5 border border-gray-200 shadow-md w-full relative" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {/* Action Buttons - Copy and Print */}
        {message.id !== 'initial-bot-message' && (
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
            <button
              onClick={handlePrint}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
              title="Print response"
            >
              <PrintIcon />
            </button>
          </div>
        )}
        
        {/* Mode Badge - Don't show for initial welcome message */}
        {message.id !== 'initial-bot-message' && (
          <div className="mb-3 flex items-center gap-2 flex-wrap pr-20">
            {getModeBadge()}
            {isCEBBased && cebCategory && <CEBBadge category={cebCategory} />}
          </div>
        )}
        
        {/* CourtListener Badge */}
        {usedCourtListener && (
        <div className="mb-3 flex items-center">
        <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
        CourtListener Enhanced
        </div>
        </div>
        )}
        
        {/* Verification Badge */}
        {getVerificationBadge() && verificationStatus !== 'not_needed' && (
          <div className="mb-3 flex items-center">
            {getVerificationBadge()}
          </div>
        )}
          {!usedCourtListener && hasOfficialSources && !needsVerification && verificationStatus === 'unverified' && (
          <div className="mb-3 flex items-center">
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          Legal Sources Included
          </div>
          </div>
          )}
          {needsVerification && verificationStatus === 'unverified' && (
            <div className="mb-3 flex items-center">
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                Verification Recommended
              </div>
            </div>
          )}
          <div ref={messageRef}>
            {renderMessageContent(
              message.text, 
              message.sources,
              // Pass unsupported claim texts for strikethrough
              message.verificationReport?.unsupportedClaims?.map(c => c.text)
            )}
          </div>
          {showSourceList && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2 text-green-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
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
