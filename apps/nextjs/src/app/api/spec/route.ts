import { router } from "@acme/api/root";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";

const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const spec = await openAPIGenerator.generate(router, {
    info: {
      title: "Blink API",
      description:
        "Blink public API for trading, rewards, referrals, and internal protocol operations.",
      version: "1.0.0",
    },
    servers: [{ url: `${origin}/api` }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  });

  return new Response(JSON.stringify(spec), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
