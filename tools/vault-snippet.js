/* VAULT:START (shared by every tool; edit tools/vault-snippet.js, then run node tools/sync-vault.js) */
/* Encrypted copies. The plan is encrypted in the browser with a passphrase (PBKDF2-SHA256, 310,000 rounds, then
   AES-GCM 256) before it is stored or downloaded. The passphrase is kept in memory only and is never stored or sent.
   Online copies use the claude.ai `db` capability under data/users/<viewer id>/, which is private to each signed-in
   person. On a standalone website there is no online store, so only encrypted files are offered.
   The text is squeezed (gzip) before it is encrypted, where the browser can: an online copy may be no larger than
   256 KiB, and what a tool keeps grows with use. A copy made that way carries z:1. A copy without it is plain text
   inside, as every copy was before, and opens the same way. */
function makeVault(o){
  const el=o.mount,enc=new TextEncoder(),dec=new TextDecoder(),ITER=310000;
  let pass=null,db=null,uid=null,items=[],note='',ready=false,armedDel=null;
  const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
  const unb=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const keyFor=async(p,salt)=>crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveKey']),{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const pipe=async(u,t)=>new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(t)).arrayBuffer());
  async function seal(obj,p){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    let pt=enc.encode(JSON.stringify(obj)),z=0;
    if(window.CompressionStream){try{pt=await pipe(pt,new CompressionStream('gzip'));z=1}catch(e){pt=enc.encode(JSON.stringify(obj));z=0}}
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await keyFor(p,salt),pt);
    const rec={enc:1,kdf:'PBKDF2-SHA256-'+ITER,salt:b64(salt),iv:b64(iv),ct:b64(new Uint8Array(ct))};if(z)rec.z=1;return rec}
  /* A wrong passphrase fails at the decrypt step. A squeezed copy in a browser that cannot unsqueeze fails after it,
     with its own code, so that the reader is not told the passphrase is wrong. */
  async function unseal(rec,p){let pt=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb(rec.iv)},await keyFor(p,unb(rec.salt)),unb(rec.ct)));
    if(rec.z){if(!window.DecompressionStream)throw {code:'old_browser'};pt=await pipe(pt,new DecompressionStream('gzip'))}
    return JSON.parse(dec.decode(pt))}
  const tooOld=e=>e&&e.code==='old_browser'?'This browser is too old to open that copy. Open it in a current browser.':'';
  const col=()=>db.collection('data/users/'+uid);
  const online=()=>!!(db&&uid);
  const when=t=>{try{return new Date(t).toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){return t}};
  async function refresh(){if(!online())return;try{const q=await col().get();items=q.docs.map(d=>Object.assign({id:d.id},d.data())).filter(d=>d&&d.app===o.app&&d.ct).sort((a,b)=>String(b.at).localeCompare(String(a.at)))}catch(e){note='Could not read your online copies just now.'}}
  function draw(){
    const can=!!(window.crypto&&crypto.subtle);
    let h='<h3 style="margin:0">Encrypted copies</h3>';
    if(!can){el.innerHTML=h+'<p class="note" style="margin:0">This browser can\'t encrypt here. Use the ordinary save options.</p>';return}
    h+='<p class="note" style="margin:0">Protect a copy of '+esc(o.what)+' with a passphrase. It is encrypted in your browser first, so nobody can read it without the passphrase: not us, and not whoever stores the file. <b>If you forget the passphrase, those copies cannot be recovered.</b> Keep your printed or ordinary copy as well.</p>';
    if(!pass){const first=online()&&ready&&!items.length;
      h+='<div class="row" style="align-items:flex-end"><label class="f" for="'+o.app+'VPass" style="flex:1 1 220px">Passphrase<span class="h">four or more words is best; at least 10 characters</span><input type="password" id="'+o.app+'VPass" autocomplete="off" style="font:inherit;padding:8px 10px;border-radius:6px;border:1px solid var(--line);background:var(--sunk);color:var(--fg);min-height:40px;width:100%"></label>'+
        (first?'<label class="f" for="'+o.app+'VPass2" style="flex:1 1 220px">Type it again<input type="password" id="'+o.app+'VPass2" autocomplete="off" style="font:inherit;padding:8px 10px;border-radius:6px;border:1px solid var(--line);background:var(--sunk);color:var(--fg);min-height:40px;width:100%"></label>':'')+
        '<button type="button" class="btn" data-v="unlock">Unlock</button></div>'+
        (online()?'<p class="note" style="margin:0">'+(ready?(items.length?items.length+' online '+(items.length>1?'copies':'copy')+' saved. Unlock to see or load them.':'No online copies yet. Choose a passphrase to start.'):'Checking for online copies…')+'</p>':'<p class="note" style="margin:0">Online copies are available on the private claude.ai link, when you are signed in. Here you can save and open encrypted files.</p>');
    }else{
      h+='<div class="row"><span class="note">Unlocked for this visit.</span><button type="button" class="btn sm" data-v="lock">Lock</button></div>';
      if(online()){
        h+='<div class="row" style="align-items:flex-end"><label class="f" for="'+o.app+'VName" style="flex:1 1 220px">Name for this version<span class="h">the name and date are stored unencrypted, so keep it plain</span><input type="text" id="'+o.app+'VName" maxlength="60" placeholder="e.g. November baseline" style="font:inherit;padding:8px 10px;border-radius:6px;border:1px solid var(--line);background:var(--sunk);color:var(--fg);min-height:40px;width:100%"></label><button type="button" class="btn" data-v="save">Save a version online</button></div>';
        h+=items.length?'<div>'+items.map(d=>'<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding:8px 0"><span><b>'+esc(d.name||'Untitled')+'</b> <span class="note">· '+esc(when(d.at))+'</span></span><span class="row"><button type="button" class="btn sm" data-v="load" data-id="'+esc(d.id)+'">Load</button><button type="button" class="btn sm" data-v="del" data-id="'+esc(d.id)+'">'+(armedDel===d.id?'Click again to delete':'Delete')+'</button></span></div>').join('')+'</div>':'<p class="note" style="margin:0">No online copies yet.</p>';
      }
      h+='<div class="row"><button type="button" class="btn" data-v="file">Download an encrypted file</button><label class="btn" for="'+o.app+'VFile" style="display:inline-flex;align-items:center">Open an encrypted file</label><input type="file" id="'+o.app+'VFile" accept=".json,application/json" hidden></div>';
    }
    h+='<p class="note" role="status" style="margin:0"'+(note?'':' hidden')+'>'+esc(note)+'</p>';
    el.innerHTML=h;
    const f=document.getElementById(o.app+'VFile');if(f)f.onchange=ev=>{const file=ev.target.files[0];if(!file)return;const r=new FileReader();
      r.onload=async()=>{try{const rec=JSON.parse(r.result);if(!rec||rec.app!==o.app||!rec.ct)throw 0;let st;try{st=await unseal(rec,pass)}catch(e){note=tooOld(e)||'The passphrase doesn\'t open that file.';return draw()}o.setState(st);note='Opened the encrypted file.'}catch(e){note='That isn\'t an encrypted file from this tool.'}draw()};r.readAsText(file)};
    const p1=document.getElementById(o.app+'VPass');if(p1)p1.onkeydown=ev=>{if(ev.key==='Enter')act('unlock')};
  }
  async function act(a,id){
    try{
      if(a==='unlock'){const p=document.getElementById(o.app+'VPass').value,p2=document.getElementById(o.app+'VPass2');
        if(p.length<10){note='Use at least 10 characters. Four unrelated words work well.';return draw()}
        if(p2&&p2.value!==p){note='The two passphrases don\'t match.';return draw()}
        if(items.length){try{await unseal(items[0],p)}catch(e){note=tooOld(e)||'That passphrase doesn\'t open your saved copies.';return draw()}}
        pass=p;note='';return draw()}
      if(a==='lock'){pass=null;note='';return draw()}
      if(a==='save'){const nm=(document.getElementById(o.app+'VName').value||'').trim()||'Untitled';note='Saving…';draw();
        const rec=Object.assign(await seal(o.getState(),pass),{app:o.app,name:nm,at:new Date().toISOString()});
        if(JSON.stringify(rec).length>250000){note='This copy is too large to keep online. Download an encrypted file instead: a file has no size limit.';return draw()}
        await col().doc('v'+Date.now()).set(rec);await refresh();note='Saved "'+nm+'" online, encrypted.';return draw()}
      if(a==='load'){const d=items.find(x=>x.id===id);if(!d)return;let st;try{st=await unseal(d,pass)}catch(e){note=tooOld(e)||'The passphrase doesn\'t open "'+(d.name||'Untitled')+'". It may have been saved with a different one.';return draw()}
        o.setState(st);note='Loaded "'+(d.name||'Untitled')+'".';return draw()}
      if(a==='del'){if(armedDel!==id){armedDel=id;return draw()}armedDel=null;await col().doc(id).delete();await refresh();note='Deleted that online copy.';return draw()}
      if(a==='file'){const rec=Object.assign(await seal(o.getState(),pass),{app:o.app,at:new Date().toISOString()});
        await o.download(o.app+'-encrypted-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(rec));note='';return draw()}
    }catch(e){const c=e&&e.code;note=c==='not_granted'||c==='permission_denied'?'Online copies aren\'t allowed for this view.':'That didn\'t work. Please try again.';draw()}
  }
  el.addEventListener('click',ev=>{const b=ev.target.closest('button[data-v]');if(b)act(b.dataset.v,b.dataset.id)});
  draw();
  (async()=>{try{if(window.claude&&window.claude.use){const u=await window.claude.use('user'),d=await window.claude.use('db');uid=u?await u.id():null;db=d||null;if(online()){await refresh()}}}catch(e){db=null}ready=true;draw()})();
}
/* Inside the Financial Tools of Life collection, each page shows a link back to the home page, and a tool that has a
   guide shows the way to it beside that link. The build sets window.FTOL_HOME and window.FTOL_GUIDE on the collection's
   copies; a page opened on its own has neither link. */
(function(){try{if(!window.FTOL_HOME)return;const w=document.querySelector('.wrap');if(!w)return;
  const link=(href,text)=>{const x=document.createElement('a');x.href=href;x.textContent=text;x.style.cssText='font:500 14px var(--body);color:var(--accent);text-decoration:none';return x};
  const nav=document.createElement('div'),a=link(window.FTOL_HOME,'\u2190 Financial Tools of Life');nav.className='noprint';nav.style.cssText='display:flex;flex-wrap:wrap;gap:6px 20px;align-items:baseline';
  nav.appendChild(a);if(window.FTOL_GUIDE)nav.appendChild(link(window.FTOL_GUIDE,'Guide: how to use this page'));w.prepend(nav);
  /* Inside the claude.ai collection the address belongs to the collection, not to this tool, so refreshing the browser
     reloads the home page. This tool therefore leaves a note that it is the page on show and keeps the note fresh while it
     is open; the home page reads it and comes straight back. Going home on purpose, by the link above, clears the note. */
  if(window.FTOL_SELF){let leaving=false;const mark=()=>{if(leaving)return;try{localStorage.setItem('ftol-at',JSON.stringify({p:window.FTOL_SELF,t:Date.now()}))}catch(e){}};
    mark();setInterval(mark,20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)mark()});window.addEventListener('pagehide',mark);
    a.addEventListener('click',()=>{leaving=true;try{localStorage.removeItem('ftol-at')}catch(e){}})}
  }catch(e){}})();
