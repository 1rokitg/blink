import {
  ICON_IMAGE_URL,
  redirectToStaticMetadataImage,
} from "~/lib/blink/metadata-images";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return redirectToStaticMetadataImage(ICON_IMAGE_URL);
}