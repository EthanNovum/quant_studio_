import { cn } from '@/lib/utils'

interface DangerLabelProps {
  reasons: string[]
  className?: string
}

export default function DangerLabel({ reasons, className }: DangerLabelProps) {
  if (reasons.length === 0) return null

  return (
    <div className={cn('group relative inline-block', className)}>
      <span className="rounded bg-danger px-1.5 py-0.5 text-xs font-medium text-danger-foreground">
        DANGER
      </span>
      <div className="invisible absolute left-0 top-full z-50 mt-1 w-48 rounded-md bg-card p-2 text-xs shadow-lg group-hover:visible">
        <ul className="space-y-1">
          {reasons.map((reason, index) => (
            <li key={index} className="text-muted-foreground">
              • {reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
