import {
  SOCIAL_CARD_IMAGE,
  redirectToStaticMetadataImage,
} from "~/lib/blink/metadata-images";

export const runtime = "nodejs";
export const alt = SOCIAL_CARD_IMAGE.alt;
export const size = {
  width: SOCIAL_CARD_IMAGE.width,
  height: SOCIAL_CARD_IMAGE.height,
};
export const contentType = "image/png";

export default function StaticMetadataImage() {
  return redirectToStaticMetadataImage();
}