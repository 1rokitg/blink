import { redirect } from "next/navigation";

export default function InternalAffiliateJoinRedirectPage() {
  redirect("/internal/affiliates/new");
}
