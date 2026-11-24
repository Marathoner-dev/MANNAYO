import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 공통 UI(버튼·입력·모달)를 페이지 CSS보다 먼저 불러와야 페이지별 덮어쓰기가 먹는다
import './App.css'
import App from './App.tsx'
import { resetMetaTags } from './utils/metaTags'

// 앱 시작 시 기본 메타 태그를 절대 URL로 설정
resetMetaTags()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
