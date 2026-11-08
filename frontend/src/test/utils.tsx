import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from '../App'
import { FileSessionProvider } from '../hooks/useFileSession'
import { ToastProvider } from '../hooks/useToast'
import { FileMeta } from '../services/api'

export function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <FileSessionProvider>
          <AppRoutes />
        </FileSessionProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

export const imageMeta: FileMeta = {
  id: 'a'.repeat(32), original_name: 'photo.png', format: 'png', kind: 'image', size: 204800,
  info: { width: 640, height: 480 }, targets: ['jpg', 'webp', 'bmp', 'tiff'], previewable: true,
}
export const audioMeta: FileMeta = {
  id: 'b'.repeat(32), original_name: 'tone.wav', format: 'wav', kind: 'audio', size: 1000, info: { duration: 3 },
  targets: ['mp3'], previewable: true,
}
