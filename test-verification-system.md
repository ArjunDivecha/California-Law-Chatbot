# Two-Step Verification System Test

This test suite verifies that the two-step verification system is working correctly.

## What It Tests

1. **Claims Extraction Logic** - Verifies that claims are properly extracted from generator answers with citations
2. **Verification Report Structure** - Validates that verification reports have the correct structure and data types
3. **Confidence Gating Logic** - Tests that the system correctly gates answers based on verification coverage:
   - ✅ **Verified** (coverage = 1.0): All claims supported
   - ⚠️ **Partially Verified** (0.6 ≤ coverage < 1.0): Some claims supported
   - ❌ **Refusal** (coverage < 0.6 or ambiguity): Insufficient support
4. **Two-Step Flow Logic** - Verifies the complete flow from generator → verifier → confidence gating

## How to Run

```bash
npm run test:verification
```

Or directly:
```bash
node test-verification-system.js
```

## Expected Output

```
🚀 Starting Two-Step Verification System Tests

🧪 Testing: Claims Extraction Logic
✅ Claims should be extracted
✅ Claim should reference source [1]
...

📊 Test Results:
   ✅ Passed: 4
   ❌ Failed: 0
   📈 Total: 4

🎉 All tests passed! Two-step verification system logic is correct.
```

## What the Test Verifies

### Step 1: Generator (Claude Sonnet 4.5)
- Produces answer with legal claims
- Includes citations in format `[1]`, `[2]`, etc.

### Step 2: Claims Extraction
- Extracts claims from generator answer
- Identifies source citations
- Categorizes claims (statute, case, fact)

### Step 3: Verifier (Gemini 2.5 Pro)
- Validates each claim against provided sources
- Generates verification report with:
  - `coverage`: Percentage of supported claims
  - `supportedClaims`: Claims with evidence
  - `unsupportedClaims`: Claims without evidence
  - `verifiedQuotes`: Exact quotes supporting claims

### Step 4: Confidence Gating
- Determines final status based on coverage:
  - **Verified**: Show answer (all claims supported)
  - **Partially Verified**: Show answer with caveat (some claims unsupported)
  - **Refusal**: Don't show answer, show refusal message (insufficient support)

## Integration Testing

This test validates the **logic** of the verification system. To test with **actual API calls**, you'll need to:

1. Set up environment variables (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`)
2. Run the Vercel dev server: `vercel dev`
3. Test through the UI or create an integration test that calls the actual API endpoints

## Future Enhancements

- Add integration tests that mock API responses
- Add performance benchmarks
- Add tests for edge cases (empty sources, malformed claims, etc.)
- Add tests for guardrails service integration

