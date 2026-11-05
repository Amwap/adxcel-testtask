import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useDebounced } from "@/shared/lib/useDebounced";
import { useRequest } from "@/shared/lib/useRequest";
import { Spinner } from "./Button";

export type ComboOption = {
  value: string;
  label: string;
  /** Shown on hover, e.g. the full text of a shortened label. */
  title?: string;
  /** Muted text on the right, e.g. a count. */
  hint?: ReactNode;
};

export type ComboSearch = (
  query: string,
  signal: AbortSignal,
) => Promise<ComboOption[]>;

type ComboboxProps = {
  /** Accessible name of the input. */
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Options matching the typed text; called with '' for the initial list. */
  search: ComboSearch;
  /** Label of a selected value that has not been in the options yet, e.g. one from the URL. */
  labelOf?: (value: string) => Pick<ComboOption, "label" | "title">;
  /** Several values as removable chips, or one that replaces the previous. */
  multiple?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** The list stays open in the page flow (inside a popover) instead of floating under the input. */
  inline?: boolean;
  /** Tooltip of the field (not of the options). */
  title?: string;
  className?: string;
};

const DEBOUNCE_MS = 200;
// Floating list: gap to the field, margin to the viewport edge, height limits
const GAP = 4;
const EDGE = 8;
const MAX_HEIGHT = 288;
const MIN_ROOM = 160;

const box =
  "flex w-full flex-wrap items-center gap-1 rounded-md bg-white px-1.5 py-1 text-sm ring-1 ring-slate-300 ring-inset focus-within:ring-2 focus-within:ring-indigo-600 dark:bg-slate-950 dark:ring-slate-700 dark:focus-within:ring-indigo-500";
const chip =
  "inline-flex max-w-full items-center gap-1 rounded bg-indigo-50 py-0.5 pr-1 pl-1.5 text-xs text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";

/**
 * A searchable select in the spirit of select2: type part of a value, pick from the matches
 * with the mouse or the arrow keys and Enter. Enter on an empty query is left to the form.
 */
