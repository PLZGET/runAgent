# 탈출 마스터 MVP

`plan2.md`를 기준으로 구현한 해커톤용 MVP다.

구성:

- `frontend`: Next.js 대시보드
- `backend`: FastAPI 분석 API

핵심 흐름:

1. 사용자 프로필 입력
2. 퇴사 타이밍 분석
3. 브라우저 액션 로그 재생
4. 공고 추천 Top 5
5. 퇴사 리포트와 문서 초안 생성

## 실행

### 백엔드

```bash
cd backend
"C:\Program Files\Python311\python.exe" -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8002
```

이미 설정된 뒤에는 아래처럼 더 짧게 실행해도 된다.

```powershell
cd backend
.\start.ps1
```

실행 정책 문제를 피하려면 아래 배치 파일을 써도 된다.

```powershell
cd backend
.\start.cmd
```

### 프론트엔드

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:3002` 접속.

## Docker Compose

```bash
docker compose up --build
```

## 주의

- 현재 버전은 외부 채용 사이트를 직접 크롤링하지 않는다.
- 브라우저 액션은 데모 안정성을 위한 `mock browser run` 방식이다.
- 실제 Playwright 연동은 `backend/app/engine.py`의 이벤트 생성부를 대체하는 방식으로 확장할 수 있다.
