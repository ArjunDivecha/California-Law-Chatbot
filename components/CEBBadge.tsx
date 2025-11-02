/**
 * CEB Verification Badge Component
 * 
 * Displays a prominent badge for responses based on authoritative CEB sources.
 * Shows the CEB category (Trusts & Estates, Family Law, Business Litigation).
 * 
 * Version: 1.0
 * Last Updated: November 1, 2025
 */

import React from 'react';
import type { CEBSource } from '../types';

interface CEBBadgeProps {
  sources: (any | CEBSource)[];
  category?: string;
}

export const CEBBadge: React.FC<CEBBadgeProps> = ({ sources, category }) => {
  // Check if any sources are CEB sources
  const hasCEBSources = sources?.some((s): s is CEBSource => 'isCEB' in s && s.isCEB);
  
  if (!hasCEBSources) {
    return null;
  }

  // Get category from sources if not provided
  const cebCategory = category || 
    (sources?.find((s): s is CEBSource => 'isCEB' in s && s.isCEB) as CEBSource)?.category;

  // Format category name for display
  const getCategoryDisplay = (cat?: string): string => {
    if (!cat) return 'CEB';
    
    switch (cat) {
      case 'trusts_estates':
        return 'Trusts & Estates';
      case 'family_law':
        return 'Family Law';
      case 'business_litigation':
        return 'Business Litigation';
      default:
        return 'CEB';
    }
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 18px',
      backgroundColor: '#fef3c7', // Warm gold/amber background
      border: '2px solid #f59e0b', // Amber border
      borderRadius: '8px',
      marginBottom: '16px',
      fontWeight: 600,
      fontSize: '14px',
      color: '#92400e', // Dark amber text
      boxShadow: '0 2px 4px rgba(245, 158, 11, 0.1)',
    }}>
      {/* Checkmark icon */}
      <span style={{ 
        fontSize: '20px',
        lineHeight: 1,
      }}>✅</span>
      
      {/* Main badge text */}
      <span style={{
        letterSpacing: '0.5px',
      }}>CEB VERIFIED</span>
      
      {/* Category pill */}
      <span style={{ 
        fontSize: '12px', 
        fontWeight: 500,
        padding: '3px 10px',
        backgroundColor: '#fbbf24', // Slightly darker amber
        borderRadius: '12px',
        color: '#78350f', // Very dark amber
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
      }}>
        {getCategoryDisplay(cebCategory)}
      </span>
      
      {/* Info icon with tooltip */}
      <span 
        title="This response is based on authoritative CEB (Continuing Education of the Bar) publications - the gold standard for California legal practice. No additional verification needed."
        style={{
          fontSize: '16px',
          cursor: 'help',
          opacity: 0.7,
          lineHeight: 1,
        }}
      >ℹ️</span>
    </div>
  );
};

/**
 * INTEGRATION INSTRUCTIONS FOR Message.tsx:
 * 
 * 1. Import the CEBBadge component:
 *    import { CEBBadge } from './CEBBadge';
 * 
 * 2. Import CEBSource type:
 *    import type { CEBSource } from '../types';
 * 
 * 3. Add the badge before the existing source badges in the Message component:
 * 
 *    {message.role === MessageRole.BOT && (
 *      <>
 *        <CEBBadge sources={message.sources} category={message.cebCategory} />
 *        
 *        {/* Existing badges below... *\/}
 *        {hasCourtListenerSources && (
 *          <div style={{...}}>
 *            ...
 *          </div>
 *        )}
 *      </>
 *    )}
 * 
 * That's it! The badge will automatically show for CEB-based responses.
 */

