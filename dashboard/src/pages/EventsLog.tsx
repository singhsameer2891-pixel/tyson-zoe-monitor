import { useEffect, useState } from 'react'
import axios from 'axios'
import { RefreshCw } from 'lucide-react'
import EventTable from '../components/EventTable'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

interface EventLogEntry {
  id?: number
  event_id: string
  camera: string
  zone: string
  object_type: string
  rule_id: string | null
  rule_name: string | null
  notified: boolean
  snapshot_path: string | null
  timestamp: string
}

export default function EventsLog() {
  const [events, setEvents] = useState<EventLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [cameras, setCameras] = useState<string[]>([])

  // Filters
  const [cameraFilter, setCameraFilter] = useState('')
  const [objectFilter, setObjectFilter] = useState('')
  const [limit, setLimit] = useState(50)

  async function fetchEvents() {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { limit }
      if (cameraFilter) params.camera = cameraFilter
      if (objectFilter) params.object = objectFilter
      const { data } = await axios.get<EventLogEntry[]>(`${API_URL}/api/events`, { params })
      setEvents(data)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchCameras() {
    try {
      const { data } = await axios.get<string[]>(`${API_URL}/api/cameras`)
      setCameras(data)
    } catch {
      setCameras([])
    }
  }

  useEffect(() => {
    fetchCameras()
    fetchEvents()
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [cameraFilter, objectFilter, limit])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Events Log</h1>
        <button
          onClick={fetchEvents}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <select
          value={cameraFilter}
          onChange={(e) => setCameraFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        >
          <option value="">All Cameras</option>
          {cameras.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={objectFilter}
          onChange={(e) => setObjectFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        >
          <option value="">All Objects</option>
          <option value="person">Person</option>
          <option value="dog">Dog</option>
          <option value="cat">Cat</option>
        </select>

        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
        >
          <option value={25}>Last 25</option>
          <option value={50}>Last 50</option>
          <option value={100}>Last 100</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <EventTable events={events} loading={loading} />
      </div>
    </div>
  )
}
