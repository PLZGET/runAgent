from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime
from statistics import mean
from typing import Any, Iterable, List

from .agent import generate_diagnosis, generate_documents
from .live_jobs import fetch_live_jobs
from .models import (
    AnalysisResponse,
    BrowserEvent,
    Diagnosis,
    GeneratedDocument,
    MetricCard,
    ProfileInput,
    RecommendedJob,
)


@dataclass
class ScoredJob:
    job: dict[str, Any]
    score: int
    salary_gap_percent: int
    reasons: List[str]


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _months_between(start: date, end: date) -> int:
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(months, 0)


def _normalize_tokens(values: Iterable[str]) -> set[str]:
    return {value.strip().lower() for value in values if value.strip()}


def _effective_average_salary(job: dict[str, Any], fallback: int) -> int:
    salary_min = int(job.get("salary_min") or 0)
    salary_max = int(job.get("salary_max") or 0)

    if salary_min > 0 and salary_max > 0:
        return int((salary_min + salary_max) / 2)
    if salary_max > 0:
        return salary_max
    if salary_min > 0:
        return salary_min
    return fallback


def _calc_tenure_months(profile: ProfileInput) -> int:
    start_date = _parse_date(profile.start_date)
    return _months_between(start_date, date.today())


def _score_jobs(profile: ProfileInput, jobs: List[dict[str, Any]]) -> List[ScoredJob]:
    desired_role = profile.desired_role.lower()
    current_role = profile.current_role.lower()
    user_skills = _normalize_tokens(profile.skills)
    scored: List[ScoredJob] = []

    for job in jobs:
        role_score = 0
        title_lc = str(job.get("title") or "").lower()
        source_lc = str(job.get("source") or "").lower()

        if desired_role.split()[0] in title_lc or "백엔드" in title_lc or "backend" in title_lc:
            role_score += 32
        if current_role.split()[0] in title_lc:
            role_score += 8
        if "platform" in title_lc or "플랫폼" in title_lc:
            role_score += 6

        job_skills = _normalize_tokens(job.get("skills") or [])
        overlap = sorted(user_skills.intersection(job_skills))
        skill_score = min(len(overlap) * 10, 40)

        avg_salary = _effective_average_salary(job, profile.current_salary)
        has_salary = int(job.get("salary_min") or 0) > 0 or int(job.get("salary_max") or 0) > 0
        if has_salary and avg_salary >= profile.desired_salary:
            salary_score = 20
        elif has_salary and avg_salary >= profile.current_salary:
            salary_score = 14
        elif has_salary:
            salary_score = 7
        else:
            salary_score = 10

        rating = job.get("rating")
        culture_score = min(int((rating if rating is not None else 3.8) * 4), 18)
        source_score = 4 if "remote ok" in source_lc or "arbeitnow" in source_lc else 0
        total_score = min(role_score + skill_score + salary_score + culture_score + source_score, 100)
        salary_gap_percent = (
            round(((avg_salary - profile.current_salary) / max(profile.current_salary, 1)) * 100)
            if has_salary
            else 0
        )

        reasons = []
        if overlap:
            reasons.append(f"보유 스킬 {', '.join(skill.upper() for skill in overlap[:3])} 매칭")
        if has_salary and avg_salary >= profile.desired_salary:
            reasons.append("희망 연봉 상단과 근접하거나 상회")
        elif has_salary and avg_salary >= profile.current_salary:
            reasons.append("현재 연봉 대비 상승 여지 존재")
        else:
            reasons.append("실시간 공고로 최신 채용 상태를 확인 가능")
        if rating is not None and rating >= 4.2:
            reasons.append("조직 평판 점수가 높음")
        if "시니어" in title_lc or "platform" in title_lc or "lead" in title_lc:
            reasons.append("다음 단계 역할로 확장 가능한 포지션")

        scored.append(
            ScoredJob(
                job=job,
                score=total_score,
                salary_gap_percent=salary_gap_percent,
                reasons=reasons[:3] or ["직무 적합도가 무난하고 최근에 열린 공고입니다."],
            )
        )

    scored.sort(
        key=lambda item: (
            item.score,
            item.salary_gap_percent,
            item.job.get("rating") or 0,
        ),
        reverse=True,
    )
    return scored


