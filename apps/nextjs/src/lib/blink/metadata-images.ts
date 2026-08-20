const ONE_YEAR_SECONDS = 31_536_000;

export const SOCIAL_CARD_IMAGE = {
  url: "/social-card.png",
  width: 1200,
  height: 630,
  alt: "Blink Hyperliquid Terminal",
} as const;

export const SOCIAL_CARD_IMAGE_URL = SOCIAL_CARD_IMAGE.url;
export const ICON_IMAGE_URL = "/icon.png";
export const APPLE_ICON_IMAGE_URL = "/apple-icon.png";

export function redirectToStaticMetadataImage(path: string = SOCIAL_CARD_IMAGE_URL) {
  return new Response(null, {
    status: 308,
    headers: {
      "Cache-Control": `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
      Location: path,
    },
  });
}