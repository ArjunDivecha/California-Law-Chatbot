/**
 * California Code Lookup Utilities
 *
 * Provides utilities for parsing and looking up California statutory citations.
 * Supports all 29 California Codes with various citation formats.
 */

export interface CaliforniaCode {
    lawCode: string;      // Code used in leginfo URLs (e.g., 'FAM')
    fullName: string;     // Full name (e.g., 'Family Code')
    abbreviations: string[];  // Common abbreviations
}

/**
 * Map of all 29 California Codes
 */
export const CALIFORNIA_CODES: Record<string, CaliforniaCode> = {
    // Common codes used in family/estate law
    'FAM': { lawCode: 'FAM', fullName: 'Family Code', abbreviations: ['Fam', 'Fam.', 'Family'] },
    'PROB': { lawCode: 'PROB', fullName: 'Probate Code', abbreviations: ['Prob', 'Prob.', 'Probate'] },
    'CIV': { lawCode: 'CIV', fullName: 'Civil Code', abbreviations: ['Civ', 'Civ.', 'Civil'] },
    'CCP': { lawCode: 'CCP', fullName: 'Code of Civil Procedure', abbreviations: ['CCP', 'C.C.P.', 'Code Civ. Proc.'] },

    // Criminal and government
    'PEN': { lawCode: 'PEN', fullName: 'Penal Code', abbreviations: ['Pen', 'Pen.', 'Penal'] },
    'GOV': { lawCode: 'GOV', fullName: 'Government Code', abbreviations: ['Gov', 'Gov.', 'Government', 'Govt'] },

    // Business codes
    'BPC': { lawCode: 'BPC', fullName: 'Business and Professions Code', abbreviations: ['BPC', 'B&P', 'Bus. & Prof.'] },
    'CORP': { lawCode: 'CORP', fullName: 'Corporations Code', abbreviations: ['Corp', 'Corp.', 'Corporations'] },
    'COM': { lawCode: 'COM', fullName: 'Commercial Code', abbreviations: ['Com', 'Com.', 'Commercial'] },
    'FIN': { lawCode: 'FIN', fullName: 'Financial Code', abbreviations: ['Fin', 'Fin.', 'Financial'] },
    'INS': { lawCode: 'INS', fullName: 'Insurance Code', abbreviations: ['Ins', 'Ins.', 'Insurance'] },

    // Evidence and procedure
    'EVID': { lawCode: 'EVID', fullName: 'Evidence Code', abbreviations: ['Evid', 'Evid.', 'Evidence'] },

    // Health and safety
    'HSC': { lawCode: 'HSC', fullName: 'Health and Safety Code', abbreviations: ['HSC', 'H&S', 'Health & Safety', 'Health & Saf.'] },
    'WIC': { lawCode: 'WIC', fullName: 'Welfare and Institutions Code', abbreviations: ['WIC', 'W&I', 'Welf. & Inst.'] },

    // Labor and employment
    'LAB': { lawCode: 'LAB', fullName: 'Labor Code', abbreviations: ['Lab', 'Lab.', 'Labor'] },
    'UIC': { lawCode: 'UIC', fullName: 'Unemployment Insurance Code', abbreviations: ['UIC', 'U.I.C.', 'Unemp. Ins.'] },

    // Transportation and vehicles
    'VEH': { lawCode: 'VEH', fullName: 'Vehicle Code', abbreviations: ['Veh', 'Veh.', 'Vehicle'] },
    'SHC': { lawCode: 'SHC', fullName: 'Streets and Highways Code', abbreviations: ['SHC', 'S&H', 'Streets & Highways'] },
    'PRC': { lawCode: 'PRC', fullName: 'Public Resources Code', abbreviations: ['PRC', 'Pub. Res.', 'Public Resources'] },
    'PUC': { lawCode: 'PUC', fullName: 'Public Utilities Code', abbreviations: ['PUC', 'Pub. Util.', 'Public Utilities'] },
    'HAR': { lawCode: 'HAR', fullName: 'Harbors and Navigation Code', abbreviations: ['HAR', 'Harb. & Nav.'] },

    // Property and resources
    'WAT': { lawCode: 'WAT', fullName: 'Water Code', abbreviations: ['Wat', 'Wat.', 'Water'] },
    'FAC': { lawCode: 'FAC', fullName: 'Food and Agricultural Code', abbreviations: ['FAC', 'F&A', 'Food & Ag.'] },
    'FGC': { lawCode: 'FGC', fullName: 'Fish and Game Code', abbreviations: ['FGC', 'F&G', 'Fish & Game'] },

    // Taxation
    'RTC': { lawCode: 'RTC', fullName: 'Revenue and Taxation Code', abbreviations: ['RTC', 'R&T', 'Rev. & Tax.'] },

    // Education
    'EDC': { lawCode: 'EDC', fullName: 'Education Code', abbreviations: ['Edc', 'Ed.', 'Education'] },

    // Military
    'MVC': { lawCode: 'MVC', fullName: 'Military and Veterans Code', abbreviations: ['MVC', 'M&V', 'Mil. & Vet.'] },

    // Elections
    'ELEC': { lawCode: 'ELEC', fullName: 'Elections Code', abbreviations: ['Elec', 'Elec.', 'Elections'] },

    // Public Contract
    'PCC': { lawCode: 'PCC', fullName: 'Public Contract Code', abbreviations: ['PCC', 'Pub. Cont.', 'Public Contract'] },
};