def _build_browser_events(
    profile: ProfileInput,
    total_jobs: int,
    top_jobs: List[ScoredJob],
    sources: List[str],
    live_mode: bool,
) -> List[BrowserEvent]:
    primary_keywords = ", ".join(profile.skills[:3])
    preview_companies = [job.job["company"] for job in top_jobs[:3]]
    source_label = " + ".join(sources) if live_mode else "fallback dataset"

    return [
        BrowserEvent(
            phase="intake",
            site="인터뷰 엔진",
            title="프로필 구조화 완료",
            detail=f"{profile.current_role}에서 {profile.desired_role}로 이동하는 시나리오를 정리했습니다.",
            elapsed_ms=800,
            preview_lines=[
                f"name={profile.name}",
                f"role={profile.current_role} -> {profile.desired_role}",
                f"salary={profile.current_salary} -> {profile.desired_salary}",
                f"skills={primary_keywords}",
            ],
        ),
        BrowserEvent(
            phase="market",
            site=source_label,
            title="실시간 채용 피드 접속",
            detail=f"{source_label}에서 '{profile.desired_role}' 조건과 유사한 공고를 수집했습니다.",
            elapsed_ms=1400,
            preview_lines=[
                f"sources={source_label}",
                f"search='{profile.desired_role}'",
                f"filters=experience:{profile.years_experience}y, keywords:{primary_keywords}",
            ],
        ),
        BrowserEvent(
            phase="market",
            site=source_label,
            title="공고 리스트 수집",
            detail=f"실시간 기준 {total_jobs}개 공고를 정규화 대상으로 확보했습니다.",
            elapsed_ms=2200,
            preview_lines=[
                "fetch -> normalize title/company/location/url",
                "description -> summary",
                f"jobs_found={total_jobs}",
            ],
        ),
        BrowserEvent(
            phase="ranking",
            site="매칭 엔진",
            title="매칭 점수 계산",
            detail="스킬 겹침, 연봉 간극, 역할 적합도 기준으로 점수를 계산했습니다.",
            elapsed_ms=3000,
            preview_lines=[
                "score = role_fit + skill_overlap + salary_fit + freshness",
                f"top_companies={', '.join(preview_companies)}",
                "dedupe -> rank -> top5",
            ],
        ),
        BrowserEvent(
            phase="report",
            site="리포트 패키저",
            title="결과 패키지 생성",
            detail="실시간 공고 링크와 퇴사 문서를 포함한 결과 패키지를 생성했습니다.",
            elapsed_ms=3800,
            preview_lines=[
                "report.md generated",
                "job_links attached",
                "documents.bundle ready",
            ],
        ),
    ]


def _build_metrics(profile: ProfileInput, matched_jobs: List[ScoredJob], live_mode: bool, sources: List[str]) -> List[MetricCard]:
    top_five = matched_jobs[:5]
    avg_match = round(mean([job.score for job in top_five]))
    avg_salary = int(mean([_effective_average_salary(job.job, profile.current_salary) for job in top_five]))
    upside = round(((avg_salary - profile.current_salary) / max(profile.current_salary, 1)) * 100)
    source_value = " + ".join(sources) if live_mode else "Fallback"

    return [
        MetricCard(
            label="탐색 공고",
            value=f"{len(matched_jobs)}개",
            detail="실시간으로 수집한 공고를 정규화한 뒤 중복을 제거한 기준",
        ),
        MetricCard(
            label="예상 연봉 상승",
            value=f"{upside:+d}%",
            detail=f"상위 5개 공고 평균 보상을 현재 연봉 {profile.current_salary:,}만원과 비교",
        ),
        MetricCard(
            label="평균 매칭 점수",
            value=f"{avg_match}점",
            detail="직무 적합도, 스킬 겹침, 연봉 적합도 기반",
        ),
        MetricCard(
            label="데이터 소스",
            value=source_value,
            detail="실시간 공고를 가져온 채용 피드",
        ),
    ]




def run_analysis(profile: ProfileInput) -> AnalysisResponse:
    jobs, sources, live_mode = fetch_live_jobs(profile)
    matched_jobs = _score_jobs(profile, jobs)
    tenure_months = _calc_tenure_months(profile)
    diagnosis = generate_diagnosis(profile, [j.job for j in matched_jobs[:3]], tenure_months)
    metrics = _build_metrics(profile, matched_jobs, live_mode, sources)
    browser_events = _build_browser_events(profile, len(matched_jobs), matched_jobs, sources, live_mode)
    documents = generate_documents(profile, diagnosis, matched_jobs[0].job)

    recommended_jobs = [
        RecommendedJob(
            company=item.job["company"],
            title=item.job["title"],
            location=item.job["location"],
            source=item.job["source"],
            url=item.job["url"],
            salary_min=int(item.job.get("salary_min") or 0),
            salary_max=int(item.job.get("salary_max") or 0),
            rating=item.job.get("rating"),
            review_summary=item.job["review_summary"],
            skills=item.job.get("skills") or [],
            match_score=item.score,
            salary_gap_percent=item.salary_gap_percent,
            reasons=item.reasons,
        )
        for item in matched_jobs[:5]
    ]

    profile_summary = (
        f"{profile.name}님은 {profile.years_experience}년차 {profile.current_role}이며, "
        f"현재 연봉 {profile.current_salary:,}만원에서 {profile.desired_role}로의 이동을 목표로 하고 있습니다."
    )

    disclaimers = [
        "본 결과는 데모용 추정치이며 법률·노무 자문을 대체하지 않습니다.",
        "채용 공고는 공개 JSON 피드에서 실시간 수집하며, 네트워크 실패 시에만 fallback 데이터를 사용합니다.",
        "실제 지원 전에는 보상 구조, 복지, 퇴직금 산정 기준을 별도 확인해야 합니다.",
    ]

    return AnalysisResponse(
        profile_summary=profile_summary,
        diagnosis=diagnosis,
        browser_events=browser_events,
        metrics=metrics,
        recommended_jobs=recommended_jobs,
        documents=documents,
        disclaimers=disclaimers,
    )
