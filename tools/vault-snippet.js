/* VAULT:START (shared by every tool; edit tools/vault-snippet.js, then run node tools/sync-vault.js) */
/* Encrypted copies. The plan is encrypted in the browser with a passphrase (PBKDF2-SHA256, 310,000 rounds, then
   AES-GCM 256) before it is stored or downloaded. The passphrase is kept in memory only and is never stored or sent.
   Online copies use the claude.ai `db` capability under data/users/<viewer id>/, which is private to each signed-in
   person. On a standalone website there is no online store, so only encrypted files are offered. */
function makeVault(o){
  const el=o.mount,enc=new TextEncoder(),dec=new TextDecoder(),ITER=310000;
  let pass=null,db=null,uid=null,items=[],note='',ready=false,armedDel=null;
  const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
  const unb=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const keyFor=async(p,salt)=>crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITER,hash:'SHA-256'},await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveKey']),{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  async function seal(obj,p){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await keyFor(p,salt),enc.encode(JSON.stringify(obj)));
    return {enc:1,kdf:'PBKDF2-SHA256-'+ITER,salt:b64(salt),iv:b64(iv),ct:b64(new Uint8Array(ct))}}
  async function unseal(rec,p){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb(rec.iv)},await keyFor(p,unb(rec.salt)),unb(rec.ct));return JSON.parse(dec.decode(pt))}
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
      r.onload=async()=>{try{const rec=JSON.parse(r.result);if(!rec||rec.app!==o.app||!rec.ct)throw 0;let st;try{st=await unseal(rec,pass)}catch(e){note='The passphrase doesn\'t open that file.';return draw()}o.setState(st);note='Opened the encrypted file.'}catch(e){note='That isn\'t an encrypted file from this tool.'}draw()};r.readAsText(file)};
    const p1=document.getElementById(o.app+'VPass');if(p1)p1.onkeydown=ev=>{if(ev.key==='Enter')act('unlock')};
  }
  async function act(a,id){
    try{
      if(a==='unlock'){const p=document.getElementById(o.app+'VPass').value,p2=document.getElementById(o.app+'VPass2');
        if(p.length<10){note='Use at least 10 characters. Four unrelated words work well.';return draw()}
        if(p2&&p2.value!==p){note='The two passphrases don\'t match.';return draw()}
        if(items.length){try{await unseal(items[0],p)}catch(e){note='That passphrase doesn\'t open your saved copies.';return draw()}}
        pass=p;note='';return draw()}
      if(a==='lock'){pass=null;note='';return draw()}
      if(a==='save'){const nm=(document.getElementById(o.app+'VName').value||'').trim()||'Untitled';note='Saving…';draw();
        const rec=Object.assign(await seal(o.getState(),pass),{app:o.app,name:nm,at:new Date().toISOString()});
        await col().doc('v'+Date.now()).set(rec);await refresh();note='Saved "'+nm+'" online, encrypted.';return draw()}
      if(a==='load'){const d=items.find(x=>x.id===id);if(!d)return;let st;try{st=await unseal(d,pass)}catch(e){note='The passphrase doesn\'t open "'+(d.name||'Untitled')+'". It may have been saved with a different one.';return draw()}
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
/* Inside the Financial Tools of Life collection, each tool shows a link back to the home page. The build sets
   window.FTOL_HOME on the collection's copies; a tool opened on its own has no such link. */
(function(){try{if(!window.FTOL_HOME)return;const w=document.querySelector('.wrap');if(!w)return;const a=document.createElement('a');
  a.href=window.FTOL_HOME;a.textContent='\u2190 Financial Tools of Life';a.className='noprint';a.style.cssText='font:500 14px var(--body);color:var(--accent);text-decoration:none;align-self:flex-start';w.prepend(a)}catch(e){}})();
/* VAULT:END */
