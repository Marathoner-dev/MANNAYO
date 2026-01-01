# 배포 가이드 (Netlify)

이 문서는 ShareCalendar 앱을 GitHub + Netlify를 통해 배포하는 방법을 안내합니다.

## 1단계: GitHub 저장소 생성

1. [GitHub](https://github.com)에 로그인
2. 우측 상단의 "+" 버튼 클릭 → "New repository" 선택
3. 저장소 정보 입력:
   - **Repository name**: `ShareCalendar` (또는 원하는 이름)
   - **Description**: "공유 달력 서비스"
   - **Visibility**: Public 또는 Private 선택
   - **Initialize this repository with**: 체크하지 않음 (이미 로컬에 코드가 있음)
4. "Create repository" 클릭

## 2단계: 로컬 코드를 GitHub에 푸시

터미널에서 다음 명령어 실행:

```bash
# GitHub 저장소 URL을 원격 저장소로 추가
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 브랜치 이름을 main으로 변경 (필요한 경우)
git branch -M main

# 코드 푸시
git push -u origin main
```

**참고**: `YOUR_USERNAME`과 `YOUR_REPO_NAME`을 실제 GitHub 사용자명과 저장소 이름으로 변경하세요.

## 3단계: Netlify 배포 설정

### 3.1 Netlify 계정 생성 및 로그인

1. [Netlify](https://www.netlify.com/)에 접속
2. "Sign up" 클릭 → GitHub 계정으로 로그인 (권장)

### 3.2 새 사이트 생성

1. Netlify 대시보드에서 "Add new site" → "Import an existing project" 클릭
2. "Deploy with GitHub" 선택
3. GitHub 저장소 선택 및 권한 부여
4. 저장소 선택

### 3.3 빌드 설정

Netlify가 자동으로 설정을 감지하지만, 확인하세요:

- **Branch to deploy**: `main`
- **Build command**: `npm run build`
- **Publish directory**: `dist`

### 3.4 환경 변수 설정

**중요**: Firebase 설정을 위해 환경 변수를 추가해야 합니다.

1. "Show advanced" 클릭
2. "New variable" 클릭하여 다음 변수들을 하나씩 추가:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**참고**: `.env` 파일의 값들을 그대로 복사하여 입력하세요.

3. "Deploy site" 클릭

### 3.5 배포 완료 대기

- 빌드가 시작되면 로그를 확인할 수 있습니다
- 빌드가 완료되면 사이트 URL이 생성됩니다 (예: `https://your-site-name.netlify.app`)

## 4단계: Firebase 설정 업데이트

### 4.1 인증 도메인 추가

Netlify 배포 후 생성된 도메인을 Firebase에 등록해야 합니다:

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. **Authentication** → **Settings** → **Authorized domains** 이동
4. "Add domain" 클릭
5. Netlify 도메인 입력 (예: `your-site-name.netlify.app`)
6. "Add" 클릭

### 4.2 Firestore 보안 규칙 확인

배포 환경에서도 Firestore 보안 규칙이 올바르게 설정되어 있는지 확인:

1. Firebase Console → **Firestore Database** → **Rules**
2. 다음 규칙이 설정되어 있는지 확인:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자 데이터 (인증된 사용자만 읽기/쓰기)
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 달력 데이터 (모든 사용자가 읽기 가능, 생성자만 쓰기)
    match /calendars/{calendarId} {
      allow read: if true; // 모든 사용자가 읽기 가능
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && 
        request.resource.data.createdBy == request.auth.uid;
    }
    
    // 가용성 데이터 (모든 사용자가 읽기/쓰기 가능)
    match /availability/{availabilityId} {
      allow read, write: if true;
    }
  }
}
```

## 5단계: 배포 확인

1. Netlify에서 제공된 URL로 접속
2. 다음 기능들이 정상 작동하는지 확인:
   - ✅ 구글 로그인
   - ✅ 달력 생성
   - ✅ 달력 조회
   - ✅ 날짜 클릭 토글
   - ✅ 실시간 업데이트

## 자동 배포 설정

Netlify는 기본적으로 GitHub 저장소에 푸시할 때마다 자동으로 재배포됩니다:

1. 코드 수정
2. `git add .`
3. `git commit -m "Update"`
4. `git push`
5. Netlify가 자동으로 빌드 및 배포 시작

## 커스텀 도메인 설정 (선택사항)

1. Netlify 대시보드 → Site settings → Domain management
2. "Add custom domain" 클릭
3. 도메인 입력 및 DNS 설정 안내 따르기

## 문제 해결

### 빌드 실패 시

1. Netlify 빌드 로그 확인
2. 환경 변수가 올바르게 설정되었는지 확인
3. 로컬에서 `npm run build`가 성공하는지 확인

### 인증 오류 시

1. Firebase Console에서 인증 도메인이 올바르게 추가되었는지 확인
2. 환경 변수가 올바르게 설정되었는지 확인

### Firestore 접근 오류 시

1. Firestore 보안 규칙 확인
2. Firebase Console에서 인덱스가 생성되었는지 확인

## 추가 리소스

- [Netlify 문서](https://docs.netlify.com/)
- [Firebase 문서](https://firebase.google.com/docs)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)

