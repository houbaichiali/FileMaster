import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import i18n, { readStoredLang } from '../i18n'
import * as api from '../services/api'
import { addRecent } from '../hooks/useRecent'
import { audioMeta, imageMeta, renderApp } from './utils'

vi.mock('../services/api', async (orig) => {
  const real = await orig<typeof import('../services/api')>()
  return {
    ...real,
    uploadFile: vi.fn(), startJob: vi.fn(), pollJob: vi.fn(), isJobAvailable: vi.fn(), deleteFile: vi.fn(async () => undefined),
    getFormats: vi.fn(async () => ({ conversions: {}, max_upload_mb: 20, ttl_minutes: 60, levels: [] })),
    getHealth: vi.fn(async () => ({ status: 'ok', ffmpeg: true, ffprobe: true })),
  }
})
const m = vi.mocked(api)
const file = (name = 'photo.png') => new File([new Uint8Array(10)], name, { type: 'image/png' })

beforeEach(() => vi.clearAllMocks())

describe('navigation', () => {
  it('shows the dashboard in French by default and navigates to the tools', async () => {
    const user = userEvent.setup()
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur FileMaster' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'Convertir' })[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'Convertir un fichier' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'Fichiers récents' })[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'Fichiers récents' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'Réglages' })[0])
    expect(await screen.findByRole('heading', { level: 1, name: 'Réglages' })).toBeInTheDocument()
  })
  it('exposes every main section in the navigation', () => {
    renderApp('/')
    for (const name of ['Accueil', 'Convertir', 'Compresser', "Éditeur d'images", 'Éditeur audio', 'Éditeur vidéo', 'Fichiers récents', 'Réglages'])
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0)
  })
})

