import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sanitizeHtml from 'sanitize-html';

export const categories = [
  {slug:'furniture', name:'Furniture', number:'01', note:'Pieces that make a place your own.', topics:'Materials · Comfort · Practical choices'},
  {slug:'fashion', name:'Fashion', number:'02', note:'Find a style that feels like you.', topics:'Personal style · Wardrobe · Details'},
  {slug:'health', name:'Health', number:'03', note:'A thoughtful look at everyday wellbeing.', topics:'Wellbeing · Healthy habits · Awareness'},
  {slug:'fitness', name:'Fitness', number:'04', note:'Make movement a part of your day.', topics:'Movement · Routines · Motivation'},
  {slug:'beauty', name:'Beauty', number:'05', note:'A little care, on your own terms.', topics:'Personal care · Routines · Essentials'},
  {slug:'home-and-decor', name:'Home & Decor', number:'06', note:'Small touches. A space that feels like home.', topics:'Interiors · Organisation · Inspiration'}
];
export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const plain = html => sanitizeHtml(String(html ?? ''),{allowedTags:[],allowedAttributes:{}});
const jsonLD = object => JSON.stringify(object).replace(/</g,'\\u003c');
const goodUrl = value => typeof value === 'string' && (/^\/(?!\/)/.test(value) || /^https:\/\//.test(value)) ? value : '';
const dateText = date => new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date));
function validDate(value) {
  const date = String(value ?? '').slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date ? date : null;
}
export function cleanBody(body) {
  return sanitizeHtml(String(body ?? ''), {
    allowedTags:['p','br','strong','b','em','i','u','s','h2','h3','h4','h5','h6','ul','ol','li','a','blockquote','img','figure','figcaption','hr','table','thead','tbody','tr','th','td','pre','code','sup','sub'],
    allowedAttributes:{a:['href','title','rel'],img:['src','alt','width','height','loading','decoding'],ol:['start'],th:['colspan','rowspan'],td:['colspan','rowspan']},
    allowedSchemes:['http','https','mailto','tel'],
    allowedSchemesByTag:{img:['https']},
    allowProtocolRelative:false,
    transformTags:{
      h1:'h2',
      a:(tagName,attribs)=>({tagName,attribs:{...attribs,rel:[...(attribs.rel||'').split(/\s+/).filter(x=>['sponsored','nofollow','ugc'].includes(x)),'noopener'].join(' ')}}),
      img:(tagName,attribs)=>({tagName,attribs:{...attribs,loading:'lazy',decoding:'async',alt:attribs.alt||''}})
    }
  });
}
function articleMarkup(post) {
  const headings=[];
  const html=cleanBody(post.body).replace(/<h([23])>([\s\S]*?)<\/h\1>/g,(_,level,text)=>{
    const id=`section-${headings.length+1}`;
    headings.push({id,text:plain(text),level});
    return `<h${level} id="${id}">${text}</h${level}>`;
  });
  return {html, headings};
}
function validatePost(post, file) {
  for (const key of ['title','slug','description','category','body']) if(typeof post[key]!=='string'||!post[key].trim()) throw new Error(`${file}: ${key} is required.`);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) throw new Error(`${file}: URL name must use lowercase English letters, numbers and hyphens.`);
  if(!categories.some(c=>c.slug===post.category)) throw new Error(`${file}: choose one of the six categories.`);
  if(!validDate(post.date)) throw new Error(`${file}: publication date must be a valid date.`);
  if(post.updated && (!validDate(post.updated) || validDate(post.updated)<validDate(post.date))) throw new Error(`${file}: updated date must be on or after publication date.`);
  if(post.image && (!goodUrl(post.image)||!post.imageAlt?.trim())) throw new Error(`${file}: cover image needs a valid HTTPS/local URL and image description.`);
}

