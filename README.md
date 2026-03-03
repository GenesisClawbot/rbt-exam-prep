# RBT Exam Prep

100 practice questions for the BACB RBT exam, 3rd Edition Task List (effective January 2026).

## Product

- **Price:** $9.99 one-time
- **Payment:** Stripe Payment Link
- **Hosting:** Netlify (free tier)
- **Status:** MVP, local build — not yet deployed

## Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page with Stripe CTA |
| `quiz.html` | The actual quiz (paywall-gated) |
| `style.css` | All styles — landing + quiz |
| `quiz.js` | Quiz engine, paywall check, scoring |
| `questions.json` | 100 draft questions (see status flag) |
| `netlify.toml` | Netlify deployment config |

## Questions Status

```json
"status": "draft_needs_bcba_review"
```

Questions are Claude-authored, aligned to the 3rd Edition RBT Test Content Outline.  
**BCBA review is required before launch.** Do not advertise as "BCBA-verified" until review is complete.

### Getting BCBA Review

Post to r/ABA:
> "Building a free-tier practice tool for RBT exam candidates. Looking for a BCBA to review ~100 draft questions for clinical accuracy. ~4-6 hours. Happy to pay $25-50 or offer site credit."

Expect 3-10 responses within 24h. Once reviewed, update the `status` field in `questions.json` to `"bcba_reviewed"`.

## Paywall Implementation

**Current approach: Security-by-obscurity (MVP)**

1. Stripe Payment Link configured with success URL: `https://your-domain.netlify.app/quiz.html?token=rbt2026access`
2. `quiz.js` checks for `?token=rbt2026access` on load
3. If valid, sets `localStorage.rbt_access = "true"` and cleans the URL
4. Future visits check localStorage — no token needed again

**Known limitations:**
- The token is static. Anyone who receives the link can share it.
- Nothing stops someone from sharing `quiz.html?token=rbt2026access` publicly.
- This is acceptable for a $9.99 product with estimated 10-100 sales/month.
- URL sharing scales slowly (most people won't bother) and doesn't enable mass piracy.

**To upgrade:** Implement Netlify Edge Function with HMAC token per email address.
See `netlify/functions/` directory — scaffold is in place.

**Before going live:**
1. Change `VALID_TOKEN` in `quiz.js` to something non-obvious (generate: `openssl rand -hex 16`)
2. Set Stripe success URL to match: `https://your-domain.com/quiz.html?token=YOUR_NEW_TOKEN`

## Stripe Setup

```bash
# Create product + price
python3 -c "
import stripe, os
stripe.api_key = os.environ['STRIPE_SECRET_KEY']
p = stripe.Price.create(
  unit_amount=999,
  currency='usd',
  product_data={'name': 'RBT Exam Practice — 100 Questions'},
  metadata={'type': 'one_time'}
)
print('Price ID:', p.id)
"

# Then create Payment Link in Stripe Dashboard:
# Products → [your product] → Create Payment Link
# Set "After payment" → Redirect to URL → quiz.html?token=YOUR_TOKEN
```

## Deployment

1. Push to GitHub
2. Connect Netlify to GitHub repo
3. Set publish directory to `/` (root)
4. Deploy
5. Set custom domain (optional — Netlify subdomain works at MVP)
6. Update `index.html` canonical URL

## SEO

Update `index.html` before deploy:
- Replace `YOUR-DOMAIN.netlify.app` in canonical tag
- Add Google Analytics if wanted (optional)

## Domain Distribution (Questions)

| Domain | Name | Questions | % |
|--------|------|-----------|---|
| A | Basic Behavior Analytic Skills | 15 | 15% |
| B | Measurement | 15 | 15% |
| C | Skill Acquisition | 15 | 15% |
| D | Behavior Reduction | 15 | 15% |
| E | Documentation and Reporting | 20 | 20% |
| F | Professional Conduct and Scope of Practice | 20 | 20% |

Domains E and F are over-weighted intentionally — these are where RBT candidates score 30-38% on Pocket Prep.

## Disclaimer

Not affiliated with or endorsed by the BACB.
"RBT" is a trademark of the Behavior Analyst Certification Board.
Questions are based on the publicly available BACB RBT Test Content Outline, 3rd Edition.
