export function AuthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-soft via-surface to-background" />

      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--border) / 0.7) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--border) / 0.7) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 70% at 30% 40%, black 20%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 30% 40%, black 20%, transparent 75%)",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, hsl(var(--primary) / 0.35) 0 1px, transparent 1px 18px)",
        }}
      />

      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/25 blur-3xl animate-auth-orb" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-primary/15 blur-3xl animate-auth-orb [animation-delay:-6s]" />
      <div className="absolute right-1/4 top-1/3 h-40 w-40 rounded-full bg-info-soft blur-2xl" />
    </div>
  );
}
