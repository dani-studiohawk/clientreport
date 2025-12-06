# Billable Rate Fix - December 6, 2025

## Problem
The "Avg Billable Rate" displayed on client detail pages was wildly incorrect, showing values like $38/hr instead of the expected ~$190/hr.

## Root Cause
The calculation was using `client.agency_value` which is a lookup field from Monday.com that only contains a **single value** (appears to be one sprint's value), not the total contract value.

### Example: Budget Pet Products
- **agency_value**: $10,260 (only 1 sprint worth)
- **Actual total contract value**: $36,720 (4 sprints × $9,180 each)
- **Wrong calculation**: $10,260 / 267.75 hrs = **$38/hr** ❌
- **Correct calculation**: $36,720 / 267.75 hrs = **$137/hr** ✅

## Solution
Changed the calculation to sum up all sprint revenues instead of relying on the `agency_value` field:

```typescript
// OLD (WRONG):
const avgBillableRate = totalHoursUsed > 0 && client.agency_value
  ? client.agency_value / totalHoursUsed
  : null

// NEW (CORRECT):
const totalContractValue = sprints?.reduce((sum, s) => {
  const sprintRevenue = (s.monthly_rate || 0) * 3
  return sum + sprintRevenue
}, 0) || 0

const avgBillableRate = totalHoursUsed > 0 && totalContractValue > 0
  ? totalContractValue / totalHoursUsed
  : null
```

## Files Changed
1. `my-website/src/app/dashboard/clients/[id]/page.tsx`
   - Fixed avg billable rate calculation
   - Fixed contract value display

2. `my-website/src/app/dashboard/clients/mock/page.tsx`
   - Fixed avg billable rate calculation
   - Fixed contract value display

## Impact
- ✅ Avg Billable Rate now shows accurate values
- ✅ Contract Value card now shows total contract value instead of single sprint value
- ✅ More accurate financial reporting across all clients

## Notes
- The `agency_value` field appears unreliable and shouldn't be used for calculations
- Sprint-level `monthly_rate` is the authoritative source for revenue calculations
- Standard assumption: 3-month sprints (monthly_rate × 3 per sprint)
