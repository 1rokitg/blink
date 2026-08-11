export type Dictionary = {
  meta: {
    title: string;
    description: string;
    claimTitle: string;
    claimDescription: string;
  };
  common: {
    siteName: string;
    tagline: string;
    group: string;
    dashboard: string;
    language: string;
    english: string;
    spanish: string;
  };
  landing: {
    heroKicker: string;
    learnMore: string;
    openingPortal: string;
    portalError: string;
    portalNetworkError: string;
    benefitsTitle: string;
    plansTitle: string;
    plansSubtitle: string;
    howItWorksTitle: string;
    partnersTitle: string;
    partnersSubtitle: string;
    openApp: string;
    footer: string;
    benefits: string[];
    steps: string[];
    partnerDescriptions: Record<string, string>;
  };
  checkout: {
    title: string;
    subtitle: string;
    nextStep: string;
    plan: string;
    total: string;
    crypto: string;
    preferred: string;
    card: string;
    stripe: string;
    redirecting: string;
    continueStripe: string;
    stripeHint: string;
    hideTelegram: string;
    addTelegram: string;
    disconnect: string;
    telegramPlaceholder: string;
    hideReferral: string;
    haveReferral: string;
    referralPlaceholder: string;
    discountApplied: string;
    stripeNotConfigured: string;
    noPlans: string;
    checkoutFailed: string;
    networkError: string;
    telegramFailed: string;
    billingMonthly: string;
    billingYearly: string;
    wasPrice: string;
    perMonthShort: string;
  };
  pricingDialog: {
    eyebrow: string;
    title: string;
    body: string;
    monthly: string;
    yearly: string;
    bestValue: string;
    saveBadge: string;
    perYear: string;
    perMonth: string;
    onlyPerMonth: string;
    vsMonthly: string;
    flexible: string;
    monthHint: string;
    ctaYearly: string;
    ctaMonthly: string;
    ctaRedirecting: string;
    ctaError: string;
    dismiss: string;
    close: string;
    compareLink: string;
  };
  crypto: {
    working: string;
    payUsdcOn: string;
    amount: string;
    treasury: string;
    copy: string;
    copied: string;
    nativeOnly: string;
    alreadyPaid: string;
    verifying: string;
    verifyPayment: string;
    solanaPlaceholder: string;
    evmPlaceholder: string;
    copyFailed: string;
    sendSolanaThenPaste: string;
    noWallet: string;
    confirmInWallet: string;
    submittedVerifying: string;
    walletFailed: string;
    pasteHashFirst: string;
    verifyingOnChain: string;
    couldNotVerify: string;
    confirmedRedirecting: string;
    networkVerifyError: string;
  };
  whopBanner: {
    title: string;
    body: string;
    cta: string;
    dismiss: string;
  };
  claim: {
    eyebrow: string;
    title: string;
    body: string;
    verified: string;
    openInvite: string;
    backTo: string;
    emailLabel: string;
    emailPlaceholder: string;
    telegramLabel: string;
    telegramPlaceholder: string;
    fastestVerify: string;
    screenshotTitle: string;
    screenshotBody: string;
    shareTelegram: string;
    verifying: string;
    claimInvite: string;
    stuck: string;
    verifyFailed: string;
    networkError: string;
  };
  success: {
    eyebrow: string;
    welcome: string;
    active: string;
    cryptoVerified: string;
    admitUser: string;
    useInvite: string;
    join: string;
    openTelegram: string;
    manageBilling: string;
    messageForAccess: string;
  };
  cancel: {
    title: string;
    body: string;
    back: string;
  };
  dashboard: {
    eyebrow: string;
    signedInAs: string;
    connectHint: string;
    connectTelegram: string;
    backHome: string;
  };
  homeErrors: {
    telegramLogin: string;
  };
  marketing: {
    liveLabel: string;
    liveSuffix: string;
    heroEyebrow: string;
    heroTitle: string;
    heroTitleAccent: string;
    heroBody: string;
    heroQuote: string;
    primaryCta: string;
    secondaryCta: string;
    emailPlaceholder: string;
    emailCta: string;
    emailSubmitting: string;
    emailConsent: string;
    emailSuccess: string;
    emailSuccessTitle: string;
    emailSuccessBody: string;
    emailSuccessHint: string;
    emailError: string;
    emailOrJoin: string;
    emailJoinLink: string;
    newsletterEyebrow: string;
    newsletterTitle: string;
    newsletterBody: string;
    newsletterYes: string;
    newsletterNo: string;
    trustReviews: string;
    trustAccess: string;
    trustPay: string;
    marquee: string[];
    movementTitle: string;
    movementBody: string;
    stats: { value: string; label: string }[];
    achieveTitle: string;
    achieveBody: string;
    achievements: { title: string; body: string }[];
    midCtaTitle: string;
    midCtaBody: string;
    midCtaButton: string;
    midCtaHint: string;
    painTitle: string;
    painBody: string;
    pains: string[];
    painCtaTitle: string;
    painCtaBody: string;
    painCtaButton: string;
    differTitle: string;
    differBody: string;
    steps: { title: string; body: string }[];
    othersTitle: string;
    others: string[];
    oursTitle: string;
    ours: string[];
    differCtaTitle: string;
    differCtaButton: string;
    reviewsTitle: string;
    reviewsRating: string;
    reviewsCount: string;
    reviews: { author: string; body: string }[];
    includedTitle: string;
    includedBody: string;
    included: { eyebrow: string; title: string; items: string[] }[];
    bonusesTitle: string;
    bonuses: string[];
    includedCta: string;
    finalTitle: string;
    finalBody: string;
    finalCta: string;
    finalHints: string[];
    footer: string;
    navJoin: string;
    carouselEyebrow: string;
    carouselTitle: string;
    carouselBody: string;
    reentryTitle: string;
    reentryBody: string;
    reentryPrimary: string;
    reentrySecondary: string;
    reentryWatch: string;
    reentryLiveBadge: string;
  };
};

