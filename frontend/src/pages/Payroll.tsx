import { useEffect, useMemo, useState } from "react";
import { yearKST } from "../lib/date";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card, won } from "../ui/kit";
import { useConfig } from "../api/config";


interface User { id: string; name: string; role: string; grade: string; join_date: string | null; exit_date: string | null; }
interface Project { id: string; code: string; category: string; agency: string; start: string | null; end: string | null; }
interface Part { uid: string; project_id: string; rate_pct: number; month: string; }
interface Slip { id: string; uid: string; project_id: string; month: string; amount: number; status: string; }
interface Budget { project_id: string; category: string; allocated: number; spent: number; }

const GRADE_RATES_FB: Record<string, number> = { "박사과정": 2500000, "석사과정": 2200000, "학사과정": 1000000, "교수": 0 };
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const TABS = [{ k: "plan", t: "참여율 편성" }, { k: "pay", t: "학생별 지급" }, { k: "exec", t: "과제별 집행" }];

export default function Payroll() {
  const { me } = useAuth();
  const GRADE_RATES = useConfig<Record<string, number>>("grade_rates", GRADE_RATES_FB);
  const isAdmin = !!me && (["prof", "staff"].includes(me.role) || !!me.delegated_admin);
  const yearNow = yearKST();
  const years = [yearNow + 1, yearNow, yearNow - 1, yearNow - 2].map(String);
  const [tab, setTab] = useState("plan");
  const [year, setYear] = useState(String(yearNow));
  const [pid, setPid] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});  // uid -> { "01": rate_pct } (선택 과제)
  const [slips, setSlips] = useState<Slip[]>([]);   // 연도 전체 명세
  const [detail, setDetail] = useState<{ uid: string; mm: string } | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const students = useMemo(() => users.filter((u) => ["phd", "master", "under"].includes(u.role)), [users]);
  const grade = (u: User) => u.grade || (u.role === "phd" ? "박사과정" : u.role === "master" ? "석사과정" : "학사과정");
  const rate = (u: User) => GRADE_RATES[grade(u)] || 0;
  const codeOf = (id: string) => projects.find((p) => p.id === id)?.code || "—";
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name || id.slice(0, 6);
  // 재직 기간(입실~퇴실) 밖의 월은 잠금 → 중간 입·퇴사 자연 반영
  const active = (u: User, mm: string) => { const ym = `${year}-${mm}`; if (u.join_date && ym < u.join_date.slice(0, 7)) return false; if (u.exit_date && ym > u.exit_date.slice(0, 7)) return false; return true; };
  const stuBudget = (projId: string) => budgets.find((b) => b.project_id === projId && b.category === "학생인건비") || { allocated: 0, spent: 0 };
  // 과제 기간이 선택 연도를 포함하는지 / 특정 월이 과제 기간 내인지
  const projInYear = (p: Project) => (!p.start || p.start.slice(0, 4) <= year) && (!p.end || p.end.slice(0, 4) >= year);
  const monthInProj = (p: Project | undefined, mm: string) => !!p && (!p.start || `${year}-${mm}` >= p.start.slice(0, 7)) && (!p.end || `${year}-${mm}` <= p.end.slice(0, 7));
  const yearProjects = projects.filter(projInYear);
  const curProj = projects.find((p) => p.id === pid);

  async function loadBase() {
    try {
      setUsers((await api.get<User[]>("/members/users")).data);
      setProjects((await api.get<Project[]>("/projects/projects?kind=grant")).data.filter((p) => p.category !== "세미나"));
      if (isAdmin) setBudgets((await api.get<Budget[]>("/funds/budgets")).data);   // 예산은 관리자만
    } catch (e) { setErr(apiError(e)); }
  }
  async function loadPlan() {
    if (!pid || !year) { setMatrix({}); return; }
    try {
      const ps = (await api.get<Part[]>(`/funds/participations/year?year=${year}&project_id=${pid}`)).data;
      const mx: Record<string, Record<string, number>> = {};
      ps.forEach((p) => { (mx[p.uid] = mx[p.uid] || {})[p.month.slice(5, 7)] = p.rate_pct; });
      setMatrix(mx);
    } catch (e) { setErr(apiError(e)); }
  }
  async function loadSlips() {
    try { setSlips((await api.get<Slip[]>(`/funds/payslips?year=${year}`)).data); } catch (e) { setErr(apiError(e)); }
  }
  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (isAdmin) loadPlan(); /* eslint-disable-next-line */ }, [pid, year, isAdmin]);
  useEffect(() => { loadSlips(); /* eslint-disable-next-line */ }, [year]);
  useEffect(() => { const yp = projects.filter(projInYear); setPid((p) => (p && yp.some((x) => x.id === p)) ? p : (yp[0]?.id || "")); /* eslint-disable-next-line */ }, [projects, year]);

  function setCell(uid: string, mm: string, v: number) {
    setMatrix((m) => ({ ...m, [uid]: { ...(m[uid] || {}), [mm]: Math.max(0, Math.min(100, v || 0)) } }));
  }
  async function savePlan() {
    setErr(""); setMsg("");
    const rows = students.map((u) => ({ uid: u.id, grade: grade(u), monthly: matrix[u.id] || {} }));
    try {
      await api.post("/funds/payroll/year-matrix", { year, project_id: pid, rows, grade_rates: GRADE_RATES });
      setMsg(`${codeOf(pid)} ${year}년 참여율 저장됨`); loadPlan(); loadSlips();
    } catch (e) { setErr(apiError(e)); }
  }
  async function confirmMonth(mm: string) {
    setErr(""); setMsg("");
    try { const r = await api.post(`/funds/payroll/confirm?month=${year}-${mm}`); setMsg(r.data.detail); loadSlips(); loadBase(); }
    catch (e) { setErr(apiError(e)); }
  }

  // ===== 집계 =====
  const planAmt = (u: User, mm: string) => Math.round(rate(u) * (Number(matrix[u.id]?.[mm]) || 0) / 100);
  const planAnnual = students.reduce((a, u) => a + MONTHS.reduce((s, mm) => s + planAmt(u, mm), 0), 0);   // 선택 과제 연 편성(예정)
  const payAmt = (uid: string, mm: string) => slips.filter((s) => s.uid === uid && s.month === `${year}-${mm}`).reduce((a, s) => a + s.amount, 0);
  const payMonthTotal = (mm: string) => students.reduce((a, u) => a + payAmt(u.id, mm), 0);
  const payAnnual = (uid: string) => MONTHS.reduce((a, mm) => a + payAmt(uid, mm), 0);
  const monthPend = (mm: string) => slips.filter((s) => s.month === `${year}-${mm}` && s.status === "예정").length;
  const payStudents = students.filter((u) => MONTHS.some((mm) => payAmt(u.id, mm) > 0));
  const projPend = (projId: string) => slips.filter((s) => s.project_id === projId && s.status === "예정").reduce((a, s) => a + s.amount, 0);

  if (!isAdmin) {
    const my = slips.filter((s) => s.uid === me?.id);
    return (
      <div data-testid="page-payroll">
        <PageHeader crumb="연구비 › 학생인건비" title="학생인건비 (내 지급 내역)" action={<select value={year} onChange={(e) => setYear(e.target.value)} style={{ width: "auto", fontWeight: 700 }}>{years.map((y) => <option key={y}>{y}</option>)}</select>} />
        <Card title={`${year}년 월별 지급`}>
          <table className="tbl"><thead><tr><th>과제</th>{MONTHS.map((m) => <th key={m} style={{ textAlign: "center" }}>{Number(m)}월</th>)}</tr></thead>
            <tbody>
              {Array.from(new Set(my.map((s) => s.project_id))).map((projId) => (
                <tr key={projId}><td><b>{codeOf(projId)}</b></td>{MONTHS.map((m) => { const s = my.find((x) => x.project_id === projId && x.month === `${year}-${m}`); return <td key={m} style={{ textAlign: "center" }} className={s ? "" : "muted"}>{s ? <>{won(s.amount)}<div className="muted small">{s.status}</div></> : "—"}</td>; })}</tr>
              ))}
              {!my.length && <tr><td colSpan={13} className="muted">지급 내역 없음</td></tr>}
            </tbody></table>
        </Card>
      </div>
    );
  }

  const sb = stuBudget(pid);
  return (
    <div data-testid="page-payroll">
      <PageHeader crumb="연구비 › 학생인건비" title="학생인건비 관리" />
      {err && <div className="form-err" data-testid="pay-error">{err}</div>}
      {msg && <div className="io" data-testid="pay-msg">{msg}</div>}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className="fchips" data-testid="pay-tabs" style={{ marginBottom: 0 }}>
            {TABS.map((x) => <button key={x.k} className={"chip" + (tab === x.k ? " on" : "")} data-testid={`pay-tab-${x.k}`} onClick={() => setTab(x.k)}>{x.t}</button>)}
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ margin: 0 }}>연도</label>
            <select value={year} data-testid="pay-year" onChange={(e) => setYear(e.target.value)} style={{ width: "auto", fontWeight: 700 }}>{years.map((y) => <option key={y}>{y}</option>)}</select>
            {tab === "plan" && <><label style={{ margin: 0, marginLeft: 6 }}>과제</label>
              <select value={pid} data-testid="pay-project" onChange={(e) => setPid(e.target.value)} style={{ width: "auto", fontWeight: 700 }}>{yearProjects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}{!yearProjects.length && <option value="">{year}년 과제 없음</option>}</select></>}
          </span>
        </div>
      </Card>

      {/* ===== 탭1: 참여율 편성 ===== */}
      {tab === "plan" && (
        <Card title={`${year}년 참여율 편성 — ${codeOf(pid)}`} extra={<span className="pill">재직기간 밖 월은 잠금</span>}>
          <div data-testid="pay-budbar" style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "2px 2px 12px", fontSize: 13 }}>
            <span>학생인건비 예산 <b>{won(sb.allocated)}</b></span>
            <span className="muted">지급확정 집행 <b>{won(sb.spent)}</b></span>
            <span>잔여 <b style={{ color: sb.allocated - sb.spent < 0 ? "var(--bad)" : "var(--ok)" }}>{won(sb.allocated - sb.spent)}</b></span>
            <span style={{ marginLeft: "auto" }}>이 과제 {year}년 편성(예정) <b style={{ color: planAnnual > sb.allocated - sb.spent ? "var(--bad)" : "var(--brand)" }}>{won(planAnnual)}</b>{planAnnual > sb.allocated - sb.spent && <span className="badge s-bad" style={{ marginLeft: 6 }}>잔여 예산 초과</span>}</span>
          </div>
          <div className="card scroll" style={{ margin: 0, border: "none" }}>
            <table className="tbl" data-testid="pay-matrix">
              <thead><tr><th>구성원</th>{MONTHS.map((m) => <th key={m} style={{ textAlign: "center" }}>{Number(m)}월</th>)}<th>연 인건비</th></tr></thead>
              <tbody>
                {students.map((u) => (
                  <tr key={u.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{u.name} <span className="pill">{grade(u)}</span></td>
                    {MONTHS.map((mm) => {
                      const outProj = !monthInProj(curProj, mm);
                      const lock = !active(u, mm) || outProj;
                      return (
                        <td key={mm} style={{ textAlign: "center", padding: "4px 3px", background: lock ? "var(--soft)" : undefined }}>
                          {lock ? <span className="muted small" title={outProj ? "과제 기간 외" : "재직기간 외"}>–</span> :
                            <input type="number" min={0} max={100} style={{ width: 46, textAlign: "center", margin: 0, padding: "5px 2px" }}
                              data-testid={`pm-${u.id}-${mm}`} value={matrix[u.id]?.[mm] ?? ""} placeholder="0"
                              onChange={(e) => setCell(u.id, mm, Number(e.target.value))} />}
                        </td>
                      );
                    })}
                    <td style={{ whiteSpace: "nowrap" }}><b style={{ color: "var(--brand)" }}>{won(MONTHS.reduce((s, mm) => s + planAmt(u, mm), 0))}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn primary" data-testid="pay-save" onClick={savePlan}>{year}년 참여율 저장</button>
            <span className="muted small">저장 시 월별 인건비 명세(예정) 자동 생성 · 지급확정은 [학생별 지급] 탭</span>
          </div>
        </Card>
      )}

      {/* ===== 탭2: 학생별 지급 ===== */}
      {tab === "pay" && (
        <Card title={`${year}년 학생별 월 지급액`} extra={<span className="muted small">셀 클릭 시 과제별 분해 · 전 과제 합산</span>}>
          <div className="card scroll" style={{ margin: 0, border: "none" }}>
            <table className="tbl" data-testid="pay-table">
              <thead>
                <tr><th>구성원</th>{MONTHS.map((m) => <th key={m} style={{ textAlign: "center" }}>{Number(m)}월</th>)}<th>연 합계</th></tr>
                <tr style={{ background: "var(--soft)" }}><th className="muted small">지급확정</th>{MONTHS.map((mm) => <th key={mm} style={{ textAlign: "center" }}>{monthPend(mm) > 0 ? <button className="btn ghost sm" data-testid={`pay-confirm-${mm}`} style={{ padding: "2px 6px" }} onClick={() => confirmMonth(mm)}>확정 {monthPend(mm)}</button> : <span className="muted small">{payMonthTotal(mm) ? "완료" : "—"}</span>}</th>)}<th></th></tr>
              </thead>
              <tbody>
                {payStudents.map((u) => (
                  <tr key={u.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{u.name} <span className="pill">{grade(u)}</span></td>
                    {MONTHS.map((mm) => { const amt = payAmt(u.id, mm); return (
                      <td key={mm} style={{ textAlign: "center", cursor: amt ? "pointer" : undefined }} onClick={() => amt && setDetail({ uid: u.id, mm })} data-testid={`pay-${u.id}-${mm}`} className={amt ? "" : "muted"}>{amt ? won(amt) : "–"}</td>
                    ); })}
                    <td style={{ whiteSpace: "nowrap" }}><b style={{ color: "var(--brand)" }}>{won(payAnnual(u.id))}</b></td>
                  </tr>
                ))}
                {!payStudents.length && <tr><td colSpan={14} className="muted">지급 내역 없음 — [참여율 편성]에서 먼저 입력하세요</td></tr>}
                <tr style={{ fontWeight: 700, background: "var(--soft)" }}><td>월 합계</td>{MONTHS.map((mm) => <td key={mm} style={{ textAlign: "center", fontSize: 11 }}>{payMonthTotal(mm) ? won(payMonthTotal(mm)) : "—"}</td>)}<td>{won(students.reduce((a, u) => a + payAnnual(u.id), 0))}</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ===== 탭3: 과제별 집행(예산 연동) ===== */}
      {tab === "exec" && (
        <Card title={`${year}년 과제별 학생인건비 집행`} extra={<span className="muted small">예산 학생인건비 비목과 연동</span>}>
          <table className="tbl" data-testid="exec-table">
            <thead><tr><th>과제</th><th>편성(학생인건비)</th><th>지급확정 집행</th><th>예정(미확정)</th><th>잔여</th><th>집행률</th></tr></thead>
            <tbody>
              {yearProjects.map((p) => { const b = stuBudget(p.id); const pend = projPend(p.id); const r = b.allocated ? Math.round(b.spent / b.allocated * 100) : 0; return (
                <tr key={p.id}>
                  <td><b>{p.code}</b></td>
                  <td>{won(b.allocated)}</td>
                  <td>{won(b.spent)}</td>
                  <td className="muted">{pend ? won(pend) : "—"}</td>
                  <td style={{ color: b.allocated - b.spent < 0 ? "var(--bad)" : "inherit" }}>{won(b.allocated - b.spent)}</td>
                  <td><div className="bar" style={{ width: 80, display: "inline-block", verticalAlign: "middle" }}><i style={{ width: `${Math.min(r, 100)}%`, background: r > 90 ? "var(--bad)" : "var(--brand)" }} /></div> {r}%</td>
                </tr>
              ); })}
            </tbody>
          </table>
          <div className="muted small" style={{ marginTop: 10 }}>지급확정 시 해당 과제 학생인건비 집행액이 자동 반영되며, [예산] 화면에서도 동일하게 표시됩니다.</div>
        </Card>
      )}

      <Card title="학력등급별 기준단가(월)">
        <table className="tbl"><thead><tr><th>등급</th><th>월 단가</th></tr></thead>
          <tbody>{Object.entries(GRADE_RATES).filter(([g]) => g !== "교수").map(([g, r]) => <tr key={g}><td>{g}</td><td>{won(r)}</td></tr>)}</tbody></table>
      </Card>

      {/* 과제별 분해 팝업 */}
      {detail && (() => {
        const rows = slips.filter((s) => s.uid === detail.uid && s.month === `${year}-${detail.mm}`);
        return (
          <div className="modal-ovl" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
            <div className="modal" data-testid="pay-detail" style={{ width: 420 }}>
              <div className="modal-h"><b>{nameOf(detail.uid)} · {year}-{detail.mm} 지급 분해</b><button className="btn ghost sm" onClick={() => setDetail(null)}>✕</button></div>
              <div className="modal-b">
                <table className="tbl"><thead><tr><th>과제</th><th>금액</th><th>상태</th></tr></thead>
                  <tbody>
                    {rows.map((s) => <tr key={s.id}><td>{codeOf(s.project_id)}</td><td>{won(s.amount)}</td><td><span className={"badge " + (s.status === "지급" ? "s-ok" : "s-info")}>{s.status}</span></td></tr>)}
                    <tr style={{ fontWeight: 700, background: "var(--soft)" }}><td>합계</td><td>{won(rows.reduce((a, s) => a + s.amount, 0))}</td><td></td></tr>
                  </tbody></table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
