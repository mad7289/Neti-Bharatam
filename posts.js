(function(){
const root=document.getElementById("categoryPosts");if(!root)return;
const category=root.dataset.category;
function renderBody(container,source){
 const lines=String(source||"").split(/\r?\n/);let i=0;
 while(i<lines.length){const line=lines[i].trim();
  if(line.startsWith("|")&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}/.test(lines[i+1])){
   const headers=line.split("|").slice(1,-1).map(x=>x.trim());i+=2;
   const table=document.createElement("table"),thead=document.createElement("thead"),hr=document.createElement("tr");
   headers.forEach(v=>{const th=document.createElement("th");th.textContent=v;hr.append(th);});thead.append(hr);table.append(thead);
   const tbody=document.createElement("tbody");
   while(i<lines.length&&lines[i].trim().startsWith("|")){
    const cells=lines[i].trim().split("|").slice(1,-1).map(x=>x.trim());const tr=document.createElement("tr");
    cells.forEach((v,n)=>{const td=document.createElement("td");td.textContent=v;if(n===0&&v.toUpperCase()==="SELL")td.className="action-sell";if(n===0&&v.toUpperCase()==="BUY")td.className="action-buy";tr.append(td);});tbody.append(tr);i++;
   }
   table.append(tbody);const wrap=document.createElement("div");wrap.className="post-table-wrap";wrap.append(table);container.append(wrap);continue;
  }
  if(line){const p=document.createElement("p");p.textContent=line;container.append(p);}i++;
 }
}
(async()=>{try{const response=await fetch("https://netibharatam-api.vmadhu430.workers.dev/posts?category="+encodeURIComponent(category));if(!response.ok)throw new Error();const data=await response.json();root.replaceChildren();const posts=data.posts||[];
 if(!posts.length){const empty=document.createElement("div");empty.className="posts-message";empty.textContent="No updates have been published yet.";root.append(empty);return;}
 posts.forEach(post=>{const article=document.createElement("article");article.className="nifty-post";const h=document.createElement("h3");h.textContent=post.title||"Update";const date=document.createElement("div");date.className="post-date";date.textContent=post.created_at?new Date(post.created_at.replace(" ","T")+"Z").toLocaleString():"";const body=document.createElement("div");body.className="post-body";renderBody(body,post.body);article.append(h,date,body);root.append(article);});
 }catch{root.textContent="Updates are temporarily unavailable. Please try again later.";}})();
})();