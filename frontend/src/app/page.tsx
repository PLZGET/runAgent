"use client";

import { type CSSProperties, FormEvent, startTransition, useEffect, useRef, useState } from "react";

type BrowserEvent = {
  phase: string;
  site: string;
  title: string;
  detail: string;
  elapsed_ms: number;
  preview_lines: string[];
};

type Diagnosis = {
  timing_recommendation: string;
  financial_risk: string;
  market_signal: string;
  action_summary: string;
};

type MetricCard = {
  label: string;
  value: string;
  detail: string;
};

type RecommendedJob = {
  company: string;
  title: string;
  location: string;
  source: string;
  url: string;
  salary_min: number;
  salary_max: number;
  rating: number | null;
  review_summary: string;
  skills: string[];
  match_score: number;
  salary_gap_percent: number;
  reasons: string[];
};

type GeneratedDocument = {
  title: string;
  doc_type: string;
  content: string;
};

type AnalysisResponse = {
  profile_summary: string;
  diagnosis: Diagnosis;
  browser_events: BrowserEvent[];
  metrics: MetricCard[];
  recommended_jobs: RecommendedJob[];
  documents: GeneratedDocument[];
  disclaimers: string[];
};

type ProfileDraft = {
  name: string;
  start_date: string;
  current_salary: number;
  desired_salary: number;
  years_experience: number;
  current_role: string;
  desired_role: string;
  skills: string[];
  resignation_reason: string;
  preferred_timing: string;
};

type ConversationMessage = {
  id: number;
  role: "agent" | "user" | "system";
  title?: string;
  content: string;
};

type IntakeStepKey =
  | "persona"
  | "currentSalary"
  | "reason"
  | "desiredRole"
  | "desiredSalary"
  | "skills"
  | "timing"
  | "confirm";

type QuickOption = {
  icon?: string;
  label: string;
  description: string;
  value: string;
  fill?: Partial<ProfileDraft>;
  tags?: string[];
};

type IntakeStep = {
  key: IntakeStepKey;
  badge: string;
  title: string;
  placeholder: string;
  options: QuickOption[];
};

type AgentPrepItem = {
  label: string;
  detail: string;
  console: string[];
};