export function Combobox({
  label,
  value,
  onChange,
  search,
  labelOf = (v) => ({ label: v }),
  multiple = false,
  placeholder,
  autoFocus,
  inline = false,
  title,
  className = "",
}: ComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  // Enter picks only after typing or moving through the list; otherwise it submits the form
  const [navigated, setNavigated] = useState(false);
  // Labels of picked options, so chips keep them after the list has moved on
  const [picked, setPicked] = useState<Record<string, ComboOption>>({});

  const debounced = useDebounced(query.trim(), DEBOUNCE_MS);
  const open = inline || focused;
  const { data, loading, error } = useRequest(
    `combobox|${listId}|${open}|${debounced}`,
    (signal) => (open ? search(debounced, signal) : Promise.resolve([])),
  );
  const options = data ?? [];
  const labelFor = (v: string) => picked[v] ?? labelOf(v);
  const single =
    !multiple && value[0] !== undefined ? labelFor(value[0]) : null;
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));
  const floating = !inline && focused;

  // The floating list sits in the top layer (popover API), so cards with hidden overflow
  // don't clip it; it follows the field on scroll and opens upwards when there's no room below
  useLayoutEffect(() => {
    const list = listRef.current;
    const field = boxRef.current;
    if (!floating || !list || !field) return;
    const place = () => {
      const r = field.getBoundingClientRect();
      const below = innerHeight - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE;
      const up = below < MIN_ROOM && above > below;
      list.style.left = `${r.left}px`;
      list.style.width = `${r.width}px`;
      list.style.maxHeight = `${Math.min(MAX_HEIGHT, up ? above : below)}px`;
      list.style.top = up ? "auto" : `${r.bottom + GAP}px`;
      list.style.bottom = up ? `${innerHeight - r.top + GAP}px` : "auto";
    };
    list.showPopover();
    place();
    addEventListener("scroll", place, true);
    addEventListener("resize", place);
    return () => {
      removeEventListener("scroll", place, true);
      removeEventListener("resize", place);
      if (list.matches(":popover-open")) list.hidePopover();
    };
  }, [floating]);

  // Keep the option picked with the arrow keys in view
  useEffect(() => {
    if (navigated)
      document
        .getElementById(`${listId}-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [navigated, activeIndex, listId]);

  const pick = (option: ComboOption) => {
    setPicked((p) => ({ ...p, [option.value]: option }));
    if (!multiple) onChange([option.value]);
    else if (value.includes(option.value))
      onChange(value.filter((v) => v !== option.value));
    else onChange([...value, option.value]);
    setQuery("");
    setActive(0);
    setNavigated(false);
    if (!multiple) inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (options.length) {
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((i) => (i + step + options.length) % options.length);
        setNavigated(true);
      }
    } else if (
      e.key === "Enter" &&
      (query.trim() || navigated) &&
      options[activeIndex]
    ) {
      e.preventDefault();
      pick(options[activeIndex]);
    } else if (e.key === "Backspace" && !query && multiple && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape" && !inline && query) {
      e.stopPropagation();
      setQuery("");
    }
  };

  const list = (
    <ul
      ref={listRef}
      id={listId}
      popover={inline ? undefined : "manual"}
      role="listbox"
      aria-label={label}
      aria-multiselectable={multiple || undefined}
      className={
        inline
          ? "mt-2 max-h-60 space-y-0.5 overflow-y-auto"
          : "m-0 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 text-sm text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }
    >
      {options.map((o, i) => {
        const selected = value.includes(o.value);
        return (
          <li
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={selected}
            title={o.title}
            // Keep the focus in the input, so the list does not close before the click lands
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(o)}
            onMouseEnter={() => setActive(i)}
            className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 ${i === activeIndex ? "bg-slate-100 dark:bg-slate-800" : ""}`}
          >
            <span
              aria-hidden="true"
              className={`w-3 shrink-0 text-indigo-600 dark:text-indigo-400 ${selected ? "" : "opacity-0"}`}
            >
              ✓
            </span>
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.hint !== undefined && (
              <span className="shrink-0 text-xs text-slate-400 tabular-nums dark:text-slate-500">
                {o.hint}
              </span>
            )}
          </li>
        );
      })}
      {!loading && !error && options.length === 0 && (
        <li className="px-1.5 py-1 text-slate-500">
          {debounced ? "No matches" : "No options"}
        </li>
      )}
      {error && (
        <li className="px-1.5 py-1 text-red-600 dark:text-red-400">
          {error.message}
        </li>
      )}
    </ul>
  );

  return (
    <div className={className}>
      <div
        ref={boxRef}
        className={box}
        title={title}
        onClick={() => inputRef.current?.focus()}
      >
        {multiple &&
          value.map((v) => {
            const { label: text, title } = labelFor(v);
            return (
              <span key={v} className={chip} title={title}>
                <span className="truncate">{text}</span>
                <button
                  type="button"
                  aria-label={`Remove ${title ?? text}`}
                  onClick={() => onChange(value.filter((x) => x !== v))}
                  className="cursor-pointer rounded px-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/25"
                >
                  ×
                </button>
              </span>
            );
          })}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            options.length ? `${listId}-${activeIndex}` : undefined
          }
          autoFocus={autoFocus}
          autoComplete="off"
          maxLength={100}
          title={single?.title}
          // A picked single value reads as the field's text until the user types over it
          placeholder={single ? single.label : placeholder}
          className={`min-w-20 flex-1 border-0 bg-transparent px-1 py-0.5 text-slate-900 outline-none placeholder:text-slate-400 dark:text-white ${single ? "placeholder:text-slate-900 dark:placeholder:text-white" : ""}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (!inline) setQuery("");
          }}
          onKeyDown={onKeyDown}
        />
        {loading && <Spinner className="size-3.5 shrink-0 text-slate-400" />}
        {!multiple && single && (
          <button
            type="button"
            aria-label="Clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange([])}
            className="cursor-pointer rounded px-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            ×
          </button>
        )}
      </div>
      {/* A floating list stays mounted, hidden until shown as a popover while the field has focus */}
      {list}
    </div>
  );
}
