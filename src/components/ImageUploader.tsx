import { useCallback, useRef, useState } from 'react'

interface Props {
  onImageLoaded: (dataUrl: string, fileName: string) => void
  currentImage: string | null
  disabled: boolean
}

export default function ImageUploader({ onImageLoaded, currentImage, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        onImageLoaded(reader.result as string, file.name)
      }
      reader.readAsDataURL(file)
    },
    [onImageLoaded]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile, disabled]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setIsDragging(false), [])

  const onClick = useCallback(() => {
    if (!disabled) fileInputRef.current?.click()
  }, [disabled])

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      e.target.value = ''
    },
    [handleFile]
  )

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xs font-medium text-mc-text-muted uppercase tracking-wider mb-2">
        Source Image
      </h2>
      <div
        className={`
          flex-1 rounded-lg border-2 border-dashed transition-all duration-200 cursor-pointer
          flex items-center justify-center overflow-hidden relative bg-white
          ${isDragging ? 'border-mc-accent bg-blue-50' : 'border-mc-border hover:border-mc-accent'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />

        {currentImage ? (
          <img
            src={currentImage}
            alt="Uploaded"
            className="max-w-full max-h-full object-contain p-2"
          />
        ) : (
          <div className="text-center p-6">
            <div className="mb-3">
              <svg className="w-10 h-10 mx-auto text-mc-border" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-mc-text-secondary text-sm">
              Drag & drop an image here
            </p>
            <p className="text-mc-text-muted text-xs mt-1">
              or click to browse
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
