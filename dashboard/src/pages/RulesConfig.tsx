import { useEffect, useState } from 'react'
import axios from 'axios'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import RuleModal from '../components/RuleModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

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

export default function RulesConfig() {
  const [rules, setRules] = useState<Rule[]>([])
  const [cameras, setCameras] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  async function fetchRules() {
    try {
      const { data } = await axios.get<Rule[]>(`${API_URL}/api/rules`)
      setRules(data)
    } catch {
      setRules([])
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

  async function saveRules(updated: Rule[]) {
    setSaving(true)
    try {
      await axios.post(`${API_URL}/api/rules`, updated)
      setRules(updated)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchRules()
    fetchCameras()
  }, [])

  function handleToggle(id: string) {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    )
    saveRules(updated)
  }

  function handleDelete(id: string) {
    const updated = rules.filter((r) => r.id !== id)
    saveRules(updated)
  }

  function handleSave(rule: Rule) {
    const exists = rules.find((r) => r.id === rule.id)
    const updated = exists
      ? rules.map((r) => (r.id === rule.id ? rule : r))
      : [...rules, rule]
    saveRules(updated)
    setShowModal(false)
    setEditingRule(null)
  }

  function openEdit(rule: Rule) {
    setEditingRule(rule)
    setShowModal(true)
  }

  function openNew() {
    setEditingRule(null)
    setShowModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        Loading rules...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Rules Config</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-gray-500 text-center py-20">
          No rules configured. Add one to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-gray-900 border rounded-lg p-4 flex items-center justify-between transition-colors ${
                rule.enabled ? 'border-gray-800' : 'border-gray-800/50 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-medium text-gray-200 truncate">{rule.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    rule.objectType === 'dog'
                      ? 'bg-amber-900/40 text-amber-400'
                      : rule.objectType === 'person'
                      ? 'bg-blue-900/40 text-blue-400'
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {rule.objectType}
                  </span>
                  {rule.timeRestriction.enabled && (
                    <span className="text-xs text-gray-500">
                      {rule.timeRestriction.startHour}:00–{rule.timeRestriction.endHour}:00
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {rule.camera} / {rule.zone} — {rule.action}
                </p>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(rule.id)}
                  disabled={saving}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    rule.enabled ? 'bg-emerald-600' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      rule.enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>

                <button
                  onClick={() => openEdit(rule)}
                  className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  onClick={() => handleDelete(rule.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RuleModal
          rule={editingRule}
          cameras={cameras}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingRule(null) }}
        />
      )}
    </div>
  )
}
