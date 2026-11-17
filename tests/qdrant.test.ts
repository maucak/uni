import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { pointId, sparseVector, scopeFilter, qdrantCandidates } from '../server/services/rag/qdrant.ts';
import type { RagContext } from '../server/services/rag/context.ts';

const context: RagContext = { university:'unknown', universityName:'', program:null, year:null, subject:'scholarship', scholarshipType:'kyk' };
test('stable sparse features preserve Turkish suffix normalization and aggregate term frequency', () => {
  const one = sparseVector('burs başvurusu');
  const two = sparseVector('bursu başvuruları burs');
  assert.deepEqual(one.indices, two.indices);
  assert.ok(two.values.some(v => v > 1));
  assert.match(pointId('source:chunk'), /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  assert.equal(pointId('source:chunk'), pointId('source:chunk'));
});
test('unknown university and KYK scholarship use national scope before search', () => {
  const filter = scopeFilter(context);
  assert.ok(filter.must.some(c => JSON.stringify(c) === JSON.stringify({ key:'scope', match:{ any:['national'] } })));
  assert.ok(filter.must.some(c => JSON.stringify(c) === JSON.stringify({ key:'national_scholarship', match:{ value:true } })));
  assert.ok(filter.must_not.some(c => JSON.stringify(c).includes('meal_scholarship')));
});
test('remote retrieval pins both searches to one published version and requests bounded IDs only', async () => {
  const originalUrl = process.env.QDRANT_URL;
  const originalCollection = process.env.QDRANT_COLLECTION;
  const calls: { url:string; body:any }[] = [];
  const server = createServer(async (req,res) => {
    let body = ''; for await (const part of req) body += part;
    calls.push({ url:req.url!, body:body ? JSON.parse(body) : null });
    const result = req.url === '/aliases' ? { aliases:[{ alias_name:'test_index', collection_name:'test_index_v1' }] }
      : req.url?.endsWith('/points/query') ? { points:[{ score:0.9, payload:{ chunk_id:'chunk1' } }] }
      : { points_count:123 };
    res.setHeader('content-type','application/json'); res.end(JSON.stringify({ result }));
  });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  try {
    process.env.QDRANT_URL = `http://127.0.0.1:${(server.address() as { port:number }).port}`;
    process.env.QDRANT_COLLECTION = 'test_index';
    const result = await qdrantCandidates('KYK bursu',context,'',[1,2]);
    assert.equal(result.version,'test_index_v1');
    assert.equal(result.chunks,123);
    const queries = calls.filter(c => c.body?.using);
    assert.equal(queries.length,2);
    for (const q of queries) {
      assert.equal(q.url,'/collections/test_index_v1/points/query');
      assert.equal(q.body.limit,20);
      assert.deepEqual(q.body.with_payload,['chunk_id']);
      assert.deepEqual(q.body.filter,scopeFilter(context));
    }
  } finally {
    if (originalUrl === undefined) delete process.env.QDRANT_URL; else process.env.QDRANT_URL = originalUrl;
    if (originalCollection === undefined) delete process.env.QDRANT_COLLECTION; else process.env.QDRANT_COLLECTION = originalCollection;
    await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve()));
  }
});
