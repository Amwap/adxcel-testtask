const numberFormat = new Intl.NumberFormat('en-US')
// Timestamps are shown exactly as logged, without converting to the viewer's time zone
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
})

export const formatNumber = (n: number) => numberFormat.format(n)

/** Formats a naive API datetime (`2021-07-21T19:25:47`). */
export const formatDateTime = (iso: string) =>
  dateTimeFormat.format(new Date(`${iso.slice(0, 19)}Z`))
