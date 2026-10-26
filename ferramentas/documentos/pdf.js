const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file:///home/claude/build/melhorias.html');await p.waitForTimeout(500);
await p.pdf({path:'/mnt/user-data/outputs/Navi-Plano-de-Melhorias.pdf',format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<div></div>',footerTemplate:'<div style="font-size:7pt;color:#888;width:100%;text-align:center;font-family:Inter">Navi — Plano de melhorias · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>'});
await b.close();})();
