// Rendered (with a 404 status) when getSharedView 404s an unknown or revoked
// token. A calm, brand-neutral page — we have no workspace context for a token
// that doesn't resolve, so this uses the default palette.
export default function ShareNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <h1 className="font-serif text-2xl font-semibold">This link isn&apos;t available</h1>
      <p className="mt-2 text-[13.5px] text-ink-soft">
        The share link is invalid or has been turned off by its owner. If you were expecting to see
        a logbook here, ask whoever shared it for an up-to-date link.
      </p>
      <div className="mt-8 font-mono text-[10.5px] text-ink-faint">
        Powered by <span className="font-medium text-ink-soft">BragBit</span>
      </div>
    </main>
  );
}
