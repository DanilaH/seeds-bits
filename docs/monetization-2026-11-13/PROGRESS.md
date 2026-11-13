# Monetization implementation checkpoint

Actual base: `4d8943187567e20e178a86719d782c9ad3c06bc9`, preserving the guidance adoption after the research base `24ae94f`. Work branch: `feat/monetization-assists-20261113`. Normative package is retained in `spec/`; no game-specific material is being sent upstream.

Foundation C / A1–A3: versioned product receipt, frozen hint intent, separate durable grant and reveal, native readiness, off-by-default A3 QA profile, product inventories/assignment storage and new event allowlists. Save wire is 6, ordinary rules remain 1, receipt is 1; exact legacy receipts remain hint packs. Invalid/new help authority is protected from destructive recovery.

Native receipt keeps an independent in-process copy across failed SharedPreferences commits/acknowledgements. A failed earned commit must not notify JS; pending recovery retries the same token. This cannot manufacture a disk write when storage is permanently unavailable.

Revenue continues through the existing manual AdRevenue dataset. Added impression-instance IDs, assignment payload and separate coverage diagnostics, not a second sum of revenue. SDK enqueue/receipt crash gaps require downstream dedup by impression ID. Automatic/manual selection and real export join remain unverified until actual cabinet access and paid traffic; QA is excluded.

Local verification so far: 81 unit tests, build; 16 browser scenarios across the original monetization suite and new foundation suite. Browser uses Chromium headless shell, not a physical phone. Native additions need Java/Android CI. No rollout, no store publishing, no money/retention conclusion.

Next: finish native CI and separate B1 transition/search/entitlement/UI, then deliver the first isolated QA configurations before B2/A4/labs.
