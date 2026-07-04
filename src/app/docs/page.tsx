"use client";

import { useEffect, useRef } from "react";
import "swagger-ui-dist/swagger-ui.css";

// Página de documentação interativa da API (Swagger UI).
// Carrega o bundle do swagger-ui-dist no cliente e aponta para /api/docs.
export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    let cancelled = false;
    (async () => {
      const mod = await import("swagger-ui-dist/swagger-ui-es-bundle.js");
      if (cancelled || !containerRef.current) return;
      const SwaggerUIBundle = mod.default;
      SwaggerUIBundle({
        url: "/api/docs",
        domNode: containerRef.current,
        deepLinking: true,
        docExpansion: "list",
        persistAuthorization: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ background: "#fff", minHeight: "100vh" }}>
      <div ref={containerRef} />
    </main>
  );
}
