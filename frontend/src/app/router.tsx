import { createBrowserRouter, Navigate } from 'react-router'
import { AggregatesPage } from '@/pages/aggregates'
import { EventsPage } from '@/pages/events'
import { HomePage } from '@/pages/home'
import { ImpressionsPage } from '@/pages/impressions'
import { DashboardLayout } from './layouts/DashboardLayout'

export const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'trends',
        // Charts pull in Recharts; keep it out of the main bundle
        lazy: () => import('@/pages/trends').then((m) => ({ Component: m.TrendsPage })),
      },
      { path: 'aggregates', element: <AggregatesPage /> },
      { path: 'impressions', element: <ImpressionsPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