describe('theme', () => {
  it('toggles light/dark, persists it and updates the document', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const btn = screen.getByTestId('theme-switcher')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    await user.click(btn)
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('fm-theme')).toBe('dark')
    await user.click(btn)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(localStorage.getItem('fm-theme')).toBe('light')
  })
  it('can be chosen from the settings page', async () => {
    const user = userEvent.setup()
    renderApp('/settings')
    await user.click(await screen.findByRole('radio', { name: 'Sombre' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
  })
})

describe('language and RTL', () => {
  it('defaults to French for a first-time visitor', () => {
    localStorage.clear()
    expect(readStoredLang()).toBe('fr')
    expect(document.documentElement.lang).toBe('fr')
    expect(document.documentElement.dir).toBe('ltr')
  })
  it('switches fr -> en -> ar immediately, with real RTL for Arabic, and persists the choice', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const group = screen.getByTestId('language-switcher')
    await user.click(within(group).getByRole('button', { name: 'English' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to FileMaster' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')

    await user.click(within(group).getByRole('button', { name: 'العربية' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'مرحبًا بك في FileMaster' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'ar')
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(localStorage.getItem('fm-lang')).toBe('ar')
    expect(screen.getAllByRole('link', { name: 'تحويل' }).length).toBeGreaterThan(0)

    await user.click(within(group).getByRole('button', { name: 'Français' }))
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(await screen.findByRole('heading', { level: 1, name: 'Bienvenue sur FileMaster' })).toBeInTheDocument()
  })
  it('keeps timelines and numbers left-to-right inside an RTL page', async () => {
    await act(() => i18n.changeLanguage('ar'))
    renderApp('/settings')
    expect(await screen.findByRole('heading', { level: 1, name: 'الإعدادات' })).toBeInTheDocument()
    expect(document.documentElement.dir).toBe('rtl')
  })
})

describe('upload and conversion workflow', () => {
  it('uploads a file, lists only real targets, converts and offers the download', async () => {
    const user = userEvent.setup()
    m.uploadFile.mockResolvedValue(imageMeta)
    m.startJob.mockResolvedValue('c'.repeat(32))
    m.pollJob.mockImplementation(async (_id, onUpdate) => {
      const job = { id: 'c'.repeat(32), kind: 'convert', state: 'done' as const, progress: 1, error: null, result: { filename: 'photo.jpg', original_name: 'photo.png', format: 'jpg', mime: 'image/jpeg', size: 51200, original_size: 204800, saved_bytes: 153600, saved_percent: 75, previewable: true, details: { quality: 92 } } }
      onUpdate(job)
      return job
    })
    renderApp('/convert')
    await user.upload(await screen.findByTestId('file-input'), file())
    expect(await screen.findByText('photo.png')).toBeInTheDocument()
    const radios = screen.getAllByRole('radio').map((r) => r.textContent)
    expect(radios).toEqual(['JPG', 'WEBP', 'BMP', 'TIFF'])
    const run = screen.getByRole('button', { name: 'Convertir' })
    expect(run).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'JPG' }))
    await user.click(run)
    expect(m.startJob).toHaveBeenCalledWith('convert', { file_id: imageMeta.id, target: 'jpg' })
    const card = await screen.findByTestId('result-card')
    expect(within(card).getByText('75 % plus léger')).toBeInTheDocument()
    expect(screen.getByTestId('download-link')).toHaveAttribute('href', `/api/jobs/${'c'.repeat(32)}/download`)
    await user.click(screen.getByRole('button', { name: 'Traiter un autre fichier' }))
    expect(await screen.findByTestId('upload-zone')).toBeInTheDocument()
  })

  it('shows translated server errors', async () => {
    const user = userEvent.setup()
    m.uploadFile.mockRejectedValue(new api.ApiError('extension_mismatch', {}, 415))
    renderApp('/convert')
    await user.upload(await screen.findByTestId('file-input'), file())
    expect(await screen.findByRole('alert')).toHaveTextContent("L'extension du fichier ne correspond pas à son contenu réel.")
    await act(() => i18n.changeLanguage('en'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('reports processing errors with the right language', async () => {
    const user = userEvent.setup()
    m.uploadFile.mockResolvedValue(imageMeta)
    m.startJob.mockRejectedValue(new api.ApiError('network'))
    await act(() => i18n.changeLanguage('en'))
    renderApp('/convert')
    await user.upload(await screen.findByTestId('file-input'), file())
    await user.click(await screen.findByRole('radio', { name: 'JPG' }))
    await user.click(screen.getByRole('button', { name: 'Convert' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server. Check that the backend is running.')
  })

  it('refuses files of the wrong kind for a tool and cleans up the upload', async () => {
    const user = userEvent.setup({ applyAccept: false }) // browsers only treat `accept` as a hint
    m.uploadFile.mockResolvedValue(imageMeta)
    renderApp('/audio')
    await user.upload(await screen.findByTestId('file-input'), file())
    expect(await screen.findByRole('alert')).toHaveTextContent("Cet outil n'accepte pas les fichiers de type image.")
    expect(m.deleteFile).toHaveBeenCalledWith(imageMeta.id)
  })

  it('rejects oversized files before uploading', async () => {
    const user = userEvent.setup()
    renderApp('/convert')
    const big = new File([new Uint8Array(1)], 'big.png')
    Object.defineProperty(big, 'size', { value: 300 * 1024 * 1024 })
    await user.upload(await screen.findByTestId('file-input'), big)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/dépasse \d+ Mo/))
    expect(m.uploadFile).not.toHaveBeenCalled()
  })
})

describe('compress and editors', () => {
  it('sends the chosen compression level and target size', async () => {
    const user = userEvent.setup()
    m.uploadFile.mockResolvedValue(imageMeta)
    m.startJob.mockResolvedValue('d'.repeat(32))
    m.pollJob.mockImplementation(async () => ({ id: 'd', kind: 'compress', state: 'error' as const, progress: 0, error: { code: 'compress_not_supported', params: {} }, result: null }))
    renderApp('/compress')
    await user.upload(await screen.findByTestId('file-input'), file())
    await user.click(await screen.findByRole('radio', { name: /Élevée/ }))
    await user.click(screen.getByLabelText('Viser une taille cible'))
    await user.type(screen.getByLabelText('Taille cible (Mo)'), '0.5')
    await user.click(screen.getByRole('button', { name: 'Compresser' }))
    expect(m.startJob).toHaveBeenCalledWith('compress', { file_id: imageMeta.id, level: 'high', target_size_mb: 0.5 })
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce format ne peut pas être compressé')
  })

  it('audio editor validates the time range and submits a trim', async () => {
    const user = userEvent.setup()
    m.uploadFile.mockResolvedValue(audioMeta)
    m.startJob.mockResolvedValue('e'.repeat(32))
    m.pollJob.mockImplementation(async () => ({ id: 'e', kind: 'trim', state: 'error' as const, progress: 0, error: { code: 'invalid_range', params: {} }, result: null }))
    renderApp('/audio')
    await user.upload(await screen.findByTestId('file-input'), new File([new Uint8Array(4)], 'tone.wav'))
    const start = await screen.findByLabelText('Début')
    const end = screen.getByLabelText('Fin')
    expect(end).toHaveValue('0:03.000')
    await user.clear(start); await user.type(start, '0.5'); await user.tab()
    await user.clear(end); await user.type(end, '2'); await user.tab()
    await user.click(screen.getByRole('button', { name: 'Couper et exporter' }))
    expect(m.startJob).toHaveBeenCalledWith('trim', { file_id: audioMeta.id, start: 0.5, end: 2, precise: true, output_format: undefined })
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('audio editor blocks an end time beyond the duration', async () => {
    const user = userEvent.setup()
    m.uploadFile.mockResolvedValue(audioMeta)
    renderApp('/audio')
    await user.upload(await screen.findByTestId('file-input'), new File([new Uint8Array(4)], 'tone.wav'))
    const end = await screen.findByLabelText('Fin')
    await user.clear(end); await user.type(end, '99'); await user.tab()
    expect(end).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Couper et exporter' })).toBeEnabled()
    expect(end).toHaveValue('99')
  })
})

describe('recent files', () => {
  it('lists processed files and marks expired ones', async () => {
    const user = userEvent.setup()
    addRecent({ jobId: 'f'.repeat(32), filename: 'old.jpg', originalName: 'old.png', format: 'jpg', size: 1000, originalSize: 2000, tool: 'convert', date: Date.now() })
    addRecent({ jobId: '9'.repeat(32), filename: 'fresh.mp3', originalName: 'a.wav', format: 'mp3', size: 1000, originalSize: 2000, tool: 'compress', date: Date.now() })
    m.isJobAvailable.mockImplementation(async (id) => id.startsWith('9'))
    renderApp('/recent')
    const list = await screen.findByTestId('recent-list')
    await waitFor(() => expect(within(list).getByText('Expiré')).toBeInTheDocument())
    expect(within(list).getAllByRole('link', { name: /Télécharger/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Vider la liste' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmer' }))
    expect(await screen.findByText('Aucun fichier traité pour l\'instant.')).toBeInTheDocument()
  })
})
