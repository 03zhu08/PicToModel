import ImageUploader from './components/ImageUploader'
import VoxelPreview from './components/VoxelPreview'
import ReferenceViews from './components/ReferenceViews'
import ControlPanel from './components/ControlPanel'
import ModelInfo from './components/ModelInfo'
import { useModelGeneration } from './hooks/useModelGeneration'
import type { ImageSession } from './hooks/useModelGeneration'

const isElectron = import.meta.env.VITE_TARGET === 'electron'

export default function App() {
  const {
    imageData,
    voxels,
    stats,
    isProcessing,
    error,
    backendReady,
    modelReady,
    params,
    addImage,
    generate,
    exportModel,
    updateParams,
    modelJson,
    texturePng,
    sessions,
    activeSessionId,
    switchSession,
    closeSession
  } = useModelGeneration()

  const canGenerate = backendReady && modelReady && !!imageData

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
      {/* Title Bar */}
      <header
        className={`h-9 flex items-center px-4 bg-mc-secondary border-b border-mc-border shrink-0 select-none`}
        style={isElectron ? { WebkitAppRegion: 'drag' } as React.CSSProperties : undefined}
      >
        <div className={`flex items-center gap-2 ${isElectron ? 'pl-16' : ''}`}>
          <svg className="w-3.5 h-3.5 text-mc-accent" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-sm font-semibold text-mc-text">PicToModel</span>
          <span className="text-xs text-mc-text-muted ml-1">Minecraft 1.12.2 Model Generator</span>
        </div>
      </header>

      {/* Tab Bar */}
      {sessions.length > 0 && (
        <TabBar
          sessions={sessions}
          activeId={activeSessionId}
          onSwitch={switchSession}
          onClose={closeSession}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Image Upload */}
        <div className="w-72 shrink-0 p-4 border-r border-mc-border bg-mc-secondary flex flex-col gap-3">
          <ImageUploader
            onImageLoaded={addImage}
            currentImage={imageData}
            disabled={isProcessing}
          />
          <ModelInfo
            stats={stats}
            backendReady={backendReady}
            modelReady={modelReady}
            error={error}
          />
        </div>

        {/* Center - 3D Preview */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="flex-1 p-4 pb-0 min-h-0">
            <VoxelPreview
              voxels={voxels}
              dimensions={stats?.dimensions ?? null}
              modelJson={modelJson}
              texturePng={texturePng}
            />
          </div>
          <ReferenceViews
            voxels={voxels}
            dimensions={stats?.dimensions ?? null}
            modelJson={modelJson}
            texturePng={texturePng}
          />
        </div>

        {/* Right Panel - Controls */}
        <div className="w-64 shrink-0 p-4 border-l border-mc-border bg-mc-secondary overflow-y-auto">
          <ControlPanel
            params={params}
            onParamsChange={updateParams}
            onGenerate={generate}
            onExport={exportModel}
            canGenerate={canGenerate}
            canExport={!!modelJson}
            isProcessing={isProcessing}
            hasTexture={!!texturePng}
          />
        </div>
      </div>
    </div>
  )
}

function TabBar({
  sessions,
  activeId,
  onSwitch,
  onClose,
}: {
  sessions: ImageSession[]
  activeId: string | null
  onSwitch: (id: string) => void
  onClose: (id: string) => void
}) {
  return (
    <div
      className="h-8 flex items-end gap-0.5 px-2 bg-mc-secondary border-b border-mc-border shrink-0 overflow-x-auto"
      style={isElectron ? { WebkitAppRegion: 'no-drag' } as React.CSSProperties : undefined}
    >
      {sessions.map((s) => {
        const isActive = s.id === activeId
        return (
          <button
            key={s.id}
            onClick={() => onSwitch(s.id)}
            className={`
              group relative flex items-center gap-1.5 px-3 h-7 text-xs rounded-t
              transition-colors shrink-0 max-w-[160px]
              ${isActive
                ? 'bg-white text-mc-text border-t border-x border-mc-border -mb-px'
                : 'text-mc-text-muted hover:text-mc-text hover:bg-mc-hover'
              }
            `}
          >
            {s.isProcessing && (
              <svg className="animate-spin w-3 h-3 shrink-0 text-mc-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className="truncate">{s.imageName || 'Untitled'}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onClose(s.id) }}
              className="ml-1 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-mc-tertiary transition-opacity text-mc-text-muted hover:text-mc-text shrink-0"
            >
              &times;
            </span>
          </button>
        )
      })}
    </div>
  )
}