/**
 * Parsed California code citation
 */
export interface ParsedCitation {
    lawCode: string;      // Standardized code (e.g., 'FAM')
    fullName: string;     // Full name (e.g., 'Family Code')
    section: string;      // Section number (e.g., '1615')
    subsection?: string;  // Subsection if present (e.g., 'a', 'b(1)')
    fullText: string;     // Original matched text
    url: string;          // leginfo.legislature.ca.gov URL
}

/**
 * Parse California code citations from text
 * Handles various formats:
 * - "Family Code section 1615"
 * - "Cal. Fam. Code § 1615"
 * - "Fam. Code § 1615(a)"
 * - "Cal. Fam. Code § 1615(a)(1)"
 */
export function parseCodeCitation(text: string): ParsedCitation[] {
    const citations: ParsedCitation[] = [];
    const seen = new Set<string>(); // Avoid duplicates

    // Build pattern for all code names and abbreviations
    const codePatterns = Object.values(CALIFORNIA_CODES)
        .flatMap(code => [
            code.fullName.replace(/\s+/g, '\\s+'),
            ...code.abbreviations.map(abbr => abbr.replace(/\./g, '\\.?').replace(/&/g, '(?:and|&)'))
        ])
        .join('|');

    // Main pattern: captures code name, section number, and optional subsection
    // Handles: "California Family Code § 1615(a)(1)" or "Fam. Code section 1615"
    const pattern = new RegExp(
        `(?:Cal(?:ifornia)?\\.?\\s+)?` +  // Optional "California" or "Cal."
        `(${codePatterns})` +               // Code name or abbreviation
        `\\s*Code\\s*` +                    // "Code"
        `(?:§§?|[Ss]ec(?:tion|\\.)?)?\\s*` + // § or "section" or "sec."
        `(\\d+(?:\\.\\d+)?)` +              // Section number (e.g., "1615" or "1615.5")
        `(?:\\s*\\(([^)]+(?:\\)\\s*\\([^)]+)*)\\))?`, // Optional subsection(s)
        'gi'
    );

    let match;
    while ((match = pattern.exec(text)) !== null) {
        const codeMatch = match[1] || '';
        const section = match[2] || '';
        const subsection = match[3];

        // Find the standardized law code
        const lawCode = findLawCode(codeMatch);
        if (!lawCode) continue;

        const codeInfo = CALIFORNIA_CODES[lawCode];
        const key = `${lawCode}:${section}`;

        if (seen.has(key)) continue;
        seen.add(key);

        const url = buildLeginfoUrl(lawCode, section);

        citations.push({
            lawCode,
            fullName: codeInfo.fullName,
            section,
            subsection: subsection?.trim(),
            fullText: match[0],
            url
        });
    }

    // Also try direct abbreviation patterns (e.g., "FAM § 1615")
    const abbreviationPattern = /\b(FAM|PROB|CIV|CCP|PEN|GOV|BPC|CORP|COM|FIN|INS|EVID|HSC|WIC|LAB|UIC|VEH|SHC|PRC|PUC|HAR|WAT|FAC|FGC|RTC|EDC|MVC|ELEC|PCC)\s*(?:§§?|[Ss]ec(?:tion|\\.)?)\s*(\d+(?:\.\d+)?)(?:\s*\(([^)]+)\))?/gi;

    while ((match = abbreviationPattern.exec(text)) !== null) {
        const lawCode = match[1].toUpperCase();
        const section = match[2];
        const subsection = match[3];

        const codeInfo = CALIFORNIA_CODES[lawCode];
        if (!codeInfo) continue;

        const key = `${lawCode}:${section}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const url = buildLeginfoUrl(lawCode, section);

        citations.push({
            lawCode,
            fullName: codeInfo.fullName,
            section,
            subsection: subsection?.trim(),
            fullText: match[0],
            url
        });
    }

    return citations;
}

/**
 * Find the standardized law code from a code name or abbreviation
 */
function findLawCode(codeMatch: string): string | null {
    const normalized = codeMatch.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

    for (const [lawCode, info] of Object.entries(CALIFORNIA_CODES)) {
        // Check full name
        if (info.fullName.toLowerCase().replace(/\s+/g, ' ').includes(normalized) ||
            normalized.includes(info.fullName.toLowerCase().replace(/\s+/g, ' '))) {
            return lawCode;
        }

        // Check abbreviations
        for (const abbr of info.abbreviations) {
            if (abbr.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ') === normalized) {
                return lawCode;
            }
        }
    }

    return null;
}

/**
 * Build a leginfo.legislature.ca.gov URL for a code section
 */
export function buildLeginfoUrl(lawCode: string, section: string): string {
    // Clean section number (remove any trailing year-like patterns)
    let cleanSection = section;
    const yearPattern = /^(\d+)\.(\d{4})$/;
    const yearMatch = cleanSection.match(yearPattern);
    if (yearMatch) {
        cleanSection = yearMatch[1];
    }

    return `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=${lawCode}&sectionNum=${cleanSection}`;
}

/**
 * Get the full name of a California code from its abbreviation
 */
export function getCodeFullName(lawCode: string): string | null {
    const code = CALIFORNIA_CODES[lawCode.toUpperCase()];
    return code ? code.fullName : null;
}

/**
 * Check if text contains any California code citations
 */
export function containsCodeCitation(text: string): boolean {
    // Quick check for common patterns
    const quickPatterns = [
        /(?:Cal\.?\s+)?(?:Fam(?:ily)?|Prob(?:ate)?|Civ(?:il)?|Pen(?:al)?|Gov(?:ernment)?|Corp(?:orations?)?|Evid(?:ence)?|Lab(?:or)?|Veh(?:icle)?|Bus(?:iness)?)/i,
        /\b(FAM|PROB|CIV|CCP|PEN|GOV|BPC|CORP|EVID|LAB|VEH|HSC|WIC)\s*(?:§|[Ss]ec)/i
    ];

    return quickPatterns.some(pattern => pattern.test(text));
}

/**
 * Extract search terms for CEB vector search from parsed citations
 */
export function citationToSearchTerms(citations: ParsedCitation[]): string[] {
    return citations.map(cite => {
        // Create searchable terms like "Family Code section 1615"
        return `${cite.fullName} section ${cite.section}`;
    });
}
