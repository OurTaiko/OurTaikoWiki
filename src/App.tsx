import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Header } from './components/Header'
import { SongsPage } from './pages/SongsPage'
import { SongPage } from './pages/SongPage'
import { RatingPage } from './pages/RatingPage'
import { SettingsPage } from './pages/SettingsPage'
import { MigratePage } from './pages/MigratePage'

function Layout() {
  return (
    <div className="app ffxiv-ui">
      <Header />
      <Outlet />
      <footer className="site-footer"><span>OUR TAIKO WIKI</span><p>曲目资料来自 OurTaiko CDN</p></footer>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/songs" replace />} />
        <Route path="songs" element={<SongsPage />} />
        <Route path="songs/:id" element={<SongPage />} />
        <Route path="rating" element={<RatingPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="migrate" element={<MigratePage />} />
        <Route path="*" element={<Navigate to="/songs" replace />} />
      </Route>
    </Routes>
  )
}
