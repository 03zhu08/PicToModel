import type { GenerationParams } from '../hooks/useModelGeneration'

interface Props {
  params: GenerationParams
  onParamsChange: (updates: Partial<GenerationParams>) => void
  onGenerate: () => void
  onExport: () => void
  canGenerate: boolean
  canExport: boolean
  isProcessing: boolean
  hasTexture: boolean
}

export default function ControlPanel({
  params,
  onParamsChange,
  onGenerate,
  onExport,
  canGenerate,
  canExport,
  isProcessing,
  hasTexture
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xs font-medium text-mc-text-muted uppercase tracking-wider">
        Settings
      </h2>

      {/* Resolution */}
      <div>
        <label className="flex items-center justify-between text-sm mb-2">
          <span className="text-mc-text-secondary">Resolution</span>
          <span className="text-mc-accent font-mono font-semibold text-xs">
            {params.resolution}x{params.resolution}
          </span>
        </label>
        <input
          type="range"
          min={8}
          max={128}
          step={2}
          value={params.resolution}
          onChange={(e) => onParamsChange({ resolution: Number(e.target.value) })}
          className="slider-track w-full"
        />
        <div className="flex justify-between text-xs text-mc-text-muted mt-1">
          <span>8</span>
          <span>128</span>
        </div>
      </div>

      {/* Extrusion Mode */}
      <div>
        <label className="text-sm text-mc-text-secondary mb-2 block">Extrusion Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {(['flat', 'rounded'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onParamsChange({ extrusionMode: mode })}
              className={`
                px-3 py-1.5 rounded text-sm font-medium transition-all capitalize
                ${params.extrusionMode === mode
                  ? 'bg-mc-accent text-white shadow-sm'
                  : 'bg-white text-mc-text-secondary border border-mc-border hover:bg-mc-hover'
                }
              `}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Depth Ratio */}
      <div>
        <label className="flex items-center justify-between text-sm mb-2">
          <span className="text-mc-text-secondary">Depth Ratio</span>
          <span className="text-mc-accent font-mono font-semibold text-xs">
            {(params.depthRatio * 100).toFixed(0)}%
          </span>
        </label>
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={params.depthRatio * 100}
          onChange={(e) => onParamsChange({ depthRatio: Number(e.target.value) / 100 })}
          className="slider-track w-full"
        />
        <div className="flex justify-between text-xs text-mc-text-muted mt-1">
          <span>Thin</span>
          <span>Thick</span>
        </div>
      </div>

      {/* Enable Color */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={params.enableColor}
              onChange={(e) => onParamsChange({ enableColor: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-mc-border rounded-full peer-checked:bg-mc-accent transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
          </div>
          <span className="text-sm text-mc-text-secondary">Enable Color</span>
        </label>
        <p className="text-xs text-mc-text-muted mt-1.5 ml-12">
          Sample colors from the original image onto the model
        </p>
      </div>

      {/* Texture Resolution */}
      {params.enableColor && (
        <div>
          <label className="flex items-center justify-between text-sm mb-2">
            <span className="text-mc-text-secondary">Texture Resolution</span>
            <span className="text-mc-accent font-mono font-semibold text-xs">
              {params.textureResolution}x{params.textureResolution}
            </span>
          </label>
          <input
            type="range"
            min={4}
            max={16}
            step={2}
            value={params.textureResolution}
            onChange={(e) => onParamsChange({ textureResolution: Number(e.target.value) })}
            className="slider-track w-full"
          />
          <div className="flex justify-between text-xs text-mc-text-muted mt-1">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 mt-2">
        <button
          onClick={onGenerate}
          disabled={!canGenerate || isProcessing}
          className={`
            btn-primary w-full flex items-center justify-center gap-2
            ${(!canGenerate || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing...
            </>
          ) : (
            'Generate Model'
          )}
        </button>

        <button
          onClick={onExport}
          disabled={!canExport}
          className={`
            btn-secondary w-full flex items-center justify-center gap-2
            ${!canExport ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {hasTexture ? 'Export JSON + Texture' : 'Export JSON'}
        </button>
      </div>
    </div>
  )
}
