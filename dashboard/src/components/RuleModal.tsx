import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

interface TimeRestriction {
  enabled: boolean
  startHour: number
  endHour: number
}

interface Rule {
  id: string
  name: string
  camera: string
  zone: string
  objectType: 'dog' | 'person' | 'cat'
  action: 'entered' | 'exited'
  timeRestriction: TimeRestriction
  notificationTemplate: string
  enabled: boolean
}

interface RuleModalProps {
  rule: Rule | null
  cameras: string[]
  onSave: (rule: Rule) => void
  onClose: () => void
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i)

function formatHour(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

export default function RuleModal({ rule, cameras, onSave, onClose }: RuleModalProps) {
  const [form, setForm] = useState<Rule>(() =>
    rule ?? {
      id: `rule-${Date.now()}`,
      name: '',
      camera: cameras[0] ?? '',
      zone: '',
      objectType: 'person',
      action: 'entered',
      timeRestriction: { enabled: false, startHour: 23, endHour: 6 },
      notificationTemplate: '',
      enabled: true,
    }
  )

  useEffect(() => {
    if (rule) setForm(rule)
  }, [rule])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-400'
  const labelClass = 'block text-sm text-gray-400 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">{rule ? 'Edit Rule' : 'New Rule'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelClass}>Rule Name</label>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Dog in Garden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Camera</label>
              <select
                className={inputClass}
                value={form.camera}
                onChange={(e) => setForm({ ...form, camera: e.target.value })}
              >
                {cameras.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {cameras.length === 0 && <option value="">No cameras found</option>}
              </select>
            </div>

            <div>
              <label className={labelClass}>Zone Name</label>
              <input
                className={inputClass}
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                placeholder="garden_zone"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Object Type</label>
              <select
                className={inputClass}
                value={form.objectType}
                onChange={(e) => setForm({ ...form, objectType: e.target.value as Rule['objectType'] })}
              >
                <option value="person">Person</option>
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Action</label>
              <select
                className={inputClass}
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value as Rule['action'] })}
              >
                <option value="entered">Entered</option>
                <option value="exited">Exited</option>
              </select>
            </div>
          </div>

          {/* Time Restriction */}
          <div className="border border-gray-800 rounded p-4">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.timeRestriction.enabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    timeRestriction: { ...form.timeRestriction, enabled: e.target.checked },
                  })
                }
                className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-400"
              />
              Enable Time Restriction
            </label>

            {form.timeRestriction.enabled && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className={labelClass}>Start Hour</label>
                  <select
                    className={inputClass}
                    value={form.timeRestriction.startHour}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        timeRestriction: { ...form.timeRestriction, startHour: Number(e.target.value) },
                      })
                    }
                  >
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>End Hour</label>
                  <select
                    className={inputClass}
                    value={form.timeRestriction.endHour}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        timeRestriction: { ...form.timeRestriction, endHour: Number(e.target.value) },
                      })
                    }
                  >
                    {HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Notification Template</label>
            <input
              className={inputClass}
              value={form.notificationTemplate}
              onChange={(e) => setForm({ ...form, notificationTemplate: e.target.value })}
              placeholder="e.g. Dog spotted in the garden!"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition-colors"
            >
              Save Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
