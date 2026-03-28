"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const REPORT_STORAGE_KEY = "talchul-master-report";

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
  metrics: MetricCard[];
  recommended_jobs: RecommendedJob[];
  documents: GeneratedDocument[];
  disclaimers: string[];
};

type StoredReportPayload = {
  saved_at: number;
  profile: {
    name: string;
    current_role: string;
    desired_role: string;
  };
  result: AnalysisResponse;
};

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

export default function ReportPage() {
  const [payload, setPayload] = useState<StoredReportPayload | null>(null);
  const [activeDocumentIndex, setActiveDocumentIndex] = useState(0);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredReportPayload;
      setPayload(parsed);
    } catch {
      window.sessionStorage.removeItem(REPORT_STORAGE_KEY);
    }
  }, []);

  function handleOpenJob(url: string) {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.assign(url);
    }
  }

  if (!payload) {
    return (
      <main className="report-shell">
        <section className="panel report-empty">
          <p className="eyebrow">Report Missing</p>
          <h1>저장된 리포트가 없습니다.</h1>
          <p>홈에서 인터뷰를 마친 뒤 에이전트를 출격시키면 결과 리포트 페이지로 들어올 수 있습니다.</p>
          <Link className="primary-button report-link" href="/">
            홈으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const { result, profile } = payload;

  return (
    <main className="report-shell">
      <section className="panel report-hero-panel">
        <div className="report-topbar">
          <div>
            <p className="eyebrow">Report Gate</p>
            <h1>퇴사 결과 리포트</h1>
          </div>
          <Link className="ghost-button report-link" href="/">
            홈으로 돌아가기
          </Link>
        </div>

        <p className="report-summary">{result.profile_summary}</p>

        <div className="report-hero-meta">
          <article>
            <span>현재 직무</span>
            <strong>{profile.current_role}</strong>
          </article>
          <article>
            <span>목표 직무</span>
            <strong>{profile.desired_role}</strong>
          </article>
          <article>
            <span>추천 공고</span>
            <strong>{result.recommended_jobs.length}개</strong>
          </article>
        </div>
      </section>

      <section className="results-grid">
        <section className="panel report-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Briefing</p>
              <h2>핵심 진단</h2>
            </div>
          </div>

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
        </section>

        <section className="panel jobs-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Top Matches</p>
              <h2>추천 공고 링크</h2>
            </div>
          </div>

          <div className="job-list">
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
                    공고 열기
                  </button>
                  <span className="job-link-url">{job.url}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="results-grid documents-layout">
        <section className="panel documents-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Document Pack</p>
              <h2>생성 문서</h2>
            </div>
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

          <pre className="document-viewer">{result.documents[activeDocumentIndex]?.content}</pre>

          <div className="disclaimer-box">
            {result.disclaimers.map((disclaimer) => (
              <p key={disclaimer}>{disclaimer}</p>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
