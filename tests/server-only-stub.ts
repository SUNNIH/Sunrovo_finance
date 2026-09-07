// Vitest runs outside Next.js's bundler, which is the only thing that
// resolves the real `server-only` package to a no-op on the server side.
// Under plain Node/Vitest it always throws by design. This stub is
// aliased in vitest.config.ts so unit tests can still exercise
// server-only modules directly — it deliberately does nothing.
export {};
