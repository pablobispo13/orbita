// swagger-ui-dist não publica tipos; declaração mínima do que usamos.
declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  interface SwaggerUIOptions {
    url?: string;
    domNode?: HTMLElement | null;
    dom_id?: string;
    deepLinking?: boolean;
    docExpansion?: "list" | "full" | "none";
    persistAuthorization?: boolean;
    [key: string]: unknown;
  }
  const SwaggerUIBundle: (options: SwaggerUIOptions) => unknown;
  export default SwaggerUIBundle;
}
