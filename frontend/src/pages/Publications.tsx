import { useEffect, useState } from "react";
import { api, apiError } from "../api/client";
import { todayKST } from "../lib/date";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card } from "../ui/kit";
import { DataTable, Col } from "../ui/DataTable";
import { printDoc } from "../ui/pdf";
import { useConfig, names } from "../api/config";

interface PubFile { name: string; url: string; }
interface Pub {
  id: string; kind: string; title: string; project_id: string; scope: string; index_type: string;
  index_grade: string; authors: string; funding: string; status: string; pub_date: string | null; meta: any;
  abstract?: string; files?: PubFile[];
}
// 고정(수정 불가) 실적 종류 6종 — 전용 입력 양식. 그 외 추가 종류는 기본(기타) 양식.
const FIXED_KINDS = ["국제논문지", "국내논문지", "국제학술대회", "국내학술대회", "국제특허", "국내특허"];
const KINDS_FB = [...FIXED_KINDS];

// 실적 종류(라벨) → 입력 양식 계열. 고정 6종만 전용 양식, 그 외는 '기타'(기본 양식).
function family(k: string): "논문" | "학술대회" | "특허" | "기타" {
  if (/특허/.test(k)) return "특허";
  if (/학술대회|학회/.test(k)) return "학술대회";
  if (/논문|SCI|KCI/i.test(k)) return "논문";
  return "기타";
}
function scopeOf(u: Pub) { return u.scope || "국외"; }
function yearOf(u: Pub) { return (u.pub_date || "").slice(0, 4) || "미상"; }
// 실적 → 고정 6종 라벨. 신규 라벨은 그대로, 구(舊) 데이터(SCI/KCI·대분류·세분류)는 6종으로 매핑.
function seriesOf(u: Pub): string {
  const k = u.kind || "";
  if (FIXED_KINDS.includes(k)) return k;
  const fam = family(k);
  if (fam === "논문") {
    const ix = u.index_grade || u.index_type || k;
    return /SSCI|SCIE|SCI|SCOPUS|A&HCI/i.test(ix) ? "국제논문지" : "국내논문지";
  }
  const intl = scopeOf(u) === "국외" || /국제|국외|해외/.test(k);
  if (fam === "학술대회") return intl ? "국제학술대회" : "국내학술대회";
  if (fam === "특허") return intl ? "국제특허" : "국내특허";
  return k;   // 기타(커스텀 종류)
}

const EMPTY = {
  kind: "국제논문지", title: "", project_id: "", funding: "", funding_type: "연구과제", status: "게재완료", pub_date: "",
  authors: "", index_grade: "SCI", abstract: "",
  // 논문
  journal: "", vol: "", no: "", pages: "", publisher: "", country: "", lang: "영어", issn: "", doi: "",
  first_authors: "", corr_authors: "", total_authors: "",
  // 학술대회
  cscope: "국제", conf: "", conf_start: "", conf_end: "", host: "", venue: "", proceedings: "", host_country: "", part_countries: "", co_authors: "",
  // 특허
  pstat: "국내출원", reg_no: "", applicant: "", inv_count: "",
};

