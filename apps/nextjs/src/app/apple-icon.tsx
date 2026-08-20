import {
  APPLE_ICON_IMAGE_URL,
  redirectToStaticMetadataImage,
} from "~/lib/blink/metadata-images";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return redirectToStaticMetadataImage(APPLE_ICON_IMAGE_URL);
}