from __future__ import annotations

import json
import os
from typing import Any, List

from openai import OpenAI

from .models import Diagnosis, GeneratedDocument, ProfileInput

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")
        _client = OpenAI(api_key=api_key)
    return _client


def generate_diagnosis(
    profile: ProfileInput,
    top_jobs: List[dict[str, Any]],
    tenure_months: int,
) -> Diagnosis:
    client = _get_client()

    top_jobs_text = "\n".join(
        f"- {j['company']} ({j['title']}): "
        f"연봉 {j.get('salary_min') or '?'}~{j.get('salary_max') or '?'}만원"
        for j in top_jobs[:3]
    ) or "공고 데이터 없음"

    prompt = f"""당신은 10년 경력의 커리어 컨설턴트입니다. 아래 직장인 프로필과 실시간 채용 시장 데이터를 분석하여 퇴사 진단을 JSON으로 작성하세요.

## 유저 프로필
- 이름: {profile.name}
- 현재 직무: {profile.current_role} → 희망 직무: {profile.desired_role}
- 현재 연봉: {profile.current_salary:,}만원 → 희망 연봉: {profile.desired_salary:,}만원
- 경력: {profile.years_experience}년 / 현 직장 근속: {tenure_months}개월
- 보유 스킬: {', '.join(profile.skills)}
- 퇴사 사유: {profile.resignation_reason}
- 희망 퇴사 시점: {profile.preferred_timing}

## 실시간 상위 추천 공고
{top_jobs_text}

## 출력 형식 (JSON)
각 필드는 2~3문장 분량으로, {profile.name}님 상황에 맞는 구체적인 조언을 작성하세요.

{{
  "timing_recommendation": "퇴사 타이밍 조언 (근속 {tenure_months}개월 기준 퇴직금·성과급 손익 포함)",
  "financial_risk": "재무 리스크 분석 (월 생활비, 공백 기간별 소득 손실 수치 포함)",
  "market_signal": "시장 신호 해석 (상위 공고 연봉 vs 현재 연봉 격차, 스킬 수요 포함)",
  "action_summary": "지금 당장 해야 할 가장 중요한 액션 3가지를 하나의 문자열로 요약 (배열 금지, 줄바꿈 구분)"
}}

중요: 모든 값은 JSON 문자열이어야 합니다. 배열([ ])은 절대 사용하지 마세요."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    data = json.loads(response.choices[0].message.content)

    # LLM이 문자열 대신 리스트를 반환하는 경우 방어 처리
    for field in ("timing_recommendation", "financial_risk", "market_signal", "action_summary"):
        if isinstance(data.get(field), list):
            data[field] = "\n".join(str(item) for item in data[field])

    return Diagnosis(**data)


def generate_documents(
    profile: ProfileInput,
    diagnosis: Diagnosis,
    top_job: dict[str, Any],
) -> List[GeneratedDocument]:
    client = _get_client()

    prompt = f"""당신은 커리어 전문 컨설턴트입니다. 아래 프로필을 바탕으로 3가지 퇴사 문서를 JSON으로 생성하세요.

## 유저 프로필
- 이름: {profile.name}
- 현재 직무: {profile.current_role} → 희망: {profile.desired_role}
- 퇴사 사유: {profile.resignation_reason}
- 희망 퇴사 시점: {profile.preferred_timing}
- 보유 스킬: {', '.join(profile.skills)}

## AI 진단 요약
- 타이밍: {diagnosis.timing_recommendation}
- 액션: {diagnosis.action_summary}

## 1순위 추천 공고
- 회사: {top_job['company']} / 포지션: {top_job['title']}

## 출력 형식 (JSON)
{{
  "report": "퇴사 리포트 마크다운 전문 (# 헤딩 사용, 현황 분석·핵심 진단·추천 액션·타임라인 섹션 포함, 600자 이상)",
  "letter": "사직서 초안 전문 (정중하고 전문적인 톤, 퇴사 사유는 '커리어 방향성' 등 완곡하게 표현, 인수인계 협조 의사 명시)",
  "checklist": "퇴사 체크리스트 마크다운 (## 섹션별 분류, 연차/퇴직금, 인수인계, 이직 준비, 개인 정리 등 최소 12개 항목)"
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.8,
    )

    data = json.loads(response.choices[0].message.content)

    # LLM이 문자열 대신 리스트를 반환하는 경우 방어 처리
    for field in ("report", "letter", "checklist"):
        if isinstance(data.get(field), list):
            data[field] = "\n".join(str(item) for item in data[field])

    return [
        GeneratedDocument(title="퇴사 리포트", doc_type="report", content=data["report"]),
        GeneratedDocument(title="사직서 초안", doc_type="letter", content=data["letter"]),
        GeneratedDocument(title="퇴사 체크리스트", doc_type="checklist", content=data["checklist"]),
    ]
