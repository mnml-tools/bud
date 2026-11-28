import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { linuxPlatform } from './lib/platform'
import './style.css'

document.documentElement.classList.toggle('linux', linuxPlatform)

createRoot(document.getElementById('root')!).render(<App />)
