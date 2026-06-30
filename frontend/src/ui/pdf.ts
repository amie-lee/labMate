// 문서를 새 창에 깔끔히 렌더링하고 인쇄 대화상자를 열어 "PDF로 저장"할 수 있게 한다.
// (별도 라이브러리 없이 브라우저 인쇄→PDF 저장 사용)
export function printDoc(title: string, innerHtml: string) {
  const w = window.open("", "_blank", "width=860,height=1000");
  if (!w) { alert("팝업이 차단되었습니다. 팝업을 허용해 주세요."); return; }
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:-apple-system,"Segoe UI","Malgun Gothic",sans-serif;color:#1f2733;margin:0;padding:34px 42px;}
    .doc-title{font-size:22px;font-weight:800;letter-spacing:-.3px;margin:0 0 2px}
    .doc-sub{color:#6b7685;font-size:12.5px;margin-bottom:18px}
    table.kv{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0 16px}
    table.kv th,table.kv td{border:1px solid #d9dee5;padding:7px 11px;text-align:left;vertical-align:top}
    table.kv th{background:#f5f7fa;color:#46505e;width:130px;font-weight:600}
    .sign{display:flex;gap:0;margin:0 0 18px;justify-content:flex-end}
    .sign .box{border:1px solid #444;border-left:0;min-width:96px;text-align:center}
    .sign .box:first-child{border-left:1px solid #444}
    .sign .box .h{background:#eef1f5;border-bottom:1px solid #444;padding:4px;font-size:11.5px;color:#46505e}
    .sign .box .b{height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:12px;gap:2px}
    .sign .ok{color:#1f8a55;font-weight:700}.sign .no{color:#c5453f;font-weight:700}.sign .wait{color:#9aa3ad}
    .doc-body{line-height:1.75;font-size:13.5px;margin-top:6px;border-top:1px solid #e4e7ec;padding-top:14px}
    .doc-body h3{font-size:15px;margin:8px 0}.doc-body ul{padding-left:20px}
    .files{font-size:12.5px;color:#46505e;margin-top:10px}
    @media print{ @page{size:A4;margin:14mm} .noprint{display:none} }
  </style></head><body>${innerHtml}
  <div class="noprint" style="margin-top:26px;text-align:center">
    <button onclick="window.print()" style="padding:9px 20px;border:1px solid #3f5d7d;background:#3f5d7d;color:#fff;border-radius:8px;font-size:14px;cursor:pointer">PDF로 저장 / 인쇄</button>
  </div>
  <script>setTimeout(function(){window.focus();window.print();},350)</script>
  </body></html>`);
  w.document.close();
}
