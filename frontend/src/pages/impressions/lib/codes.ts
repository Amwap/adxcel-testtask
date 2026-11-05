// Code tables from the interview.X.csv description; -1 means N/A everywhere

const NA = '—'

const PRIOR_IMPRESSIONS = ['1', '2–5', '6–10', '11–20', '21+']

const SINCE_LAST = ['< 1 min', '1–10 min', '11–30 min', '31–60 min', '1–3 h', '4–24 h', '1+ days', 'Never']

const LOCAL_TIME = [
  '00–03',
  '03–06',
  '06–09',
  '09–12',
  '12–15',
  '15–18',
  '18–21',
  '21–24',
]

const label = (table: string[]) => (code: number) => table[code] ?? NA

export const priorImpressionsLabel = label(PRIOR_IMPRESSIONS)
export const sinceLastLabel = label(SINCE_LAST)
export const localTimeLabel = label(LOCAL_TIME)
