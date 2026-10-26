import test from 'node:test';
import assert from 'node:assert/strict';
import { unifiedPage, unifiedPageCount } from '../src/utils/adminPagination.js';

const PAGE=36;
test('all 47 originals and 791 imports appear on exactly one combined page each', () => {
 const ids=[];
 const total=47+791;
 const pageCount=unifiedPageCount(47,791,PAGE,'all');
 assert.equal(pageCount,24);
 for(let page=1;page<=pageCount;page++) {
  const { originalStart,originalEnd,importOffset,importLimit }=unifiedPage(47,page,PAGE,'all');
  for(let i=originalStart;i<originalEnd;i++)ids.push(`original-${i}`);
  for(let i=importOffset;i<Math.min(791,importOffset+importLimit);i++)ids.push(`import-${i}`);
 }
 assert.equal(ids.length,total);
 assert.equal(new Set(ids).size,total);
 assert.deepEqual(unifiedPage(47,1,PAGE,'all'),{first:0,originalStart:0,originalEnd:36,importOffset:0,importLimit:0});
 assert.deepEqual(unifiedPage(47,2,PAGE,'all'),{first:36,originalStart:36,originalEnd:47,importOffset:0,importLimit:25});
 assert.deepEqual(unifiedPage(47,3,PAGE,'all'),{first:72,originalStart:47,originalEnd:47,importOffset:25,importLimit:36});
});
test('source tabs and filtered result count paginate independently',()=>{
 assert.equal(unifiedPageCount(47,0,36,'original'),2);
 assert.equal(unifiedPageCount(0,791,36,'imported'),22);
 assert.equal(unifiedPageCount(0,0,36,'all'),1);
 assert.equal(unifiedPageCount(47,null,36,'all'),null);
 assert.equal(unifiedPage(47,2,36,'original').importLimit,0);
 assert.equal(unifiedPage(47,2,36,'imported').importOffset,36);
 assert.equal(unifiedPage(0,1,36,'all').importLimit,36);
});
test('single unified admin navigation replaces independent imports section',async()=>{
 const {readFileSync}=await import('node:fs');
 const page=readFileSync(new URL('../src/components/AdminPage.jsx',import.meta.url),'utf8');
 const workspace=readFileSync(new URL('../src/components/AdminCatalogWorkspace.jsx',import.meta.url),'utf8');
 assert.match(page,/id: "catalog", name: "All products"/);
 assert.doesNotMatch(page,/Catalogue health/);
 assert.doesNotMatch(page,/id: "imports"/);
 assert.match(workspace,/originalPage\.map/);
 assert.match(workspace,/unifiedPage\(/);
 assert.match(workspace,/Page \{page\}/);
 assert.doesNotMatch(workspace,/Imported page/);
});
