const $ = id => document.getElementById(id);
const labels = {gate1:'保真已通过',gate2:'彩色已通过',preview:'本地预览',changed:'文件已变化'};
let entries=[];
let selected;
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function versionFor(shot){const status=$('status').value;return shot.versions.find(v=>v.status===status)||shot.versions[0];}
function render(){
  const query=$('search').value.trim().toLocaleLowerCase();
  const scene=$('scene').value,status=$('status').value;
  const visible=entries.filter(s=>(!query||[s.sequenceId,s.title,...s.tags,s.description].join(' ').toLocaleLowerCase().includes(query))&&(!scene||s.sceneType===scene)&&(!status||s.versions.some(v=>v.status===status)));
  if($('sort').value==='recent')visible.sort((a,b)=>b.versions[0].modifiedAt.localeCompare(a.versions[0].modifiedAt));
  $('count').textContent=`${visible.length} / ${entries.length}`;
  $('grid').replaceChildren();
  for(const shot of visible){
    const version=versionFor(shot);
    const button=el('button',undefined,'shot');button.setAttribute('aria-label',`查看 ${shot.sequenceId} ${shot.title}`);
    const thumb=el('div',undefined,'thumbnail');
    const fallback=el('span',undefined,'preview-missing');fallback.append(el('strong',shot.sequenceId.replace('seq-','SHOT / ')),el('span','点击播放镜头'));
    const img=el('img');img.src=version.poster;img.alt='';img.loading='lazy';img.addEventListener('error',()=>img.classList.add('failed'));
    thumb.append(fallback,img,el('span','▶','play'));
    if(Number.isFinite(shot.durationSeconds))thumb.append(el('span',`${shot.durationSeconds.toFixed(1)} s`,'duration'));
    const meta=el('div',undefined,'card-meta');meta.append(el('span',shot.sequenceId.toUpperCase(),'number'),el('span',labels[version.status],`state ${version.status.startsWith('gate')?'approved':''}`));
    button.append(thumb,meta,el('h3',shot.title),el('div',[shot.sceneType,...shot.tags.slice(0,2)].join(' · '),'card-tags'));
    button.addEventListener('click',()=>openShot(shot,version.id));$('grid').append(button);
  }
  $('empty').hidden=visible.length>0;
  $('empty').querySelector('h2').textContent=entries.length?'没有匹配的镜头':'这里还没有镜头';
  $('empty').querySelector('p').textContent=entries.length?'换个关键词或调整筛选条件试试。':'完成复刻并登记本地成片后，就能在这里查看。公开项目不附带 WangChuan 的私人镜头和素材。';
}
function selectVersion(){
  const v=selected.versions.find(v=>v.id===$('version').value);
  $('player').pause();$('player').src=v.url;$('player').poster=v.poster;$('play-error').hidden=true;
  $('approval').textContent=v.status==='changed'?'文件与批准时的版本不一致，需重新核对。':v.status.startsWith('gate')?`${labels[v.status]} · 视频哈希已核对`:'这是本地预览，尚未核对用户批准。';
  $('facts').replaceChildren();
  for(const [key,value] of [['画幅',selected.width&&selected.height?`${selected.width} × ${selected.height}`:'未记录'],['文件',v.fileName],['更新',new Date(v.modifiedAt).toLocaleString('zh-CN')]])$('facts').append(el('dt',key),el('dd',value));
}
function openShot(shot,versionId){
  selected=shot;$('detail-id').textContent=shot.sequenceId.toUpperCase();$('detail-title').textContent=shot.title;$('detail-desc').textContent=shot.description;
  $('detail-tags').replaceChildren(...shot.tags.map(t=>el('span',t)));
  $('version').replaceChildren(...shot.versions.map(v=>{const option=el('option',`${v.label} · ${labels[v.status]}`);option.value=v.id;return option;}));
  $('version').value=versionId;selectVersion();$('detail').showModal();
}
async function load(){
  $('refresh').disabled=true;$('notice').textContent='正在读取本地镜头与批准记录…';
  try{
    const response=await fetch('/api/library');if(!response.ok)throw Error('无法连接本地镜头库');
    const data=await response.json();entries=data.entries;$('total').textContent=String(entries.length).padStart(2,'0');
    const current=$('scene').value;$('scene').replaceChildren(el('option','全部类型'));$('scene').firstChild.value='';
    for(const scene of [...new Set(entries.map(e=>e.sceneType))]){const option=el('option',scene);option.value=scene;$('scene').append(option);}
    $('scene').value=current;$('notice').textContent=data.warnings.length?`有 ${data.warnings.length} 份记录无法读取，已保留其他镜头。`:'';render();
  }catch(error){$('notice').textContent=`${error.message}。请确认查看服务正在运行，然后点击刷新。`;}
  finally{$('refresh').disabled=false;}
}
$('search').addEventListener('input',render);
for(const id of ['scene','status','sort'])$(id).addEventListener('change',render);
$('refresh').addEventListener('click',load);$('version').addEventListener('change',selectVersion);
$('close').addEventListener('click',()=>$('detail').close());$('detail').addEventListener('close',()=>$('player').pause());
$('player').addEventListener('error',()=>$('play-error').hidden=false);
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('detail').open){event.preventDefault();$('search').focus();}});
load();
