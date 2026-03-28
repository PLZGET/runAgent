# 탈출 마스터 배포 가이드

## 프로젝트 구성

| 서비스 | 기술 스택 | 포트 |
|--------|-----------|------|
| 프론트엔드 | Next.js 15 (TypeScript) | 3002 |
| 백엔드 | FastAPI (Python 3.11) | 8002 |

---

## 방법 1: 로컬 개발 환경

### 사전 요구사항
- Python 3.11+
- Node.js 22+
- Git

### 백엔드 실행

```bash
cd backend

# 가상환경 생성 (최초 1회)
python -m venv .venv

# 가상환경 활성화
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Windows CMD:
.venv\Scripts\activate.bat
# Linux/Mac:
source .venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 서버 실행 (개발용 - 핫리로드 포함)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

### 프론트엔드 실행

```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

접속: http://localhost:3002
API 문서: http://localhost:8002/docs

---

## 방법 2: Docker Compose (권장 - 로컬/서버 공통)

### 사전 요구사항
- Docker Desktop (Windows/Mac) 또는 Docker Engine + Docker Compose (Linux)

### 실행

```bash
# 프로젝트 루트에서
docker compose up --build

# 백그라운드 실행
docker compose up --build -d

# 종료
docker compose down
```

접속: http://localhost:3002

### 컨테이너 상태 확인

```bash
docker compose ps
docker compose logs backend
docker compose logs frontend
```

---

## 방법 3: 클라우드 배포

### 옵션 A: Render (가장 간단, 무료 플랜 있음)

#### 백엔드 배포

1. [render.com](https://render.com) 가입 후 **New Web Service** 생성
2. GitHub 저장소 연결
3. 설정:
   ```
   Name: talchul-master-backend
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. 배포 후 URL 메모 (예: `https://talchul-master-backend.onrender.com`)

#### 프론트엔드 배포

1. **New Web Service** 생성
2. 설정:
   ```
   Name: talchul-master-frontend
   Root Directory: frontend
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm run start
   ```
3. **Environment Variables** 추가:
   ```
   BACKEND_INTERNAL_URL=https://talchul-master-backend.onrender.com
   PORT=3002
   ```

---

### 옵션 B: Railway

#### 백엔드

```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 생성 및 백엔드 배포
cd backend
railway init
railway up
```

Railway 대시보드에서 환경변수 없음 (백엔드는 현재 없음).

#### 프론트엔드

```bash
cd frontend
railway init
railway up
```

환경변수 설정:
```
BACKEND_INTERNAL_URL=https://<백엔드-Railway-URL>
```

---

### 옵션 C: VPS (Ubuntu) - Docker Compose로 전체 배포

#### 1. 서버 초기 설정

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose 설치 (Docker Plugin 방식)
sudo apt install docker-compose-plugin

# 확인
docker compose version
```

#### 2. 코드 배포

```bash
# 서버에서
git clone https://github.com/<your-org>/codexProject.git
cd codexProject

# 실행
docker compose up --build -d
```

#### 3. Nginx 리버스 프록시 설정 (선택사항 - 도메인 연결 시)

```bash
sudo apt install nginx
```

`/etc/nginx/sites-available/talchul`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/talchul /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. HTTPS 설정 (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

### 옵션 D: Vercel (프론트엔드) + 별도 백엔드

프론트엔드만 Vercel에 배포하고, 백엔드는 Render/Railway에 별도 배포하는 방식.

#### Vercel 배포

```bash
# Vercel CLI 설치
npm install -g vercel

cd frontend
vercel

# 환경변수 설정
vercel env add BACKEND_INTERNAL_URL
# 값: https://<백엔드-URL>
```

또는 [vercel.com](https://vercel.com) 대시보드에서 GitHub 저장소 직접 연결.

> **주의:** Vercel은 `Root Directory`를 `frontend`로 설정해야 합니다.

---

## 환경변수 정리

### 프론트엔드

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `BACKEND_INTERNAL_URL` | 백엔드 API URL | `http://backend:8000` (Docker 내부) 또는 `https://api.example.com` (외부) |
| `PORT` | 프론트엔드 서버 포트 | `3002` |

### 백엔드

현재 환경변수 없음 (필요 시 추가).

---

## 프로덕션 배포 전 체크리스트

- [ ] `BACKEND_INTERNAL_URL` 환경변수가 올바른 백엔드 URL을 가리키는지 확인
- [ ] 백엔드 CORS 설정 변경 (`allow_origins=["*"]` → 실제 프론트엔드 도메인)
- [ ] `next.config.ts`의 rewrite 규칙이 올바른 백엔드 URL을 사용하는지 확인
- [ ] 외부 API (Remote OK, Arbeitnow) 접근이 서버 환경에서 가능한지 확인
- [ ] Docker 이미지가 정상 빌드되는지 로컬에서 먼저 검증

### CORS 설정 변경 (backend/app/main.py)

```python
# 현재 (개발용)
allow_origins=["*"]

# 프로덕션 시 변경
allow_origins=["https://your-frontend-domain.com"]
```

---

## 포트 요약

| 환경 | 프론트엔드 | 백엔드 |
|------|-----------|--------|
| 로컬 개발 | http://localhost:3002 | http://localhost:8002 |
| Docker Compose | http://localhost:3002 | http://localhost:8002 |
| Docker 내부 통신 | - | http://backend:8000 |

---

## 문제 해결

### 백엔드 연결 오류
```bash
# 백엔드 로그 확인
docker compose logs backend

# 백엔드 헬스체크
curl http://localhost:8002/health
```

### 프론트엔드 빌드 오류
```bash
# 로컬에서 빌드 테스트
cd frontend
npm run build
```

### Docker 이미지 재빌드
```bash
docker compose down
docker compose up --build --force-recreate
```

### 포트 충돌
```bash
# 사용 중인 포트 확인 (Windows)
netstat -ano | findstr :3002
netstat -ano | findstr :8002
```
