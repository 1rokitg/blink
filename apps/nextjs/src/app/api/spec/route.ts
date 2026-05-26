import { buildPublicApiSpec } from "~/lib/blink/public-api-spec";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const spec = buildPublicApiSpec(origin);

  return new Response(JSON.stringify(spec), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
