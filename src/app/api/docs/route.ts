import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi";

// Serve a especificação OpenAPI (JSON) consumida pelo Swagger UI em /docs.
export async function GET() {
  return NextResponse.json(openApiSpec);
}
