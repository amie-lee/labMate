import { useEffect, useState } from "react";
import { todayKST } from "../lib/date";
import { api, apiError } from "../api/client";
import { confirmDialog } from "../ui/dialog";
import { useAuth } from "../auth/AuthContext";
import { useConfig, names } from "../api/config";


interface TFile { name: string; url: string; }
interface Exp { id: string; project_id: string; category: string; subcategory: string; title: string; amount: number; status: string; by_id: string; claim_date?: string; files?: TFile[]; }
interface Proj { id: string; code: string; }
const CATS_FB = [{ name: "인건비", subs: [] }, { name: "학생인건비", subs: [] }, { name: "장비비", subs: [] }, { name: "재료비", subs: [] }, { name: "연구활동비", subs: [] }, { name: "연구수당", subs: [] }, { name: "간접비", subs: [] }];

export default function Expenses() {
  const { me } = useAuth();
  const isAdmin = !!me && (["prof", "staff"].includes(me.role) || !!me.delegated_admin);
  const BCATS = useConfig<any[]>("budget_types", CATS_FB);
  const STD = names(BCATS);
  const subsOf = (category: string): string[] => (BCATS.find((c: any) => (c.name || c) === category)?.subs) || [];
  const [items, setItems] = useState<Exp[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState("");
  const today = todayKST();
  const uname = (id: string) => users.find((u) => u.id === id)?.name || "—";
  const code = (pid: string) => projects.find((p) => p.id === pid)?.code || "—";
  const [filterPid, setFilterPid] = useState("");
  const [form, setForm] = useState({ project_id: "", category: "인건비", subcategory: "", title: "", claim_date: today, amount: 0, files: [] as TFile[] });

  async function uploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files; if (!fl || !fl.length) return;
    const fd = new FormData(); Array.from(fl).forEach((f) => fd.append("files", f));
    try { const r = await api.post<TFile[]>("/projects/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } }); setForm((f) => ({ ...f, files: [...f.files, ...r.data] })); }
    catch (err) { setErr(apiError(err)); }
    e.target.value = "";
  }

  async function load() {
    try {
      setItems((await api.get<Exp[]>("/funds/expenses")).data);
      const pr = (await api.get<Proj[]>("/projects/projects?kind=grant")).data;
      setProjects(pr);
      if (pr.length && !form.project_id) setForm((f) => ({ ...f, project_id: pr[0].id }));
      setUsers((await api.get<any[]>("/members/users")).data);
    } catch (e) { setErr(apiError(e)); }
  }
  useEffect(() => { load(); }, []);

  const EMPTY = { project_id: projects[0]?.id || "", category: "인건비", subcategory: "", title: "", claim_date: today, amount: 0, files: [] as TFile[] };
  function openForm() { setEditId(""); setForm({ ...EMPTY, project_id: form.project_id || projects[0]?.id || "" }); setAdding((v) => !v); }
  function editExpense(x: Exp) {
    setForm({ project_id: x.project_id, category: x.category, subcategory: x.subcategory || "", title: x.title, claim_date: x.claim_date || today, amount: x.amount, files: x.files || [] });
    setEditId(x.id); setAdding(true);
  }
  function closeForm() { setAdding(false); setEditId(""); setForm({ ...EMPTY, project_id: form.project_id || projects[0]?.id || "" }); }
  async function save() {
    setErr("");
    if (!form.title.trim()) { setErr("집행 내용을 입력하세요"); return; }
    if (!form.amount) { setErr("금액을 입력하세요"); return; }
    const payload = { ...form, amount: Number(form.amount) };
    try {
      if (editId) await api.put(`/funds/expenses/${editId}`, payload);
      else await api.post("/funds/expenses", payload);
      closeForm(); load();
    } catch (e) { setErr(apiError(e)); }
  }
  async function del(x: Exp) {
    if (!await confirmDialog(`집행 내역 "${x.title}"을(를) 삭제할까요? (예산 집행액도 원복됩니다)`, { danger: true })) return;
    try { await api.delete(`/funds/expenses/${x.id}`); load(); } catch (e) { setErr(apiError(e)); }
  }

  const shown = filterPid ? items.filter((x) => x.project_id === filterPid) : items;
  const total = shown.reduce((a, x) => a + x.amount, 0);

  return (
    <div data-testid="page-expenses">
      <div className="page-head">
        <div><div className="crumb">연구비 › 연구비집행</div><h1>연구비집행</h1></div>
        <button className="btn primary" data-testid="exp-add-open" onClick={openForm}>+ 집행 등록</button>
      </div>
      {err && <div className="form-err" data-testid="exp-error">{err}</div>}
      {adding && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); save(); }} data-testid="exp-form">
          <div className="card-h"><b>{editId ? "집행 내역 수정" : "집행 내역 등록"}</b></div>
          <div className="bd grid2">
            <div><label>과제</label><select data-testid="e-project" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>{projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}</select></div>
            <div><label>집행일자</label><input data-testid="e-date" type="date" value={form.claim_date} onChange={(e) => setForm({ ...form, claim_date: e.target.value })} /></div>
            <div><label>비목</label><select data-testid="e-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: "" })}>{STD.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label>세목(선택)</label>{subsOf(form.category).length ? (
              <select data-testid="e-subcategory" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })}>
                <option value="">선택…</option>{subsOf(form.category).map((s) => <option key={s}>{s}</option>)}
              </select>
            ) : (
              <input data-testid="e-subcategory" value="" disabled placeholder="세목 없음" style={{ background: "var(--soft)", cursor: "not-allowed" }} />
            )}</div>
            <div><label>집행 내용</label><input data-testid="e-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 클라우드 사용료" /></div>
            <div><label>금액(원)</label><input data-testid="e-amount" inputMode="numeric" value={form.amount ? form.amount.toLocaleString() : ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value.replace(/[^0-9]/g, "")) })} placeholder="0" /></div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>증빙 첨부</label>
              <input type="file" multiple data-testid="e-files" onChange={uploadFiles} />
              {!!form.files.length && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {form.files.map((f, i) => (
                    <span key={i} className="badge s-info">📎 {f.name}
                      <button type="button" onClick={() => setForm((ff) => ({ ...ff, files: ff.files.filter((_, j) => j !== i) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", marginLeft: 4 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="bd" style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn primary" data-testid="exp-save">{editId ? "저장" : "등록"}</button>
            <button type="button" className="btn ghost" onClick={closeForm}>취소</button>
          </div>
        </form>
      )}

      <div className="card scroll">
        <div className="card-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <b>집행 내역</b>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select data-testid="exp-filter" value={filterPid} onChange={(e) => setFilterPid(e.target.value)} style={{ width: "auto", margin: 0 }}>
              <option value="">전체 과제</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
            <span className="pill">합계 {total.toLocaleString()}원</span>
          </span>
        </div>
        <table className="tbl" data-testid="exp-table">
          <thead><tr><th>집행일자</th><th>과제</th><th>비목/세목</th><th>집행 내용</th>{isAdmin && <th>등록자</th>}<th>금액</th><th>증빙</th><th>처리</th></tr></thead>
          <tbody>
            {shown.map((x) => (
              <tr key={x.id}>
                <td className="small muted">{x.claim_date || "—"}</td>
                <td>{code(x.project_id)}</td>
                <td>{x.category}{x.subcategory ? <span className="muted small"> · {x.subcategory}</span> : ""}</td>
                <td>{x.title}</td>
                {isAdmin && <td className="muted">{uname(x.by_id)}</td>}
                <td>{x.amount.toLocaleString()}원</td>
                <td className="small">{x.files?.length ? x.files.map((f, i) => <a key={i} href={f.url} target="_blank" rel="noreferrer" title={f.name} style={{ marginRight: 6 }}>📎{x.files!.length > 1 ? i + 1 : ""}</a>) : <span className="muted">—</span>}</td>
                <td>
                  {(x.by_id === me?.id || isAdmin) && <button className="btn ghost sm" data-testid={`e-edit-${x.id}`} onClick={() => editExpense(x)}>수정</button>}{" "}
                  {(x.by_id === me?.id || isAdmin) && <button className="btn ghost sm" data-testid={`e-del-${x.id}`} style={{ color: "var(--bad)" }} onClick={() => del(x)}>삭제</button>}
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={isAdmin ? 8 : 7} className="muted" style={{ textAlign: "center", padding: 14 }}>집행 내역 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
