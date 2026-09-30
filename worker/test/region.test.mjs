import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const upstream = [];
globalThis.fetch = async url => {
  upstream.push(new URL(url).hostname);
  const groq = String(url).includes('groq');
  return new Response(JSON.stringify(groq ? { choices: [{ message: { content: 'groq' } }] } : { candidates: [{ content: { parts: [{ text: 'gemini' }] } }] }), { status: 200 });
};
function curate(country, provider = 'gemini', origin = 'https://museum-of-you.pages.dev') {
  const request = new Request('https://proxy.example/api/curate', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model: 'gemini-3.8-flash', prompt: 'p', image: 'data:image/jpeg;base64,AAAA' }),
  });
  Object.defineProperty(request, 'cf', { value: country ? { country } : undefined });
  return request;
}

test('Gemini is used outside the EU/EEA, Switzerland and the UK', async () => {
  upstream.length = 0;
  const res = await worker.fetch(curate('MX'), { GEMINI_API_KEY: 'k' });
  assert.equal(res.status, 200);
  assert.deepEqual(upstream, ['generativelanguage.googleapis.com']);
});

test('Gemini requests from restricted countries are rejected without Groq', async () => {
  upstream.length = 0;
  for (const country of ['DE', 'IS', 'CH', 'GB']) {
    const res = await worker.fetch(curate(country), { GEMINI_API_KEY: 'k' });
    assert.equal(res.status, 451);
    assert.equal((await res.json()).code, 'region_unavailable');
  }
  assert.deepEqual(upstream, []);
});

test('Gemini requests from restricted countries are rerouted to Groq when configured', async () => {
  upstream.length = 0;
  const res = await worker.fetch(curate('FR'), { GEMINI_API_KEY: 'k', GROQ_API_KEY: 'g' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.provider, 'groq');
  assert.equal(body.rerouted, true);
  assert.deepEqual(upstream, ['api.groq.com']);
});

test('Unknown origins are rejected', async () => {
  const res = await worker.fetch(curate('MX', 'gemini', 'https://evil.example'), { GEMINI_API_KEY: 'k' });
  assert.equal(res.status, 403);
});