export const en: Dictionary = {
  meta: {
    title: "The Circle | Real-Time Calls. Real Results.",
    description:
      "The Circle — premium trading community for serious traders. Real-time calls, private Telegram, perps + onchain. Join the Season Pass.",
    claimTitle: "Claim access · The Circle",
    claimDescription:
      "Coming from Whop? Claim your Circle Telegram invite with your membership email.",
  },
  common: {
    siteName: "The Circle",
    tagline: "Unlock exclusive access.",
    group: "Group",
    dashboard: "Dashboard",
    language: "Language",
    english: "English",
    spanish: "Español",
  },
  landing: {
    heroKicker: "Private invite · alpha · tools · partners",
    learnMore: "Learn More",
    openingPortal: "Opening Stripe Customer Portal…",
    portalError: "Could not open billing portal.",
    portalNetworkError: "Network error opening billing portal.",
    benefitsTitle: "Membership Benefits",
    plansTitle: "Membership Plans",
    plansSubtitle: "Synced from your Stripe catalog.",
    howItWorksTitle: "How it works",
    partnersTitle: "Trade With Our Partners",
    partnersSubtitle: "Tap a card to open with our affiliate link.",
    openApp: "Open app",
    footer:
      "The Circle · Telegram group · Billed via Stripe · Cancel anytime in the Customer Portal",
    benefits: [
      "Regular info on trending coins, upcoming drops, project news",
      "Active community discussion around coins and NFTs",
      "Access to our in-house profit bot for easy profit calculation",
      "Access to other in-house monitors for the latest alpha",
      "Access to partnered bots and tools",
      "Many whitelist opportunities for project collabs",
    ],
    steps: [
      "Choose your subscription plan",
      "Pay with USDC (preferred) or continue to Stripe Checkout for credit card",
      "Get a private invite link to the Telegram group",
      "Optionally link Telegram anytime for auto-admit",
    ],
    partnerDescriptions: {
      propr:
        "The onchain prop firm. Get funded up to $300,000, keep 80% of your rewards, paid out onchain in USDC in minutes.",
      fomo: "Social-first memecoin trading where the feed meets the order book.",
      basedbot: "Base-native bot flow for snipes, routes, and quick entries.",
      kraken: "Institutional-grade exchange access with deep liquidity.",
      axiom: "Terminal for on-chain discovery, charts, and rapid trades.",
      extended: "Perps and advanced markets — join through our invite.",
    },
  },
  checkout: {
    title: "Unlock the link",
    subtitle: "Pick a plan, pay once — your private invite unlocks after checkout.",
    nextStep: "Next step",
    plan: "Plan",
    total: "Total",
    crypto: "Crypto · USDC",
    preferred: "Preferred",
    card: "Credit Card",
    stripe: "Stripe",
    redirecting: "Redirecting…",
    continueStripe: "Continue to Stripe Checkout",
    stripeHint:
      "One click opens Stripe Checkout. No Telegram required — invite after payment.",
    hideTelegram: "Hide Telegram (optional)",
    addTelegram: "Add Telegram handle (optional)",
    disconnect: "Disconnect",
    telegramPlaceholder: "@username (optional)",
    hideReferral: "Hide referral code",
    haveReferral: "Have a referral code? (optional)",
    referralPlaceholder: "Referral code",
    discountApplied: "Discount applied: €{{amount}} off",
    stripeNotConfigured: "Stripe is not configured yet.",
    noPlans: "No plans available.",
    checkoutFailed: "Checkout failed.",
    networkError: "Network error starting checkout.",
    telegramFailed: "Telegram login failed.",
    billingMonthly: "Monthly",
    billingYearly: "Yearly",
    wasPrice: "Was {{amount}}",
    perMonthShort: "{{amount}}/mo",
  },
  pricingDialog: {
    eyebrow: "Limited launch pricing",
    title: "Go yearly. Save hard.",
    body: "Most members lock the year — same Circle access, lower monthly cost.",
    monthly: "Monthly",
    yearly: "Yearly",
    bestValue: "Best",
    saveBadge: "Save {{pct}}%",
    perYear: "/ year",
    perMonth: "/ month",
    onlyPerMonth: "Only {{amount}}/mo billed yearly",
    vsMonthly: "vs {{amount}} if you paid monthly",
    flexible: "Flexible",
    monthHint: "Cancel anytime · upgrade to yearly later",
    ctaYearly: "Go to Stripe · {{amount}}/year",
    ctaMonthly: "Go to Stripe · {{amount}}/mo",
    ctaRedirecting: "Opening Stripe Checkout…",
    ctaError: "Could not start checkout. Try again.",
    dismiss: "Compare all plans below",
    close: "Close",
    compareLink: "Monthly vs yearly deal",
  },
  crypto: {
    working: "Working…",
    payUsdcOn: "Pay {{amount}} USDC on {{chain}}",
    amount: "Amount",
    treasury: "Treasury",
    copy: "Copy",
    copied: "Copied",
    nativeOnly: "Native USDC only on {{chain}}.",
    alreadyPaid: "Already paid? Paste tx hash",
    verifying: "Verifying…",
    verifyPayment: "Verify payment",
    solanaPlaceholder: "Solana transaction signature",
    evmPlaceholder: "0x…",
    copyFailed: "Could not copy to clipboard.",
    sendSolanaThenPaste: "Send USDC on Solana, then paste the signature below.",
    noWallet:
      "No browser wallet detected. Send USDC manually, then paste the tx hash.",
    confirmInWallet: "Confirm the USDC transfer in your wallet…",
    submittedVerifying: "Transaction submitted. Verifying on-chain…",
    walletFailed: "Wallet payment failed.",
    pasteHashFirst: "Paste your transaction hash / signature first.",
    verifyingOnChain: "Verifying USDC payment on-chain…",
    couldNotVerify: "Could not verify payment.",
    confirmedRedirecting: "Payment confirmed. Redirecting…",
    networkVerifyError: "Network error verifying payment.",
  },
  whopBanner: {
    title: "Coming from Whop?",
    body: "Claim your Circle invite — no second payment.",
    cta: "Claim access",
    dismiss: "Dismiss",
  },
  claim: {
    eyebrow: "Member transfer",
    title: "Claim your Circle access",
    body: "Paid on Whop before we moved? Enter the email on that membership. We'll verify it on our side and send your private Telegram invite — no new charge.",
    verified: "Membership verified. Your invite is ready.",
    openInvite: "Open Telegram invite",
    backTo: "Back to {{name}}",
    emailLabel: "Whop email",
    emailPlaceholder: "you@email.com",
    telegramLabel: "Telegram (optional)",
    telegramPlaceholder: "@username",
    fastestVerify: "Fastest verify",
    screenshotTitle: "Screenshot your Whop invoice email",
    screenshotBody:
      "Open the Whop receipt in your inbox, snap it, and send it on Telegram — we'll unlock your invite from there.",
    shareTelegram: "Share via Telegram",
    verifying: "Verifying…",
    claimInvite: "Claim my invite",
    stuck: "Stuck? Message",
    verifyFailed: "Could not verify Whop membership.",
    networkError: "Network error. Try again in a moment.",
  },
  success: {
    eyebrow: "Payment confirmed",
    welcome: "Welcome to {{name}}",
    active: "Your membership is active",
    cryptoVerified: "USDC payment verified on-chain.",
    admitUser: "We'll admit @{{user}} to The Circle Telegram group.",
    useInvite:
      "Use your private invite link below to join The Circle Telegram group.",
    join: "Join The Circle",
    openTelegram: "Open Telegram",
    manageBilling: "Manage billing",
    messageForAccess:
      "Message @rokitgg for group access. The Circle Guard bot will later auto-admit members and kick unpaid ones.",
  },
  cancel: {
    title: "Checkout canceled",
    body: "No charge was made. Pick a plan whenever you're ready.",
    back: "Back to plans",
  },
  dashboard: {
    eyebrow: "Member dashboard",
    signedInAs: "Signed in as",
    connectHint: "Connect Telegram on the join page to manage your membership.",
    connectTelegram: "Connect with Telegram",
    backHome: "Back to home",
  },
  homeErrors: {
    telegramLogin: "Telegram login failed. Try again.",
  },
  marketing: {
    liveLabel: "LIVE",
    liveSuffix: "in The Circle",
    heroEyebrow: "Premium Trading Group · Season Pass",
    heroTitle: "The Circle. Real-Time Calls.",
    heroTitleAccent: "Real Results.",
    heroBody:
      "Premium trading community for serious traders. Private Telegram, real-time calls, perps + onchain — from rokitgg.",
    heroQuote: "Consistently posts bangers. Doesn't larp. He can actually trade.",
    primaryCta: "Join The Circle",
    secondaryCta: "See What's Inside",
    emailPlaceholder: "Enter your email address",
    emailCta: "Subscribe",
    emailSubmitting: "Saving…",
    emailConsent:
      "You agree to receive emails from The Circle about membership and updates.",
    emailSuccess: "You're on the list.",
    emailSuccessTitle: "You're in!",
    emailSuccessBody:
      "Thanks — {{email}}. One more step: grab the free newsletter.",
    emailSuccessHint: "Free newsletter next",
    emailError: "Could not save your email. Try again.",
    emailOrJoin: "Skip for now?",
    emailJoinLink: "Go to join",
    newsletterEyebrow: "Free sidekick",
    newsletterTitle: "Subscribe free to the newsletter?",
    newsletterBody:
      "Weekly crypto alpha from RokitG on Substack — no charge. Yes takes you there; No continues to Circle membership.",
    newsletterYes: "Yes — subscribe free",
    newsletterNo: "No — continue to join",
    trustReviews: "5.0 from members",
    trustAccess: "Private Telegram",
    trustPay: "USDC or credit card",
    marquee: [
      "The Circle",
      "Real-Time Calls",
      "Real Results",
      "Season Pass",
      "Perps + Onchain",
      "Private Telegram",
      "Premium Trading Group",
    ],
    movementTitle: "Built for serious traders",
    movementBody:
      "Same Circle energy from Whop — now on our own rails. Real-time calls, no LARP accounts, private room access.",
    stats: [
      { value: "5.0", label: "Member rating" },
      { value: "VIP", label: "Telegram access" },
      { value: "24/7", label: "Real-time calls" },
      { value: "USDC", label: "Crypto checkout" },
    ],
    achieveTitle: "What you unlock",
    achieveBody:
      "Real-time calls and the stack around them — tools, partners, and a room that stays active.",
    achievements: [
      {
        title: "Real-time calls",
        body: "Perps and onchain setups with context — not screenshots after the move already printed.",
      },
      {
        title: "Trade with better tooling",
        body: "In-house profit bot, monitors, and partnered bots so execution stays fast.",
      },
      {
        title: "Stay inside the room",
        body: "Active discussion, whitelist collabs, and a community that actually shows up.",
      },
    ],
    midCtaTitle: "Ready for real results?",
    midCtaBody:
      "Grab the Season Pass energy — pick a plan, pay with USDC or credit card, get your private Telegram invite.",
    midCtaButton: "Join The Circle",
    midCtaHint: "Cancel anytime in Stripe · Instant access after payment",
    painTitle: "Tired of LARP accounts and empty signals?",
    painBody:
      "If these feel familiar, you're not alone — most rooms optimize for hype, not edge.",
    pains: [
      "Big X accounts that 'made it' but can't actually trade",
      "Calls that only show up after something already pumped",
      "Expensive groups that disappear after you pay",
      "No tools — just screenshots and vibes",
      "Affiliate spam instead of real-time alpha",
    ],
    painCtaTitle: "Stop scrolling empty rooms",
    painCtaBody:
      "The Circle is a premium trading community for serious traders — real-time calls, private Telegram, no LARP.",
    painCtaButton: "Join The Circle",
    differTitle: "How The Circle does it differently",
    differBody:
      "A simple path from checkout to private access — real-time calls without the guru theater.",
    steps: [
      {
        title: "Choose your plan",
        body: "Month, quarter, or year — live Stripe catalog (Season Pass energy, cleaner billing).",
      },
      {
        title: "Pay your way",
        body: "USDC preferred, or credit card via Stripe Checkout. Referral codes welcome.",
      },
      {
        title: "Enter the room",
        body: "Get a private Telegram invite. Link Telegram for smoother admit later.",
      },
    ],
    othersTitle: "Typical paid groups",
    others: [
      "Sell hard, deliver soft",
      "Ghost after checkout",
      "LARP screenshots",
      "No real tooling",
      "Public chats full of bots",
    ],
    oursTitle: "The Circle",
    ours: [
      "Real-time calls · perps + onchain",
      "Private Telegram invite",
      "In-house bots and monitors",
      "Partner stack with real links",
      "Transparent Stripe billing",
    ],
    differCtaTitle: "Experience the difference yourself",
    differCtaButton: "Join The Circle",
    reviewsTitle: "What members say",
    reviewsRating: "5.00",
    reviewsCount: "From our Whop era — still the same Circle",
    reviews: [
      {
        author: "maortega7997",
        body: "This man is pretty goated, look at his tg or X. Consistently posts bangers, both perps and onchain. Doesnt larp like alot of the big X accounts that 'made it'. He can actually trade",
      },
      {
        author: "DarthoOVader",
        body: "Trader español muy experimentado en perpetuals. Siempre activo por redes sociales ofreciendo sus conocimientos y pensamientos sobre los mercados.",
      },
    ],
    includedTitle: "What's inside the Season Pass",
    includedBody:
      "Premium trading group access — the same Circle, now checkout on rokitg.com.",
    included: [
      {
        eyebrow: "Calls",
        title: "Real-time signal",
        items: [
          "Real-time calls on perps + onchain",
          "Trending coins, drops, and catalysts",
          "Context from someone who can actually trade",
        ],
      },
      {
        eyebrow: "Tools",
        title: "Execution stack",
        items: [
          "In-house profit calculator bot",
          "Internal monitors for fresh alpha",
          "Partnered bots and terminals",
        ],
      },
      {
        eyebrow: "Access",
        title: "Member perks",
        items: [
          "Private Telegram invite",
          "Whitelist + partner invites",
          "Cancel anytime via Customer Portal",
        ],
      },
    ],
    bonusesTitle: "Also included",
    bonuses: [
      "Private invite link after payment",
      "USDC or credit card checkout",
      "EN / ES site experience",
      "Member dashboard + billing portal",
    ],
    includedCta: "Join The Circle",
    finalTitle: "Ready for real-time calls?",
    finalBody:
      "The Circle. Real-Time Calls. Real Results. Unlock private Telegram and get in the room.",
    finalCta: "Join The Circle",
    finalHints: ["USDC or credit card", "Instant invite", "Cancel anytime"],
    footer:
      "The Circle · Premium Trading Group · Season Pass · Billed via Stripe",
    navJoin: "Start for free",
    carouselEyebrow: "Member stack",
    carouselTitle: "Trade with tools members trust",
    carouselBody:
      "Partner apps and terminals inside The Circle — prop funding, memecoins, perps, and execution.",
    reentryTitle: "We're live — don't miss the stream",
    reentryBody:
      "The Circle is streaming live now. Real-time calls, real setups — join the room or watch the live stream first.",
    reentryPrimary: "Join The Circle",
    reentrySecondary: "Maybe later",
    reentryWatch: "Watch the live stream",
    reentryLiveBadge: "LIVE",
  },
};
