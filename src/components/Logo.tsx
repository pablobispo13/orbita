// Marca ÓRBITA — um planeta orbitando um núcleo (console central).
// Gradiente violeta → ciano, coerente com os design tokens.

export function OrbitMark({ size = 32 }: { size?: number }) {
  const id = "orbita-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="1" stopColor="#C084FC" />
        </linearGradient>
      </defs>
      {/* órbita */}
      <ellipse
        cx="16"
        cy="16"
        rx="13"
        ry="5.6"
        transform="rotate(-22 16 16)"
        stroke={`url(#${id})`}
        strokeWidth="1.9"
      />
      {/* núcleo */}
      <circle cx="16" cy="16" r="4" fill={`url(#${id})`} />
      {/* planeta sobre a órbita */}
      <circle cx="22.1" cy="8.9" r="2.2" fill="#C084FC" />
    </svg>
  );
}

export function OrbitaLogo({
  size = 28,
  showWordmark = true,
}: {
  size?: number;
  showWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <OrbitMark size={size} />
      {showWordmark && (
        <span
          className="font-display font-bold tracking-tight"
          style={{ fontSize: size * 0.72 }}
        >
          Órbita
        </span>
      )}
    </span>
  );
}
