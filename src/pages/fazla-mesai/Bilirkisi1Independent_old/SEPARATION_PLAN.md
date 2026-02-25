# COMPLETE PAGE SEPARATION PLAN

## OBJECTIVE
Create COMPLETELY ISOLATED standalone pages for STANDART and HAFTALIK_KARMA scenarios.
Each page must work 100% identically to current behavior.

## CURRENT STRUCTURE (index.tsx - 4630 lines)

### SHARED COMPONENTS (Copy to both pages)
- All imports (React, hooks, utilities)
- Toast system
- Layout components
- Modal components (Katsayi, Mahsuplasama, Zamanasimi)
- Footer actions
- Report preview
- Save/Load functionality
- Exclusions management
- Common state (iseGiris, istenCikis, exclusions, notes, etc.)

### STANDART-SPECIFIC (Copy to StandartPage.tsx)
- standardState (davaci, witnesses)
- useStandartScenario hook
- STANDART calculation logic
- STANDART table rendering
- STANDART text generation
- STANDART UI sections (when calculationScenario === "STANDART")

### HAFTALIK_KARMA-SPECIFIC (Copy to HaftalikKarmaPage.tsx)
- haftalikKarmaState (dayGroups, witnesses, dates)
- useHaftalikKarmaScenario hook
- HAFTALIK_KARMA calculation logic
- HAFTALIK_KARMA table rendering
- HAFTALIK_KARMA text generation
- HAFTALIK_KARMA UI sections (when calculationScenario === "HAFTALIK_KARMA")

## EXECUTION PLAN

### Step 1: Create StandartPage.tsx
1. Copy all imports from index.tsx
2. Copy all helper functions
3. Copy ToastProvider wrapper
4. Copy all shared state (iseGiris, istenCikis, exclusions, etc.)
5. Copy standardState and related logic
6. Copy useStandartScenario hook usage
7. Copy STANDART calculation useMemo
8. Copy STANDART table rendering
9. Copy STANDART text generation
10. Copy STANDART UI sections
11. Remove all HAFTALIK_KARMA references
12. Set calculationScenario = "STANDART" (hardcoded)

### Step 2: Create HaftalikKarmaPage.tsx
1. Copy all imports from index.tsx
2. Copy all helper functions
3. Copy ToastProvider wrapper
4. Copy all shared state (iseGiris, istenCikis, exclusions, etc.)
5. Copy haftalikKarmaState and related logic
6. Copy useHaftalikKarmaScenario hook usage
7. Copy HAFTALIK_KARMA calculation useMemo
8. Copy HAFTALIK_KARMA table rendering
9. Copy HAFTALIK_KARMA text generation
10. Copy HAFTALIK_KARMA UI sections
11. Remove all STANDART references
12. Set calculationScenario = "HAFTALIK_KARMA" (hardcoded)

### Step 3: Update Routing
- /bilirkisi-1/standart → StandartPage
- /bilirkisi-1/haftalik-karma → HaftalikKarmaPage

### Step 4: Testing
- Test STANDART: All calculations, text, table must work identically
- Test HAFTALIK_KARMA: All calculations, text, table must work identically
- Verify NO state bleeding between pages

## CRITICAL RULES
❌ NO refactoring
❌ NO optimization
❌ NO logic changes
✅ ONLY copy-paste existing working code
✅ Preserve 100% identical behavior
✅ Complete isolation - no shared scenario state

## STATUS
- [ ] StandartPage.tsx created
- [ ] HaftalikKarmaPage.tsx created
- [ ] Routing updated
- [ ] STANDART tested
- [ ] HAFTALIK_KARMA tested
