// 공용 서식 에디터 — contentEditable + 아이콘 툴바 + 이미지 드롭/붙여넣기/크기조절.
import { RefObject, useRef, useState } from "react";
import { api } from "../api/client";
import { fileUrl } from "../api/config";

function Ico({ children }: { children: any }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}
const ICONS = {
  undo: <Ico><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></Ico>,
  redo: <Ico><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></Ico>,
  alignL: <Ico><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></Ico>,
  alignC: <Ico><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="5" y1="18" x2="19" y2="18" /></Ico>,
  alignR: <Ico><line x1="3" y1="6" x2="21" y2="6" /><line x1="9" y1="12" x2="21" y2="12" /><line x1="6" y1="18" x2="21" y2="18" /></Ico>,
  ul: <Ico><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><circle cx="3.5" cy="6" r="1.1" /><circle cx="3.5" cy="12" r="1.1" /><circle cx="3.5" cy="18" r="1.1" /></Ico>,
  ol: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><text x="2" y="8.5" fontSize="8" fill="currentColor" stroke="none">1</text><text x="2" y="14.5" fontSize="8" fill="currentColor" stroke="none">2</text><text x="2" y="20.5" fontSize="8" fill="currentColor" stroke="none">3</text></svg>,
  outdent: <Ico><polyline points="7 8 3 12 7 16" /><line x1="11" y1="6" x2="21" y2="6" /><line x1="11" y1="12" x2="21" y2="12" /><line x1="11" y1="18" x2="21" y2="18" /></Ico>,
  indent: <Ico><polyline points="3 8 7 12 3 16" /><line x1="11" y1="6" x2="21" y2="6" /><line x1="11" y1="12" x2="21" y2="12" /><line x1="11" y1="18" x2="21" y2="18" /></Ico>,
  link: <Ico><path d="M9 15l6-6" /><path d="M11 6l1-1a4 4 0 0 1 6 6l-2 2" /><path d="M13 18l-1 1a4 4 0 0 1-6-6l2-2" /></Ico>,
  image: <Ico><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></Ico>,
  table: <Ico><rect x="3" y="3" width="18" height="18" rx="1" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></Ico>,
  hr: <Ico><line x1="3" y1="12" x2="21" y2="12" /></Ico>,
  quote: <Ico><path d="M7 7H4v6h3l-1 4M17 7h-3v6h3l-1 4" /></Ico>,
  clear: <Ico><path d="M4 7V5h16v2" /><path d="M9 20h6" /><path d="M14 5l-4 15" /></Ico>,
};

