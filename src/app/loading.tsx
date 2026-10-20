// Скелет під час навігації: шапка лишається, вміст показує каркас замість порожнього екрана.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </main>
  );
}