/* A guide can ask a tool to open at a particular place. It leaves a short-lived note in localStorage (key ftol-show),
   which the pages of the collection share: the tool it is for, and what to show. ftolShow hands a tool its own note,
   once, and only while it is under a minute old. The tool sets its view from the note, then calls ftolSpot with the
   part of the page to show. ftolSpot opens any closed section around the part, brings it into view, keeps it there
   while the page is still settling (until the reader touches the page), outlines it for a few seconds and, for a
   reader who came from a guide, offers the way back. */
function ftolShow(app){try{const g=JSON.parse(localStorage.getItem('ftol-show')||'null');if(!g)return null;const fresh=Date.now()-g.t<60000;
  if(g.p===app||!fresh)localStorage.removeItem('ftol-show');return g.p===app&&fresh?g:null}catch(e){return null}}
function ftolSpot(el,go,around,top){
  if(go&&go.from==='guide'&&window.FTOL_GUIDE&&!document.getElementById('guideBack')){const a=document.createElement('a');a.id='guideBack';a.className='noprint';a.href=window.FTOL_GUIDE;a.textContent='\u2190 Back to the guide';
    a.style.cssText='position:fixed;left:max(16px,env(safe-area-inset-left,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:20;font:500 13px var(--body);background:var(--accent);color:var(--surface);padding:9px 13px;border-radius:8px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.25)';document.body.appendChild(a)}
  if(!el)return;
  for(let d=el.closest('details');d;d=d.parentElement&&d.parentElement.closest('details'))d.open=true;
  /* outline the panel the part belongs to (`around` lists what counts as one in this tool), or the part itself */
  const box=go&&go.box==='self'?el:el.closest(around)||el,st=box.style,was=[st.outline,st.outlineOffset];
  /* inside a table the outline is drawn just within the part, because a table's scrolling frame would cut off one drawn outside it */
  box.classList.add('ftol-spot');st.outline='3px solid var(--accent)';st.outlineOffset=box.closest('table')?'-3px':'4px';
  const at=top||box;at.style.scrollMarginTop='14px';     /* `top`, when given, is what to bring to the top of the screen instead of the outlined part */
  let live=true;const ro=window.ResizeObserver?new ResizeObserver(()=>place()):null;
  const place=()=>{if(live)at.scrollIntoView({block:'start'})},stop=()=>{live=false;if(ro)ro.disconnect()};
  setTimeout(()=>{place();if(ro)ro.observe(document.body)},60);
  ['wheel','touchstart','keydown','mousedown'].forEach(t=>addEventListener(t,stop,{once:true,passive:true}));
  setTimeout(stop,15000);setTimeout(()=>{box.classList.remove('ftol-spot');st.outline=was[0];st.outlineOffset=was[1]},6000);
}
/* VAULT:END */
