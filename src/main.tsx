import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'

type Mode = 'popup' | 'full' | 'sidepanel'
const mode = (document.body.dataset.mode as Mode) || 'full'

const root = document.getElementById('root')
if (root) createRoot(root).render(<App mode={mode} />)
