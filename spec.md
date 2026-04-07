# MoiraSmartBank V17 — V18 ROC India Module

## Current State
The app is a full-screen 4D Neon command center HUD with tabs: COMMAND DASHBOARD, THREAT INTELLIGENCE, GLOBAL OPERATIONS, SECURE VAULT, COMPLIANCE LOGS, ADMIN PORTAL, MOIRA LAB, MOIRA LIBRARY, MOIRA BRAIN, MOIRA CODE. TabId union and NAV_TABS array define navigation. Compliance ticker runs across bottom. Main App.tsx is ~5600 lines.

## Requested Changes (Diff)

### Add
- New tab: `roc-india` with label `🏛 ROC INDIA` added to TabId union, NAV_TABS array, and main render switch
- New component `RocIndiaPanel` rendered when `activeTab === 'roc-india'`
- RocIndiaPanel displays: MoiraSmartBank FinTech Logic & Logistics Ltd — full ROC India corporate identity card including:
  - Company name: MOIRASMARTBANK FINTECH LOGIC & LOGISTICS LTD
  - Company type: Private Limited Company (to be upgraded to Public)
  - ROC jurisdiction: ROC Chennai / ROC Bangalore (TBD — displayed as ROC INDIA)
  - CIN format placeholder: U74999TN2024PTC000000 (clearly marked PENDING ALLOTMENT for demo)
  - Incorporation date, registered office address, authorized capital, paid-up capital fields
  - Directors table (Founder/CEO, Co-Founder, CTO placeholders)
  - MCA21 filing status badges
  - Digital seal / government stamp graphic
  - V18 INFINITE badge
  - PRINT ROC CERTIFICATE button (generates downloadable document)
- Compliance ticker updated to include ROC INDIA REGISTERED entity reference

### Modify
- `TabId` type: add `| 'roc-india'`
- `NAV_TABS` array: add `{ id: 'roc-india', label: '🏛 ROC INDIA' }`
- Main content render block: add `{activeTab === 'roc-india' && <RocIndiaPanel />}`
- The `activeTab !== ...` guard for `ActiveModulePlaceholder` updated to exclude `roc-india`
- TICKER_TEXT: prepend ROC India entity reference

### Remove
- Nothing removed

## Implementation Plan
1. Add `roc-india` to TabId union
2. Add tab to NAV_TABS
3. Build RocIndiaPanel component in App.tsx with full corporate identity UI
4. Wire tab render in main content block
5. Update compliance ticker text
6. Add PRINT ROC CERTIFICATE handler (downloads text/html document)
