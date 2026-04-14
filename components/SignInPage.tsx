/**
 * Sign-in page — wraps Clerk's <SignIn> with the app's branding.
 */

import React from 'react';
import { SignIn } from '@clerk/clerk-react';

const SignInPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm">
            <img src="/Heart Favicon.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            California Law Chatbot
          </h1>
        </div>
        <a
          href="https://www.femmeandfemmelaw.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-pink-500 hover:text-pink-600 hover:underline transition-colors"
        >
          femme & femme LLP
        </a>
      </div>

      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/"
      />
    </div>
  );
};

export default SignInPage;
