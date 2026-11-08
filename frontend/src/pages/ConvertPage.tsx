import { ArrowLeftRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ErrorNotice } from '../components/ErrorNotice'
import { FileChip } from '../components/FileChip'
import { FileUploadZone } from '../components/FileUploadZone'
import { FilePreview } from '../components/FilePreview'
import { GlassButton } from '../components/GlassButton'
import { GlassCard } from '../components/GlassCard'
import { ProcessingIndicator } from '../components/ProcessingIndicator'
import { ResultCard } from '../components/ResultCard'
import { ToolHeader } from '../components/ToolHeader'
import { useProcessing } from '../hooks/useProcessing'
import { useToolFile } from '../hooks/useToolFile'
import { sourcePreviewUrl } from '../services/api'
import { FORMATS, KINDS, upper } from '../utils/formats'

export default function ConvertPage() {
  const { t } = useTranslation()
  const { file, setFile } = useToolFile(KINDS)
  const { state, run, reset } = useProcessing('convert')
  const [target, setTarget] = useState<string | null>(null)
  const header = <ToolHeader icon={<ArrowLeftRight size={24} aria-hidden />} title={t('convert.title')} description={t('tools.convert')} />

  if (!file) return <>{header}<FileUploadZone onUploaded={(f) => { setTarget(null); setFile(f) }} /></>

  const audioTargets = FORMATS.audio
  const effective = target && file.targets.includes(target) ? target : null
  return (
    <>
      {header}
      <div className="flex flex-col gap-5">
        <FileChip file={file} onReplace={() => { setFile(null); reset(); setTarget(null) }} />
        {state.phase === 'running' && <ProcessingIndicator progress={state.progress} />}
        {state.phase === 'done' && <ResultCard jobId={state.jobId} result={state.result} onAnother={() => { reset(); setFile(null); setTarget(null) }} />}
        {state.phase === 'error' && <ErrorNotice error={state.error} onRetry={reset} />}
        {(state.phase === 'idle' || state.phase === 'error') && (
          <>
            <GlassCard className="flex flex-col gap-4">
              <FilePreview kind={file.kind} format={file.format} name={file.original_name} src={sourcePreviewUrl(file.id)} previewable={file.previewable} />
              <h2 className="font-medium">{t('convert.chooseTarget')}</h2>
              {file.targets.length === 0 ? <p className="text-sm text-fg-2">{t('convert.noTargets')}</p> : (
                <div role="radiogroup" aria-label={t('convert.chooseTarget')} className="flex flex-wrap gap-2">
                  {file.targets.map((f) => (
                    <button key={f} type="button" role="radio" aria-checked={effective === f} onClick={() => setTarget(f)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${effective === f ? 'bg-ink text-ink-contrast' : 'glass hover:bg-glass-strong'}`}>
                      {upper(f)}
                    </button>
                  ))}
                </div>
              )}
              {file.kind === 'document' && <p className="hint">{t('convert.docNote')}</p>}
              {file.kind === 'video' && effective && audioTargets.includes(effective) && <p className="hint">{t('convert.audioExtract')}</p>}
              <GlassButton variant="primary" size="lg" className="self-start" disabled={!effective} onClick={() => effective && void run('convert', { file_id: file.id, target: effective })}>{t('convert.run')}</GlassButton>
            </GlassCard>
          </>
        )}
      </div>
    </>
  )
}
