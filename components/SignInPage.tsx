/**
 * Sign-in page — wraps Clerk's <SignIn> with the app's branding.
 *
 * Artboard 01 (docs/design-handoff/DancingElephant Redesign.dc.html,
 * lines 27-61): split layout — dark plum brand panel on the left (hidden
 * on small screens), Clerk sign-in card on the right. The Clerk
 * component itself is unchanged; only its `appearance` prop is styled.
 */

import React from 'react';
import { SignIn } from '@clerk/clerk-react';

const SignInPage: React.FC = () => {
  return (
    <div className="min-h-screen flex">
      {/* Left brand panel — dark plum, sign-in/marketing only per design tokens. */}
      <div className="hidden lg:flex lg:w-[44%] shrink-0 bg-plum flex-col justify-between p-14">
        <div className="flex items-center gap-3">
          <img src="/dancingelephant.png" alt="DancingElephant" className="w-11 h-11 rounded-[12px]" />
          <span className="font-display text-xl font-semibold text-plum-text">DancingElephant</span>
        </div>
        <div>
          <img src="/dancingelephant.png" alt="" className="w-[300px] h-[300px] rounded-[32px] block mb-9" />
          <div className="font-display text-[44px] font-semibold leading-[1.15] text-plum-text max-w-[420px]">
            Legal AI that never forgets to check.
          </div>
          <div className="de-rule mt-5 max-w-[400px]" />
          <p className="text-[15px] leading-relaxed text-plum-muted max-w-[400px] mt-5">
            Research, drafting, and citation verification for California attorneys — with
            client information protected on your device before anything is sent.
          </p>
        </div>
        <div className="text-xs text-plum-muted">Every citation checked against the official record.</div>
      </div>

      {/* Right side — Clerk sign-in card. */}
      <div className="flex-1 bg-surface-app flex items-center justify-center p-6">
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/"
          appearance={{
            variables: {
              colorPrimary: '#7C5CFC',
              colorText: '#2A2233',
              colorTextSecondary: '#6E6580',
              colorBackground: '#FFFFFF',
              colorInputBackground: '#FFFFFF',
              colorInputText: '#2A2233',
              borderRadius: '10px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica Neue, Arial, sans-serif',
            },
            elements: {
              card: 'shadow-card border border-surface-line rounded-[14px]',
              headerTitle: 'font-display text-2xl font-semibold text-ink',
              headerSubtitle: 'text-[13.5px] text-ink-muted',
              formButtonPrimary:
                'bg-brand hover:bg-brand-deep text-white text-sm font-semibold rounded-[10px] normal-case',
              formFieldInput: 'border border-surface-ctl rounded-[10px] text-sm',
              footerActionLink: 'text-brand hover:text-brand-deep',
              socialButtonsBlockButton: 'border border-surface-ctl rounded-[10px]',
            },
          }}
        />
      </div>
    </div>
  );
};

export default SignInPage;
