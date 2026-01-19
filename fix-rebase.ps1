# Script to fix the Stripe secret in commit history
$commitToEdit = "de8a06a"

# Checkout the commit with the secret
git checkout $commitToEdit

# The file should already have the fix from our previous edit, but let's make sure
# Actually, we need to apply the fix to this commit
$content = @"
# Stripe Integration - Complete Implementation

## ✅ Status: Fully Implemented

All Stripe integration features have been implemented and are ready for use.

---

## Configuration

### Environment Variables

Add to `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here  # Optional for local testing
```
---
"@

# Read the full file first
$fullContent = Get-Content "server/STRIPE_INTEGRATION.md" -Raw
# Replace the secret key section
$fullContent = $fullContent -replace 'STRIPE_SECRET_KEY=sk_test_[^\s`]+', 'STRIPE_SECRET_KEY=sk_test_your_secret_key_here'
$fullContent = $fullContent -replace 'STRIPE_PUBLISHABLE_KEY=pk_test_[^\s`]+', 'STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here'
$fullContent | Set-Content "server/STRIPE_INTEGRATION.md"

# Amend the commit
git add server/STRIPE_INTEGRATION.md
git commit --amend --no-edit

# Continue with the rest
git checkout main





