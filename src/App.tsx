import ImageUploader from './components/ImageUploader'
import VoxelPreview from './components/VoxelPreview'
import ControlPanel from './components/ControlPanel'
import ModelInfo from './components/ModelInfo'
import { useModelGeneration } from './hooks/useModelGeneration'

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
    setImage,
    generate,
    exportModel,
    updateParams,
    modelJson,
    texturePng
  } = useModelGeneration()

  return (
    <div className="h-screen w-screen flex flex-col bg-white overflow-hidden">
      {/* Title Bar */}
      <header
        className="h-9 flex items-center px-4 bg-mc-secondary border-b border-mc-border shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 pl-16">
          <svg className="w-3.5 h-3.5 text-mc-accent" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          <span className="text-sm font-semibold text-mc-text">PicToModel</span>
          <span className="text-xs text-mc-text-muted ml-1">Minecraft 1.12.2 Model Generator</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Image Upload */}
        <div className="w-72 shrink-0 p-4 border-r border-mc-border bg-mc-secondary flex flex-col gap-4">
          <ImageUploader
            onImageLoaded={setImage}
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
        <div className="flex-1 p-4 bg-white">
          <VoxelPreview
            voxels={voxels}
            dimensions={stats?.dimensions ?? null}
          />
        </div>

        {/* Right Panel - Controls */}
        <div className="w-64 shrink-0 p-4 border-l border-mc-border bg-mc-secondary overflow-y-auto">
          <ControlPanel
            params={params}
            onParamsChange={updateParams}
            onGenerate={generate}
            onExport={exportModel}
            canGenerate={!!imageData && backendReady && modelReady}
            canExport={!!modelJson}
            isProcessing={isProcessing}
            hasTexture={!!texturePng}
          />
        </div>
      </div>
    </div>
  )
}
