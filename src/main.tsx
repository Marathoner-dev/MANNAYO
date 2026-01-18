import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { resetMetaTags } from './utils/metaTags'

// 앱 시작 시 기본 메타 태그를 절대 URL로 설정
resetMetaTags()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
