import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import EventsLog from './pages/EventsLog'
import RulesConfig from './pages/RulesConfig'
import Settings from './pages/Settings'
import LiveFeed from './pages/LiveFeed'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/events" replace />} />
          <Route path="/events" element={<EventsLog />} />
          <Route path="/rules" element={<RulesConfig />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/live" element={<LiveFeed />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