export async function build({root=process.cwd(),outDir=path.join(root,'dist'),now=new Date()}={}) {
  root=path.resolve(root); outDir=path.resolve(outDir);
  if(!outDir.startsWith(root+path.sep)||outDir===root) throw new Error('Build output must be inside the project directory.');
  const site=JSON.parse(await fs.readFile(path.join(root,'content/site.json'),'utf8'));
  const origin=new URL(site.url);
  if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash) throw new Error('Website address must be an HTTPS origin.');
  site.url=origin.origin;
  const entries=await fs.readdir(path.join(root,'content/articles'));
  const posts=[],seen=new Set();
  for(const file of entries.filter(f=>f.endsWith('.json'))) {
    const post=JSON.parse(await fs.readFile(path.join(root,'content/articles',file),'utf8'));
    if(post.published!==true) continue;
    validatePost(post,file);
    if(seen.has(post.slug)) throw new Error(`Duplicate article URL: ${post.slug}`);
    seen.add(post.slug);
    post.date=validDate(post.date); post.updated=validDate(post.updated)||post.date;
    if(post.date>now.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})) continue;
    post.url=`/articles/${post.slug}/`;
    post.readTime=Math.max(1,Math.ceil(plain(post.body).split(/\s+/).length/200));
    posts.push(post);
  }
  posts.sort((a,b)=>b.date.localeCompare(a.date)||a.slug.localeCompare(b.slug));
  // outDir is resolved and checked above before recursive removal.
  await fs.rm(outDir,{recursive:true,force:true});
  await fs.mkdir(outDir,{recursive:true});
  await fs.cp(path.join(root,'public'),outDir,{recursive:true});
  const urls=[];
  const link=(url,label,cls='')=>`<a class="${cls}" href="${escape(url)}">${escape(label)}</a>`;
  const catNav=categories.map(c=>link(`/category/${c.slug}/`,c.name)).join('');
  const footer=`<footer><div class="footer-top"><a class="wordmark" href="/">${escape(site.title)}<span class="brand-dot">.</span></a><p>A journal by ${escape(site.author)}.<br>Home, style & everyday wellbeing.</p><nav aria-label="Footer">${link('/about/','About')}${link('/admin/','Writer dashboard')}${link('/sitemap.xml','Sitemap')}</nav></div><div class="footer-bottom"><span>© ${now.getUTCFullYear()} ${escape(site.author)}</span><span>Made for a more thoughtful everyday.</span></div></footer>`;
  function shell({title,description=site.description,url='/',lang='en',noindex=false,body,structured}) {
    const canonical=site.url+url;
    return `<!doctype html><html lang="${escape(lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title===site.title?title:`${title} | ${site.title}`)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="${noindex?'noindex,follow':'index,follow'}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="${structured?'article':'website'}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:site_name" content="${escape(site.title)}"><meta name="theme-color" content="#143f35"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/style.css">${site.searchConsoleVerification?`<meta name="google-site-verification" content="${escape(site.searchConsoleVerification)}">`:''}${structured?`<script type="application/ld+json">${jsonLD(structured)}</script>`:''}</head><body><a class="skip" href="#main">Skip to content</a><div class="topnote">THE EVERYDAY JOURNAL <span>BY ${escape(site.author).toUpperCase()}</span></div><header><a class="wordmark" href="/" aria-label="${escape(site.title)} home">${escape(site.title)}<span class="brand-dot">.</span></a><nav class="primary" aria-label="Main">${link('/','Journal')}${link('/#explore','Explore')}${link('/about/','About Arun')}</nav></header><nav class="category-nav" aria-label="Categories">${catNav}</nav><main id="main">${body}</main>${footer}</body></html>`;
  }
  async function page(url,options,lastmod) {
    const destination=url.endsWith('.html')?url.slice(1):path.join(url.slice(1),'index.html');
    const full=path.join(outDir,destination);
    await fs.mkdir(path.dirname(full),{recursive:true});
    await fs.writeFile(full,shell({...options,url}));
    if(!options.noindex) urls.push({url:site.url+url,lastmod});
  }
  const card=post=>`<article class="article-card">${post.image?`<a href="${post.url}" tabindex="-1" aria-hidden="true"><img src="${escape(goodUrl(post.image))}" alt="${escape(post.imageAlt)}" width="640" height="420" loading="lazy"></a>`:''}<div class="eyebrow">${escape(categories.find(c=>c.slug===post.category).name)}</div><h3><a href="${post.url}">${escape(post.title)}</a></h3><p>${escape(post.description)}</p><div class="meta"><time datetime="${post.date}">${dateText(post.date)}</time><span>${post.readTime} min read</span></div></article>`;
  const categoryTiles=categories.map(c=>`<a class="category-card" href="/category/${c.slug}/"><span class="category-number">${c.number}</span><h3>${c.name}</h3><p>${c.note}</p><span class="category-topics">${c.topics}</span></a>`).join('');
  await page('/',{title:site.title,body:`<section class="hero"><div class="hero-copy"><div class="eyebrow">HOME · STYLE · WELLBEING</div><h1>${escape(site.tagline)}</h1><p>${escape(site.intro)}</p><a class="button" href="#explore">Find your next read</a><div class="hero-foot">A personal journal by <a href="/about/">${escape(site.author)}</a></div></div><figure class="hero-photo"><img src="/images/living-room.webp" width="1440" height="810" alt="Forest-green armchair beside a walnut table in a sunlit living room" fetchpriority="high"><figcaption>THE ART OF EVERYDAY LIVING <span>01 / HOME</span></figcaption></figure></section><section class="explore" id="explore"><div class="section-head"><div><div class="eyebrow">FOLLOW YOUR CURIOSITY</div><h2>Six ways to feel at home.</h2></div><p>Something for your space.<br>Something for yourself.</p></div><div class="category-grid">${categoryTiles}</div></section><section class="latest" id="articles"><div class="section-head"><div><div class="eyebrow">FROM THE JOURNAL</div><h2>The latest stories.</h2></div><span class="article-count">${posts.length} ${posts.length===1?'article':'articles'}</span></div>${posts.length?`<div class="article-grid">${posts.map(card).join('')}</div>`:`<div class="empty"><span class="empty-mark">A</span><div><h3>A new chapter is taking shape.</h3><p>The first stories are on their way. Explore the categories above, or meet the writer behind the journal.</p><a href="/about/">Meet Arun</a></div></div>`}</section><section class="author-strip"><div class="author-monogram" aria-hidden="true">AA</div><div><div class="eyebrow">THE PERSON BEHIND THE PAGES</div><h2>Hello, I’m Arun.</h2><p>${escape(site.bio)}</p><a href="/about/">More about the journal</a></div></section>`});
  for(const category of categories) {
    const selected=posts.filter(p=>p.category===category.slug);
    await page(`/category/${category.slug}/`,{title:category.name,description:category.note,noindex:!selected.length,body:`<section class="page-intro"><div class="breadcrumbs"><a href="/">Journal</a><span>/</span> ${category.name}</div><div class="eyebrow">THE ${category.name.toUpperCase()} EDIT</div><h1>${category.name}<span class="brand-dot">.</span></h1><p>${category.note}</p></section><section class="listing">${selected.length?`<div class="article-grid">${selected.map(card).join('')}</div>`:`<div class="empty"><div><h2>Stories are on their way.</h2><p>There aren’t any ${escape(category.name.toLowerCase())} articles here yet. Come back for the first entry.</p><a href="/#explore">Explore the journal</a></div></div>`}</section>`});
  }
  for(const post of posts) {
    const cat=categories.find(c=>c.slug===post.category), rendered=articleMarkup(post);
    const similar=posts.filter(p=>p.category===post.category&&p.slug!==post.slug).slice(0,3);
    await page(post.url,{title:post.title,description:post.description,lang:'en',structured:{'@context':'https://schema.org','@type':'BlogPosting',headline:post.title,description:post.description,datePublished:post.date,dateModified:post.updated,mainEntityOfPage:site.url+post.url,inLanguage:'en',articleSection:cat.name,author:{'@type':'Person',name:site.author,url:site.url+'/about/'},...(post.image?{image:new URL(goodUrl(post.image),site.url).href}:{})},body:`<article><div class="article-title"><div class="breadcrumbs"><a href="/">Journal</a><span>/</span><a href="/category/${cat.slug}/">${cat.name}</a></div><div class="eyebrow">${cat.name}</div><h1>${escape(post.title)}</h1><p class="standfirst">${escape(post.description)}</p><div class="meta"><a href="/about/">${escape(site.author)}</a><time datetime="${post.date}">${dateText(post.date)}</time><span>${post.readTime} min read</span>${post.updated!==post.date?`<span>Updated ${dateText(post.updated)}</span>`:''}</div></div>${post.image?`<figure class="article-cover"><img src="${escape(goodUrl(post.image))}" alt="${escape(post.imageAlt)}" width="1200" height="700"></figure>`:''}<div class="reading-layout"><aside>${rendered.headings.length?`<nav class="toc" aria-label="In this article"><h2>In this article</h2>${rendered.headings.map(h=>`<a href="#${h.id}" class="toc-level-${h.level}">${h.text}</a>`).join('')}</nav>`:''}</aside><div class="prose">${rendered.html}${['health','fitness'].includes(post.category)?'<div class="health-note">This article provides general information and is not a substitute for individual advice from a qualified healthcare professional.</div>':''}<div class="article-byline"><strong>Written by ${escape(site.author)}</strong><p>${escape(site.bio)}</p></div></div></div></article>${similar.length?`<section class="latest"><h2>More in ${cat.name}</h2><div class="article-grid">${similar.map(card).join('')}</div></section>`:''}`},post.updated);
  }
  await page('/about/',{title:'About Arun',description:`Meet ${site.author}, the writer behind ${site.title}.`,body:`<section class="page-intro about-intro"><div class="eyebrow">BEHIND THE JOURNAL</div><h1>A little more<br>about Arun<span class="brand-dot">.</span></h1><p>${escape(site.bio)}</p></section><div class="prose standalone"><h2>What you’ll find here</h2><p>${escape(site.title)} brings together six interests: furniture, fashion, health, fitness, beauty, and home and decor. Each category has its own space, so you can go straight to the subjects you enjoy.</p><h2>A note on wellbeing</h2><p>Health and fitness articles are for general information. They should not replace advice from a qualified professional who understands your circumstances.</p><h2>Find me online</h2><p>${link(goodUrl(site.github)||'https://github.com/arun-ahirwar','Arun on GitHub')}</p><a class="button" href="/#explore">Explore the journal</a></div>`});
  await page('/admin/',{title:'Writer dashboard',noindex:true,body:`<section class="admin-intro"><div class="eyebrow">${escape(site.title)} / WRITER’S DESK</div><h1>Your next story<br>starts here.</h1><p>Write, format and publish with the visual editor.</p><a class="button" href="https://app.pagescms.org/">Open article editor</a><p class="helper">Sign in with GitHub, then select <strong>arun-ahirwar.github.io</strong> and the <strong>main</strong> branch.</p></section><section class="dashboard-guide"><div><span class="step">01</span><h2>Write & format</h2><p>Open Articles and choose New entry. Add your title, URL name, category, date and summary. The article editor supports headings, bold, italic, lists, links and images.</p></div><div><span class="step">02</span><h2>Connect your stories</h2><p>Select the words you want to link and use the editor’s link control. Paste an existing article’s address, such as <code>/articles/your-url-name/</code>.</p></div><div><span class="step">03</span><h2>Publish when ready</h2><p>Switch Published on and save. The website updates after the GitHub build succeeds, usually in a few minutes. Keep it off to work on a draft.</p></div></section><section class="admin-help prose"><h2>First-time setup</h2><p>Pages CMS needs permission to edit the <strong>arun-ahirwar.github.io</strong> repository. Choose only this repository when connecting the GitHub App. The visual editor opens on Pages CMS, and your public blog stays on GitHub Pages.</p><p>Drafts are hidden from the website, but files and their history in a public GitHub repository are public. Do not put private information in drafts.</p><p>After publishing, open the article on your website to check the formatting and links. If an update does not appear, check <a href="https://github.com/arun-ahirwar/arun-ahirwar.github.io/actions">publishing status</a>. <a href="/writer-guide/">Read the step-by-step writer guide</a>.</p></section>`});
  await page('/writer-guide/',{title:'Writer guide',noindex:true,body:`<section class="page-intro"><div class="eyebrow">WRITER’S DESK</div><h1>Write. Review. Publish.</h1><p>Your guide to using the article editor.</p></section><div class="prose standalone"><h2>1. Start a new article</h2><p>Open <a href="https://app.pagescms.org/">Pages CMS</a>, sign in with GitHub, choose your blog repository, and open Articles. Use New entry. The practice draft is available for learning the editor.</p><h2>2. Set the title and URL</h2><p>Write your title in English. For URL name, use a short English phrase with hyphens, such as <code>small-bedroom-storage</code>. The resulting link is <code>/articles/small-bedroom-storage/</code>. Keep this URL name unchanged after publishing to preserve existing links.</p><h2>3. Format your content</h2><p>Select text and use the editor toolbar. Use H2 for main sections and H3 for smaller sections. The article title already supplies H1. Use ordered lists for steps and bullet lists for items. Select text and click the link control to link to an article or a relevant source. Use the image control to upload a picture you have rights to use.</p><h2>4. Check the details</h2><p>Add a clear summary, category and publication date. Describe your cover image in the image-description field. For health topics, include authoritative sources and avoid unsupported treatment claims.</p><h2>5. Save and publish</h2><p>Keep Published off while drafting. Turn it on and save when ready. Saving commits your changes to GitHub, and the publishing workflow updates your blog and sitemap. A future date is held back until a later build on or after that date; this setup does not promise automatic timed publishing.</p><h2>6. Edit or unpublish</h2><p>Open an existing article to edit it. Change the updated date only after a substantial revision. To unpublish, turn Published off and save. The next successful build removes the article from the website and sitemap; search engines may take longer to remove cached results.</p><h2>7. Tell Google about your blog</h2><p>Add <code>${escape(site.url)}/</code> as a URL-prefix property in Google Search Console. Copy the HTML verification tag’s content value into Website settings → Google Search Console verification code. Save, wait for publishing, verify in Google, then submit <code>sitemap.xml</code>.</p><p class="health-note">GitHub Free uses a public repository for this website. Draft content and Git history are visible there. This is a publishing workflow, not a private notebook.</p><a class="button" href="/admin/">Back to writer dashboard</a></div>`});
  await page('/404.html',{title:'Page not found',noindex:true,body:'<section class="page-intro"><div class="eyebrow">404 / A LITTLE DETOUR</div><h1>This page isn’t here.</h1><p>The story may have moved or the address may be incomplete.</p><a class="button" href="/">Back to the journal</a></section>'});
  await fs.writeFile(path.join(outDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${escape(u.url)}</loc>${u.lastmod?`<lastmod>${u.lastmod}</lastmod>`:''}</url>`).join('\n')}\n</urlset>\n`);
  await fs.writeFile(path.join(outDir,'robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n\n# Writer pages use a noindex meta tag. Authentication is handled by Pages CMS.\n`);
  await fs.writeFile(path.join(outDir,'.nojekyll'),'');
  return {posts:posts.length,urls:urls.length,outDir};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) console.log(await build());
