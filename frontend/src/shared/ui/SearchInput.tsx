import { useEffect, useRef, useState } from 'react'

type SearchInputProps = {
  value: string
  onSearch: (value: string) => void
  placeholder?: string
  label?: string
  delay?: number
}

/** Search box that reports its value once the user stops typing. */
export function SearchInput({
  value,
  onSearch,
  placeholder = 'Search…',
  label = 'Search',
  delay = 350,
}: SearchInputProps) {
  const [text, setText] = useState(value)
  // Callers pass inline callbacks; don't restart the debounce timer on every render
  const onSearchRef = useRef(onSearch)

  useEffect(() => {
    onSearchRef.current = onSearch
  })

  useEffect(() => {
    if (text.trim() === value) return
    const id = setTimeout(() => onSearchRef.current(text), delay)
    return () => clearTimeout(id)
  }, [text, value, delay])

  return (
    <div className="relative w-full sm:max-w-sm">
      <svg
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="search"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch(text)
        }}
        placeholder={placeholder}
        maxLength={100}
        className="block w-full rounded-lg border-0 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 focus:outline-none dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:focus:ring-indigo-500"
      />
    </div>
  )
}
