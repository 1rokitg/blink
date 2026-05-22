# Hyperliquid Builder Codes Business Plan

Last updated: 2026-05-22

## Executive Summary

Hyperliquid builder codes are an onchain way for an app, interface, wallet, bot, or trading product to earn fees on orders it routes for users. They are not the same thing as referral codes, and they are not the same thing as HIP-3 builder-deployed perpetuals.

For a personality-led operator like `x.com/rokitdotgg`, the practical opportunity is not "launch a generic affiliate page." The stronger opportunity is to build a distribution-led trading product:

- a branded trading interface
- a mobile-first companion
- a bot or copy-trading workflow
- a private community product with analytics, alerts, and guided execution

The thesis is simple: if your audience already trusts your market taste, you can monetize execution flow with builder codes while using content and community as acquisition.

## What Builder Codes Are

Based on Hyperliquid's official docs, builder codes:

- let builders receive a fee on fills they send on behalf of a user
- are set per order, not permanently on the whole account
- require the user to approve a maximum builder fee for each builder
- can be revoked by the user at any time
- are processed entirely onchain

Important implementation details from the docs:

- The approval uses `ApproveBuilderFee`.
- The approval must be signed by the user's main wallet, not an agent/API wallet.
- The builder must have at least `100 USDC` in perps account value.
- Builder fees can be at most `0.1%` on perps and `1%` on spot.
- Spot applicability is limited: they do not apply to the buying side of spot trades, but they do apply to both sides of perp trades.
- The order can include an optional builder parameter shaped like `{"b": address, "f": number}` where `f` is in tenths of a basis point.
- Each user can have up to `10` active builder approvals.

## What Builder Codes Are Not

### Not referral codes

Hyperliquid referrals are separate from builder codes.

- Referral codes are created after `"$10,000"` in trading volume.
- Referrers receive `10%` of referred users' fees, less any discount the user receives.
- Referred users get a `4%` fee discount for their first `"$25M"` in volume.
- Referral rewards apply to a user's first `"$1B"` in volume.

Strategically:

- referrals are a lightweight audience acquisition tool
- builder codes are the monetization rail for routed order flow
- builder codes are stronger if you control product UX

### Not HIP-3 "builder-deployed perps"

HIP-3 is a separate concept. It is about permissionless deployment of perpetual markets on Hyperliquid, not fee routing for an interface. The official HIP-3 docs currently describe a mainnet staking requirement of `500k HYPE` for deployers. That is a different business entirely and not the recommended starting point here.

## Business Opportunity for Rokit

Your edge is likely distribution, not raw exchange infrastructure.

That means the best first move is to package market attention, community trust, and repeatable trade workflows into a product that captures routed volume.

### Best-fit positioning

Build a "trader OS" for your audience:

- market dashboards
- watchlists and thesis feeds
- high-signal alerts
- guided trade entry
- optional automation via agent wallets or bots
- community-gated premium research

The product sells confidence and convenience. Builder codes monetize execution.

## Recommended Business Model

### Core offer

Launch a branded Hyperliquid interface or companion product for your community.

Version 1 should include:

- wallet connect
- clear builder fee approval flow
- perp trading on the pairs your audience already trades
- thesis pages for major assets
- push alerts for setup changes
- referral onboarding link for first-touch acquisition

### Revenue streams

1. Builder fee revenue

- Charge a modest fee per routed fill.
- Start low enough that users feel the product advantage exceeds the cost.
- A practical early positioning is "pay for better workflow, not for access."

2. Referral revenue

- Use a Hyperliquid referral code and join link for top-of-funnel conversion.
- This is best for users who discover Hyperliquid through your content before they ever use your product.

3. Membership revenue

- Private Discord/Telegram/X community
- premium research
- trade breakdowns
- office-hours or market calls

4. Sponsorship and partnerships

- wallet partners
- analytics tools
- tax tooling
- infrastructure partners

5. Future software upsells

- mobile app
- advanced alerts
- API keys and team dashboards
- copy-trading or strategy vault products if legally viable

## Unit Economics

Builder-code economics are volume-driven.

Revenue formula:

`Revenue = Routed trading volume x effective builder fee`

Illustrative scenarios:

- `"$10M"` monthly routed volume at `1 bp` (`0.01%`) = about `"$1,000"` monthly gross
- `"$50M"` monthly routed volume at `2 bp` (`0.02%`) = about `"$10,000"` monthly gross
- `"$250M"` monthly routed volume at `1.5 bp` (`0.015%`) = about `"$37,500"` monthly gross

