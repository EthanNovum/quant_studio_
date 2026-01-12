export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
      <div className="flex items-center gap-4">
        {/* Progress indicator can be added here when data update is running */}
      </div>
      <div className="flex items-center gap-2">
        {/* Additional header items can go here */}
      </div>
    </header>
  )
}
