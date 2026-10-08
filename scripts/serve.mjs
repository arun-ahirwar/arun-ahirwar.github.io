import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(file!==root&&!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
    try {if((await fs.stat(file)).isDirectory()) file=path.join(file,'index.html');} catch {}
    let body,status=200;
    try {body=await fs.readFile(file);} catch {body=await fs.readFile(path.join(root,'404.html'));file='404.html';status=404;}
    res.writeHead(status,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  } catch {res.writeHead(500);res.end('Preview error');}
}).listen(4173,'127.0.0.1',()=>console.log('Arun Living preview: http://127.0.0.1:4173'));
