"use client";

import { useRouter } from "next/navigation";
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

const REPORT_STORAGE_KEY = "talchul-master-report";

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
  const router = useRouter();
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(INITIAL_PROFILE);
  const [messages, setMessages] = useState<ConversationMessage[]>(buildInitialMessages(INITIAL_PROFILE));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>("briefing");
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [activeEventIndex, setActiveEventIndex] = useState(-1);
  const [error, setError] = useState("");

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
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
    if (!chatScrollRef.current) {
      return;
    }

    chatScrollRef.current.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

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

      await delay(3200);
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
    } catch (runError) {
      const message =
        runError instanceof Error ? runError.message : "알 수 없는 오류로 작전을 중단했습니다.";

      setAgentMode("briefing");
      setError(message);
      appendMessage("agent", message, "실행 실패");
    }
  }

  function handleManualEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleStepAnswer(inputValue);
  }

  function handleOpenReport() {
    if (!result) {
      return;
    }

    window.sessionStorage.setItem(
      REPORT_STORAGE_KEY,
      JSON.stringify({
        profile: profileDraft,
        result,
        saved_at: Date.now(),
      })
    );
    router.push("/report");
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
                    <p>다음 페이지에서 추천 공고 링크, 진단 요약, 생성 문서를 확인할 수 있습니다.</p>
                  </div>
                  <button className="primary-button" type="button" onClick={handleOpenReport}>
                    결과 리포트 보러가기
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

          <div className="chat-thread" ref={chatScrollRef}>
            <div className="chat-log-head">
              <p className="eyebrow">Chat Log</p>
              <strong>대화 기록</strong>
            </div>
            {messages.map((message) => (
              <article className={`message-row ${message.role}`} key={message.id}>
                {message.role === "agent" ? <div className="avatar-badge">토비</div> : null}
                <div className={`message-bubble ${message.role}`}>
                  {message.title ? <p className="message-title">{message.title}</p> : null}
                  <p>{message.content}</p>
                </div>
              </article>
            ))}
          </div>

          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </section>
    </main>
  );
}
