import { useEffect, useState } from 'react'
import axios from 'axios'
import { Save, CheckCircle, AlertCircle, Phone } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

interface HealthStatus {
  mqtt: boolean
  frigate: boolean
  uptime: number
}

export default function Settings() {
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [cooldown, setCooldown] = useState('60')
  const [twilioSid, setTwilioSid] = useState('')
  const [twilioToken, setTwilioToken] = useState('')
  const [twilioFrom, setTwilioFrom] = useState('')
  const [twilioTo, setTwilioTo] = useState('')
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [saved, setSaved] = useState(false)

  async function fetchHealth() {
    try {
      const { data } = await axios.get<HealthStatus>(`${API_URL}/api/health`)
      setHealth(data)
    } catch {
      setHealth(null)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 15000)
    return () => clearInterval(interval)
  }, [])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    // Settings are managed via .env file — show confirmation that values should be set there
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const inputClass = 'w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-400'
  const labelClass = 'block text-sm text-gray-400 mb-1'

  function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      {/* System Health */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-300 mb-3">System Health</h2>
        {health ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              {health.mqtt ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm text-gray-300">MQTT</span>
            </div>
            <div className="flex items-center gap-2">
              {health.frigate ? (
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm text-gray-300">Frigate</span>
            </div>
            <div className="text-sm text-gray-400">
              Uptime: {formatUptime(health.uptime)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-400">Unable to reach automation service</p>
        )}
      </div>

      {/* Telegram Config */}
      <form onSubmit={handleSave}>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-300">Telegram Configuration</h2>
          <p className="text-xs text-gray-500">
            These values are read from environment variables. Update your .env file and restart the automation service to apply changes.
          </p>

          <div>
            <label className={labelClass}>Bot Token</label>
            <input
              type="password"
              className={inputClass}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Set via TELEGRAM_BOT_TOKEN in .env"
            />
          </div>

          <div>
            <label className={labelClass}>Chat ID</label>
            <input
              className={inputClass}
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Set via TELEGRAM_CHAT_ID in .env"
            />
          </div>

          <div>
            <label className={labelClass}>Notification Cooldown (seconds)</label>
            <input
              type="number"
              className={inputClass}
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
              min={0}
              placeholder="60"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 rounded font-medium transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            {saved && (
              <span className="text-sm text-emerald-400">
                Update your .env file with these values and restart the service.
              </span>
            )}
          </div>
        </div>
      </form>

      {/* Twilio Config */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4 mt-6">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-medium text-gray-300">Twilio Phone Call Alerts</h2>
        </div>
        <p className="text-xs text-gray-500">
          When configured, the system will make a phone call in parallel with the Telegram notification on every alert. Update your .env file and restart.
        </p>

        <div>
          <label className={labelClass}>Account SID</label>
          <input
            type="password"
            className={inputClass}
            value={twilioSid}
            onChange={(e) => setTwilioSid(e.target.value)}
            placeholder="Set via TWILIO_ACCOUNT_SID in .env"
          />
        </div>

        <div>
          <label className={labelClass}>Auth Token</label>
          <input
            type="password"
            className={inputClass}
            value={twilioToken}
            onChange={(e) => setTwilioToken(e.target.value)}
            placeholder="Set via TWILIO_AUTH_TOKEN in .env"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>From Number</label>
            <input
              className={inputClass}
              value={twilioFrom}
              onChange={(e) => setTwilioFrom(e.target.value)}
              placeholder="Set via TWILIO_FROM_NUMBER in .env"
            />
          </div>
          <div>
            <label className={labelClass}>To Number</label>
            <input
              className={inputClass}
              value={twilioTo}
              onChange={(e) => setTwilioTo(e.target.value)}
              placeholder="Set via TWILIO_TO_NUMBER in .env"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
