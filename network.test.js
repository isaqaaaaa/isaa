import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Run the real entry point without installed dependencies, .env or an API key.
// The Express double forwards listen arguments to a real Node TCP server.
// Port 3000 is checked before substituting port 0 to avoid local port conflicts.
const expressDouble = `
    import assert from 'node:assert/strict';
    import net from 'node:net';
    function express() {
        return {
            use() {},
            post(path, handler) {
                assert.equal(path, '/generate-prompt');
                assert.equal(typeof handler, 'function');
            },
            listen(...args) {
                assert.equal(Number(args[0]), Number(process.env.EXPECTED_PORT));
                args[0] = 0;
                const server = net.createServer();
                server.on('error', error => { throw error; });
                server.on('listening', () => {
                    try {
                        assert.equal(server.address().address, '127.0.0.1');
                        assert.equal(server.address().family, 'IPv4');
                    } finally {
                        server.close();
                    }
                });
                return server.listen(...args);
            }
        };
    }
    express.json = () => () => {};
    export default express;
`;

for (const [label, port, expected] of [['default port', '', '3000'], ['custom PORT', '3001', '3001']]) {
    test(`startup binds only IPv4 loopback with ${label}`, () => {
        const script = `
            import { registerHooks } from 'node:module';
            const doubles = {
                express: ${JSON.stringify(expressDouble)},
                dotenv: 'export default { config() {} };'
            };
            registerHooks({
                resolve(specifier, context, nextResolve) {
                    if (Object.hasOwn(doubles, specifier)) {
                        return { url: 'data:text/javascript,' + encodeURIComponent(doubles[specifier]), shortCircuit: true };
                    }
                    if (specifier === '@anthropic-ai/sdk') throw new Error('Unexpected Anthropic import');
                    return nextResolve(specifier, context);
                }
            });
            await import(${JSON.stringify(new URL('./index.js', import.meta.url).href)});
        `;
        const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
            env: { ...process.env, PORT: port, EXPECTED_PORT: expected, ANTHROPIC_API_KEY: '', NODE_OPTIONS: '' },
            encoding: 'utf8',
            timeout: 10000
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.match(result.stdout, new RegExp('Server listening at http://127\\.0\\.0\\.1:' + expected));
    });
}
