import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type PopoverProps = {
  /** Accessible name of the trigger button. */
  label: string
  trigger: ReactNode
  triggerClassName?: string
  /** Align the panel with the trigger's left or right edge. */
  align?: 'start' | 'end'
  /** Rendered only while open, so its state starts fresh every time. */
  children: (close: () => void) => ReactNode
}

const GAP = 4
const EDGE = 8

/**
 * A panel anchored to its trigger button. Uses the native popover API, so it sits in the
 * top layer (no clipping by scroll containers) and closes on Escape or an outside click.
 */
export function Popover({ label, trigger, triggerClassName = '', align = 'start', children }: PopoverProps) {
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const place = () => {
      const anchor = triggerRef.current?.getBoundingClientRect()
      if (!anchor) return
      const width = panel.offsetWidth
      const left = align === 'end' ? anchor.right - width : anchor.left
      panel.style.left = `${Math.max(EDGE, Math.min(left, innerWidth - width - EDGE))}px`
      panel.style.top = `${anchor.bottom + GAP}px`
    }
    const onBeforeToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') {
        setOpen(true)
        place()
      }
    }
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') place()
      else setOpen(false)
    }
    panel.addEventListener('beforetoggle', onBeforeToggle)
    panel.addEventListener('toggle', onToggle)
    return () => {
      panel.removeEventListener('beforetoggle', onBeforeToggle)
      panel.removeEventListener('toggle', onToggle)
    }
  }, [align])

  // The panel is fixed in the viewport: close it rather than leave it behind on scroll
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (!(e.target instanceof Node && panelRef.current?.contains(e.target))) {
        panelRef.current?.hidePopover()
      }
    }
    addEventListener('scroll', close, true)
    addEventListener('resize', close)
    return () => {
      removeEventListener('scroll', close, true)
      removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={id}
        aria-label={label}
        title={label}
        aria-expanded={open}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <div
        ref={panelRef}
        id={id}
        popover="auto"
        className="m-0 rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal tracking-normal text-slate-700 normal-case shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        {open && children(() => document.getElementById(id)?.hidePopover())}
      </div>
    </>
  )
}
