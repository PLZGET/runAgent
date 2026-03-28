from __future__ import annotations

import json
import re
from html import unescape
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .data import MOCK_JOBS
from .models import ProfileInput


REQUEST_HEADERS = {
    "User-Agent": "TalchulMaster/0.1 (+https://localhost)",
    "Accept": "application/json, text/plain, */*",
}

# 한국어 → 영어 기술/직무 번역 테이블
KO_EN_MAP: dict[str, str] = {
    "자바": "java",
    "코틀린": "kotlin",
    "스프링": "spring",
    "파이썬": "python",
    "노드": "node",
    "노드js": "nodejs",
    "리액트": "react",
    "뷰": "vue",
    "앵귤러": "angular",
    "도커": "docker",
    "쿠버네티스": "kubernetes",
    "레디스": "redis",
    "카프카": "kafka",
    "마이에스큐엘": "mysql",
    "포스트그레스": "postgresql",
    "몽고디비": "mongodb",
    "그래프큐엘": "graphql",
    "타입스크립트": "typescript",
    "자바스크립트": "javascript",
    "고언어": "golang",
    "러스트": "rust",
    "스칼라": "scala",
    "백엔드": "backend",
    "프론트엔드": "frontend",
    "풀스택": "fullstack",
    "플랫폼": "platform",
    "인프라": "infrastructure",
    "데브옵스": "devops",
    "시니어": "senior",
    "주니어": "junior",
    "리드": "lead",
    "서버": "server",
    "엔지니어": "engineer",
    "개발자": "developer",
}


def _fetch_json(url: str) -> Any:
    request = Request(url, headers=REQUEST_HEADERS)
    with urlopen(request, timeout=8) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload)


def _clean_text(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value or "")
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _summarize(value: str, limit: int = 90) -> str:
    text = _clean_text(value)
    if len(text) <= limit:
        return text
    return f"{text[:limit - 1].rstrip()}…"


def _translate_ko(text: str) -> str:
    """한국어 단어를 영어로 변환"""
    result = text.lower()
    for ko, en in KO_EN_MAP.items():
        result = result.replace(ko, en)
    return result


def _build_query_tokens(profile: ProfileInput) -> set[str]:
    role_blob = _translate_ko(f"{profile.current_role} {profile.desired_role}")
    tokens: set[str] = set()

    if "backend" in role_blob or "server" in role_blob or "백엔드" in role_blob:
        tokens.update({"backend", "server", "software engineer", "api", "java", "kotlin", "spring"})
    if "platform" in role_blob or "infra" in role_blob or "devops" in role_blob:
        tokens.update({"platform", "infrastructure", "sre", "devops", "kubernetes", "cloud"})
    if "lead" in role_blob or "senior" in role_blob or "시니어" in role_blob:
        tokens.update({"lead", "senior", "staff", "principal"})
    if "frontend" in role_blob or "프론트" in role_blob:
        tokens.update({"frontend", "react", "typescript", "vue", "angular"})
    if "fullstack" in role_blob or "풀스택" in role_blob:
        tokens.update({"fullstack", "full-stack", "full stack"})
    if "data" in role_blob or "ml" in role_blob:
        tokens.update({"data engineer", "machine learning", "python", "spark"})

    # 스킬 한국어→영어 변환 후 추가
    for skill in profile.skills[:8]:
        translated = _translate_ko(skill)
        tokens.add(translated)
        tokens.add(skill.lower())

    # 직무명 단어 분리 후 추가 (한영 변환 포함)
    for raw in (profile.desired_role, profile.current_role):
        translated = _translate_ko(raw)
        for word in re.split(r"[\s/]+", translated):
            word = word.strip()
            if len(word) >= 2:
                tokens.add(word)

    return {token.strip() for token in tokens if len(token.strip()) >= 2}


def _match_strength(haystack: str, tokens: Iterable[str]) -> int:
    return sum(1 for token in tokens if token in haystack)


def _normalize_remoteok_job(item: dict[str, Any]) -> dict[str, Any] | None:
    title = str(item.get("position") or "").strip()
    company = str(item.get("company") or "").strip()
    url = str(item.get("url") or item.get("apply_url") or "").strip().replace("remoteOK.com", "remoteok.com")

    if not title or not company or not url:
        return None

    raw_tags = item.get("tags") or []
    skills = [str(tag).strip() for tag in raw_tags if str(tag).strip()][:6]

    return {
        "company": company,
        "title": title,
        "location": str(item.get("location") or "Remote").strip() or "Remote",
        "source": "Remote OK",
        "url": url,
        "salary_min": int(item.get("salary_min") or 0),
        "salary_max": int(item.get("salary_max") or 0),
        "rating": None,
        "review_summary": _summarize(str(item.get("description") or "")),
        "skills": skills,
    }


