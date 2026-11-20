/* GUIDEJS:START (shared by the guides; edit tools/guide-snippet.js, then run node tools/sync-vault.js) */
/* A guide is a page of lessons about one tool. The page names its tool on its outer element (data-tool), and the build
   tells it where that tool is (window.FTOL_TOOL). A "Show me" link leaves the tool a short-lived note saying what to
   open and which part of the page to show; the tool reads it once and clears it. The note is in localStorage, which the
   pages of the collection share, so nothing depends on the address. */
(function(){
  const app=document.querySelector('.wrap').dataset.tool,RUN=window.FTOL_TOOL,KEY='ftol-guide-'+app;
  const links=document.querySelectorAll('a[data-go],a.run');
  if(RUN)links.forEach(a=>{a.href=RUN});
  /* opened on its own, a guide doesn't know where its tool is: the names stay, the links go */
  else{links.forEach(a=>{if(a.classList.contains('k')){const s=document.createElement('span');s.className=a.className;s.textContent=a.textContent;a.replaceWith(s)}else a.hidden=true});
    document.querySelectorAll('.needs-tool').forEach(e=>{e.hidden=true})}
  const put=id=>{try{localStorage.setItem(KEY,JSON.stringify({at:id,t:Date.now()}))}catch(e){}};
  document.addEventListener('click',ev=>{const a=ev.target.closest('a[data-go]');if(!a||!RUN)return;
    try{const go=JSON.parse(a.dataset.go);go.p=app;go.from='guide';go.t=Date.now();localStorage.setItem('ftol-show',JSON.stringify(go))}catch(e){}
    const les=a.closest('details.lesson');if(les)put(les.id)});
  /* Remember the lesson that was opened last, and reopen it for a reader who comes back within half an hour. */
  document.querySelectorAll('details.lesson').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)put(d.id)}));
  let was=null;try{was=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
  if(was&&Date.now()-was.t<18e5){const d=document.getElementById(String(was.at));
    if(d&&d.matches('details.lesson')){d.open=true;requestAnimationFrame(()=>d.scrollIntoView({block:'start'}))}}
})();
/* GUIDEJS:END */
