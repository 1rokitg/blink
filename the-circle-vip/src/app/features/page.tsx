import { redirect } from "next/navigation";

/** Legacy showcase — replaced by the marketing landing at `/`. */
export default function FeaturesRoute() {
  redirect("/");
}
