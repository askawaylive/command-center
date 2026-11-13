/** Shown instantly while a page loads on the server, so clicks never feel dead. */
export default function Loading() {
  return (
    <div className="flex h-full items-start px-8 pt-8">
      <div className="w-full max-w-3xl animate-pulse space-y-4">
        <div className="h-9 w-48 rounded-lg bg-sidebar" />
        <div className="h-4 w-80 rounded bg-sidebar" />
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="h-28 rounded-xl bg-sidebar" />
          <div className="h-28 rounded-xl bg-sidebar" />
        </div>
        <div className="h-48 rounded-xl bg-sidebar" />
      </div>
    </div>
  );
}
