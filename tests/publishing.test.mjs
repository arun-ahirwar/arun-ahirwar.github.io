import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {build,cleanBody} from '../scripts/build.mjs';

test('only published articles appear publicly; sitemap and pages update',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'arun-living-test-'));
  try {
    await fs.mkdir(path.join(root,'content/articles'),{recursive:true});
    await fs.mkdir(path.join(root,'public'),{recursive:true});
    await fs.writeFile(path.join(root,'content/site.json'),JSON.stringify({title:'Arun Living',description:'A personal journal',tagline:'Everyday living',intro:'Welcome',author:'Arun Ahirwar',bio:'Writer',url:'https://arun-ahirwar.github.io',github:'https://github.com/arun-ahirwar'}));
    const article={title:'Small rooms',slug:'Small Rooms',description:'Practical small room ideas',category:'furniture',date:'2026-10-07',published:true,image:'/uploads/small-room.jpg',body:'<h2>Start here</h2><p>See <a href="/category/furniture/">furniture</a>.</p><script>alert(1)</script>'};
    await fs.writeFile(path.join(root,'content/articles','small-rooms.json'),JSON.stringify(article));
    await fs.writeFile(path.join(root,'content/articles','secret-draft.json'),JSON.stringify({...article,slug:'secret-draft',published:false}));
    const result=await build({root,now:new Date('2026-10-08T08:00:00Z')});
    assert.equal(result.posts,1);
    const html=await fs.readFile(path.join(root,'dist/articles/small-rooms/index.html'),'utf8');
    const map=await fs.readFile(path.join(root,'dist/sitemap.xml'),'utf8');
    const home=await fs.readFile(path.join(root,'dist/index.html'),'utf8');
    assert.match(html,/<h2 id="section-1">Start here<\/h2>/);
    assert.match(html,/href="\/category\/furniture\/"/);
    assert.match(html,/alt="Small rooms"/);
    assert.doesNotMatch(html,/<script>alert/);
    assert.match(map,/articles\/small-rooms/);
    assert.doesNotMatch(map,/secret-draft/);
    assert.doesNotMatch(home,/secret-draft/);
    await assert.rejects(fs.stat(path.join(root,'dist/articles/secret-draft/index.html')));
    await assert.rejects(fs.stat(path.join(root,'dist/articles/editor-practice/index.html')));
    assert.match(await fs.readFile(path.join(root,'dist/robots.txt'),'utf8'),/Sitemap: https:\/\/arun-ahirwar.github.io\/sitemap.xml/);
    article.published=false;
    await fs.writeFile(path.join(root,'content/articles','small-rooms.json'),JSON.stringify(article));
    await build({root,now:new Date('2026-10-08T08:00:00Z')});
    await assert.rejects(fs.stat(path.join(root,'dist/articles/small-rooms/index.html')));
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('editor HTML preserves formatting and removes unsafe URLs, scripts and handlers',()=>{
  const body=cleanBody('<h2>Ideas</h2><ul><li><strong>One</strong></li></ul><p><a href="javascript:alert(1)" onclick="evil()">bad</a><a href="/articles/one/">good</a></p><img src="https://example.org/a.jpg" onerror="evil()" alt="Chair"><script>evil()</script>');
  assert.match(body,/<h2>Ideas<\/h2>/);
  assert.match(body,/<ul><li><strong>One<\/strong><\/li><\/ul>/);
  assert.match(body,/href="\/articles\/one\/"/);
  assert.doesNotMatch(body,/javascript:|onclick|onerror|<script>/);
});