The real lever is not squeezing fee rate. It is increasing:

- active routed traders
- trader retention
- trading frequency
- share of user flow executed through your surface

## Go-To-Market

### Wedge

Do not open with "use my builder code."

Open with:

- better signal organization
- faster execution
- cleaner mobile workflow
- community context around trades
- less friction from idea to execution

### Audience strategy

Use your public profile as the acquisition engine:

- daily market takes on X
- clips and screenshots from your product UI
- weekly "what I am watching" threads
- community challenges
- leaderboard or trader scorecards

### Conversion funnel

1. X content drives attention.
2. Landing page captures wallet-ready traders.
3. Referral link or onboarding content gets them onto Hyperliquid.
4. Product walkthrough gets them to approve builder fee.
5. Alerts, dashboards, and community keep them trading through your interface.

## Product Strategy

### Phase 1: Monetization-ready MVP

Build only what is required to prove routed volume:

- branded landing page
- simple auth or wallet-gated access
- Hyperliquid integration
- builder fee approval UX
- order entry with visible fee disclosure
- basic analytics for user actions and routed volume

Success metric:

- first 50 to 100 active routed traders

### Phase 2: Retention layer

Add product reasons to stay:

- mobile notifications
- trade journal
- setup tracking
- curated lists
- community heatmap
- post-trade analytics

Success metric:

- repeat weekly routed volume per active user

### Phase 3: Brand moat

Add proprietary distribution:

- exclusive research streams
- creator collaborations
- affiliate network
- ambassador program
- team analysts or guest traders

Success metric:

- non-founder sourced volume as a share of total volume

## 90-Day Action Plan

### Days 1-14

- Secure your Hyperliquid referral code if not already active.
- Create or designate the builder wallet/address.
- Fund the builder account with at least `100 USDC` in perps account value.
- Validate the legal and disclosure language you want on approvals and fee pages.
- Choose one wedge: mobile, community, analytics, or fast execution.

### Days 15-30

- Build the MVP landing page and dashboard.
- Implement builder fee approval and revocation education.
- Add fee disclosure copy before order routing.
- Set up analytics for approvals, routed orders, volume, and retention.
- Recruit 20 to 30 trusted beta users from your audience.

### Days 31-60

- Run a private beta with feedback loops in Telegram or Discord.
- Publish live content around product learnings and trader wins.
- Tune fee level based on drop-off and retention.
- Add alerts and saved watchlists.
- Publish transparent FAQs on how fees work.

### Days 61-90

- Open public waitlist or gated public launch.
- Launch a weekly market briefing anchored to the product.
- Start creator partnerships or community affiliate deals.
- Measure CAC, activation, routed volume, and builder-fee revenue by cohort.
- Decide whether to double down on software, media, or private community monetization.

## Key Risks

### Trust risk

If the builder fee feels hidden, you lose brand equity fast. The fee must be disclosed plainly before approval and before order flow is routed.

### Product risk

If your interface does not materially improve the experience, users will trade directly in the native app and you will not capture flow.

### Concentration risk

If all usage depends on your personal posting cadence, growth will stall when you step back. Build repeatable community and partner distribution early.

### Legal and compliance risk

Depending on jurisdiction and product scope, adding copy-trading, automation, paid signals, or managed strategy behavior can change your risk profile significantly. Review this before launch.

## Recommendation

The highest-probability plan is:

1. Use referral links for broad top-of-funnel acquisition.
2. Build a lightweight branded product that routes orders through builder codes.
3. Keep builder fees modest and transparent.
4. Monetize the serious users further with community, research, and workflow upgrades.

Do not start with HIP-3. Do not start with a generic terminal. Start with a creator-led execution product for your existing audience.

## Sources

- Hyperliquid Docs, Builder codes: https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes
- Hyperliquid Docs, Referrals: https://hyperliquid.gitbook.io/hyperliquid-docs/referrals
- Hyperliquid Docs, Hyperliquid 101 for non-crypto audiences: https://hyperliquid.gitbook.io/hyperliquid-docs/about-hyperliquid/hyperliquid-101-for-non-crypto-audiences
- Hyperliquid Docs, HIP-3 builder-deployed perpetuals: https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals
- Hyperliquid Python SDK example: https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/examples/basic_builder_fee.py
