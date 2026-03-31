import { useState } from 'react'
import { X } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

interface SnapshotCardProps {
  eventId: string
  alt?: string
}

export default function SnapshotCard({ eventId, alt = 'Snapshot' }: SnapshotCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(false)

  const src = `${API_URL}/api/snapshot/${eventId}`

  if (error) {
    return (
      <div className="w-16 h-12 bg-gray-800 rounded flex items-center justify-center text-gray-600 text-xs">
        N/A
      </div>
    )
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        className="w-16 h-12 object-cover rounded cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
        onClick={() => setExpanded(true)}
        onError={() => setError(true)}
      />

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpanded(false)}
        >
          <div className="relative max-w-3xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpanded(false)}
              className="absolute -top-3 -right-3 bg-gray-800 rounded-full p-1 hover:bg-gray-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[80vh] rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  )
}
