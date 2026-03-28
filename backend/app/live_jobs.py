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


def _fetch_json(url: str) -> Any:
    request = Request(url, headers=REQUEST_HEADERS)
    with urlopen(request, timeout=6) as response:
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


def _build_query_tokens(profile: ProfileInput) -> set[str]:
    role_blob = f"{profile.current_role} {profile.desired_role}".lower()
    tokens: set[str] = set()

    if "백엔드" in role_blob or "backend" in role_blob or "server" in role_blob:
        tokens.update({"backend", "server", "software engineer", "api", "java", "kotlin"})
    if "플랫폼" in role_blob or "platform" in role_blob or "infra" in role_blob:
        tokens.update({"platform", "infrastructure", "sre", "devops", "kubernetes"})
    if "리드" in role_blob or "lead" in role_blob or "senior" in role_blob:
        tokens.update({"lead", "senior", "staff", "principal"})

    tokens.update(skill.lower() for skill in profile.skills[:5])
    tokens.update(word.lower() for word in re.split(r"\s+", profile.desired_role) if word.strip())
    tokens.update(word.lower() for word in re.split(r"\s+", profile.current_role) if word.strip())
    return {token for token in tokens if len(token) >= 2}


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

        haystack = " ".join(
            [
                normalized["title"],
                normalized["company"],
                normalized["review_summary"],
                " ".join(normalized["skills"]),
            ]
        ).lower()

        if _match_strength(haystack, tokens) < 2:
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

            haystack = " ".join(
                [
                    normalized["title"],
                    normalized["company"],
                    normalized["review_summary"],
                    " ".join(normalized["skills"]),
                ]
            ).lower()

            if _match_strength(haystack, tokens) < 1:
                continue

            jobs.append(normalized)

    return jobs


def fetch_live_jobs(profile: ProfileInput) -> tuple[list[dict[str, Any]], list[str], bool]:
    tokens = _build_query_tokens(profile)
    collected: list[dict[str, Any]] = []
    sources: list[str] = []

    for label, provider in (
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
