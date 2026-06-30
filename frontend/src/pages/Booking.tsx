import { useEffect, useState } from "react";
import { todayKST } from "../lib/date";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useConfig } from "../api/config";
import { confirmDialog } from "../ui/dialog";

interface Bk { id: string; resource: string; date: string; start: string; end: string; purpose: string; by_id: string; }
const RESOURCES_FB = ["세미나실", "회의실", "GPU 서버", "공용 워크스테이션", "실험장비"];

export default function Booking() {
  const { me } = useAuth();
  const RESOURCES = useConfig<string[]>("booking_resources", RESOURCES_FB);
  const [items, setItems] = useState<Bk[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState("");
  const today = todayKST();
  const empty = { resource: "세미나실", date: today, start: "10:00", end: "11:00", purpose: "" };
  const [form, setForm] = useState(empty);
  const canEdit = (b: Bk) => !!me && (b.by_id === me.id || me.role === "prof");   // 본인 예약 또는 교수만
  const uname = (id: string) => users.find((u) => u.id === id)?.name || "—";

  async function load() {
    try {
      setItems((await api.get<Bk[]>("/resource/bookings")).data);
      api.get<{ id: string; name: string }[]>("/members/users").then((r) => setUsers(r.data)).catch(() => {});
    } catch (e) { setErr(apiError(e)); }
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEditId(""); setForm(empty); setAdding(true); }
  function startEdit(b: Bk) { setEditId(b.id); setForm({ resource: b.resource, date: b.date, start: b.start, end: b.end, purpose: b.purpose }); setAdding(true); }

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try {
      if (editId) await api.patch(`/resource/bookings/${editId}`, form);
      else await api.post("/resource/bookings", form);
      setAdding(false); setEditId(""); setForm(empty); load();
    } catch (e) { setErr(apiError(e)); }
  }
  async function del(b: Bk) {
    if (!await confirmDialog(`${b.resource} 예약(${b.date} ${b.start}~${b.end})을 삭제할까요?`, { danger: true })) return;
    try { await api.delete(`/resource/bookings/${b.id}`); load(); } catch (e) { setErr(apiError(e)); }
  }

  return (
    <div data-testid="page-booking">
      <div className="page-head">
        <div><div className="crumb">업무 › 자원예약</div><h1>자원예약</h1></div>
        <button className="btn primary" data-testid="booking-add-open" onClick={() => (adding ? (setAdding(false), setEditId("")) : openNew())}>+ 예약</button>
      </div>
      {err && <div className="form-err" data-testid="booking-error">{err}</div>}
      {adding && (
        <form className="card" onSubmit={add} data-testid="booking-form">
          {editId && <div className="card-h"><b>예약 수정</b></div>}
          <div className="bd grid2">
            <div><label>자원</label><select data-testid="bk-resource" value={form.resource} onChange={(e) => setForm({ ...form, resource: e.target.value })}>{RESOURCES.map((r) => <option key={r}>{r}</option>)}</select></div>
            <div><label>일자</label><input data-testid="bk-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label>시작</label><input data-testid="bk-start" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
            <div><label>종료</label><input data-testid="bk-end" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label>용도</label><input data-testid="bk-purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
          </div>
          <div className="bd" style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" data-testid="booking-add-submit">{editId ? "저장" : "예약"}</button>
            <button type="button" className="btn ghost" onClick={() => { setAdding(false); setEditId(""); }}>취소</button>
          </div>
        </form>
      )}
      <div className="card">
        <table className="tbl" data-testid="booking-table">
          <thead><tr><th>자원</th><th>일자</th><th>시간</th><th>예약자</th><th>용도</th><th>작업</th></tr></thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td>{b.resource}</td><td>{b.date}</td><td>{b.start}~{b.end}</td><td>{uname(b.by_id)}</td><td>{b.purpose}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {canEdit(b) ? <>
                    <button className="btn ghost sm" data-testid={`bk-edit-${b.id}`} onClick={() => startEdit(b)}>수정</button>{" "}
                    <button className="btn ghost sm" data-testid={`bk-del-${b.id}`} style={{ color: "var(--bad)" }} onClick={() => del(b)}>삭제</button>
                  </> : <span className="muted small">—</span>}
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="muted">예약 없음</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
