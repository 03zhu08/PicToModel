interface Props {
  stats: {
    elementCount: number
    dimensions: [number, number, number]
  } | null
  backendReady: boolean
  modelReady: boolean
  error: string | null
}

export default function ModelInfo({ stats, backendReady, modelReady, error }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Backend Status */}
      <div className="flex items-center gap-2 text-xs">
        <div className={`w-2 h-2 rounded-full ${
          backendReady && modelReady
            ? 'bg-mc-success'
            : backendReady
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-mc-danger animate-pulse'
        }`} />
        <span className="text-mc-text-muted">
          {!backendReady
            ? 'Starting backend...'
            : !modelReady
              ? 'Loading AI model...'
              : 'Ready'}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-mc-danger text-xs break-words">{error}</p>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="glass-panel p-3 space-y-2">
          <h3 className="text-xs font-medium text-mc-text-muted uppercase tracking-wider">
            Model Stats
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Elements" value={stats.elementCount.toLocaleString()} />
            <Stat label="Dimensions" value={`${stats.dimensions[0]}x${stats.dimensions[1]}x${stats.dimensions[2]}`} />
          </div>
          {stats.elementCount > 1000 && (
            <p className="text-yellow-600 text-xs mt-1">
              High element count may cause lag in Minecraft.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-mc-text-muted text-xs">{label}</p>
      <p className="text-mc-text font-mono font-semibold text-sm">{value}</p>
    </div>
  )
}