type AgentMode = "briefing" | "launching" | "running" | "replaying" | "ready";

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildStartDateFromYears(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - Math.max(years, 1));
  date.setDate(Math.max(1, date.getDate() - 3));

  return formatDateInput(date);
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}만원`;
}

function formatSalaryRange(min: number, max: number) {
  if (min > 0 && max > 0) {
    return `${formatCurrency(min)} ~ ${formatCurrency(max)}`;
  }

  if (max > 0) {
    return `${formatCurrency(max)} 이하`;
  }

  if (min > 0) {
    return `${formatCurrency(min)} 이상`;
  }

  return "연봉 미공개";
}

function delay(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function parseNumberAnswer(text: string) {
  const sanitized = text.replace(/,/g, "");
  const directMatch = sanitized.match(/(\d{3,5})/);

  if (directMatch) {
    return Number(directMatch[1]);
  }

  return undefined;
}

function parseRoleAnswer(text: string) {
  const normalized = text.toLowerCase();

  if (normalized.includes("platform") || text.includes("플랫폼")) {
    return "플랫폼 엔지니어";
  }

  if (normalized.includes("frontend") || text.includes("프론트")) {
    return "프론트엔드 개발자";
  }

  if (normalized.includes("fullstack") || text.includes("풀스택")) {
    return "풀스택 개발자";
  }

  if (normalized.includes("backend") || text.includes("백엔드") || text.includes("서버")) {
    return "백엔드 개발자";
  }

  if (text.trim()) {
    return text.trim();
  }

  return "";
}

function parseSkillsAnswer(text: string) {
  return text
    .split(/[,/|·\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function applyProfilePatch(base: ProfileDraft, patch: Partial<ProfileDraft>) {
  const merged: ProfileDraft = {
    ...base,
    ...patch,
    skills: patch.skills ? [...patch.skills] : [...base.skills],
  };

  if (patch.years_experience !== undefined && patch.start_date === undefined) {
    merged.start_date = buildStartDateFromYears(patch.years_experience);
  }

  return merged;
}

function buildMockResponse(profile: ProfileDraft): AnalysisResponse {
  const salaryGap = Math.round(((profile.desired_salary - profile.current_salary) / profile.current_salary) * 100);
  const topSkill = profile.skills[0] ?? "Java";
  const secondSkill = profile.skills[1] ?? "Spring Boot";

  return {
    profile_summary: `${profile.years_experience}년차 ${profile.current_role}로 현재 ${profile.current_salary.toLocaleString("ko-KR")}만원을 받고 있으며, ${profile.resignation_reason} 이유로 이직을 고민 중입니다. ${profile.desired_role} 포지션으로 ${profile.desired_salary.toLocaleString("ko-KR")}만원 이상을 목표로 하고 있습니다. (데모 목업 데이터)`,
    diagnosis: {
      timing_recommendation: `현재 ${profile.preferred_timing} 기준으로 움직이는 것이 유리합니다. IT 시장 채용 수요가 회복세이며, ${topSkill} 포지션 수요가 꾸준히 증가하고 있습니다.`,
      financial_risk: `현재 연봉 ${profile.current_salary.toLocaleString("ko-KR")}만원 기준으로 3~6개월 생활비 준비가 권장됩니다. 목표 연봉 달성 시 연간 ${(profile.desired_salary - profile.current_salary).toLocaleString("ko-KR")}만원 추가 수입이 예상됩니다.`,
      market_signal: `${profile.desired_role} 포지션 채용 공고가 전분기 대비 18% 증가했습니다. ${topSkill}/${secondSkill} 스택 수요가 특히 강세입니다.`,
      action_summary: `포트폴리오 정리 후 ${profile.preferred_timing} 내 상위 3개 공고에 지원하는 것을 권장합니다. 희망 연봉 ${salaryGap}% 상향은 현실적인 목표입니다.`,
    },
    browser_events: [
      { phase: "intake", site: "내부", title: "프로필 분석 완료", detail: "연차, 스킬, 연봉 데이터를 구조화했습니다.", elapsed_ms: 320, preview_lines: ["profile.lock = true", `role = ${profile.current_role}`, `salary = ${profile.current_salary}`] },
      { phase: "market", site: "wanted.co.kr", title: "원티드 공고 수집", detail: `${profile.desired_role} 포지션 공고 42개를 수집했습니다.`, elapsed_ms: 1240, preview_lines: ["site = wanted.co.kr", "jobs.found = 42", "filter.apply -> role, salary"] },
      { phase: "market", site: "jumpit.com", title: "점핏 공고 수집", detail: `${topSkill} 관련 공고 28개를 추가로 수집했습니다.`, elapsed_ms: 980, preview_lines: ["site = jumpit.com", "jobs.found = 28", `skill_filter = ${topSkill}`] },
      { phase: "ranking", site: "내부", title: "매칭 점수 계산", detail: "스킬, 연봉, 위치 기반 매칭 점수를 계산했습니다.", elapsed_ms: 560, preview_lines: ["match.algo = skill+salary+location", "dedupe.hash -> enabled", "top_picks = 3"] },
      { phase: "report", site: "내부", title: "리포트 생성 완료", detail: "추천 공고 3개와 문서 패키지를 조립했습니다.", elapsed_ms: 410, preview_lines: ["report.compose = done", "documents.bundle = 3", "delivery.channel = dashboard"] },
    ],
    metrics: [
      { label: "탐색 공고", value: "70개", detail: "원티드, 점핏, 로켓펀치 등 주요 채용 플랫폼 기준" },
      { label: "예상 연봉 상승", value: `+${salaryGap}%`, detail: `현재 ${profile.current_salary.toLocaleString("ko-KR")}만원 → 목표 ${profile.desired_salary.toLocaleString("ko-KR")}만원` },
      { label: "매칭 공고", value: "3개", detail: "스킬과 연봉 조건을 동시에 충족하는 최상위 공고" },
      { label: "이직 타이밍", value: "적합", detail: `${profile.preferred_timing} 기준 시장 수요와 맞닿아 있음` },
    ],
    recommended_jobs: [
      {
        company: "카카오페이",
        title: `${profile.desired_role}`,
        location: "서울 성동구",
        source: "wanted.co.kr",
        url: "https://www.wanted.co.kr",
        salary_min: profile.desired_salary,
        salary_max: Math.round(profile.desired_salary * 1.15),
        rating: 4.1,
        review_summary: "복지가 좋고 기술 스택이 최신입니다. 코드 리뷰 문화가 잘 정착되어 있습니다.",
        skills: profile.skills.slice(0, 4),
        match_score: 92,
        salary_gap_percent: salaryGap + 5,
        reasons: [`현재 ${topSkill}/${secondSkill} 스택과 완벽 매칭`, `목표 연봉 ${profile.desired_salary.toLocaleString("ko-KR")}만원 충족`, "성장 환경과 코드 리뷰 문화 우수"],
      },
      {
        company: "토스",
        title: `${profile.desired_role}`,
        location: "서울 강남구",
        source: "toss.im",
        url: "https://toss.im/career",
        salary_min: Math.round(profile.desired_salary * 0.95),
        salary_max: Math.round(profile.desired_salary * 1.2),
        rating: 4.3,
        review_summary: "빠른 성장 환경과 높은 엔지니어링 기준. 자율과 책임 문화가 강합니다.",
        skills: profile.skills.slice(0, 3),
        match_score: 87,
        salary_gap_percent: salaryGap + 8,
        reasons: [`${profile.desired_role} 직책 명확`, "빠른 성장 환경", "높은 엔지니어링 기준"],
      },
      {
        company: "당근마켓",
        title: `백엔드 엔지니어`,
        location: "서울 서초구",
        source: "jumpit.com",
        url: "https://www.jumpit.co.kr",
        salary_min: Math.round(profile.desired_salary * 0.9),
        salary_max: profile.desired_salary,
        rating: 4.0,
        review_summary: "수평적인 조직 문화와 자율성이 높습니다. 트래픽 규모가 크고 기술적 도전이 많습니다.",
        skills: profile.skills.slice(0, 5),
        match_score: 81,
        salary_gap_percent: salaryGap - 2,
        reasons: ["대규모 트래픽 경험 가능", "수평적 조직 문화", `${topSkill} 기술 스택 활용`],
      },
    ],
    documents: [
      {
        title: "이직 준비 체크리스트",
        doc_type: "checklist",
        content: `=== 이직 준비 체크리스트 (${profile.current_role} → ${profile.desired_role}) ===\n\n[ ] 포트폴리오 GitHub 정리\n    - 주요 프로젝트 README 업데이트\n    - ${topSkill}/${secondSkill} 활용 코드 예시 정리\n\n[ ] 이력서 업데이트\n    - 현재 ${profile.years_experience}년간의 핵심 성과 수치화\n    - ${profile.skills.join(", ")} 스킬 섹션 업데이트\n\n[ ] 공고 지원 준비\n    - 위 3개 추천 공고 세부 JD 분석\n    - 지원서 맞춤화 (각 회사별 강조점 다르게)\n\n[ ] 면접 준비\n    - ${topSkill} 심화 기술 면접 예상 질문 50개\n    - 퇴사 이유 답변 정리: "${profile.resignation_reason}"\n\n[ ] 연봉 협상 준비\n    - 현재 ${profile.current_salary.toLocaleString("ko-KR")}만원 기준 협상 포인트 정리\n    - 목표: ${profile.desired_salary.toLocaleString("ko-KR")}만원 (${salaryGap}% 상향)`,
      },
      {
        title: "자기소개서 초안",
        doc_type: "cover_letter",
        content: `=== 자기소개서 초안 ===\n\n저는 ${profile.years_experience}년간 ${profile.current_role}로 근무하며 ${profile.skills.slice(0, 3).join(", ")} 기술을 활용한 서비스 개발 경험을 쌓았습니다.\n\n[성장 배경]\n현재 포지션에서 ${profile.resignation_reason}을 경험하며, 더 큰 기술적 도전과 성장 기회를 모색하게 되었습니다. ${profile.desired_role}로서 대규모 시스템 설계와 팀 기술 방향 수립에 기여하고자 합니다.\n\n[핵심 역량]\n- ${profile.skills[0] ?? "주요 스킬"}: 실무 ${profile.years_experience}년 이상 활용\n- ${profile.skills[1] ?? "보조 스킬"}: 프로덕션 환경 적용 경험\n- 코드 리뷰 및 팀 협업 문화 기여\n\n[지원 동기]\n귀사의 기술 스택과 제 역량이 높은 시너지를 낼 수 있다고 판단하여 지원합니다.\n목표 보상: ${profile.desired_salary.toLocaleString("ko-KR")}만원\n\n※ 이 문서는 AI 목업 데이터 기반 초안입니다. 실제 경험에 맞게 수정하세요.`,
      },
      {
        title: "연봉 협상 스크립트",
        doc_type: "negotiation",
        content: `=== 연봉 협상 스크립트 ===\n\n현재 연봉: ${profile.current_salary.toLocaleString("ko-KR")}만원\n목표 연봉: ${profile.desired_salary.toLocaleString("ko-KR")}만원 (${salaryGap}% 상향)\n\n[오퍼 수령 후 협상 시]\n"감사합니다. 제 ${profile.years_experience}년간의 ${topSkill}/${secondSkill} 경험과 현재 시장 벤치마크를 고려했을 때, ${profile.desired_salary.toLocaleString("ko-KR")}만원으로 조정 가능한지 여쭤보고 싶습니다."\n\n[카운터 오퍼 시]\n"현재 받은 오퍼를 존중하지만, 제 기여 가치를 고려해 중간점인 ${Math.round((profile.current_salary + profile.desired_salary) / 2).toLocaleString("ko-KR")}만원은 가능한지 확인 부탁드립니다."\n\n[거절당할 경우]\n"연봉 조정이 어렵다면, 6개월 후 재검토 조건이나 성과 보너스 구조를 논의할 수 있을까요?"\n\n※ 협상은 서면(이메일)으로 진행하면 기록이 남아 유리합니다.`,
      },
    ],
    disclaimers: [
      "⚠️ 이 결과는 API 연결 실패로 인한 데모 목업 데이터입니다. 실제 서비스 결과와 다를 수 있습니다.",
      "추천 공고 URL은 실제 공고가 아닌 예시입니다. 실제 지원 전 해당 채용 플랫폼에서 직접 확인하세요.",
      "연봉 및 시장 데이터는 가상의 추정치입니다. 실제 채용 공고 및 면접 과정에서 확인하시기 바랍니다.",
    ],
  };
}

const INITIAL_PROFILE: ProfileDraft = {
  name: "방문자",
  start_date: buildStartDateFromYears(3),
  current_salary: 5400,
  desired_salary: 6500,
  years_experience: 3,
  current_role: "백엔드 개발자",
  desired_role: "시니어 백엔드 개발자",
  skills: ["Java", "Spring Boot", "JPA", "Redis", "AWS"],
  resignation_reason: "성장 정체와 잦은 야근",
  preferred_timing: "2개월 내",
};

const PERSONA_OPTIONS: QuickOption[] = [
  {
    icon: "🧱",
    label: "3년차 백엔드",
    description: "5400만원 · Spring/Redis · 성장 정체",
    value: "3년차 백엔드 개발자에 가깝습니다.",
    tags: ["가장 무난", "MVP"],
    fill: {
      years_experience: 3,
      current_role: "백엔드 개발자",
      current_salary: 5400,
      desired_role: "시니어 백엔드 개발자",
      desired_salary: 6500,
      skills: ["Java", "Spring Boot", "JPA", "Redis", "AWS"],
      resignation_reason: "성장 정체와 잦은 야근",
      preferred_timing: "2개월 내",
    },
  },
  {
    icon: "🛰️",
    label: "5년차 플랫폼",
    description: "7000만원 · Kotlin/Kafka · 더 큰 트래픽",
    value: "5년차 플랫폼 엔지니어 시나리오로 갈게요.",
    tags: ["상향 이직", "고연차"],
    fill: {
      years_experience: 5,
      current_role: "플랫폼 엔지니어",
      current_salary: 7000,
      desired_role: "시니어 플랫폼 엔지니어",
      desired_salary: 8200,
      skills: ["Kotlin", "Spring Boot", "Kafka", "Kubernetes", "AWS"],
      resignation_reason: "더 큰 트래픽과 아키텍처 경험이 필요함",
      preferred_timing: "오퍼 받고 이동",
    },
  },
  {
    icon: "🌱",
    label: "2년차 서버 주니어",
    description: "4200만원 · Java/JPA · 야근과 낮은 보상",
    value: "2년차 서버 주니어 기준으로 정리해 주세요.",
    tags: ["주니어", "보상 개선"],
    fill: {
      years_experience: 2,
      current_role: "백엔드 개발자",
      current_salary: 4200,
      desired_role: "백엔드 개발자",
      desired_salary: 5200,
      skills: ["Java", "Spring Boot", "JPA", "MySQL", "Docker"],
      resignation_reason: "야근이 많고 보상 체감이 낮음",
      preferred_timing: "1개월 내",
    },
  },
];

const INTAKE_STEPS: IntakeStep[] = [
  {
    key: "persona",
    badge: "현재 포지션",
    title: "지금 상태를 먼저 잡겠습니다.",
    placeholder: "예: 3년차 백엔드 개발자",
    options: PERSONA_OPTIONS,
  },
  {
    key: "currentSalary",
    badge: "현재 연봉",
    title: "현재 보상 수준을 알려주세요.",
    placeholder: "예: 5400",
    options: [
      { icon: "🌱", label: "4200만원", description: "주니어~초중급 구간", value: "4200만원", fill: { current_salary: 4200 } },
      { icon: "💼", label: "5400만원", description: "3년차 전후 대표 구간", value: "5400만원", fill: { current_salary: 5400 } },
      { icon: "💸", label: "7000만원", description: "상위 중급~시니어 구간", value: "7000만원", fill: { current_salary: 7000 } },
      { icon: "🏷️", label: "8500만원+", description: "상위 밴드 협상 구간", value: "8500만원", fill: { current_salary: 8500 } },
    ],
  },
  {
    key: "reason",
    badge: "퇴사 이유",
    title: "가장 큰 퇴사 이유 하나만 고르면 됩니다.",
    placeholder: "예: 성장 정체와 조직 피로감",
    options: [
      { icon: "😮‍💨", label: "야근 / 번아웃", description: "지속 가능한 리듬이 깨짐", value: "잦은 야근과 번아웃이 누적됨" },
      { icon: "💰", label: "연봉 불만족", description: "역할 대비 보상이 낮게 느껴짐", value: "역할 대비 보상 상승 여지가 낮음" },
      { icon: "📉", label: "성장 기회 없음", description: "기술 난도와 배움이 멈춤", value: "성장 정체와 더 큰 문제를 풀고 싶음" },
      { icon: "🤯", label: "상사 / 동료 갈등", description: "협업 리듬과 관계 스트레스가 큼", value: "협업 관계와 조직 분위기로 인한 피로가 큼" },
      { icon: "💔", label: "회사 비전 없음", description: "사업 방향과 목표에 공감이 약함", value: "회사 방향성과 커리어 목표가 맞지 않음" },
      { icon: "🔥", label: "더 좋은 곳 발견", description: "확실히 더 나은 기회가 보임", value: "시장에 더 적합한 기회가 보여서 이동을 고민함" },
    ],
  },
  {
    key: "desiredRole",
    badge: "타깃 역할",
    title: "다음 이직에서 노릴 포지션을 정하죠.",
    placeholder: "예: 시니어 백엔드 개발자",
    options: [
      {
        icon: "🧱",
        label: "시니어 백엔드",
        description: "서비스 난도와 책임 범위를 키움",
        value: "시니어 백엔드 개발자",
        fill: { desired_role: "시니어 백엔드 개발자" },
      },
      {
        icon: "🛰️",
        label: "플랫폼/인프라",
        description: "트래픽과 시스템 안정성 중심",
        value: "플랫폼 엔지니어",
        fill: { desired_role: "플랫폼 엔지니어" },
      },
      {
        icon: "🧭",
        label: "백엔드 리드",
        description: "설계와 주도권을 가져가는 역할",
        value: "백엔드 테크 리드",
        fill: { desired_role: "백엔드 테크 리드" },
      },
    ],
  },
  {
    key: "desiredSalary",
    badge: "희망 연봉",
    title: "목표 보상 상한을 잡아보겠습니다.",
    placeholder: "예: 6500",
    options: [
      { icon: "📈", label: "6000만원", description: "안정적 상향 이직", value: "6000만원", fill: { desired_salary: 6000 } },
      { icon: "🎯", label: "7000만원", description: "확실한 점프업 목표", value: "7000만원", fill: { desired_salary: 7000 } },
      { icon: "🚀", label: "8200만원", description: "상위 밴드 도전", value: "8200만원", fill: { desired_salary: 8200 } },
      { icon: "🏁", label: "9000만원+", description: "강한 협상 목표", value: "9000만원", fill: { desired_salary: 9000 } },
    ],
  },
  {
    key: "skills",
    badge: "핵심 스킬",
    title: "매칭 점수에 쓸 핵심 스택을 3~5개만 주세요.",
    placeholder: "예: Java, Spring Boot, Redis, AWS",
    options: [
      {
        icon: "☕",
        label: "Java/Spring",
        description: "Java, Spring Boot, JPA, Redis, AWS",
        value: "Java, Spring Boot, JPA, Redis, AWS",
        fill: { skills: ["Java", "Spring Boot", "JPA", "Redis", "AWS"] },
      },
      {
        icon: "⚙️",
        label: "Kotlin/Platform",
        description: "Kotlin, Spring Boot, Kafka, Kubernetes, AWS",
        value: "Kotlin, Spring Boot, Kafka, Kubernetes, AWS",
        fill: { skills: ["Kotlin", "Spring Boot", "Kafka", "Kubernetes", "AWS"] },
      },
      {
        icon: "🌐",
        label: "Node/Nest",
        description: "Node.js, TypeScript, NestJS, PostgreSQL, Docker",
        value: "Node.js, TypeScript, NestJS, PostgreSQL, Docker",
        fill: { skills: ["Node.js", "TypeScript", "NestJS", "PostgreSQL", "Docker"] },
      },
    ],
  },
  {
    key: "timing",
    badge: "이동 시점",
    title: "언제 움직이고 싶은지 정해보죠.",
    placeholder: "예: 오퍼 받고 이동",
    options: [
      { icon: "⚡", label: "즉시", description: "바로 움직이고 싶음", value: "즉시" },
      { icon: "🗓️", label: "1개월 내", description: "빠르게 시장 테스트", value: "1개월 내" },
      { icon: "🧳", label: "2~3개월 내", description: "준비 후 점프", value: "2~3개월 내" },
      { icon: "🛡️", label: "오퍼 받고 이동", description: "리스크 최소화", value: "오퍼 받고 이동" },
    ],
  },
  {
    key: "confirm",
    badge: "작전 승인",
    title: "이제 에이전트를 출격시킬 수 있습니다.",
    placeholder: "",
    options: [],
  },
];

const AGENT_PREP_STEPS: AgentPrepItem[] = [
  {
    label: "프로필 구조화",
    detail: "대화에서 연차, 현재 연봉, 목표 역할, 리스크 포인트를 JSON 스냅샷으로 잠그는 중",
    console: [
      "draft.lock.profile = true",
      "resignation_risk_matrix -> seeded",
      "salary_delta_target -> computed",
    ],
  },
  {
    label: "브라우저 세션 부팅",
    detail: "채용 사이트 탐색에 쓸 질의와 필터를 준비하고 브라우저 작업 큐를 여는 중",
    console: [
      "browser.session -> warming",
      "query.role -> normalized",
      "search.intent -> market_scan",
    ],
  },
  {
    label: "시장 탐색 큐 정리",
    detail: "공고 수집, 중복 제거, 보상 범위 정규화 로직을 순서대로 실행하는 중",
    console: [
      "jobs.collect -> queued",
      "dedupe.hash -> enabled",
      "salary_band -> normalized",
    ],
  },
  {
    label: "리포트 패키지 생성",
    detail: "추천 공고와 퇴사 문서를 한 번에 보여줄 결과 패키지를 조립하는 중",
    console: [
      "report.compose -> started",
      "documents.bundle -> assembling",
      "delivery.channel -> dashboard",
    ],
  },
];

function buildPrompt(step: IntakeStep, draft: ProfileDraft) {
  switch (step.key) {
    case "persona":
      return "당신 상황에 가까운 예시 카드를 누르거나, 직접 '3년차 백엔드 개발자'처럼 적어 주세요.";
    case "currentSalary":
      return `${draft.current_role} 기준 현재 연봉이 어느 정도인지 알려주세요. 숫자만 보내도 됩니다.`;
    case "reason":
      return "좋습니다. 이제 왜 퇴사를 고민하는지 가장 큰 이유 하나만 먼저 잡겠습니다.";
    case "desiredRole":
      return "다음 이직에서 어떤 역할로 이동하고 싶은지 정하죠.";
    case "desiredSalary":
      return `${draft.desired_role || "다음 역할"} 기준 목표 연봉 상한을 잡아보겠습니다.`;
    case "skills":
      return "매칭 점수에 직접 쓰일 핵심 스킬만 추려주세요. 콤마로 적으면 바로 인식합니다.";
    case "timing":
      return "언제 움직일지에 따라 전략이 달라집니다. 희망 시점을 알려주세요.";
    case "confirm":
      return `${draft.current_role} -> ${draft.desired_role}, 현재 ${formatCurrency(
        draft.current_salary
      )}, 목표 ${formatCurrency(draft.desired_salary)} 기준으로 준비됐습니다. 이 조건으로 바로 에이전트를 출격할까요?`;
    default:
      return "";
  }
}

function buildInitialMessages(profile: ProfileDraft): ConversationMessage[] {
  return [
    {
      id: 1,
      role: "agent",
      title: "가이드 NPC 토비",
      content: "질문 블록 몇 개만 고르면, 퇴사 판단부터 시장 탐색과 문서 초안까지 한 흐름으로 정리하겠습니다.",
    },
    {
      id: 2,
      role: "system",
      content: "예시 블록을 누르거나 직접 입력 블록을 열어서 답하면 됩니다.",
    },
    {
      id: 3,
      role: "agent",
      title: INTAKE_STEPS[0].badge,
      content: buildPrompt(INTAKE_STEPS[0], profile),
    },
  ];
}

function currentMissionStage(mode: AgentMode, loadingIndex: number, activePhase: string) {
  if (mode === "briefing") {
    return 0;
  }

  if (mode === "launching") {
    return 0;
  }

  if (mode === "running") {
    return Math.min(loadingIndex, 3);
  }

  if (mode === "ready") {
    return 3;
  }

  return (
    {
      intake: 0,
      market: 1,
      ranking: 2,
      report: 3,
    }[activePhase] ?? 0
  );
}

function buildInventorySlots(profile: ProfileDraft, currentStepIndex: number) {
  const slots: Array<{ label: string; value: string }> = [];

  if (currentStepIndex >= 1) {
    slots.push({
      label: "현재 직무",
      value: `${profile.years_experience}년차 ${profile.current_role}`,
    });
  }

  if (currentStepIndex >= 2) {
    slots.push({
      label: "현재 연봉",
      value: formatCurrency(profile.current_salary),
    });
  }

  if (currentStepIndex >= 3) {
    slots.push({
      label: "퇴사 이유",
      value: profile.resignation_reason,
    });
  }

  if (currentStepIndex >= 4) {
    slots.push({
      label: "목표 역할",
      value: profile.desired_role,
    });
  }

  if (currentStepIndex >= 5) {
    slots.push({
      label: "희망 연봉",
      value: formatCurrency(profile.desired_salary),
    });
  }

  if (currentStepIndex >= 6) {
    slots.push({
      label: "핵심 스킬",
      value: profile.skills.slice(0, 3).join(" / "),
    });
  }

  if (currentStepIndex >= 7) {
    slots.push({
      label: "이동 시점",
      value: profile.preferred_timing,
    });
  }

  return slots;
}

function AgentMascot({ className = "agent-mascot" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true" shapeRendering="crispEdges">
      <rect x="12" y="12" width="176" height="176" fill="rgba(255,255,255,0.08)" />
      <rect x="28" y="28" width="144" height="144" fill="#202734" />
      <rect x="56" y="36" width="88" height="88" fill="#8d5a37" />
      <rect x="64" y="44" width="72" height="72" fill="#f0c694" />
      <rect x="64" y="44" width="72" height="18" fill="#5f3b28" />
      <rect x="74" y="74" width="10" height="10" fill="#1a1d22" />
      <rect x="116" y="74" width="10" height="10" fill="#1a1d22" />
      <rect x="90" y="96" width="20" height="8" fill="#b85b46" />
      <rect x="56" y="124" width="88" height="40" fill="#3f495d" />
      <rect x="64" y="132" width="72" height="24" fill="#1f2430" />
      <rect x="92" y="124" width="16" height="40" fill="#ffb44d" />
      <rect x="144" y="112" width="24" height="24" fill="#d8d2c5" />
      <rect x="148" y="116" width="16" height="6" fill="#ff8b45" />
      <rect x="32" y="124" width="16" height="40" fill="#1f2430" />
    </svg>
  );
}

export default function HomePage() {
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(INITIAL_PROFILE);
  const [, setMessages] = useState<ConversationMessage[]>(buildInitialMessages(INITIAL_PROFILE));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>("briefing");
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [activeEventIndex, setActiveEventIndex] = useState(-1);
  const [activeDocumentIndex, setActiveDocumentIndex] = useState(0);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [error, setError] = useState("");

  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const nextMessageIdRef = useRef(4);
  const summaryInjectedRef = useRef(false);

  const currentStep = INTAKE_STEPS[currentStepIndex];
  const visibleEvents =
    result && activeEventIndex >= 0 ? result.browser_events.slice(0, activeEventIndex + 1) : [];
  const currentEvent = visibleEvents[visibleEvents.length - 1];
  const currentPhase = currentEvent?.phase ?? "intake";
  const missionStageIndex = currentMissionStage(agentMode, loadingIndex, currentPhase);
  const inputProgress = Math.round((currentStepIndex / (INTAKE_STEPS.length - 1)) * 100);
  const interviewLocked =
    agentMode === "launching" || agentMode === "running" || agentMode === "replaying";
  const intakeStepCount = INTAKE_STEPS.length - 1;
  const displayStepNumber = Math.min(currentStepIndex + 1, intakeStepCount);
  const inventorySlots = buildInventorySlots(profileDraft, currentStepIndex);
  const answeredCount = Math.max(inventorySlots.length, 1);
  const questionGuide = manualEntryOpen
    ? "직접 입력창이 열려 있습니다. 값을 적고 답변 전송을 누르면 바로 다음 질문으로 넘어갑니다."
    : "예시 블록을 누르거나 마지막 직접 입력 블록을 열어서 답하면 됩니다.";

  useEffect(() => {
    if (manualEntryOpen) {
      manualInputRef.current?.focus();
    }
  }, [manualEntryOpen, currentStepIndex]);

  useEffect(() => {
    if (agentMode !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % AGENT_PREP_STEPS.length);
    }, 850);

    return () => {
      window.clearInterval(interval);
    };
  }, [agentMode]);

  useEffect(() => {
    if (agentMode !== "replaying" || !result) {
      return;
    }

    if (activeEventIndex >= result.browser_events.length - 1) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setActiveEventIndex((current) => current + 1);
    }, activeEventIndex < 0 ? 500 : 900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [agentMode, result, activeEventIndex]);

  useEffect(() => {
    if (agentMode !== "replaying" || !result) {
      return;
    }

    if (activeEventIndex >= result.browser_events.length - 1) {
      setAgentMode("ready");
    }
  }, [agentMode, result, activeEventIndex]);

  useEffect(() => {
    if (agentMode !== "ready" || !result || summaryInjectedRef.current) {
      return;
    }

    const scannedJobs =
      result.metrics.find((metric) => metric.label === "탐색 공고")?.value ??
      `${result.recommended_jobs.length}개`;
    const salaryUpside =
      result.metrics.find((metric) => metric.label === "예상 연봉 상승")?.value ?? "상향 여지 있음";

    summaryInjectedRef.current = true;

    setMessages((current) => [
      ...current,
      {
        id: nextMessageIdRef.current++,
        role: "agent",
        title: "작전 완료",
        content: `시장 탐색 ${scannedJobs}, 예상 연봉 상승 ${salaryUpside} 기준으로 리포트를 정리했습니다. 이제 결과 리포트 페이지로 이동할 수 있습니다.`,
      },
    ]);
  }, [agentMode, result]);

  useEffect(() => {
    if (agentMode === "ready" && result) {
      setIsReportModalOpen(true);
    }
  }, [agentMode, result]);

  function appendMessage(role: ConversationMessage["role"], content: string, title?: string) {
    const nextId = nextMessageIdRef.current++;

    setMessages((current) => [
      ...current,
      {
        id: nextId,
        role,
        title,
        content,
      },
    ]);
  }

  function resetInterview() {
    const freshProfile = INITIAL_PROFILE;

    setProfileDraft(freshProfile);
    setMessages(buildInitialMessages(freshProfile));
    setCurrentStepIndex(0);
    setInputValue("");
    setManualEntryOpen(false);
    setResult(null);
    setAgentMode("briefing");
    setLoadingIndex(0);
    setActiveEventIndex(-1);
    setActiveDocumentIndex(0);
    setIsReportModalOpen(false);
    setError("");
    nextMessageIdRef.current = 4;
    summaryInjectedRef.current = false;
  }

  function handleStepAnswer(rawValue: string, option?: QuickOption) {
    if (agentMode === "running" || agentMode === "replaying") {
      return;
    }

    const trimmed = rawValue.trim();
    const userReply = option?.label ?? trimmed;

    if (!userReply) {
      return;
    }

    const step = currentStep;
    let nextDraft = profileDraft;
    let validationError = "";

    if (step.key === "persona") {
      if (option?.fill) {
        nextDraft = applyProfilePatch(nextDraft, option.fill);
      } else {
        const yearsMatch = trimmed.match(/(\d+)\s*년차/);
        const years = yearsMatch ? Number(yearsMatch[1]) : undefined;
        const role = parseRoleAnswer(trimmed);
        const patch: Partial<ProfileDraft> = {};

        if (years !== undefined) {
          patch.years_experience = years;
        }

        if (role) {
          patch.current_role = role;
        }

        nextDraft = applyProfilePatch(nextDraft, patch);
      }
    }

    if (step.key === "currentSalary") {
      const parsed =
        option?.fill?.current_salary !== undefined
          ? option.fill.current_salary
          : parseNumberAnswer(trimmed);

      if (parsed === undefined) {
        validationError = "연봉은 5400처럼 숫자로 보내주세요.";
      } else {
        nextDraft = applyProfilePatch(nextDraft, { current_salary: parsed });
      }
    }

    if (step.key === "reason") {
      nextDraft = applyProfilePatch(nextDraft, {
        resignation_reason: option?.value ?? trimmed,
      });
    }

    if (step.key === "desiredRole") {
      nextDraft = applyProfilePatch(nextDraft, {
        desired_role: option?.fill?.desired_role ?? option?.value ?? trimmed,
      });
    }

    if (step.key === "desiredSalary") {
      const parsed =
        option?.fill?.desired_salary !== undefined
          ? option.fill.desired_salary
          : parseNumberAnswer(trimmed);

      if (parsed === undefined) {
        validationError = "희망 연봉도 숫자로 적어주세요. 예: 7000";
      } else {
        nextDraft = applyProfilePatch(nextDraft, { desired_salary: parsed });
      }
    }

    if (step.key === "skills") {
      const parsed = option?.fill?.skills ?? parseSkillsAnswer(trimmed);

      if (!parsed.length) {
        validationError = "스킬은 최소 2개 이상 적어주세요. 예: Java, Spring Boot";
      } else {
        nextDraft = applyProfilePatch(nextDraft, { skills: parsed });
      }
    }

    if (step.key === "timing") {
      nextDraft = applyProfilePatch(nextDraft, {
        preferred_timing: option?.value ?? trimmed,
      });
    }

    if (validationError) {
      setError(validationError);
      appendMessage("agent", validationError, "입력 확인");
      return;
    }

    setError("");
    setInputValue("");
    setManualEntryOpen(false);
    setProfileDraft(nextDraft);
    appendMessage("user", userReply);

    const nextIndex = Math.min(currentStepIndex + 1, INTAKE_STEPS.length - 1);
    const nextStep = INTAKE_STEPS[nextIndex];
    setCurrentStepIndex(nextIndex);
    appendMessage("agent", buildPrompt(nextStep, nextDraft), nextStep.badge);
  }

  async function handleRunAgent() {
    if (agentMode === "launching" || agentMode === "running" || agentMode === "replaying") {
      return;
    }

    setError("");
    setAgentMode("launching");
    setLoadingIndex(0);
    setResult(null);
    setActiveEventIndex(-1);
    summaryInjectedRef.current = false;

    appendMessage("user", "이 조건으로 바로 실행해줘.");
    appendMessage(
      "agent",
      "좋습니다. 답변 구슬을 회수한 뒤 에이전트를 출격시키고, 실시간 공고 수집 로그를 열겠습니다.",
      "작전 시작"
    );

    try {
      const responsePromise = fetch("/api/backend/api/demo/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileDraft),
      });

      await delay(4300);
      setAgentMode("running");
      const response = await responsePromise;

      if (!response.ok) {
        throw new Error("에이전트 실행에 실패했습니다.");
      }

      const payload: AnalysisResponse = await response.json();

      startTransition(() => {
        setResult(payload);
        setAgentMode("replaying");
        setActiveEventIndex(-1);
      });
    } catch {
      const mockPayload = buildMockResponse(profileDraft);

      appendMessage(
        "agent",
        "서버 연결에 실패했습니다. 데모 목업 데이터로 작전을 계속합니다.",
        "데모 모드"
      );

      startTransition(() => {
        setResult(mockPayload);
        setAgentMode("replaying");
        setActiveEventIndex(-1);
      });
    }
  }

  function handleManualEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleStepAnswer(inputValue);
  }

  function handleOpenReport() {
    if (!result || agentMode !== "ready") {
      return;
    }

    setIsReportModalOpen(true);
  }

  function handleOpenJob(url: string) {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.assign(url);
    }
  }

  const missionConsole =
    agentMode === "launching"
      ? [
          `answer.orbs = ${answeredCount}`,
          "launch.sequence = charge",
          "agent.status = materializing",
        ]
      : agentMode === "running"
      ? AGENT_PREP_STEPS[loadingIndex].console
      : currentEvent?.preview_lines ??
        (agentMode === "briefing"
          ? [
              "session.mode = anonymous_web",
              `intake.step = ${currentStep.badge}`,
              "agent.status = standby",
            ]
          : [
              `current_role=${profileDraft.current_role}`,
              `target_role=${profileDraft.desired_role}`,
              `salary_target=${profileDraft.current_salary} -> ${profileDraft.desired_salary}`,
            ]);

  const missionFeed =
    agentMode === "launching"
      ? [
          {
            label: "답변 구슬 회수",
            detail: `${answeredCount}개의 답변을 에너지 구슬로 변환해 중앙 코어로 모으는 중`,
            console: [],
          },
          {
            label: "출격 엔진 예열",
            detail: "토비 NPC를 실시간 탐색 모드로 전환하는 중",
            console: [],
          },
        ]
      : agentMode === "running" || agentMode === "briefing"
      ? AGENT_PREP_STEPS
      : visibleEvents.map((eventItem) => ({
          label: eventItem.title,
          detail: eventItem.detail,
          console: eventItem.preview_lines,
        }));

  const missionHeadline =
    agentMode === "launching"
      ? "출격 시퀀스"
      : agentMode === "running"
      ? AGENT_PREP_STEPS[loadingIndex].label
      : agentMode === "ready"
        ? "리포트 준비 완료"
        : currentEvent?.title ?? "출격 대기";

  const missionDetail =
    agentMode === "launching"
      ? "답변 수만큼의 구슬을 회수해 중앙 코어로 결집시키고 있습니다. 집결이 끝나면 토비가 바로 시장 탐색에 출격합니다."
      : agentMode === "running"
      ? AGENT_PREP_STEPS[loadingIndex].detail
      : agentMode === "ready"
        ? "실시간 공고 수집과 정렬이 끝났습니다. 결과 리포트 페이지에서 추천 공고 링크와 문서 패키지를 확인할 수 있습니다."
      : currentEvent?.detail ??
        "누구나 카드 선택이나 자유 입력으로 조건을 보내면, 그 정보만으로 에이전트가 바로 탐색에 들어갑니다.";

  return (
    <main className="mission-shell">
      <section className="workspace-grid">
        <section className="panel mission-panel">
          <div className="panel-heading inverse">
            <div>
              <p className="eyebrow">Agent Workshop</p>
              <h2>에이전트 작업대</h2>
            </div>
            <div className="theater-signal">
              <span className="signal-dot" />
              <strong>
                {agentMode === "briefing"
                  ? "대기"
                  : agentMode === "launching"
                    ? "출격"
                  : agentMode === "running"
                    ? "실행"
                    : agentMode === "replaying"
                      ? "재생"
                      : "리포트"}
              </strong>
            </div>
          </div>

          <div className="mission-agent-card">
            <AgentMascot className="agent-mascot compact" />
            <div>
              <p className="eyebrow">Guide NPC</p>
              <strong>“입력 블록이 쌓이면 바로 시장 탐색을 시작합니다.”</strong>
              <p>오른쪽 인터뷰 광장에서 고른 답변을 작업대에서 즉시 조합해 탐색, 정렬, 리포트 순으로 진행합니다.</p>
            </div>
          </div>

          <div className="phase-rail">
            {["프로필 잠금", "시장 탐색", "매칭 계산", "문서 생성"].map((phase, index) => {
              const isActive = missionStageIndex === index;
              const isDone = missionStageIndex > index || agentMode === "ready";

              return (
                <div
                  className={`phase-node ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                  key={phase}
                >
                  <span>{index + 1}</span>
                  <strong>{phase}</strong>
                </div>
              );
            })}
          </div>

          {agentMode === "launching" ? (
            <div className="launch-sequence">
              <div className="launch-arena">
                <div className="launch-core" />
                {Array.from({ length: answeredCount }).map((_, index) => {
                  const angle = (Math.PI * 2 * index) / answeredCount;
                  const radius = 120 + (index % 2) * 28;

                  return (
                    <span
                      aria-hidden="true"
                      className="launch-orb"
                      key={`orb-${index}`}
                      style={
                        {
                          "--dx": `${Math.cos(angle) * radius}px`,
                          "--dy": `${Math.sin(angle) * radius}px`,
                          animationDelay: `${index * 100}ms`,
                        } as CSSProperties
                      }
                    />
                  );
                })}
                <AgentMascot className="agent-mascot launch" />
                <span className="launch-flare" aria-hidden="true" />
              </div>

              <div className="launch-sequence-copy">
                <p className="eyebrow">Launch Sequence</p>
                <h3>답변 구슬 집결 완료</h3>
                <p>{answeredCount}개의 답변 구슬이 중앙 코어에 모이고 있습니다. 코어가 닫히면 토비가 탐색 모드로 출격합니다.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mission-visual">
                <div className={`radar-scope ${agentMode}`}>
                  <div className="radar-ring ring-1" />
                  <div className="radar-ring ring-2" />
                  <div className="radar-ring ring-3" />
                  <div className="radar-sweep" />
                  <div className="radar-core" />
                </div>

                <div className="mission-callout">
                  <p className="eyebrow">Current Mission</p>
                  <h3>{missionHeadline}</h3>
                  <p>{missionDetail}</p>
                </div>
              </div>

              <pre className="mission-console">{missionConsole.join("\n")}</pre>

              <div className="mission-feed">
                {missionFeed.length ? (
                  missionFeed.map((item, index) => (
                    <article
                      className={`feed-item ${index === missionStageIndex ? "active" : ""}`}
                      key={`${item.label}-${index}`}
                    >
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </article>
                  ))
                ) : (
                  <div className="feed-empty">
                    <p>아직 실행된 작전 로그가 없습니다.</p>
                  </div>
                )}
              </div>

              {agentMode === "ready" && result ? (
                <div className="report-entry-card">
                  <div>
                    <p className="eyebrow">Report Gate</p>
                    <strong>실시간 공고 수집이 끝났습니다.</strong>
                    <p>추천 공고 링크, 진단 요약, 생성 문서를 모달에서 바로 확인할 수 있습니다.</p>
                  </div>
                  <button className="primary-button" type="button" onClick={handleOpenReport}>
                    결과 리포트 열기
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="panel chat-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Spawn Zone</p>
              <h2>퇴사 인터뷰 광장</h2>
            </div>
            <span className={`status-pill ${agentMode}`}>
              {agentMode === "briefing"
                ? "게스트 접속"
                : agentMode === "launching"
                  ? "출격 준비"
                  : agentMode === "running"
                    ? "실데이터 수집"
                    : agentMode === "replaying"
                      ? "동작 재생"
                      : "리포트 준비"}
            </span>
          </div>

          <div className="chat-intro-card">
            <div>
              <p className="eyebrow">Guest Mode</p>
              <strong>로그인 없이 블록 몇 개만 고르면 바로 시작됩니다.</strong>
              <p>오른쪽에서 조건 블록을 쌓고, 왼쪽 작업대에서 에이전트가 실제 실행 흐름을 보여줍니다.</p>
            </div>
            <button className="ghost-button" type="button" onClick={resetInterview}>
              인터뷰 다시 시작
            </button>
          </div>

          {inventorySlots.length ? (
            <div className="inventory-strip">
              {inventorySlots.map((slot) => (
                <article className="inventory-slot" key={slot.label}>
                  <span>{slot.label}</span>
                  <strong>{slot.value}</strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="inventory-empty">
              아직 저장된 답변이 없습니다. 첫 번째 질문부터 블록을 하나 고르면 인벤토리가 채워집니다.
            </div>
          )}

          {currentStep.key !== "confirm" ? (
            <div className="question-board">
              <div className="question-board-head">
                <div>
                  <p className="question-step-label">Quest {displayStepNumber}</p>
                  <h3>{currentStep.title}</h3>
                </div>
                <strong className="question-badge">{currentStep.badge}</strong>
              </div>

              <div className="question-progress-bar" aria-hidden="true">
                <span style={{ width: `${inputProgress}%` }} />
              </div>

              <p className="question-guide">{questionGuide}</p>

              <div className="choice-grid">
                {currentStep.options.map((option) => (
                  <button
                    className="choice-card"
                    disabled={interviewLocked}
                    key={`${currentStep.key}-${option.label}`}
                    type="button"
                    onClick={() => handleStepAnswer(option.value, option)}
                  >
                    <span className="choice-icon" aria-hidden="true">
                      {option.icon ?? "•"}
                    </span>
                    <div className="choice-copy">
                      <div className="choice-title-row">
                        <strong>{option.label}</strong>
                        {option.tags?.length ? (
                          <div className="choice-tags">
                            {option.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <p>{option.description}</p>
                    </div>
                  </button>
                ))}

                <button
                  className={`choice-card direct-entry ${manualEntryOpen ? "active" : ""}`}
                  disabled={interviewLocked}
                  type="button"
                  onClick={() => {
                    setError("");
                    setManualEntryOpen((current) => !current);
                  }}
                >
                  <span className="choice-icon" aria-hidden="true">
                    ✍️
                  </span>
                  <div className="choice-copy">
                    <div className="choice-title-row">
                      <strong>{manualEntryOpen ? "직접 입력 중" : "직접 입력"}</strong>
                    </div>
                    <p>{currentStep.placeholder}</p>
                  </div>
                  <span className="choice-action">
                    {manualEntryOpen ? "입력창 닫기" : "직접 적기"}
                  </span>
                </button>
              </div>

              {manualEntryOpen ? (
                <form className="inline-entry" onSubmit={handleManualEntrySubmit}>
                  <div className="inline-entry-head">
                    <strong>직접 답변 입력</strong>
                    <span>{currentStep.placeholder}</span>
                  </div>
                  <div className="inline-entry-form">
                    <input
                      ref={manualInputRef}
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      placeholder={currentStep.placeholder}
                    />
                    <button
                      className="primary-button compact"
                      disabled={interviewLocked || !inputValue.trim()}
                      type="submit"
                    >
                      답변 전송
                    </button>
                  </div>
                </form>
              ) : (
                <p className="inline-entry-hint">카드를 고르거나 아래 직접 입력 카드를 눌러 답하면 됩니다.</p>
              )}
            </div>
          ) : (
            <div className="launch-panel">
              <div className="launch-summary">
                <article>
                  <span>현재</span>
                  <strong>
                    {profileDraft.years_experience}년차 {profileDraft.current_role}
                  </strong>
                </article>
                <article>
                  <span>목표</span>
                  <strong>{profileDraft.desired_role}</strong>
                </article>
                <article>
                  <span>연봉 갭</span>
                  <strong>
                    {formatCurrency(profileDraft.current_salary)} → {formatCurrency(profileDraft.desired_salary)}
                  </strong>
                </article>
                <article>
                  <span>이동 시점</span>
                  <strong>{profileDraft.preferred_timing}</strong>
                </article>
              </div>

              <div className="launch-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={interviewLocked}
                  onClick={handleRunAgent}
                >
                  {interviewLocked ? "에이전트 실행 중..." : "에이전트 출격"}
                </button>
                <p>입력된 조건으로 실시간 공고 수집, 추천 정렬, 결과 리포트 생성을 순서대로 진행합니다.</p>
              </div>
            </div>
          )}

          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </section>

      {isReportModalOpen && result ? (
        <div
          className="report-modal-backdrop"
          onClick={() => setIsReportModalOpen(false)}
          role="presentation"
        >
          <section
            aria-modal="true"
            className="report-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="report-modal-topbar">
              <div>
                <p className="eyebrow">Result Modal</p>
                <h2>퇴사 결과 리포트</h2>
              </div>
              <button
                className="ghost-button modal-close"
                type="button"
                onClick={() => setIsReportModalOpen(false)}
              >
                닫기
              </button>
            </div>

            <p className="report-summary">{result.profile_summary}</p>

            <div className="metric-grid">
              {result.metrics.map((metric) => (
                <article className="metric-card" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.detail}</p>
                </article>
              ))}
            </div>

            <div className="diagnosis-grid">
              <article>
                <h3>타이밍 분석</h3>
                <p>{result.diagnosis.timing_recommendation}</p>
              </article>
              <article>
                <h3>재무 리스크</h3>
                <p>{result.diagnosis.financial_risk}</p>
              </article>
              <article>
                <h3>시장 신호</h3>
                <p>{result.diagnosis.market_signal}</p>
              </article>
              <article>
                <h3>권장 액션</h3>
                <p>{result.diagnosis.action_summary}</p>
              </article>
            </div>

            <div className="job-list report-job-list">
              {result.recommended_jobs.map((job) => (
                <article className="job-card" key={`${job.company}-${job.title}`}>
                  <div className="job-card-top">
                    <div>
                      <p className="job-company">{job.company}</p>
                      <h3>{job.title}</h3>
                      <span>
                        {job.location} · {job.source}
                      </span>
                    </div>
                    <div className="job-score">{job.match_score}점</div>
                  </div>

                  <div className="job-meta">
                    <span>{formatSalaryRange(job.salary_min, job.salary_max)}</span>
                    <span>{job.rating !== null ? `평점 ${job.rating.toFixed(1)}` : "평점 미제공"}</span>
                    <span>
                      연봉 변화 {job.salary_gap_percent > 0 ? "+" : ""}
                      {job.salary_gap_percent}%
                    </span>
                  </div>

                  <p className="job-review">{job.review_summary}</p>

                  <div className="skill-ribbon compact">
                    {job.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>

                  <ul className="reason-list">
                    {job.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>

                  <div className="job-link-row">
                    <button
                      className="job-link-button"
                      type="button"
                      onClick={() => handleOpenJob(job.url)}
                    >
                      공고 보기
                    </button>
                    <span className="job-link-url">{job.url}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="document-tabs">
              {result.documents.map((document, index) => (
                <button
                  className={index === activeDocumentIndex ? "active" : ""}
                  key={document.title}
                  type="button"
                  onClick={() => setActiveDocumentIndex(index)}
                >
                  {document.title}
                </button>
              ))}
            </div>

            <pre className="document-viewer modal-document-viewer">
              {result.documents[activeDocumentIndex]?.content}
            </pre>

            <div className="disclaimer-box">
              {result.disclaimers.map((disclaimer) => (
                <p key={disclaimer}>{disclaimer}</p>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
