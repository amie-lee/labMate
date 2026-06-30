import { useEffect, useState } from "react";
import { api, apiError } from "../api/client";
import { confirmDialog } from "../ui/dialog";
import { useAuth } from "../auth/AuthContext";

interface User {
  id: string; email: string; name: string; role: string; position: string; grade: string;
  name_en: string; birth: string | null; gender: string; join_date: string | null; exit_date: string | null;
  phone: string; dept: string; student_id: string; researcher_no: string; degree: string; major: string; grad_year: string;
  bank_account: string; note: string;
  delegated_admin: boolean; must_change_password: boolean; active: boolean;
}
const ROLES = ["prof", "phd", "master", "under", "staff", "admin"];
const ROLE_KO: Record<string, string> = { prof: "지도교수", phd: "박사과정", master: "석사과정", under: "학사과정", staff: "행정", admin: "관리자" };
const EMPTY = {
  email: "", name: "", role: "under", position: "", grade: "", name_en: "", birth: "", gender: "",
  join_date: "", exit_date: "", phone: "", dept: "", student_id: "", researcher_no: "", degree: "", major: "", grad_year: "", bank_account: "", note: "",
  temp_password: "labmate123",
};

export default function Members() {
  const { canManageUsers, me } = useAuth();
  // 위임 학생 권한상승 방지 — 교수/관리자 계정·위임·역할 변경 차단
  const isRealAdmin = !!me && (["prof", "staff", "admin"].includes(me.role) || !!me.delegated_admin);   // 위임 학생도 구성원 전체 관리 가능
  const canActOn = (u: User) => canManageUsers && u.id !== me?.id && (isRealAdmin || !["prof", "staff", "admin"].includes(u.role));
  const [users, setUsers] = useState<User[]>([]);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState("");
  const [detail, setDetail] = useState<User | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const up = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function load() {
    try { setUsers((await api.get<User[]>("/members/users")).data); }
    catch (e) { setErr(apiError(e)); }
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...EMPTY }); setEditId(""); setAdding(true); }
  function editUser(u: User) {
    setForm({
      email: u.email, name: u.name, role: u.role, position: u.position || "", grade: u.grade || "",
      name_en: u.name_en || "", birth: u.birth || "", gender: u.gender || "", join_date: u.join_date || "", exit_date: u.exit_date || "",
      phone: u.phone || "", dept: u.dept || "", student_id: u.student_id || "", researcher_no: u.researcher_no || "",
      degree: u.degree || "", major: u.major || "", grad_year: u.grad_year || "", bank_account: u.bank_account || "", note: u.note || "",
      temp_password: "",
    });
    setEditId(u.id); setAdding(true); setDetail(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeForm() { setAdding(false); setEditId(""); setForm({ ...EMPTY }); }
  async function saveUser(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const payload: any = { ...form };
    for (const k of ["birth", "join_date", "exit_date"]) if (!payload[k]) delete payload[k];
    try {
      if (editId) {
        if (!payload.temp_password) delete payload.temp_password;   // 빈칸이면 비밀번호 유지
        delete payload.email;                                       // 로그인 ID 변경 불가
        await api.patch(`/members/users/${editId}`, payload);
      } else {
        await api.post("/members/users", payload);
      }
      closeForm(); load();
    } catch (e) { setErr(apiError(e)); }
  }
  async function toggleDelegate(u: User) {
    try { await api.patch(`/members/users/${u.id}`, { delegated_admin: !u.delegated_admin }); load(); } catch (e) { setErr(apiError(e)); }
  }
  async function toggleActive(u: User) {
    if (u.active && !await confirmDialog(`${u.name} 계정을 비활성화(오프보딩)할까요?`)) return;
    try { await api.patch(`/members/users/${u.id}`, { active: !u.active }); load(); } catch (e) { setErr(apiError(e)); }
  }
  async function delUser(u: User) {
    if (!await confirmDialog(`${u.name}(${u.email}) 구성원을 완전히 삭제할까요? 되돌릴 수 없습니다.`, { danger: true })) return;
    try { await api.delete(`/members/users/${u.id}`); load(); } catch (e) { setErr(apiError(e)); }
  }

  return (
    <div data-testid="page-members">
      <div className="page-head">
        <div><div className="crumb">인사 › 구성원</div><h1>구성원</h1></div>
        {canManageUsers && <button className="btn primary" data-testid="member-add-open" onClick={() => (adding ? closeForm() : openNew())}>+ 구성원 추가</button>}
      </div>
      {err && <div className="form-err" data-testid="member-error">{err}</div>}

      {adding && (
        <form className="card" onSubmit={saveUser} data-testid="member-form" style={{ marginBottom: 12 }}>
          <div className="card-h"><b>{editId ? "구성원 수정" : "구성원 추가"}</b></div>
          <div className="bd grid2">
            <div className="fsec first">신원</div>
            <div><label>이름 *</label><input data-testid="m-name" value={form.name} onChange={(e) => up("name", e.target.value)} /></div>
            <div><label>영문이름</label><input data-testid="m-nameEn" value={form.name_en} onChange={(e) => up("name_en", e.target.value)} /></div>
            <div><label>생년월일</label><input type="date" value={form.birth} onChange={(e) => up("birth", e.target.value)} /></div>
            <div><label>성별</label><select value={form.gender} onChange={(e) => up("gender", e.target.value)}><option value="">(선택)</option><option>남</option><option>여</option></select></div>
            <div><label>휴대폰</label><input value={form.phone} onChange={(e) => up("phone", e.target.value)} /></div>
            <div className="fsec">계정</div>
            <div><label>이메일 *{editId && <span className="muted small"> (변경 불가)</span>}</label><input data-testid="m-email" value={form.email} disabled={!!editId} onChange={(e) => up("email", e.target.value)} /></div>
            <div><label>임시 비밀번호{editId && <span className="muted small"> (입력 시 초기화)</span>}</label><input data-testid="m-temp" value={form.temp_password} placeholder={editId ? "변경 시에만 입력" : ""} onChange={(e) => up("temp_password", e.target.value)} /></div>
            <div><label>입실(입사)일</label><input type="date" value={form.join_date} onChange={(e) => up("join_date", e.target.value)} /></div>
            <div><label>퇴실(퇴사)일 <span className="muted small">(비활성화 시 자동 기록)</span></label><input type="date" value={form.exit_date} onChange={(e) => up("exit_date", e.target.value)} /></div>
            <div className="fsec">소속</div>
            <div><label>학과</label><input data-testid="m-dept" value={form.dept} onChange={(e) => up("dept", e.target.value)} /></div>
            <div><label>학번</label><input data-testid="m-stid" value={form.student_id} onChange={(e) => up("student_id", e.target.value)} /></div>
            <div><label>직급 <span className="muted small">(인건비 등급 자동 적용)</span></label><select data-testid="m-role" value={form.role} onChange={(e) => up("role", e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_KO[r]}</option>)}</select></div>
            <div className="fsec">과제 정보</div>
            <div><label>과학기술인번호</label><input data-testid="m-stno" value={form.researcher_no} onChange={(e) => up("researcher_no", e.target.value)} /></div>
            <div><label>최종학위</label><input data-testid="m-degree" value={form.degree} onChange={(e) => up("degree", e.target.value)} placeholder="예: 석사" /></div>
            <div><label>전공</label><input data-testid="m-major" value={form.major} onChange={(e) => up("major", e.target.value)} /></div>
            <div><label>학위취득년도</label><input value={form.grad_year} onChange={(e) => up("grad_year", e.target.value)} placeholder="예: 2023" /></div>
            <div style={{ gridColumn: "1 / -1" }}><label>비고</label><input value={form.note} onChange={(e) => up("note", e.target.value)} /></div>
          </div>
          <div className="bd" style={{ borderTop: "1px solid var(--line2)", display: "flex", gap: 8 }}>
            <button className="btn primary" data-testid="member-add-submit">{editId ? "저장" : "추가 (첫 로그인 시 비밀번호 변경 강제)"}</button>
            <button type="button" className="btn ghost" onClick={closeForm}>취소</button>
          </div>
        </form>
      )}

      <div className="card scroll">
        <table className="tbl" data-testid="member-table">
          <thead><tr><th>이름</th><th>직급</th><th>전공</th><th>최종학위</th><th>이메일</th><th>상태</th>{canManageUsers && <th>관리</th>}</tr></thead>
          <tbody>
            {users.filter((u) => u.role !== "admin").map((u) => (
              <tr key={u.id}>
                <td><a className="lnk" style={{ fontWeight: 700 }} data-testid={`member-open-${u.email}`} onClick={() => setDetail(u)}>{u.name}</a>{u.delegated_admin ? <span className="badge s-pur" style={{ marginLeft: 6 }}>행정위임</span> : ""}</td>
                <td>{ROLE_KO[u.role] || u.role}</td>
                <td className="muted">{u.major || "—"}</td>
                <td className="muted">{u.degree || "—"}</td>
                <td className="muted">{u.email}</td>
                <td><span className={"badge " + (!u.active ? "s-mute" : u.must_change_password ? "s-wait" : "s-ok")}>{!u.active ? "비활성" : u.must_change_password ? "비번변경 필요" : "정상"}</span></td>
                {canManageUsers && (
                  <td>
                    {canActOn(u) && <button className="btn ghost sm" data-testid={`m-edit-${u.email}`} onClick={() => editUser(u)}>수정</button>}{" "}
                    {isRealAdmin && !["prof", "staff", "admin"].includes(u.role) && <button className="btn ghost sm" data-testid={`m-delegate-${u.email}`} onClick={() => toggleDelegate(u)}>{u.delegated_admin ? "위임해제" : "행정위임"}</button>}{" "}
                    {canActOn(u) && <button className="btn ghost sm" data-testid={`m-active-${u.email}`} onClick={() => toggleActive(u)}>{u.active ? "비활성화" : "활성화"}</button>}{" "}
                    {canActOn(u) && <button className="btn ghost sm" data-testid={`m-del-${u.email}`} style={{ color: "var(--bad)" }} onClick={() => delUser(u)}>삭제</button>}
                    {!canActOn(u) && <span className="muted small">—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="modal-ovl" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="modal" data-testid="member-detail" style={{ width: 560 }}>
            <div className="modal-h"><b>{detail.name} <span className="muted small">{ROLE_KO[detail.role]}</span></b><span style={{ display: "flex", gap: 6 }}>{canActOn(detail) && <button className="btn ghost sm" data-testid="member-detail-edit" onClick={() => editUser(detail)}>수정</button>}<button className="btn ghost sm" onClick={() => setDetail(null)}>✕</button></span></div>
            <div className="modal-b">
              <table className="tbl"><tbody>
                {[
                  ["영문이름", detail.name_en], ["성별", detail.gender], ["생년월일", detail.birth], ["휴대폰", detail.phone],
                  ["이메일", detail.email], ["입실(입사)일", detail.join_date], ["퇴실(퇴사)일", detail.exit_date],
                  ["학과", detail.dept], ["학번", detail.student_id], ["과학기술인번호", detail.researcher_no],
                  ["최종학위", detail.degree], ["전공", detail.major], ["학위취득년도", detail.grad_year],
                  ["비고", detail.note],
                ].map(([k, v]) => <tr key={k as string}><th style={{ width: 130 }}>{k}</th><td>{v || "—"}</td></tr>)}
              </tbody></table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
