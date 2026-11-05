type IconProps = { className?: string }

function Icon({ className = 'size-5', d }: IconProps & { d: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export const OverviewIcon = (p: IconProps) => (
  <Icon {...p} d="M3.75 13.5h4.5v6.75h-4.5zM9.75 3.75h4.5v16.5h-4.5zM15.75 9h4.5v11.25h-4.5z" />
)

export const TrendsIcon = (p: IconProps) => (
  <Icon {...p} d="M2.25 18 9 11.25l4.31 4.31a11.95 11.95 0 0 1 5.81-5.52l2.63-1.17m0 0-5.94-2.28m5.94 2.28-2.28 5.94" />
)

export const AggregatesIcon = (p: IconProps) => (
  <Icon
    {...p}
    d="M3.38 19.5h17.25M3.38 19.5c-.62 0-1.13-.5-1.13-1.13V5.63c0-.62.5-1.13 1.13-1.13h17.25c.62 0 1.12.5 1.12 1.13v12.74c0 .62-.5 1.13-1.12 1.13M3.38 19.5V9.75m0 0h17.25M3.38 9.75V15m17.25-5.25V15M3.38 15h17.25M12 9.75V19.5"
  />
)

export const ImpressionsIcon = (p: IconProps) => (
  <Icon
    {...p}
    d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.51 7.36 4.5 12 4.5s8.57 3 9.96 7.18a1 1 0 0 1 0 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3-9.96-7.18ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
  />
)

export const EventsIcon = (p: IconProps) => (
  <Icon {...p} d="M3.75 13.5 14.25 2.25 12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
)

export const MenuIcon = (p: IconProps) => <Icon {...p} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />

export const CloseIcon = (p: IconProps) => <Icon {...p} d="M6 18 18 6M6 6l12 12" />

export const CollapseIcon = (p: IconProps) => (
  <Icon {...p} d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
)

export const ExpandIcon = (p: IconProps) => (
  <Icon {...p} d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" />
)
