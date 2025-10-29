
import React, { useState, useEffect } from 'react';
import { useChat } from './hooks/useChat';
import ChatWindow from './components/ChatWindow';
import ChatInput from './components/ChatInput';

const App: React.FC = () => {
  // Read CourtListener API key from environment variables (set in Vercel)
  const courtListenerApiKey = process.env.COURTLISTENER_API_KEY || null;

  const { messages, sendMessage, isLoading } = useChat(courtListenerApiKey);
  const [showConfidentialityWarning, setShowConfidentialityWarning] = useState(true);
  const [showAIDisclosure, setShowAIDisclosure] = useState(() => {
    const acknowledged = localStorage.getItem('ai-disclosure-acknowledged');
    return !acknowledged;
  });

  useEffect(() => {
    const dismissed = localStorage.getItem('confidentiality-warning-dismissed');
    if (dismissed === 'true') {
      setShowConfidentialityWarning(false);
    }
  }, []);

  const handleDismissConfidentiality = () => {
    localStorage.setItem('confidentiality-warning-dismissed', 'true');
    setShowConfidentialityWarning(false);
  };

  const handleAcknowledgeAI = () => {
    localStorage.setItem('ai-disclosure-acknowledged', 'true');
    setShowAIDisclosure(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* AI Disclosure Modal */}
      {showAIDisclosure && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Important Disclosure: Use of Generative AI
              </h2>
              <p className="text-sm text-gray-600">
                California State Bar Compliance Notice
              </p>
            </div>
            <div className="p-6 space-y-4 text-gray-700">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <p className="font-semibold text-yellow-800 mb-2">⚠️ NOT LEGAL ADVICE</p>
                <p className="text-sm text-yellow-700">
                  This tool provides general legal information and research assistance. It is NOT a substitute for professional legal counsel. All information must be reviewed and verified by a qualified attorney before use.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Technology Used</h3>
                <p className="text-sm mb-2">
                  This chatbot uses <strong>Google Gemini 2.5 Flash</strong>, a generative artificial intelligence system. 
                  Your queries and any information you input may be transmitted to Google's servers for processing.
                </p>
              </div>

              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <p className="font-semibold text-red-800 mb-2">🔒 CONFIDENTIALITY WARNING</p>
                <p className="text-sm text-red-700 mb-2">
                  <strong>DO NOT input confidential client information</strong> into this tool. Client data must be anonymized before use. 
                  This system transmits data to third-party AI services, which may not maintain attorney-client privilege protections.
                </p>
                <p className="text-sm text-red-700">
                  Always consult with IT/cybersecurity professionals before using AI tools with confidential client information.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Limitations & Risks</h3>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>AI systems may produce inaccurate, incomplete, or biased information</li>
                  <li>AI may "hallucinate" or generate false citations and legal authorities</li>
                  <li>All outputs must be critically reviewed and verified by a qualified attorney</li>
                  <li>Professional judgment cannot be delegated to AI systems</li>
                  <li>Information may be outdated or incorrect</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Court Filings</h3>
                <p className="text-sm bg-blue-50 border-l-4 border-blue-400 p-3">
                  If you intend to use information from this tool in court filings, you must:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2 mt-2">
                  <li>Review all AI-generated content for accuracy before submission</li>
                  <li>Verify all citations against primary legal sources</li>
                  <li>Check applicable court rules for AI disclosure requirements</li>
                  <li>Correct any errors or misleading statements</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">No Attorney-Client Relationship</h3>
                <p className="text-sm">
                  Use of this tool does not create an attorney-client relationship. This is a research tool only, 
                  not a legal service provider.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleAcknowledgeAI}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                I Understand and Agree to Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confidentiality Warning Banner */}
      {showConfidentialityWarning && !showAIDisclosure && (
        <div className="bg-red-600 text-white px-4 py-3 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  ⚠️ CONFIDENTIALITY WARNING: Do NOT input confidential client information. 
                  Anonymize all client data before use. This system transmits data to third-party AI services.
                </p>
              </div>
            </div>
            <button
              onClick={handleDismissConfidentiality}
              className="ml-4 text-white hover:text-gray-200 transition-colors"
              aria-label="Dismiss warning"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

       <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center">
          <div className="flex items-center">
            <img src="https://picsum.photos/seed/lawbot/40/40" alt="CA Seal" className="w-10 h-10 rounded-full mr-4" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">California Law Chatbot</h1>
              <p className="text-sm text-gray-500">Your AI legal research assistant</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
      <div className="h-full max-w-4xl mx-auto flex flex-col">
      <ChatWindow messages={messages} isLoading={isLoading} />
      <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
      </main>
    </div>
  );
};

export default App;