def _normalize_arbeitnow_job(item: dict[str, Any]) -> dict[str, Any] | None:
    title = str(item.get("title") or "").strip()
    company = str(item.get("company_name") or "").strip()
    url = str(item.get("url") or "").strip()

    if not title or not company or not url:
        return None

    raw_tags = item.get("tags") or []
    skills = [str(tag).strip() for tag in raw_tags if str(tag).strip()][:6]
    remote = bool(item.get("remote"))
    location = "Remote" if remote else str(item.get("location") or "미기재").strip()

    return {
        "company": company,
        "title": title,
        "location": location,
        "source": "Arbeitnow",
        "url": url,
        "salary_min": 0,
        "salary_max": 0,
        "rating": None,
        "review_summary": _summarize(str(item.get("description") or "")),
        "skills": skills,
    }


def _normalize_remotive_job(item: dict[str, Any]) -> dict[str, Any] | None:
    title = str(item.get("title") or "").strip()
    company = str(item.get("company_name") or "").strip()
    url = str(item.get("url") or "").strip()

    if not title or not company or not url:
        return None

    raw_tags = item.get("tags") or []
    skills = [str(tag).strip() for tag in raw_tags if str(tag).strip()][:6]

    # Remotive는 salary를 "100k-150k USD" 형식의 문자열로 제공
    salary_str = str(item.get("salary") or "")
    salary_min, salary_max = 0, 0
    nums = re.findall(r"[\d,]+", salary_str.replace(",", ""))
    if len(nums) >= 2:
        try:
            salary_min = int(nums[0])
            salary_max = int(nums[1])
        except ValueError:
            pass
    elif len(nums) == 1:
        try:
            salary_min = salary_max = int(nums[0])
        except ValueError:
            pass

    return {
        "company": company,
        "title": title,
        "location": str(item.get("candidate_required_location") or "Remote").strip() or "Remote",
        "source": "Remotive",
        "url": url,
        "salary_min": salary_min,
        "salary_max": salary_max,
        "rating": None,
        "review_summary": _summarize(str(item.get("description") or "")),
        "skills": skills,
    }


def _fetch_remoteok_jobs(profile: ProfileInput, tokens: set[str]) -> list[dict[str, Any]]:
    payload = _fetch_json("https://remoteok.com/api")
    jobs: list[dict[str, Any]] = []

    if not isinstance(payload, list):
        return jobs

    for item in payload[1:]:
        if not isinstance(item, dict):
            continue

        normalized = _normalize_remoteok_job(item)
        if normalized is None:
            continue

        haystack = " ".join([
            normalized["title"],
            normalized["company"],
            normalized["review_summary"],
            " ".join(normalized["skills"]),
        ]).lower()

        if _match_strength(haystack, tokens) < 1:
            continue

        jobs.append(normalized)

    return jobs


def _fetch_arbeitnow_jobs(profile: ProfileInput, tokens: set[str]) -> list[dict[str, Any]]:
    jobs: list[dict[str, Any]] = []

    for page in (1, 2):
        payload = _fetch_json(f"https://www.arbeitnow.com/api/job-board-api?page={page}")
        data = payload.get("data") if isinstance(payload, dict) else None

        if not isinstance(data, list):
            continue

        for item in data:
            if not isinstance(item, dict):
                continue

            normalized = _normalize_arbeitnow_job(item)
            if normalized is None:
                continue

            haystack = " ".join([
                normalized["title"],
                normalized["company"],
                normalized["review_summary"],
                " ".join(normalized["skills"]),
            ]).lower()

            if _match_strength(haystack, tokens) < 1:
                continue

            jobs.append(normalized)

    return jobs


def _fetch_remotive_jobs(profile: ProfileInput, tokens: set[str]) -> list[dict[str, Any]]:
    """Remotive 무료 API — 카테고리별 리모트 공고 제공"""
    jobs: list[dict[str, Any]] = []

    categories = ["software-dev", "devops-sysadmin", "data"]
    for category in categories:
        try:
            payload = _fetch_json(f"https://remotive.com/api/remote-jobs?category={category}&limit=100")
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            continue

        raw_jobs = payload.get("jobs") if isinstance(payload, dict) else None
        if not isinstance(raw_jobs, list):
            continue

        for item in raw_jobs:
            if not isinstance(item, dict):
                continue

            normalized = _normalize_remotive_job(item)
            if normalized is None:
                continue

            haystack = " ".join([
                normalized["title"],
                normalized["company"],
                normalized["review_summary"],
                " ".join(normalized["skills"]),
            ]).lower()

            if _match_strength(haystack, tokens) < 1:
                continue

            jobs.append(normalized)

    return jobs


def fetch_live_jobs(profile: ProfileInput) -> tuple[list[dict[str, Any]], list[str], bool]:
    tokens = _build_query_tokens(profile)
    collected: list[dict[str, Any]] = []
    sources: list[str] = []

    for label, provider in (
        ("Remotive", _fetch_remotive_jobs),
        ("Remote OK", _fetch_remoteok_jobs),
        ("Arbeitnow", _fetch_arbeitnow_jobs),
    ):
        try:
            jobs = provider(profile, tokens)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            jobs = []

        if jobs:
            collected.extend(jobs)
            sources.append(label)

    if not collected:
        return [dict(item) for item in MOCK_JOBS], ["fallback"], False

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()

    for item in collected:
        key = f"{item['company']}::{item['title']}::{item['url']}".lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped, sources, True
