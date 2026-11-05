import { createBrowserRouter, Navigate } from 'react-router'
import { EventsPage } from '@/pages/events'
import { HomePage } from '@/pages/home'
import { ImpressionsPage } from '@/pages/impressions'
import { DashboardLayout } from './layouts/DashboardLayout'

export const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'impressions', element: <ImpressionsPage /> },
      { path: 'events', element: <EventsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
