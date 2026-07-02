import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

export interface Col<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string | number;   // 정렬·검색용
  sortable?: boolean;
  nowrap?: boolean;
}

interface Props<T> {
  rows: T[];
  cols: Col<T>[];
  testid?: string;
  searchPlaceholder?: string;
  searchKeys?: (row: T) => string;
  pageSize?: number;
  autoHeight?: boolean;   // 브라우저 높이에 맞춰 페이지 크기를 자동 계산(페이지 수 최소화)
  defaultSort?: string;
  defaultDir?: 1 | -1;
  chips?: { get: (row: T) => string; values: string[] };
  empty?: string;
}

export function DataTable<T>({ rows, cols, testid, searchPlaceholder = "검색…", searchKeys, pageSize = 10, autoHeight = false, defaultSort, defaultDir = 1, chips, empty = "데이터 없음" }: Props<T>) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<string | null>(defaultSort ?? null);
  const [dir, setDir] = useState<1 | -1>(defaultDir);
  const [page, setPage] = useState(0);
  const [chip, setChip] = useState<string>("전체");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [autoSize, setAutoSize] = useState(pageSize);

  const filtered = useMemo(() => {
    let r = rows;
    if (chips && chip !== "전체") r = r.filter((x) => chips.get(x) === chip);
    if (q && searchKeys) {
      const lq = q.toLowerCase();
      r = r.filter((x) => searchKeys(x).toLowerCase().includes(lq));
    }
    if (sort) {
      const col = cols.find((c) => c.key === sort);
      if (col?.value) {
        r = [...r].sort((a, b) => {
          const va = col.value!(a), vb = col.value!(b);
          if (va < vb) return -1 * dir;
          if (va > vb) return 1 * dir;
          return 0;
        });
      }
    }
    return r;
  }, [rows, q, sort, dir, chip, cols, chips, searchKeys]);

  // 뷰포트 높이에 맞춰 한 페이지 행 수 계산 (기준은 window.innerHeight 고정 — 컨테이너 높이 기준 시 피드백 루프)
  useEffect(() => {
    if (!autoHeight) return;
    const calc = () => {
      const el = wrapRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;                     // 테이블 래퍼(검색바 아래) 상단
      const rowEl = el.querySelector("tbody tr") as HTMLElement | null;
      const headEl = el.querySelector("thead") as HTMLElement | null;
      const rowH = Math.max(24, rowEl ? rowEl.getBoundingClientRect().height : 42);  // 실제 행 높이
      const headH = headEl ? headEl.getBoundingClientRect().height : 40;
      const RESERVE = 60;                                              // 페이저 + 하단 여백
      const avail = window.innerHeight - top - headH - RESERVE;
      const n = Math.max(6, Math.floor(avail / rowH));
      setAutoSize((prev) => (prev === n ? prev : n));
    };
    const raf = requestAnimationFrame(calc);       // 최초 레이아웃 확정 후 측정
    window.addEventListener("resize", calc);
    const ro = new ResizeObserver(calc);           // 폼 열림/닫힘 등 상단 변화 감지(기준이 고정이라 루프 없음)
    ro.observe(document.body);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", calc); ro.disconnect(); };
  }, [autoHeight, filtered.length]);

  const effPageSize = autoHeight ? autoSize : pageSize;
  const pages = Math.max(1, Math.ceil(filtered.length / effPageSize));
  const cur = Math.min(page, pages - 1);
  const view = filtered.slice(cur * effPageSize, cur * effPageSize + effPageSize);

  function toggleSort(c: Col<T>) {
    if (!c.value && !c.sortable) return;
    if (sort === c.key) setDir((d) => (d === 1 ? -1 : 1));
    else { setSort(c.key); setDir(1); }
  }

  return (
    <div data-testid={testid}>
      <div className="tbar">
        {searchKeys && (
          <input className="tsearch" placeholder={searchPlaceholder} value={q}
            data-testid={testid ? `${testid}-search` : undefined}
            onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        )}
        {chips && (
          <div className="fchips">
            {["전체", ...chips.values].map((v) => (
              <button key={v} className={"chip" + (chip === v ? " on" : "")} onClick={() => { setChip(v); setPage(0); }}>{v}</button>
            ))}
          </div>
        )}
        <span className="muted small" style={{ marginLeft: "auto" }}>{filtered.length}건</span>
      </div>
      <div className="card scroll" style={{ margin: 0 }} ref={wrapRef}>
        <table className="tbl">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={c.value || c.sortable ? "sortable" : ""} onClick={() => toggleSort(c)}>
                  {c.label}{sort === c.key ? (dir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.key} style={c.nowrap ? { whiteSpace: "nowrap" } : undefined}>
                    {c.render ? c.render(row) : c.value ? c.value(row) : ""}
                  </td>
                ))}
              </tr>
            ))}
            {!view.length && <tr><td colSpan={cols.length} className="muted" style={{ textAlign: "center", padding: 22 }}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pager">
          <button className="btn ghost sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>이전</button>
          <span>{cur + 1} / {pages}</span>
          <button className="btn ghost sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>다음</button>
        </div>
      )}
    </div>
  );
}
