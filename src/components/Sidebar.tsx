import { NotebookPen, Plus } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { TabBar } from './TabBar'

/**
 * Permanent navigation rail: brand/home, a New note action, and the list of
 * every open tab. Nothing here collapses or slides away while writing.
 */
export function Sidebar() {
  const { createNote, setView, selectNote } = useApp()

  const goHome = () => {
    setView({ kind: 'notes' })
    selectNote(null)
  }

  return (
    <aside className="sidebar" aria-label="Navigation">
      <button className="sidebar__brand sidebar__brand--button" onClick={goHome} title="Home">
        <div className="brand-mark"><NotebookPen size={18} strokeWidth={2.2} /></div>
        <div>
          <div className="brand-name">Notely</div>
          <div className="brand-sub">YOUR SPACE TO THINK</div>
        </div>
      </button>

      <button className="sidebar__new" onClick={() => createNote()}>
        <Plus size={16} strokeWidth={2.6} /> New note
      </button>

      <div className="sidebar__scroll">
        <TabBar />
      </div>
    </aside>
  )
}
