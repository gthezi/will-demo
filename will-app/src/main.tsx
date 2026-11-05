import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './index.css'
import App from './App.tsx'
import { applyDocumentTheme, getInitialThemeMode, getSystemTheme } from './theme'

const initialMode = getInitialThemeMode()
dayjs.locale('zh-cn')
applyDocumentTheme(initialMode === 'system' ? getSystemTheme() : initialMode)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
