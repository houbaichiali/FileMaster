import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { FileSessionProvider } from './hooks/useFileSession'
import { ToastProvider } from './hooks/useToast'
import DashboardPage from './pages/DashboardPage'

const ConvertPage = lazy(() => import('./pages/ConvertPage'))
const CompressPage = lazy(() => import('./pages/CompressPage'))
const ImageEditorPage = lazy(() => import('./pages/ImageEditorPage'))
const AudioEditorPage = lazy(() => import('./pages/AudioEditorPage'))
const VideoEditorPage = lazy(() => import('./pages/VideoEditorPage'))
const RecentPage = lazy(() => import('./pages/RecentPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

export function AppRoutes() {
  return (
    <Suspense fallback={<p className="p-8 text-fg-2" role="status">…</p>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="convert" element={<ConvertPage />} />
          <Route path="compress" element={<CompressPage />} />
          <Route path="image" element={<ImageEditorPage />} />
          <Route path="audio" element={<AudioEditorPage />} />
          <Route path="video" element={<VideoEditorPage />} />
          <Route path="recent" element={<RecentPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <FileSessionProvider>
          <AppRoutes />
        </FileSessionProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
