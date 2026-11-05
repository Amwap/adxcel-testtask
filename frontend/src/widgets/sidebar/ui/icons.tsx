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
