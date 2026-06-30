import { useEffect, useState } from "react";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader, Card } from "../ui/kit";
import { useConfig } from "../api/config";
import { confirmDialog } from "../ui/dialog";


interface Dev { id: string; rack: string; pos: number; size: number; type: string; name: string; ip: string; note: string; }
interface Rack { id: string; name: string; u_height: number; order: number; }
const TYPES_FB = ["서버", "스위치", "스토리지", "GPU", "기타"];
const DCOL: Record<string, string> = { "서버": "#3f5d7d", "GPU": "#3a9b9b", "스위치": "#2e9e6b", "스토리지": "#c2891b", "VPN": "#7b66c4", "KVM": "#5a6478" };

export default function Infra() {
  const { me } = useAuth();
  const TYPES = useConfig<string[]>("device_types", TYPES_FB);
  const defU = Number(useConfig<any>("rack_max_u", 42)) || 42;
  const canManage = !!me && (["prof", "staff", "admin"].includes(me.role) || !!me.delegated_admin);
  const [items, setItems] = useState<Dev[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState({ rack: "", pos: 1, size: 1, type: "서버", name: "", ip: "", note: "" });
  const [rackForm, setRackForm] = useState<null | { id?: string; name: string; u_height: number }>(null);
  const [drag, setDrag] = useState<Dev | null>(null);
  const [over, setOver] = useState<string>("");   // `${rack}:${u}`

  async function load() {
    try {
      setItems((await api.get<Dev[]>("/resource/devices")).data);
      const rk = (await api.get<Rack[]>("/resource/racks")).data;
      setRacks(rk);
      setForm((f) => ({ ...f, rack: f.rack || rk[0]?.name || "" }));
    } catch (e) { setErr(apiError(e)); }
  }
  useEffect(() => { load(); }, []);

  const blankDev = () => ({ rack: racks[0]?.name || "", pos: 1, size: 1, type: "서버", name: "", ip: "", note: "" });
  function openNewDevice() { setEditId(""); setForm((f) => ({ ...blankDev(), rack: f.rack || racks[0]?.name || "" })); setAdding(true); }
  function editDevice(d: Dev) {
    setEditId(d.id);
    setForm({ rack: d.rack, pos: d.pos, size: d.size, type: d.type, name: d.name, ip: d.ip || "", note: d.note || "" });
    setAdding(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeDevice() { setAdding(false); setEditId(""); }
  async function saveDevice(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const payload = { ...form, pos: Number(form.pos), size: Number(form.size) };
    try {
      if (editId) await api.patch(`/resource/devices/${editId}`, payload);
      else await api.post("/resource/devices", { ...payload, spec: {} });
      closeDevice(); setForm(blankDev()); load();
    } catch (e) { setErr(apiError(e)); }
  }
  async function delDevice(d: Dev): Promise<boolean> {
    if (!await confirmDialog(`장비 "${d.name}"을(를) 삭제할까요?`, { danger: true })) return false;
    try { await api.delete(`/resource/devices/${d.id}`); load(); return true; } catch (e) { setErr(apiError(e)); return false; }
  }
  async function move(devId: string, rackName: string, u: number) {
    const d = items.find((x) => x.id === devId); if (!d) return;
    const max = racks.find((r) => r.name === rackName)?.u_height || defU;
    const pos = Math.max(1, Math.min(u, max - (d.size || 1) + 1));
    if (d.rack === rackName && d.pos === pos) return;
    setErr("");
    try { await api.patch(`/resource/devices/${devId}`, { rack: rackName, pos }); load(); }
    catch (e) { setErr(apiError(e)); }
  }

  async function saveRack() {
    if (!rackForm) return; setErr("");
    if (!rackForm.name.trim()) { setErr("랙 이름을 입력하세요"); return; }
    const payload = { name: rackForm.name.trim(), u_height: Number(rackForm.u_height) || defU };
    try {
      if (rackForm.id) await api.patch(`/resource/racks/${rackForm.id}`, payload);
      else await api.post("/resource/racks", payload);
      setRackForm(null); load();
    } catch (e) { setErr(apiError(e)); }
  }
  async function delRack(r: Rack) {
    if (!await confirmDialog(`랙 "${r.name}"을(를) 삭제할까요?`, { danger: true })) return;
    try { await api.delete(`/resource/racks/${r.id}`); load(); } catch (e) { setErr(apiError(e)); }
  }

  const types = [...new Set(items.map((d) => d.type))];

  return (
    <div data-testid="page-infra">
      <PageHeader crumb="연구실 › 인프라" title="인프라" action={
        canManage ? <span style={{ display: "flex", gap: 6 }}>
          <button className="btn ghost" data-testid="rack-add-open" onClick={() => setRackForm({ name: "", u_height: defU })}>+ 랙 추가</button>
          <button className="btn primary" data-testid="dev-add-open" onClick={() => (adding ? closeDevice() : openNewDevice())}>+ 장비 등록</button>
        </span> : <span className="muted small">조회 전용</span>
      } />
      {err && <div className="form-err" data-testid="dev-error">{err}</div>}

      {rackForm && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); saveRack(); }} data-testid="rack-form">
          <div className="card-h"><b>{rackForm.id ? "랙 수정" : "랙 추가"}</b></div>
          <div className="bd grid2">
            <div><label>랙 이름</label><input data-testid="rk-name" value={rackForm.name} onChange={(e) => setRackForm({ ...rackForm, name: e.target.value })} placeholder="예: R5" /></div>
            <div><label>랙 크기(U)</label><input data-testid="rk-u" type="number" min={1} value={rackForm.u_height} onChange={(e) => setRackForm({ ...rackForm, u_height: Number(e.target.value) })} /></div>
          </div>
          <div className="bd" style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" data-testid="rack-add-submit">{rackForm.id ? "저장" : "랙 추가"}</button>
            <button type="button" className="btn ghost" onClick={() => setRackForm(null)}>취소</button>
          </div>
        </form>
      )}
      {adding && (
        <form className="card" onSubmit={saveDevice} data-testid="dev-form">
          <div className="card-h"><b>{editId ? "장비 수정" : "장비 등록"}</b></div>
          <div className="bd grid2">
            <div><label>랙</label><select data-testid="d-rack" value={form.rack} onChange={(e) => setForm({ ...form, rack: e.target.value })}>{racks.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div>
            <div><label>종류</label><select data-testid="d-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label>장비명</label><input data-testid="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>IP주소</label><input data-testid="d-ip" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} /></div>
            <div><label>위치(시작 U)</label><input data-testid="d-pos" type="number" value={form.pos} onChange={(e) => setForm({ ...form, pos: Number(e.target.value) })} /></div>
            <div><label>크기(U)</label><input data-testid="d-size" type="number" value={form.size} onChange={(e) => setForm({ ...form, size: Number(e.target.value) })} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label>비고</label><input data-testid="d-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="예: 보증 만료 2026-12 / 담당자 비상연락" /></div>
          </div>
          <div className="bd" style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" data-testid="dev-add-submit">{editId ? "저장" : "등록"}</button>
            <button type="button" className="btn ghost" data-testid="dev-add-cancel" onClick={closeDevice}>취소</button>
            {editId && <button type="button" className="btn ghost" data-testid="dev-edit-del" style={{ color: "var(--bad)", marginLeft: "auto" }} onClick={async () => { const d = items.find((x) => x.id === editId); if (d && await delDevice(d)) closeDevice(); }}>삭제</button>}
          </div>
        </form>
      )}

      <Card title="랙 배치도" extra={<span className="pill">장비 {items.length}대 · 랙 {racks.length}개{canManage && " · 드래그로 이동"}</span>}>
        <div className="rk-legend">
          {types.map((t) => <span className="rk-leg" key={t}><span className="rk-leg-d" style={{ background: DCOL[t] || "#5a6478" }} />{t}</span>)}
          {!types.length && <span className="muted small">등록된 장비 없음</span>}
        </div>
        <div className="rackrow" data-testid="rack-grid" style={{ ["--rkn" as any]: Math.min(racks.length, 5) }}>
          {racks.map((rk) => {
            const UTOP = rk.u_height;
            const devs = items.filter((d) => d.rack === rk.name);
            const startAt: Record<number, Dev> = {}; const covered: Record<number, boolean> = {};
            devs.forEach((d) => { const top = d.pos + (d.size || 1) - 1; startAt[top] = d; for (let i = d.pos; i <= top; i++) covered[i] = true; });
            const usedU = devs.reduce((a, d) => a + (d.size || 1), 0);
            const slots: React.ReactNode[] = [];
            for (let u = UTOP; u >= 1; u--) {
              const d = startAt[u];
              if (d) {
                const sz = d.size || 1; const c = DCOL[d.type] || "#5a6478"; const h = sz * 26 + (sz - 1) * 2;
                const rng = sz > 1 ? `U${d.pos + sz - 1}–U${d.pos}` : `U${d.pos}`;
                slots.push(
                  <div key={u} className={"uslot filled" + (sz > 1 ? " multi" : "")} style={{ ["--dc" as any]: c, height: h, cursor: canManage ? "grab" : undefined }}
                    title={`${d.name} (${d.type}, ${sz}U)`} draggable={canManage} onDragStart={() => setDrag(d)} onDragEnd={() => { setDrag(null); setOver(""); }}>
                    <span className="un">{rng}</span><span className="udot" style={{ background: c }} />
                    <span className="uname">{d.name}</span>{sz > 1 && <span className="usize">{sz}U</span>}<span className="utype">{d.type}</span>
                    {canManage && <button className="uslot-x" title="수정" onClick={(e) => { e.stopPropagation(); editDevice(d); }} style={{ position: "absolute", top: 2, right: 22, background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: .7 }}>✎</button>}
                    {canManage && <button className="uslot-x" title="삭제" onClick={(e) => { e.stopPropagation(); delDevice(d); }} style={{ position: "absolute", top: 2, right: 4, background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: .7 }}>✕</button>}
                  </div>
                );
                u -= sz - 1;
              } else if (!covered[u]) {
                const key = `${rk.name}:${u}`;
                slots.push(
                  <div key={u} className={"uslot empty" + (over === key ? " uslot-over" : "")}
                    onDragOver={canManage && drag ? (e) => { e.preventDefault(); setOver(key); } : undefined}
                    onDragLeave={() => setOver((o) => o === key ? "" : o)}
                    onDrop={canManage && drag ? () => { move(drag.id, rk.name, u); setOver(""); } : undefined}>
                    <span className="un">U{u}</span><span className="uempty">{over === key ? "여기로 이동" : "빈 슬롯"}</span>
                  </div>
                );
              }
            }
            return (
              <div className="rackcab" key={rk.id}>
                <div className="rackcab-h"><b>{rk.name}</b><span className="pill">{usedU}/{UTOP}U</span></div>
                <div className="rackcab-b">{slots}</div>
                {canManage && (
                  <div className="rackcab-f" style={{ textAlign: "center", padding: "7px 0", fontSize: 12 }}>
                    <a className="lnk" data-testid={`rack-edit-${rk.name}`} style={{ cursor: "pointer" }} onClick={() => setRackForm({ id: rk.id, name: rk.name, u_height: rk.u_height })}>수정</a>
                    <span className="muted"> | </span>
                    <a className="lnk" data-testid={`rack-del-${rk.name}`} style={{ cursor: "pointer", color: "var(--bad)" }} onClick={() => delRack(rk)}>삭제</a>
                  </div>
                )}
              </div>
            );
          })}
          {!racks.length && <div className="muted">랙이 없습니다 — "+ 랙 추가"로 생성하세요</div>}
        </div>
      </Card>
    </div>
  );
}
