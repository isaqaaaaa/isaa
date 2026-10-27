import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCinematicPrompt } from './claudeService.js';
import { createPromptHandler } from './promptHandler.js';

const idea = 'Почему минус на минус даёт плюс';
const textResponse = { content: [{ type: 'text', text: '  An animated math cartoon.  ' }], stop_reason: 'end_turn' };
function mockClient(result = textResponse, error) {
    const calls = [];
    return { calls, messages: { async create(...args) {
        calls.push(args);
        if (error) throw error;
        return result;
    } } };
}
async function request(body, client) {
    const res = { status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
    await createPromptHandler((rawText, target) => generateCinematicPrompt(rawText, target, client))({ body }, res);
    return res;
}

test('omitted and explicit Omniflash keep the original request settings', async () => {
    for (const target of [undefined, 'omniflash']) {
        const client = mockClient();
        const res = await request({ rawText: idea, ...(target ? { target } : {}) }, client);
        assert.equal(res.code, 200);
        assert.deepEqual(res.body, { prompt: 'An animated math cartoon.' });
        const [payload, options] = client.calls[0];
        assert.equal(payload.model, 'claude-3-haiku-20240307');
        assert.equal(payload.max_tokens, 500);
        assert.equal(payload.system, 'You are a professional video director. Your task is to take a raw idea or description for a video and turn it into a continuous, cinematic paragraph in English, optimized as a prompt for a video generation model called Omniflash. Do not include any variables, timecodes, or structural formatting (like lists or bullet points). Output only the pure, vivid, cinematic description of the video.');
        assert.deepEqual(payload.messages, [{ role: 'user', content: idea }]);
        assert.deepEqual(options, { timeout: 15000 });
    }
});

test('Flow selects a single English 2D vertical math clip and preserves the user idea', async () => {
    const client = mockClient();
    assert.equal((await request({ rawText: idea, target: 'flow' }, client)).code, 200);
    const [payload, options] = client.calls[0];
    for (const requirement of ['Google Flow', 'English', 'ONE short', '2D', '8 seconds', '9:16', 'purposeful movement', 'mathematically correct', 'without headings', 'or a storyboard']) {
        assert.ok(payload.system.includes(requirement), requirement);
    }
    assert.equal(payload.max_tokens, 1000);
    assert.deepEqual(payload.messages, [{ role: 'user', content: idea }]);
    assert.deepEqual(options, { timeout: 15000 });
});

test('invalid or absent bodies and rawText return 400 without invoking Anthropic', async () => {
    for (const body of [undefined, null, {}, [], { rawText: '' }, { rawText: '  ' }, { rawText: 1 }, { rawText: {} }]) {
        const client = mockClient();
        const res = await request(body, client);
        assert.equal(res.code, 400);
        assert.equal(res.body.error, 'Missing or invalid "rawText" in request body.');
        assert.equal(client.calls.length, 0);
    }
});

test('unsupported target values return 400 before invoking Anthropic', async () => {
    for (const target of ['runway', 'FLOW', '', null, 1, {}, []]) {
        const client = mockClient();
        assert.equal((await request({ rawText: idea, target }, client)).code, 400);
        assert.equal(client.calls.length, 0);
    }
});

test('direct service input validation also prevents API calls', async () => {
    const client = mockClient();
    for (const rawText of [undefined, null, '', '  ', 42]) {
        await assert.rejects(generateCinematicPrompt(rawText, 'flow', client), /Invalid input/);
    }
    await assert.rejects(generateCinematicPrompt(idea, 'other', client), /Invalid target/);
    assert.equal(client.calls.length, 0);
});

test('timeout, API and network errors preserve endpoint error responses in both modes', async () => {
    for (const target of ['flow', 'omniflash']) {
        for (const [error, code, expected] of [
            [Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' }), 504, /timed out/],
            [Object.assign(new Error('Unauthorized'), { status: 401 }), 500, /Status: 401/],
            [Object.assign(new Error('Rate limit'), { status: 429 }), 500, /Status: 429/],
            [new Error('Connection error'), 500, /Connection error/]
        ]) {
            const res = await request({ rawText: idea, target }, mockClient(null, error));
            assert.equal(res.code, code);
            assert.match(res.body.details ?? res.body.error, expected);
        }
    }
});

test('empty, non-text and truncated API responses fail instead of returning a broken prompt', async () => {
    for (const result of [null, {}, { content: [] }, { content: [{ type: 'text', text: '  ' }] }, { content: [{ type: 'tool_use' }] }, { ...textResponse, stop_reason: 'max_tokens' }]) {
        const res = await request({ rawText: idea, target: 'flow' }, mockClient(result));
        assert.equal(res.code, 500);
        assert.match(res.body.details, /empty response|truncated/);
    }
});

test('multiple text blocks are combined; non-text blocks are ignored', async () => {
    const client = mockClient({ content: [{ type: 'thinking' }, { type: 'text', text: 'First.' }, { type: 'text', text: 'Second.' }] });
    assert.equal(await generateCinematicPrompt(idea, 'flow', client), 'First.\nSecond.');
});
