// 인앱 알림 센터 — 처리 대기 항목을 주기적으로 종(bell)에 표시, 새 항목은 브라우저 데스크톱 알림
import { useEffect, useRef, useState } from "react";
import { todayKST } from "../lib/date";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../ui/icons";

interface Noti { id: string; title: string; sub: string; link: string; icon: string; }
const SEEN_KEY = "labmate.notif.seen";

function currentIdx(line: any[]): number {
  for (let i = 0; i < line.length; i++) { if (!line[i].decision) return i; if (line[i].decision === "반려") return -1; }
  return -1;
}

export function NotificationBell() {
  const { me } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Noti[]>([]);
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("labmate.notif.read") || "[]"); } catch { return []; } });
  const unread = items.filter((i) => !read.includes(i.id));
  const ref = useRef<HTMLDivElement>(null);
  const isMgr = !!me && (["prof", "staff", "admin"].includes(me.role) || !!me.delegated_admin);
  function markAllRead() { const ids = items.map((i) => i.id); setRead(ids); localStorage.setItem("labmate.notif.read", JSON.stringify(ids)); }

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch { /* */ }
    }
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function poll() {
    if (!me) return;
    const out: Noti[] = [];
    const today = todayKST();
    try {
      const appr = (await api.get<any[]>("/boards/approvals/inbox")).data || [];
      appr.forEach((a) => {
        const idx = currentIdx(a.steps);
        if (a.status === "진행" && idx >= 0 && a.steps[idx]?.uid === me.id)
          out.push({ id: "appr-" + a.id, title: "결재 요청", sub: `${a.doc_no} · ${a.title}`, link: "/approvals", icon: "doc" });
      });
    } catch { /* 비결재자 등 */ }
    try {
      const mine = (await api.get<any[]>("/boards/approvals/mine")).data || [];
      mine.forEach((a) => { if (a.status === "반려") out.push({ id: "rej-" + a.id, title: "결재 반려됨", sub: `${a.doc_no} · ${a.title}`, link: "/approvals", icon: "doc" }); });
    } catch { /* */ }
    if (isMgr) {
      try {
        const lv = (await api.get<any[]>("/attendance/leaves/inbox")).data || [];
        lv.forEach((l) => out.push({ id: "lv-" + l.id, title: "휴가 승인 요청", sub: `${l.type} ${l.start_date}~${l.end_date}`, link: "/leave", icon: "sun" }));
      } catch { /* */ }
    }
    try {
      const mts = (await api.get<any[]>("/boards/meetings")).data || [];
      mts.forEach((m) => (m.actions || []).forEach((a: any) => {
        if (a.assignee_id === me.id && !a.done) out.push({ id: "act-" + a.id, title: "내 할 일" + (a.due && a.due <= today ? " (마감 도래)" : ""), sub: a.title, link: "/meetings", icon: "clipboard" });
      }));
    } catch { /* */ }
    try {
      const nt = (await api.get<any[]>("/boards/notices")).data || [];
      nt.forEach((n) => { if (n.required && !(n.acked_user_ids || []).includes(me.id)) out.push({ id: "nt-" + n.id, title: "필독 공지 미확인", sub: n.title, link: "/notices", icon: "bell" }); });
    } catch { /* */ }

    setItems(out);
    setRead((r) => r.filter((id) => out.some((o) => o.id === id)));   // 처리된 항목은 read 목록에서도 제거
    // 새 항목 → 데스크톱 알림
    let seen: string[] = [];
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { /* */ }
    const fresh = out.filter((o) => !seen.includes(o.id));
    if (fresh.length && "Notification" in window && Notification.permission === "granted") {
      const n = fresh[0];
      try { new Notification("LabMate 알림", { body: n.title + " · " + n.sub + (fresh.length > 1 ? ` 외 ${fresh.length - 1}건` : ""), tag: "labmate" }); } catch { /* */ }
    }
    localStorage.setItem(SEEN_KEY, JSON.stringify(out.map((o) => o.id)));
  }

  useEffect(() => {
    poll();
    const t = setInterval(poll, 45000);
    const onFocus = () => poll();                 // 탭 복귀/처리 후 즉시 갱신
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  function go(n: Noti) { setOpen(false); nav(n.link); }

  return (
    <div className="usermenu" ref={ref}>
      <button className="appbar-icon" data-testid="notif-bell" aria-label="알림" onClick={() => setOpen((v) => { if (!v) markAllRead(); return !v; })} style={{ position: "relative" }}>
        <Icon name="bell" size={17} />
        {unread.length > 0 && <span className="notif-badge" data-testid="notif-count">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>
      {open && (
        <div className="menu-pop" role="menu" data-testid="notif-pop" style={{ width: 320 }}>
          <div className="menu-head"><b>알림</b><span className="muted small"> {items.length}건 처리 대기</span></div>
          {items.map((n) => (
            <button key={n.id} role="menuitem" onClick={() => go(n)} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ opacity: .7, marginTop: 1 }}><Icon name={n.icon} size={15} /></span>
              <span style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600 }}>{n.title}</div><div className="muted small" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.sub}</div></span>
            </button>
          ))}
          {!items.length && <div className="muted small" style={{ padding: "10px 12px", textAlign: "center" }}>새 알림이 없습니다 🎉</div>}
        </div>
      )}
    </div>
  );
}
