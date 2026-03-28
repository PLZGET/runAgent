from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .engine import run_analysis
from .models import AnalysisResponse, ProfileInput


app = FastAPI(
    title="탈출 마스터 API",
    version="0.1.0",
    description="퇴사 진단과 이직 시장 분석을 제공하는 해커톤 MVP 백엔드",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "탈출 마스터 API",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/api/demo/preset", response_model=ProfileInput)
def preset() -> ProfileInput:
    return ProfileInput()


@app.post("/api/demo/run", response_model=AnalysisResponse)
def demo_run(profile: ProfileInput) -> AnalysisResponse:
    return run_analysis(profile)
