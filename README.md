# ShareCalendar (공유 달력)

여러 사용자가 공동으로 약속 가능일을 조율할 수 있는 공유 달력 서비스입니다.

## 기술 스택

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Firebase (Authentication, Firestore)
- **Routing**: React Router DOM
- **스타일링**: CSS

## 프로젝트 구조

```
src/
├── components/       # 재사용 가능한 컴포넌트
│   └── Header.tsx   # 상단 네비게이션 바
├── contexts/         # React Context
│   └── AuthContext.tsx  # 인증 상태 관리
├── pages/           # 페이지 컴포넌트
│   ├── Home.tsx     # 메인 페이지
│   └── Login.tsx    # 로그인/회원가입 페이지
├── services/         # 서비스 레이어
│   ├── firebase.ts  # Firebase 초기화
│   └── auth.ts      # 인증 서비스
└── types/           # TypeScript 타입 정의
    └── index.ts
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Firebase 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성
2. Authentication 활성화
   - **구글 로그인**: Sign-in method에서 Google 활성화
3. Firestore Database 생성
4. 웹 앱 추가 후 설정값 복사

### 3. 환경 변수 설정

프로젝트 루트에 `.env` 파일 생성:

```env
# Firebase 설정
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. 개발 서버 실행

```bash
npm run dev
```

### 5. 빌드

```bash
npm run build
```

## 배포 (Netlify)

### 1. GitHub 저장소 생성 및 푸시

```bash
# GitHub에서 새 저장소 생성 후
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 2. Netlify 배포

1. [Netlify](https://www.netlify.com/)에 로그인
2. "Add new site" → "Import an existing project" 선택
3. GitHub 저장소 연결
4. 빌드 설정 (자동 감지됨):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. 환경 변수 설정:
   - Site settings → Environment variables에서 다음 변수 추가:
     - `VITE_FIREBASE_API_KEY`
     - `VITE_FIREBASE_AUTH_DOMAIN`
     - `VITE_FIREBASE_PROJECT_ID`
     - `VITE_FIREBASE_STORAGE_BUCKET`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID`
     - `VITE_FIREBASE_APP_ID`
6. "Deploy site" 클릭

### 3. Firebase 인증 도메인 추가

Netlify 배포 후 생성된 도메인을 Firebase Console에 추가해야 합니다:

1. [Firebase Console](https://console.firebase.google.com/) → Authentication → Settings
2. "Authorized domains"에 Netlify 도메인 추가 (예: `your-site.netlify.app`)

### 4. Firestore 보안 규칙 확인

배포 환경에서도 Firestore 보안 규칙이 올바르게 설정되어 있는지 확인하세요.

## 개발 진행 상황

### ✅ Phase 1: Firebase 설정 및 인증 (완료)
- [x] 프로젝트 초기화 (Vite + React + TypeScript)
- [x] Firebase 설치 및 설정
- [x] 프로젝트 기본 구조 생성
- [x] 구글 소셜 로그인 구현
- [x] 인증 컨텍스트 및 훅 생성
- [x] 기본 UI 구성 (Header, 라우팅)

### ✅ Phase 2: 달력 생성 및 참여 (완료)
- [x] 공유달력 생성 기능
- [x] 코드로 참여 기능
- [x] 공유달력 리스트 페이지
- [x] 비밀번호 보호 기능

### ✅ Phase 3: 달력 뷰 및 상호작용 (완료)
- [x] 달력 UI 구현 (월별 뷰)
- [x] 날짜 클릭 토글 기능
- [x] 실시간 업데이트
- [x] 확정일 설정 (길게 누르기)
- [x] 달력 공유 기능
- [x] 비로그인 사용자 접근 지원

### 🎨 Phase 4: UI 개선 (완료)
- [x] 스타일링 및 UX 개선
- [x] 반응형 디자인
- [x] 로딩 및 에러 처리

## 주요 기능

### 구현된 기능
- ✅ 구글 소셜 로그인
- ✅ 인증 상태 관리 (Firebase Auth)
- ✅ 공유달력 생성 (제목, 비밀번호 옵션)
- ✅ 코드로 달력 참여
- ✅ 달력 리스트 조회
- ✅ 날짜별 가능/불가 표시 (클릭 토글)
- ✅ 약속 확정일 설정 (길게 누르기)
- ✅ 실시간 업데이트 (Firestore 실시간 구독)
- ✅ 달력 공유 (링크 복사)
- ✅ 비로그인 사용자 접근 지원
- ✅ 비밀번호 보호 달력

## 라이선스

MIT