export function RichText({ innerRef, placeholder, testid, minHeight = 160 }: {
  innerRef: RefObject<HTMLDivElement>;
  placeholder?: string;
  testid?: string;
  minHeight?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selImg = useRef<HTMLImageElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const activeCell = useRef<HTMLTableCellElement | null>(null);
  const [inTable, setInTable] = useState(false);
  const editAnchor = useRef<HTMLAnchorElement | null>(null);
  const [linkPop, setLinkPop] = useState<{ href: string; l: number; t: number } | null>(null);
  const plainPaste = useRef(false);
  const [over, setOver] = useState(false);
  const [box, setBox] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const [dlg, setDlg] = useState<null | "link" | "table">(null);
  const [link, setLink] = useState({ url: "https://", text: "" });
  const [tbl, setTbl] = useState({ rows: 3, cols: 3 });

  // pt 입력·색상 컨트롤로 포커스 이동 시 에디터 선택 저장/복원
  function saveSel() { const s = window.getSelection(); if (s && s.rangeCount && innerRef.current?.contains(s.getRangeAt(0).commonAncestorContainer)) savedRange.current = s.getRangeAt(0).cloneRange(); }
  function restoreSel() { innerRef.current?.focus(); const r = savedRange.current; if (!r) return; const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }

  function exec(cmd: string, val?: string) { document.execCommand(cmd, false, val); innerRef.current?.focus(); }
  function execCss(cmd: string, val: string) { restoreSel(); document.execCommand("styleWithCSS", false, "true"); document.execCommand(cmd, false, val); document.execCommand("styleWithCSS", false, "false"); innerRef.current?.focus(); }
  function setFontPt(v: string) {
    const pt = parseFloat(v); if (!pt || pt < 1) return;
    restoreSel();
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand("fontSize", false, "7");
    innerRef.current?.querySelectorAll('font[size="7"]').forEach((f) => { (f as HTMLElement).removeAttribute("size"); (f as HTMLElement).style.fontSize = pt + "pt"; });
    innerRef.current?.focus();
  }

  function ensureCaret() {
    const el = innerRef.current; if (!el) return;
    const sel = window.getSelection();
    const inside = !!sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer);
    el.focus();
    if (!inside) { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); sel?.removeAllRanges(); sel?.addRange(r); }
  }
  async function insertImage(file: File) {
    try {
      const fd = new FormData(); fd.append("files", file);
      const r = await api.post<{ name: string; url: string }[]>("/projects/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const url = r.data?.[0]?.url;
      if (url) { ensureCaret(); document.execCommand("insertHTML", false, `<img src="${fileUrl(url)}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:6px 0;" /><br/>`); }
    } catch { }
  }
  async function handleFiles(files: File[]) { const imgs = files.filter((f) => f.type.startsWith("image/")); for (const f of imgs) await insertImage(f); }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    setOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (!files.some((f) => f.type.startsWith("image/"))) return;
    e.preventDefault();
    const r = (document as any).caretRangeFromPoint?.(e.clientX, e.clientY);
    if (r) { const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(r); }
    handleFiles(files);
  }
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.some((f) => f.type.startsWith("image/"))) { e.preventDefault(); handleFiles(files); return; }
    if (plainPaste.current) {   // Ctrl+Shift+V: 서식 없이 텍스트만
      e.preventDefault(); plainPaste.current = false;
      document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") || "");
    }
  }
  function openLink() { saveSel(); setLink({ url: "https://", text: window.getSelection()?.toString() || "" }); setDlg("link"); }
  function confirmLink() {
    const url = link.url.trim(); if (!url) { setDlg(null); editAnchor.current = null; return; }
    if (editAnchor.current) {
      editAnchor.current.setAttribute("href", url);
      if (link.text) editAnchor.current.textContent = link.text;
      editAnchor.current = null; setDlg(null); innerRef.current?.focus(); _afterEdit(); return;
    }
    restoreSel();
    const sel = window.getSelection();
    if (sel && sel.toString()) document.execCommand("createLink", false, url);
    else { ensureCaret(); document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" rel="noreferrer">${link.text || url}</a>`); }
    innerRef.current?.focus(); setDlg(null);
  }
  function openTable() { saveSel(); setTbl({ rows: 3, cols: 3 }); setDlg("table"); }
  function confirmTable() {
    const cols = Math.max(1, Math.min(8, tbl.cols || 0)), rows = Math.max(1, Math.min(20, tbl.rows || 0));
    if (!cols || !rows) { setDlg(null); return; }
    const td = '<td style="border:1px solid #d0d5dd;padding:6px 9px;min-width:44px;"><br></td>';
    let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;font-size:13px;"><tbody>';
    for (let r = 0; r < rows; r++) html += "<tr>" + td.repeat(cols) + "</tr>";
    html += "</tbody></table><p><br></p>";
    restoreSel(); document.execCommand("insertHTML", false, html); innerRef.current?.focus(); setDlg(null);
  }

  // 이미지 클릭 선택 + 핸들 드래그 크기조절
  function updateBox() {
    const img = selImg.current, wrap = wrapRef.current;
    if (!img || !wrap || !wrap.contains(img)) { setBox(null); return; }
    const ir = img.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
    setBox({ l: ir.left - wr.left, t: ir.top - wr.top, w: ir.width, h: ir.height });
  }
  function onBodyClick(e: React.MouseEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG") { selImg.current = t as HTMLImageElement; updateBox(); }
    else { selImg.current = null; setBox(null); }
    // 체크리스트 체크박스(li 좌측 영역) 클릭 → 완료 토글
    const li = t.closest?.("li") as HTMLLIElement | null;
    if (li && li.parentElement?.classList.contains("rte-check") && e.clientX - li.getBoundingClientRect().left <= 22) {
      li.classList.toggle("done"); _afterEdit();
    }
    // 기존 링크 클릭 → 편집 팝오버
    const a = t.closest?.("a") as HTMLAnchorElement | null;
    if (a && innerRef.current?.contains(a) && wrapRef.current) {
      const wr = wrapRef.current.getBoundingClientRect(), ar = a.getBoundingClientRect();
      editAnchor.current = a; setLinkPop({ href: a.getAttribute("href") || "", l: ar.left - wr.left, t: ar.bottom - wr.top + 4 });
    } else { setLinkPop(null); editAnchor.current = null; }
    syncTableCtx();
  }
  function startResize(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const img = selImg.current; if (!img) return;
    const startX = e.clientX, startW = img.getBoundingClientRect().width;
    function move(ev: MouseEvent) { const w = Math.max(40, Math.round(startW + (ev.clientX - startX))); img!.style.width = w + "px"; img!.style.height = "auto"; img!.style.maxWidth = "100%"; updateBox(); }
    function up() { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  }
  function setW(pct: string) { const img = selImg.current; if (!img) return; img.style.width = pct; img.style.height = "auto"; updateBox(); }

  // 표 셀 컨텍스트(표 편집 툴바용)
  function syncTableCtx() {
    const sel = window.getSelection();
    let node: Node | null = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    let td: HTMLTableCellElement | null = null;
    while (node && node !== innerRef.current) {
      if (node.nodeType === 1 && (node as HTMLElement).matches?.("td,th")) { td = node as HTMLTableCellElement; break; }
      node = node.parentNode;
    }
    activeCell.current = td && innerRef.current?.contains(td) ? td : null;
    setInTable(!!activeCell.current);
  }
  const _tbl = () => activeCell.current?.closest("table") as HTMLTableElement | null;
  const _row = () => activeCell.current?.closest("tr") as HTMLTableRowElement | null;
  const _colIdx = () => { const r = _row(), c = activeCell.current; return r && c ? Array.from(r.cells).indexOf(c) : -1; };
  const _newCell = () => { const el = document.createElement("td"); el.style.cssText = "border:1px solid #d0d5dd;padding:6px 9px;min-width:44px;"; el.innerHTML = "<br>"; return el; };
  const _afterEdit = () => { innerRef.current?.dispatchEvent(new Event("input", { bubbles: true })); innerRef.current?.focus(); };
  function addRow(below: boolean) {
    const r = _row(); const body = r?.parentElement; if (!r || !body) return;
    const nr = document.createElement("tr");
    for (let i = 0; i < r.cells.length; i++) nr.appendChild(_newCell());
    body.insertBefore(nr, below ? r.nextSibling : r); _afterEdit();
  }
  function delRow() {
    const r = _row(), t = _tbl(); if (!r || !t) return;
    if (t.rows.length <= 1) { t.remove(); activeCell.current = null; setInTable(false); } else r.remove();
    _afterEdit();
  }
  function addCol(right: boolean) {
    const t = _tbl(), ci = _colIdx(); if (!t || ci < 0) return;
    Array.from(t.rows).forEach((row) => { const ref = row.cells[ci]; row.insertBefore(_newCell(), right ? (ref?.nextSibling || null) : ref); });
    _afterEdit();
  }
  function delCol() {
    const t = _tbl(), ci = _colIdx(); if (!t || ci < 0) return;
    if ((t.rows[0]?.cells.length || 0) <= 1) { t.remove(); activeCell.current = null; setInTable(false); }
    else Array.from(t.rows).forEach((row) => { if (row.cells[ci]) row.deleteCell(ci); });
    _afterEdit();
  }
  function delTable() { const t = _tbl(); if (t) t.remove(); activeCell.current = null; setInTable(false); _afterEdit(); }
  function cellAlign(a: string) { const c = activeCell.current; if (c) { c.style.textAlign = a; _afterEdit(); } }
  function toggleHeaderRow() {   // 현재 행 td↔th 전환(헤더행 지정)
    const r = _row(); if (!r) return;
    const toTh = r.cells[0]?.tagName !== "TH";
    Array.from(r.cells).forEach((c) => {
      const nn = document.createElement(toTh ? "th" : "td");
      nn.style.cssText = (c as HTMLElement).style.cssText || "border:1px solid #d0d5dd;padding:6px 9px;min-width:44px;";
      if (toTh) nn.style.background = "#f5f7fa"; else nn.style.removeProperty("background");
      nn.innerHTML = c.innerHTML;
      c.replaceWith(nn);
    });
    activeCell.current = null; setInTable(false); _afterEdit();
  }

  // 선택 위치에서 특정 태그 조상 찾기(에디터 내부)
  function closestTag(tag: string): HTMLElement | null {
    const sel = window.getSelection(); let n: Node | null = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    const T = tag.toUpperCase();
    while (n && n !== innerRef.current) { if (n.nodeType === 1 && (n as HTMLElement).tagName === T) return n as HTMLElement; n = n.parentNode; }
    return null;
  }
  function checklist() {   // 체크리스트 — UL에 rte-check 클래스 토글
    const ul = closestTag("UL");
    if (ul) { ul.classList.toggle("rte-check"); _afterEdit(); return; }
    exec("insertUnorderedList");
    closestTag("UL")?.classList.add("rte-check");
    _afterEdit();
  }
  function inlineCode() {
    const sel = window.getSelection(); if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const txt = sel.toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");
    document.execCommand("insertHTML", false, `<code class="rte-code">${txt}</code>`);
    innerRef.current?.focus(); _afterEdit();
  }
  async function pastePlain() {
    ensureCaret();
    try { const txt = await navigator.clipboard.readText(); document.execCommand("insertText", false, txt); } catch { /* 권한 없으면 Ctrl+Shift+V 사용 */ }
    _afterEdit();
  }
  function editLinkFromPop() {   // 링크 팝오버 → 편집 다이얼로그(기존 앵커 유지)
    const a = editAnchor.current; if (!a) return;
    saveSel(); setLink({ url: a.getAttribute("href") || "https://", text: a.textContent || "" }); setLinkPop(null); setDlg("link");
  }
  function removeLink() {
    const a = editAnchor.current; if (a) { a.replaceWith(document.createTextNode(a.textContent || "")); }
    editAnchor.current = null; setLinkPop(null); _afterEdit();
  }

  // 에디터 단축키(Tab 들여쓰기/내어쓰기, Ctrl+K 링크, Ctrl+E 인라인 코드; 굵게·기울임·밑줄은 브라우저 기본)
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand(e.shiftKey ? "outdent" : "indent", false);
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); openLink(); return; }
    if (mod && e.shiftKey && (e.key === "8" || e.key === "*")) { e.preventDefault(); exec("insertUnorderedList"); return; }
    if (mod && e.shiftKey && (e.key === "7" || e.key === "&")) { e.preventDefault(); exec("insertOrderedList"); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === "v") { plainPaste.current = true; setTimeout(() => { plainPaste.current = false; }, 150); }
    if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); inlineCode(); return; }
  }

  const Tb = ({ t, on, children, style }: any) => <button type="button" className="rte-tip" data-tip={t} aria-label={t} onMouseDown={(e: any) => e.preventDefault()} onClick={on} style={style}>{children}</button>;

  return (
    <div className="rte" ref={wrapRef}>
      <div className="rte-bar">
        <Tb t="실행취소" on={() => exec("undo")}>{ICONS.undo}</Tb>
        <Tb t="다시실행" on={() => exec("redo")}>{ICONS.redo}</Tb>
        <span className="sep" />
        <span className="rte-tip" data-tip="단락 스타일">
          <select className="rte-heading" defaultValue="" onMouseDown={saveSel}
            onChange={(e) => { const v = e.target.value; if (!v) return; restoreSel(); exec("formatBlock", v); e.currentTarget.value = ""; }}>
            <option value="" disabled hidden>단락</option>
            <option value="P">본문</option><option value="H1">제목 1</option><option value="H2">제목 2</option><option value="H3">제목 3</option>
          </select>
        </span>
        <span className="rte-tip" data-tip="글씨 크기(pt) — 입력 후 Enter"><input className="rte-pt" type="number" min={6} max={120} defaultValue={11}
          onMouseDown={saveSel}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setFontPt((e.target as HTMLInputElement).value); } }} /></span>
        <span className="rte-ptlabel">pt</span>
        <span className="sep" />
        <Tb t="굵게" on={() => exec("bold")} style={{ fontWeight: 800 }}>B</Tb>
        <Tb t="기울임" on={() => exec("italic")} style={{ fontStyle: "italic", fontFamily: "serif" }}>I</Tb>
        <Tb t="밑줄" on={() => exec("underline")} style={{ textDecoration: "underline" }}>U</Tb>
        <Tb t="취소선" on={() => exec("strikeThrough")} style={{ textDecoration: "line-through" }}>S</Tb>
        <Tb t="인라인 코드 (Ctrl+E)" on={inlineCode} style={{ fontFamily: "monospace" }}>{"</>"}</Tb>
        <label className="rte-color rte-tip" data-tip="글씨 색"><span>A</span><input type="color" defaultValue="#1f2733" onMouseDown={saveSel} onChange={(e) => execCss("foreColor", e.target.value)} /></label>
        <label className="rte-color rte-tip" data-tip="형광펜"><span style={{ background: "#ffe69a", borderRadius: 2, padding: "0 2px" }}>A</span><input type="color" defaultValue="#ffe69a" onMouseDown={saveSel} onChange={(e) => execCss("hiliteColor", e.target.value)} /></label>
        <span className="sep" />
        <Tb t="왼쪽 정렬" on={() => exec("justifyLeft")}>{ICONS.alignL}</Tb>
        <Tb t="가운데 정렬" on={() => exec("justifyCenter")}>{ICONS.alignC}</Tb>
        <Tb t="오른쪽 정렬" on={() => exec("justifyRight")}>{ICONS.alignR}</Tb>
        <span className="sep" />
        <Tb t="글머리 목록" on={() => exec("insertUnorderedList")}>{ICONS.ul}</Tb>
        <Tb t="번호 목록" on={() => exec("insertOrderedList")}>{ICONS.ol}</Tb>
        <Tb t="체크리스트" on={checklist} style={{ fontSize: 15 }}>☑</Tb>
        <Tb t="내어쓰기" on={() => exec("outdent")}>{ICONS.outdent}</Tb>
        <Tb t="들여쓰기" on={() => exec("indent")}>{ICONS.indent}</Tb>
        <span className="sep" />
        <Tb t="인용" on={() => exec("formatBlock", "BLOCKQUOTE")}>{ICONS.quote}</Tb>
        <Tb t="코드 블록" on={() => exec("formatBlock", "PRE")} style={{ fontFamily: "monospace", fontWeight: 700 }}>{"{ }"}</Tb>
        <Tb t="구분선" on={() => exec("insertHorizontalRule")}>{ICONS.hr}</Tb>
        <span className="sep" />
        <Tb t="링크" on={openLink}>{ICONS.link}</Tb>
        <Tb t="이미지" on={() => fileRef.current?.click()}>{ICONS.image}</Tb>
        <Tb t="표" on={openTable}>{ICONS.table}</Tb>
        <span className="sep" />
        <Tb t="텍스트만 붙여넣기 (Ctrl+Shift+V)" on={pastePlain} style={{ fontSize: 12, fontWeight: 700 }}>Tⁿ</Tb>
        <Tb t="서식 지우기" on={() => exec("removeFormat")}>{ICONS.clear}</Tb>
        {box && (
          <span className="rte-imgtools">
            <span className="muted">이미지</span>
            <button type="button" onClick={() => setW("25%")}>25%</button>
            <button type="button" onClick={() => setW("50%")}>50%</button>
            <button type="button" onClick={() => setW("75%")}>75%</button>
            <button type="button" onClick={() => setW("100%")}>100%</button>
          </span>
        )}
        {inTable && !box && (
          <span className="rte-imgtools">
            <span className="muted">표</span>
            <button type="button" title="위에 행 추가" onMouseDown={(e) => e.preventDefault()} onClick={() => addRow(false)}>＋행↑</button>
            <button type="button" title="아래에 행 추가" onMouseDown={(e) => e.preventDefault()} onClick={() => addRow(true)}>＋행↓</button>
            <button type="button" title="행 삭제" onMouseDown={(e) => e.preventDefault()} onClick={delRow}>－행</button>
            <button type="button" title="왼쪽에 열 추가" onMouseDown={(e) => e.preventDefault()} onClick={() => addCol(false)}>＋열←</button>
            <button type="button" title="오른쪽에 열 추가" onMouseDown={(e) => e.preventDefault()} onClick={() => addCol(true)}>＋열→</button>
            <button type="button" title="열 삭제" onMouseDown={(e) => e.preventDefault()} onClick={delCol}>－열</button>
            <button type="button" title="셀 왼쪽 정렬" onMouseDown={(e) => e.preventDefault()} onClick={() => cellAlign("left")}>⇤</button>
            <button type="button" title="셀 가운데 정렬" onMouseDown={(e) => e.preventDefault()} onClick={() => cellAlign("center")}>⇔</button>
            <button type="button" title="셀 오른쪽 정렬" onMouseDown={(e) => e.preventDefault()} onClick={() => cellAlign("right")}>⇥</button>
            <button type="button" title="헤더행 지정/해제" onMouseDown={(e) => e.preventDefault()} onClick={toggleHeaderRow}>헤더</button>
            <button type="button" title="표 삭제" onMouseDown={(e) => e.preventDefault()} onClick={delTable} style={{ color: "var(--bad)" }}>표✕</button>
          </span>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { handleFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <div className={"rte-body" + (over ? " rte-drop" : "")} data-testid={testid} ref={innerRef} contentEditable suppressContentEditableWarning
        data-ph={placeholder} style={{ minHeight: minHeight * 2 }}
        onClick={onBodyClick}
        onKeyDown={onKeyDown}
        onKeyUp={() => { saveSel(); syncTableCtx(); }}
        onMouseUp={() => { saveSel(); syncTableCtx(); }}
        onScroll={updateBox}
        onDrop={onDrop}
        onDragOver={(e) => { if (Array.from(e.dataTransfer?.items || []).some((it) => it.kind === "file")) { e.preventDefault(); setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onPaste={onPaste} />
      {box && <>
        <div className="rte-imgsel" style={{ left: box.l, top: box.t, width: box.w, height: box.h }} />
        <div className="rte-imghandle" style={{ left: box.l + box.w - 7, top: box.t + box.h - 7 }} onMouseDown={startResize} title="드래그해 크기 조절" />
      </>}
      {linkPop && (
        <div className="rte-linkpop" style={{ left: linkPop.l, top: linkPop.t }} onMouseDown={(e) => e.preventDefault()}>
          <a className="rte-linkpop-url" href={linkPop.href} target="_blank" rel="noreferrer" title={linkPop.href}>{linkPop.href || "(링크)"}</a>
          <button type="button" onClick={editLinkFromPop}>편집</button>
          <button type="button" onClick={removeLink} style={{ color: "var(--bad)" }}>해제</button>
        </div>
      )}

      {dlg === "link" && (
        <div className="modal-ovl" onClick={(e) => { if (e.target === e.currentTarget) setDlg(null); }}>
          <div className="modal" style={{ width: 420 }} data-testid="rte-link-dialog">
            <div className="modal-h"><b>{editAnchor.current ? "링크 편집" : "링크 삽입"}</b><button type="button" className="btn ghost sm" onClick={() => { setDlg(null); editAnchor.current = null; }}>✕</button></div>
            <div className="modal-b">
              <label>URL</label>
              <input autoFocus value={link.url} placeholder="https://example.com" onChange={(e) => setLink({ ...link, url: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") confirmLink(); }} />
              <label style={{ marginTop: 8 }}>표시 텍스트 <span className="muted small">(선택 영역이 있으면 무시)</span></label>
              <input value={link.text} placeholder="링크에 표시할 문구" onChange={(e) => setLink({ ...link, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") confirmLink(); }} />
            </div>
            <div className="modal-f"><button type="button" className="btn ghost" onClick={() => setDlg(null)}>취소</button><button type="button" className="btn primary" onClick={confirmLink}>삽입</button></div>
          </div>
        </div>
      )}
      {dlg === "table" && (
        <div className="modal-ovl" onClick={(e) => { if (e.target === e.currentTarget) setDlg(null); }}>
          <div className="modal" style={{ width: 340 }} data-testid="rte-table-dialog">
            <div className="modal-h"><b>표 삽입</b><button type="button" className="btn ghost sm" onClick={() => setDlg(null)}>✕</button></div>
            <div className="modal-b">
              <div className="grid2">
                <div><label>행</label><input type="number" min={1} max={20} autoFocus value={tbl.rows} onChange={(e) => setTbl({ ...tbl, rows: Number(e.target.value) })} onKeyDown={(e) => { if (e.key === "Enter") confirmTable(); }} /></div>
                <div><label>열</label><input type="number" min={1} max={8} value={tbl.cols} onChange={(e) => setTbl({ ...tbl, cols: Number(e.target.value) })} onKeyDown={(e) => { if (e.key === "Enter") confirmTable(); }} /></div>
              </div>
            </div>
            <div className="modal-f"><button type="button" className="btn ghost" onClick={() => setDlg(null)}>취소</button><button type="button" className="btn primary" onClick={confirmTable}>삽입</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function stripHtml(html: string, max = 80): string {
  const text = (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) + "…" : text;
}
