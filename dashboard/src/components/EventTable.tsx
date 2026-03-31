import { format } from 'date-fns'
import SnapshotCard from './SnapshotCard'

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

interface EventTableProps {
  events: EventLogEntry[]
  loading: boolean
}

export default function EventTable({ events, loading }: EventTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Loading events...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        No events found.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-left">
            <th className="py-3 px-3 font-medium">Snapshot</th>
            <th className="py-3 px-3 font-medium">Time</th>
            <th className="py-3 px-3 font-medium">Camera</th>
            <th className="py-3 px-3 font-medium">Zone</th>
            <th className="py-3 px-3 font-medium">Object</th>
            <th className="py-3 px-3 font-medium">Rule</th>
            <th className="py-3 px-3 font-medium">Notified</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id ?? event.event_id}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            >
              <td className="py-2 px-3">
                <SnapshotCard eventId={event.event_id} />
              </td>
              <td className="py-2 px-3 text-gray-300 whitespace-nowrap">
                {format(new Date(event.timestamp), 'dd MMM yyyy, hh:mm:ss a')}
              </td>
              <td className="py-2 px-3 text-gray-300">{event.camera}</td>
              <td className="py-2 px-3 text-gray-300">{event.zone}</td>
              <td className="py-2 px-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  event.object_type === 'dog'
                    ? 'bg-amber-900/40 text-amber-400'
                    : event.object_type === 'person'
                    ? 'bg-blue-900/40 text-blue-400'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {event.object_type}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-400">
                {event.rule_name ?? '—'}
              </td>
              <td className="py-2 px-3">
                {event.notified ? (
                  <span className="text-emerald-400 text-xs">Yes</span>
                ) : (
                  <span className="text-gray-600 text-xs">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
