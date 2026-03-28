from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class ProfileInput(BaseModel):
    name: str = Field(default="김철수")
    start_date: str = Field(default="2023-03-02")
    current_salary: int = Field(default=5400, ge=0, description="만원 단위")
    desired_salary: int = Field(default=6500, ge=0, description="만원 단위")
    years_experience: int = Field(default=3, ge=0)
    current_role: str = Field(default="백엔드 개발자")
    desired_role: str = Field(default="시니어 백엔드 개발자")
    skills: List[str] = Field(
        default_factory=lambda: ["Java", "Spring Boot", "JPA", "Redis", "AWS"]
    )
    resignation_reason: str = Field(default="성장 정체와 잦은 야근")
    preferred_timing: str = Field(default="2개월 내")


class BrowserEvent(BaseModel):
    phase: str
    site: str
    title: str
    detail: str
    elapsed_ms: int
    preview_lines: List[str]


class Diagnosis(BaseModel):
    timing_recommendation: str
    financial_risk: str
    market_signal: str
    action_summary: str


class RecommendedJob(BaseModel):
    company: str
    title: str
    location: str
    source: str
    url: str
    salary_min: int
    salary_max: int
    rating: float | None = None
    review_summary: str
    skills: List[str]
    match_score: int
    salary_gap_percent: int
    reasons: List[str]


class MetricCard(BaseModel):
    label: str
    value: str
    detail: str


class GeneratedDocument(BaseModel):
    title: str
    doc_type: str
    content: str


class AnalysisResponse(BaseModel):
    profile_summary: str
    diagnosis: Diagnosis
    browser_events: List[BrowserEvent]
    metrics: List[MetricCard]
    recommended_jobs: List[RecommendedJob]
    documents: List[GeneratedDocument]
    disclaimers: List[str]