export default function Publications() {
  const { me } = useAuth();
  const canAdd = !!me && (["prof", "staff", "admin"].includes(me.role) || !!me.delegated_admin);
  const [items, setItems] = useState<Pub[]>([]);
  const [projects, setProjects] = useState<{ id: string; code: string }[]>([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const KINDS = names(useConfig("pub_types", KINDS_FB));
  const [f, setF] = useState({ ...EMPTY });
  const up = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  // 발명자(소속)을 콤마로 구분한 인원수 — 발명자수에 자동 반영
  const invCount = f.authors.split(",").map((s) => s.trim()).filter(Boolean).length;
  const [files, setFiles] = useState<PubFile[]>([]);
  const [uploading, setUploading] = useState(false);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files; if (!fl || !fl.length) return;
    setUploading(true); setErr("");
    const fd = new FormData();
    Array.from(fl).forEach((file) => fd.append("files", file));
    try {
      const r = await api.post<PubFile[]>("/projects/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setFiles((prev) => [...prev, ...r.data]);
    } catch (e) { setErr(apiError(e)); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function load() {
    try {
      setItems((await api.get<Pub[]>("/projects/publications")).data);
      setProjects((await api.get("/projects/projects?kind=grant")).data);
    } catch (e) { setErr(apiError(e)); }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const fam = family(f.kind);
    const scope = /국제|국외|해외/.test(f.kind) ? "국외" : "국내";
    let meta: any = {};
    if (fam === "논문") meta = { journal: f.journal, vol: f.vol, no: f.no, pages: f.pages, publisher: f.publisher, country: f.country, lang: f.lang, issn: f.issn, doi: f.doi, first_authors: f.first_authors, corr_authors: f.corr_authors, total_authors: f.total_authors };
    else if (fam === "학술대회") meta = { conf: f.conf, conf_start: f.conf_start, conf_end: f.conf_end, host: f.host, venue: f.venue, proceedings: f.proceedings, host_country: f.host_country, part_countries: f.part_countries, co_authors: f.co_authors, total_authors: f.total_authors, pages: f.pages };
    else if (fam === "특허") meta = { pstat: f.kind.includes("등록") ? "등록" : "출원", reg_no: f.reg_no, applicant: f.applicant, inv_count: invCount };
    try {
      await api.post("/projects/publications", {
        kind: f.kind, title: f.title, project_id: f.project_id, scope, index_type: f.kind,
        index_grade: fam === "논문" ? f.index_grade : "", authors: f.authors, funding: f.funding,
        status: f.status, pub_date: f.pub_date || null, abstract: f.abstract, meta, files,
      });
      setAdding(false); setF({ ...EMPTY }); setFiles([]); load();
    } catch (e) { setErr(apiError(e)); }
  }

  // 최근 5년 실적 표 / 필터 — 실적 종류(pub_types)를 그대로 사용
  const thisYear = Number(todayKST().slice(0, 4));
  const recentYears = Array.from({ length: 5 }, (_, i) => String(thisYear - 4 + i));
  const countOf = (k: string, y: string) => items.filter((u) => seriesOf(u) === k && yearOf(u) === y).length;

  function exportPdf(u: Pub) {
    const m = u.meta || {};
    const detail: [string, any][] = [["종류", u.kind], ["구분", u.index_type], ["국내외", scopeOf(u)], ["성과지표", seriesOf(u)],
      ["저자/발명자", u.authors], ["사사(과제)", u.funding], ["게재/발표/등록일", u.pub_date], ["상태", u.status]];
    if (family(u.kind) === "논문") detail.push(["학술지", m.journal], ["권/호/페이지", `${m.vol || ""} ${m.no || ""} ${m.pages || ""}`], ["발행처/국가", `${m.publisher || ""} / ${m.country || ""}`], ["언어", m.lang], ["DOI", m.doi], ["ISSN", m.issn], ["저자수(제1/교신/전체)", `${m.first_authors || "-"}/${m.corr_authors || "-"}/${m.total_authors || "-"}`]);
    else if (family(u.kind) === "학술대회") detail.push(["학술대회", m.conf], ["기간", `${m.conf_start || ""} ~ ${m.conf_end || ""}`], ["주최/장소", `${m.host || ""} / ${m.venue || ""}`], ["논문집", m.proceedings], ["개최국/참가국", `${m.host_country || ""} / ${m.part_countries || ""}`]);
    else if (family(u.kind) === "특허") detail.push(["출원/등록번호", m.reg_no], ["출원인", m.applicant], ["발명자수", m.inv_count]);
    const rows = detail.filter(([, v]) => v != null && v !== "").map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");
    const files = (u.files && u.files.length) ? `<div class="files">📎 첨부: ${u.files.map((f) => f.name).join(", ")}</div>` : "";
    const html = `<div class="doc-title">${u.title}</div><div class="doc-sub">연구실적 증빙 · ${u.kind}</div>
      <table class="kv"><tbody>${rows}</tbody></table>${files}
      ${u.abstract ? `<div class="doc-body"><b>요약</b><br/>${u.abstract.replace(/</g, "&lt;")}</div>` : ""}`;
    printDoc(`실적_${u.title}`, html);
  }

  const cols: Col<Pub>[] = [
    { key: "kind", label: "종류", value: (u) => seriesOf(u), render: (u) => <span className="badge s-info">{seriesOf(u)}</span>, nowrap: true },
    { key: "title", label: "제목", value: (u) => u.title, render: (u) => <b>{u.title}</b> },
    { key: "authors", label: "저자", render: (u) => <span className="small">{u.authors}</span> },
    { key: "funding", label: "사사", value: (u) => u.funding, render: (u) => <span className="small">{u.funding || "-"}</span>, nowrap: true },
    { key: "files", label: "첨부", nowrap: true, render: (u) => (u.files && u.files.length) ? <span className="small">{u.files.map((fi, i) => <a key={i} className="lnk" href={fi.url} target="_blank" rel="noreferrer" title={fi.name} style={{ marginRight: 4 }}>📎{u.files!.length > 1 ? i + 1 : ""}</a>)}</span> : <span className="muted small">—</span> },
    { key: "pdf", label: "출력", nowrap: true, render: (u) => <button className="btn ghost sm" data-testid={`pub-pdf-${u.id}`} onClick={() => exportPdf(u)}>📄 PDF</button> },
    { key: "year", label: "연도", value: (u) => yearOf(u), nowrap: true, render: (u) => yearOf(u) },
  ];

  return (
    <div data-testid="page-publications">
      <PageHeader crumb="연구실 › 실적" title="실적" action={
        canAdd ? <button className="btn primary" data-testid="pub-add-open" onClick={() => { if (!adding) setF({ ...EMPTY, kind: KINDS[0] || "SCI" }); setAdding((v) => !v); }}>+ 실적 등록</button> : <span className="muted small">조회 전용</span>
      } />
      {err && <div className="form-err" data-testid="pub-error">{err}</div>}
      {adding && (
        <form className="card" onSubmit={add} data-testid="pub-form">
          <div className="bd">
            {/* 종류 — 첫 줄 전체 폭. 선택 시 아래 입력 항목이 종류에 맞춰 바뀐다 */}
            <label>종류</label>
            <select data-testid="u-kind" value={f.kind} onChange={(e) => up("kind", e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
            <label style={{ marginTop: 10 }}>{family(f.kind) === "특허" ? "특허 이름" : family(f.kind) === "기타" ? "실적명" : "논문제목"}</label>
            <input data-testid="u-title" value={f.title} onChange={(e) => up("title", e.target.value)} />

            {family(f.kind) === "논문" && (<>
              <h3 style={{ fontSize: 13, color: "var(--brand)", margin: "14px 0 6px" }}>논문 정보 <span className="muted small">({f.kind})</span></h3>
              <label>학술지명</label>
              <input value={f.journal} onChange={(e) => up("journal", e.target.value)} />
              <div className="grid3">
                <div><label>게재권/집</label><input value={f.vol} onChange={(e) => up("vol", e.target.value)} /></div>
                <div><label>게재호</label><input value={f.no} onChange={(e) => up("no", e.target.value)} /></div>
                <div><label>페이지</label><input value={f.pages} onChange={(e) => up("pages", e.target.value)} /></div>
              </div>
              <div className="grid3">
                <div><label>게재일</label><input type="date" data-testid="u-date" value={f.pub_date} onChange={(e) => up("pub_date", e.target.value)} /></div>
                <div><label>발행처</label><input value={f.publisher} onChange={(e) => up("publisher", e.target.value)} /></div>
                <div><label>발행국가</label><input value={f.country} onChange={(e) => up("country", e.target.value)} /></div>
              </div>
              <div className="grid3">
                <div><label>DOI</label><input value={f.doi} onChange={(e) => up("doi", e.target.value)} /></div>
                <div><label>ISSN</label><input value={f.issn} onChange={(e) => up("issn", e.target.value)} /></div>
                <div><label>논문언어</label><select value={f.lang} onChange={(e) => up("lang", e.target.value)}><option>영어</option><option>한글</option></select></div>
              </div>
              <div className="grid3">
                <div><label>제1저자수</label><input value={f.first_authors} onChange={(e) => up("first_authors", e.target.value)} /></div>
                <div><label>교신저자수</label><input value={f.corr_authors} onChange={(e) => up("corr_authors", e.target.value)} /></div>
                <div><label>전체저자수</label><input value={f.total_authors} onChange={(e) => up("total_authors", e.target.value)} /></div>
              </div>
            </>)}
            {family(f.kind) === "학술대회" && (<>
              <h3 style={{ fontSize: 13, color: "var(--brand)", margin: "14px 0 6px" }}>학술대회 정보</h3>
              <label>학술대회명</label>
              <input value={f.conf} onChange={(e) => up("conf", e.target.value)} />
              <div className="grid3">
                <div><label>시작일</label><input type="date" value={f.conf_start} onChange={(e) => up("conf_start", e.target.value)} /></div>
                <div><label>종료일</label><input type="date" value={f.conf_end} onChange={(e) => up("conf_end", e.target.value)} /></div>
                <div><label>발표일</label><input type="date" data-testid="u-date" value={f.pub_date} onChange={(e) => up("pub_date", e.target.value)} /></div>
              </div>
              <div className="grid3">
                <div><label>주최기관</label><input value={f.host} onChange={(e) => up("host", e.target.value)} /></div>
                <div><label>논문집명</label><input value={f.proceedings} onChange={(e) => up("proceedings", e.target.value)} /></div>
                <div><label>페이지</label><input value={f.pages} onChange={(e) => up("pages", e.target.value)} /></div>
              </div>
              <div className="grid3">
                <div><label>개최국</label><input value={f.host_country} onChange={(e) => up("host_country", e.target.value)} /></div>
                <div><label>발표장소</label><input value={f.venue} onChange={(e) => up("venue", e.target.value)} /></div>
                <div><label>참가국명</label><input value={f.part_countries} onChange={(e) => up("part_countries", e.target.value)} /></div>
              </div>
              <div className="grid2">
                <div><label>공동저자수</label><input value={f.co_authors} onChange={(e) => up("co_authors", e.target.value)} /></div>
                <div><label>전체저자수</label><input value={f.total_authors} onChange={(e) => up("total_authors", e.target.value)} /></div>
              </div>
            </>)}
            {family(f.kind) === "특허" && (<>
              <h3 style={{ fontSize: 13, color: "var(--brand)", margin: "14px 0 6px" }}>특허 정보 <span className="muted small">({f.kind})</span></h3>
              <div className="grid2">
                <div><label>출원/등록번호</label><input value={f.reg_no} onChange={(e) => up("reg_no", e.target.value)} /></div>
                <div><label>출원인</label><input value={f.applicant} onChange={(e) => up("applicant", e.target.value)} /></div>
              </div>
              <div className="grid2">
                <div><label>출원/등록일</label><input type="date" data-testid="u-date" value={f.pub_date} onChange={(e) => up("pub_date", e.target.value)} /></div>
                <div><label>발명자수</label><input data-testid="u-invcount" value={invCount} readOnly title="발명자(소속)을 콤마(,)로 구분해 자동 계산" style={{ background: "var(--soft)", cursor: "not-allowed" }} /></div>
              </div>
            </>)}
            {family(f.kind) === "기타" && (
              <div className="grid2" style={{ marginTop: 10 }}>
                <div><label>등록일</label><input type="date" data-testid="u-date" value={f.pub_date} onChange={(e) => up("pub_date", e.target.value)} /></div>
              </div>
            )}

            <label style={{ marginTop: 10 }}>{family(f.kind) === "특허" ? "발명자(소속)" : "저자(소속)"}</label>
            <input data-testid="u-authors" value={f.authors} onChange={(e) => up("authors", e.target.value)} placeholder="예: 홍길동(단국대), 김연구(단국대)" />
            <label style={{ marginTop: 10 }}>{family(f.kind) === "특허" ? "특허사사" : "사사"}</label>
            <div className="grid3">
              <select data-testid="u-funding-type" value={f.funding_type} onChange={(e) => setF((s) => ({ ...s, funding_type: e.target.value, funding: "" }))}>
                <option>연구과제</option><option>기타</option>
              </select>
              <div style={{ gridColumn: "span 2" }}>
                {f.funding_type === "연구과제"
                  ? <select data-testid="u-funding" value={f.funding} onChange={(e) => up("funding", e.target.value)}><option value="">(과제 선택)</option>{projects.map((p) => <option key={p.id} value={p.code}>{p.code}</option>)}</select>
                  : <input data-testid="u-funding" value={f.funding} onChange={(e) => up("funding", e.target.value)} placeholder="사사 문구 직접 입력" />}
              </div>
            </div>
            <label style={{ marginTop: 10 }}>증빙 파일 첨부 (PDF·이미지 등, 여러 개 가능)</label>
            <input type="file" multiple data-testid="u-file" onChange={onUpload} />
            {uploading && <div className="muted small">업로드 중…</div>}
            {files.map((fi, i) => (
              <div key={i} className="io" style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span>📎 {fi.name}</span>
                <button type="button" className="btn ghost sm" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>삭제</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn primary" data-testid="pub-add-submit">등록</button>
              <button type="button" className="btn ghost" data-testid="pub-add-cancel" onClick={() => { setAdding(false); setFiles([]); }}>취소</button>
            </div>
          </div>
        </form>
      )}


      <Card title="최근 5년 실적 현황" testid="pub-yeartable">
        <table className="tbl" style={{ minWidth: 0 }}>
          <thead><tr><th>성과지표</th>{recentYears.map((y) => <th key={y} style={{ textAlign: "center" }}>{y}</th>)}<th style={{ textAlign: "center" }}>합계</th></tr></thead>
          <tbody>
            {KINDS.map((k) => {
              const counts = recentYears.map((y) => countOf(k, y));
              const sum = counts.reduce((a, b) => a + b, 0);
              return (
                <tr key={k}>
                  <th style={{ textAlign: "left", whiteSpace: "nowrap" }}>{k}</th>
                  {counts.map((c, i) => <td key={i} style={{ textAlign: "center" }} className={c ? "" : "muted"}>{c || "-"}</td>)}
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{sum || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>


      <DataTable rows={items} cols={cols} testid="pub-table" searchPlaceholder="제목·저자·학술지 검색…"
        searchKeys={(u) => [u.title, u.authors, u.funding].join(" ")} pageSize={12} defaultSort="year" defaultDir={-1}
        chips={{ get: seriesOf, values: KINDS }} empty="실적 없음" />
    </div>
  );
}
