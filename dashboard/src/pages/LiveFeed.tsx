import { useEffect, useState } from 'react'
import axios from 'axios'
import { Video, RefreshCw } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const FRIGATE_URL = import.meta.env.VITE_FRIGATE_URL || 'http://localhost:5000'

export default function LiveFeed() {
  const [cameras, setCameras] = useState<string[]>([])
  const [selected, setSelected] = useState('')
  const [iframeKey, setIframeKey] = useState(0)

  async function fetchCameras() {
    try {
      const { data } = await axios.get<string[]>(`${API_URL}/api/cameras`)
      setCameras(data)
      if (data.length > 0 && !selected) {
        setSelected(data[0])
      }
    } catch {
      setCameras([])
    }
  }

  useEffect(() => {
    fetchCameras()
  }, [])

  const iframeSrc = selected
    ? `${FRIGATE_URL}/#/cameras/${selected}`
    : FRIGATE_URL

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Live Feed</h1>
        <div className="flex items-center gap-3">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            {cameras.length === 0 && <option value="">No cameras</option>}
            {cameras.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={() => setIframeKey((k) => k + 1)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden min-h-[400px]">
        {cameras.length > 0 ? (
          <iframe
            key={iframeKey}
            src={iframeSrc}
            className="w-full h-full border-0"
            title={`Live feed - ${selected}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
            <Video className="h-12 w-12 text-gray-700" />
            <p>No cameras configured.</p>
            <p className="text-sm text-gray-600">
              Add camera RTSP URLs in config/frigate.yml and restart Frigate.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
