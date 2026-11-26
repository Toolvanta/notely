import { createRoot } from 'react-dom/client'
import App, { type Mode } from './App'
import './styles/global.css'

const MODES: Mode[] = ['popup', 'full', 'sidepanel']
const requested = document.body.dataset.mode as Mode
const mode: Mode = MODES.includes(requested) ? requested : 'full'

const root = document.getElementById('root')
if (root) createRoot(root).render(<App mode={mode} />)
