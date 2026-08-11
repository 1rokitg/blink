import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  INTERNAL_SESSION_COOKIE,
  readInternalSession,
} from "@/lib/internal-auth";

export async function requireInternalSession() {
  const jar = await cookies();
  const session = await readInternalSession(
    jar.get(INTERNAL_SESSION_COOKIE)?.value,
  );
  if (!session) {
    redirect("/internal/login");
  }
  return session;
}
