'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { YuqueClient } = require('./yuque-client.js');
const lake = '<!doctype lake><h1>test</h1><p><strong>bold</strong></p>';
function fixture(authType = 'cookie') {
    const calls = [];
    const state = { id: 2, book_id: 1, format: 'lake', origin_format: 'lake', content: lake, updated_at: '2026-10-01T00:00:00.000Z' };
    const c = Object.create(YuqueClient.prototype);
    c.authType = authType;
    c.userLogin = 'test';
    c.handleError = e => { throw e; };
    c.client = {
        async get(url, options) { calls.push({ method: 'get', url, options }); return { data: { data: { ...state } } }; },
        async post(url, data) {
            calls.push({ method: 'post', url, data });
            return { data: { data: url === '/api/docs/convert' ? { content: lake } : { ...state, ...data } } };
        },
        async put(url, data) { calls.push({ method: 'put', url, data }); return { data: { data: { ...state, ...data } } }; }
    };
    c.getOrgCookieClient = () => c.client;
    return { c, calls, state };
}
test('Cookie Markdown update converts then saves both Lake markers', async () => {
    const { c, calls } = fixture();
    await c.updateDoc(1, 2, { body: '# title' });
    assert.deepEqual(calls.map(x => x.method), ['post', 'get', 'put']);
    assert.equal(calls[0].url, '/api/docs/convert');
    assert.deepEqual(calls[0].data, { from: 'markdown', to: 'lake', content: '# title' });
    assert.equal(calls[2].data.format, 'lake');
    assert.equal(calls[2].data.origin_format, 'lake');
    assert.equal(calls[2].data.body, lake);
    assert.equal(calls[2].data.body_asl, lake);
});
test('raw Lake update preserves supplied rich text, no conversion', async () => {
    const { c, calls } = fixture();
    await c.updateDoc(1, 2, { body: lake, format: 'lake' });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].data.body, lake);
    assert.equal(calls[1].data.body_asl, lake);
});
test('invalid Lake input stops before network writes', async () => {
    const { c, calls } = fixture();
    await assert.rejects(c.updateDoc(1, 2, { body: '# Not Lake', format: 'lake' }), /Lake 正文无效/);
    assert.equal(calls.length, 0);
});
test('unsupported format rejects before mutation', async () => {
    const { c, calls } = fixture();
    await assert.rejects(c.createDoc(1, 'x', '<p>x</p>', 'html'), /仅支持/);
    assert.equal(calls.length, 0);
});
test('failed converter response never falls back to Markdown writes', async () => {
    const { c, calls } = fixture();
    c.client.post = async () => ({ data: { data: { content: '# bad conversion' } } });
    await assert.rejects(c.updateDoc(1, 2, { body: '# x' }), /转换失败/);
    assert.equal(calls.length, 0);
});
test('converter HTTP errors propagate, never mutate document', async () => {
    const { c, calls } = fixture();
    c.client.post = async () => { throw new Error('conversion HTTP 422'); };
    await assert.rejects(c.updateDoc(1, 2, { body: '# x' }), /HTTP 422/);
    assert.equal(calls.length, 0);
});
test('title-only update leaves format/body untouched', async () => {
    const { c, calls } = fixture();
    await c.updateDoc(1, 2, { title: 'new' });
    assert.deepEqual(calls, [{ method: 'put', url: '/api/docs/2', data: { title: 'new' } }]);
});
test('empty Markdown body is converted, not silently skipped', async () => {
    const { c, calls } = fixture();
    await c.updateDoc(1, 2, { body: '' });
    assert.equal(calls[0].data.content, '');
    assert.equal(calls.at(-1).data.body, lake);
});
test('wrong book prevents overwrite', async () => {
    const { c, calls } = fixture();
    await assert.rejects(c.updateDoc(99, 2, { body: lake, format: 'lake' }), /不属于/);
    assert.equal(calls.filter(x => x.method === 'put').length, 0);
});
test('stale updated_at prevents overwrite', async () => {
    const { c, calls } = fixture();
    await assert.rejects(c.updateDoc(1, 2, { body: lake, format: 'lake', expected_updated_at: 'old' }), /已发生变化/);
    assert.equal(calls.filter(x => x.method === 'put').length, 0);
});
test('matching updated_at allows write', async () => {
    const { c, calls, state } = fixture();
    await c.updateDoc(1, 2, { title: 'new', expected_updated_at: state.updated_at });
    assert.equal(calls.at(-1).method, 'put');
});
test('Cookie create converts Markdown, preserves slug', async () => {
    const { c, calls } = fixture();
    await c.createDoc(1, 'new', '# new', 'markdown', 'custom-slug');
    assert.equal(calls[1].url, '/api/docs');
    assert.equal(calls[1].data.format, 'lake');
    assert.equal(calls[1].data.origin_format, 'lake');
    assert.equal(calls[1].data.slug, 'custom-slug');
});
test('Cookie Lake create bypasses conversion', async () => {
    const { c, calls } = fixture();
    await c.createDoc(1, 'new', lake, 'lake');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].data.body, lake);
});
test('company update uses company converter and Lake save', async () => {
    const { c, calls } = fixture();
    await c.updateOrgDoc(2, { body: '# company' });
    assert.equal(calls[0].url, '/api/docs/convert');
    assert.equal(calls[1].data.origin_format, 'lake');
});
test('company create uses same safe conversion', async () => {
    const { c, calls } = fixture();
    await c.createOrgDoc(1, 'company', '# new');
    assert.equal(calls[1].url, '/api/books/1/docs');
    assert.equal(calls[1].data.format, 'lake');
});
test('company stale updated_at blocks writes', async () => {
    const { c, calls } = fixture();
    await assert.rejects(c.updateOrgDoc(2, { title: 'new', expected_updated_at: 'old' }), /已发生变化/);
    assert.equal(calls.filter(x => x.method === 'put').length, 0);
});
test('Token explicit Lake format is no longer forced to Markdown', async () => {
    const { c, calls } = fixture('token');
    await c.updateDoc(1, 2, { body: lake, format: 'lake' });
    assert.equal(calls[0].url, '/repos/1/docs/2');
    assert.equal(calls[0].data.format, 'lake');
});
test('read supplies readable body and optional exact Lake source', async () => {
    const { c } = fixture();
    const d = await c.getDoc(1, 'slug', true);
    assert.match(d.body, /# test/);
    assert.equal(d.body_format, 'markdown_approx');
    assert.equal(d.body_is_lossy, true);
    assert.equal(d.body_lake, lake);
    assert.equal((await c.getDoc(1, 'slug')).body_lake, undefined);
});
test('company read can include raw Lake', async () => {
    const { c } = fixture();
    assert.equal((await c.getOrgDoc(1, 'slug', true)).body_lake, lake);
});
test('edit-mode Lake body is not mistaken for Markdown and preserves exact source', async () => {
    const { c, calls, state } = fixture();
    delete state.content;
    state.body = lake;
    const doc = await c.getDoc(1, 'slug', true, true);
    assert.equal(calls[0].options.params.mode, 'edit');
    assert.equal(doc.body_lake, lake);
    assert.match(doc.body, /# test/);
    assert.equal(doc.body_format, 'markdown_approx');
});
test('code cards retain tags, entities and embedded fences in readable output', () => {
    const { c } = fixture();
    const code = '<p>not HTML</p>\n```\n&amp;';
    const encoded = encodeURIComponent(JSON.stringify({ code, mode: 'html' }));
    const text = c.extractTextFromLake(`<!doctype lake><card name="codeblock" value="data:${encoded}"></card>`);
    assert.equal(text, '````html\n' + code + '\n````');
});
test('actual MCP tools/list exposes new options', async () => {
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    const transport = new StdioClientTransport({ command: process.execPath, args: [require.resolve('./index.js')],
        env: { ...process.env }, stderr: 'pipe' });
    const client = new Client({ name: 'compatibility-test', version: '1' });
    try {
        await client.connect(transport);
        const { tools } = await client.listTools();
        for (const name of ['create_doc', 'update_doc', 'create_org_doc', 'update_org_doc']) {
            assert.deepEqual(tools.find(t => t.name === name).inputSchema.properties.format.enum, ['markdown', 'lake']);
        }
        for (const name of ['get_doc', 'get_org_doc', 'get_doc_by_url']) {
            assert.equal(tools.find(t => t.name === name).inputSchema.properties.include_lake.type, 'boolean');
        }
    } finally { await client.close(); }
});
