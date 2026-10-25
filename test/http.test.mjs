import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { fetchWithDigest } from '../dist/protocol/http.js';

async function serverFor(context, handler) {
	const server = createServer(handler);
	context.after(
		() =>
			new Promise((resolve) => {
				server.closeAllConnections();
				server.close(resolve);
			}),
	);
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	return `http://127.0.0.1:${server.address().port}`;
}

test('HTTP fetch handles empty-body response statuses', async (context) => {
	const url = await serverFor(context, (_req, res) => {
		res.writeHead(204);
		res.end();
	});
	const response = await fetchWithDigest(url, 'user', 'password');
	assert.equal(response.status, 204);
	assert.equal(await response.text(), '');
});

test('HTTP fetch accepts Headers, header records, and header tuples', async (context) => {
	const url = await serverFor(context, (req, res) => {
		res.end(req.headers['x-camera-test']);
	});
	for (const headers of [
		new Headers({ 'X-Camera-Test': 'headers' }),
		{ 'X-Camera-Test': 'record' },
		[['X-Camera-Test', 'tuple']],
	]) {
		const response = await fetchWithDigest(url, 'user', 'password', { headers });
		assert.equal(await response.text(), new Headers(headers).get('x-camera-test'));
	}
});

test('HTTP fetch rejects when a response body is truncated', async (context) => {
	const url = await serverFor(context, (_req, res) => {
		res.writeHead(200, { 'content-length': 100 });
		res.write('partial');
		setImmediate(() => res.destroy());
	});
	await assert.rejects(fetchWithDigest(url, 'user', 'password'), /aborted|socket hang up/);
});

test('HTTP fetch honors abort signals during a pending response', async (context) => {
	let start;
	const started = new Promise((resolve) => {
		start = resolve;
	});
	const url = await serverFor(context, () => start());
	const controller = new AbortController();
	const pending = fetchWithDigest(url, 'user', 'password', { signal: controller.signal });
	await started;
	controller.abort();
	await assert.rejects(pending, { name: 'AbortError' });
});

test('HTTP Response construction errors reject the fetch promise', async (context) => {
	const url = await serverFor(context, (_req, res) => {
		res.writeHead(700);
		res.end();
	});
	await assert.rejects(fetchWithDigest(url, 'user', 'password'), /status.*range/i);
});

test('digest-protected HTTP fetch retries with an Authorization header', async (context) => {
	let requests = 0;
	const url = await serverFor(context, (req, res) => {
		requests += 1;
		if (!req.headers.authorization) {
			res.writeHead(401, { 'www-authenticate': 'Digest realm="camera", nonce="test", qop="auth", algorithm=MD5' });
			res.end();
			return;
		}
		assert.match(req.headers.authorization, /^Digest /);
		res.end('cnonce=client\nresponse=digest');
	});
	const response = await fetchWithDigest(url, 'user', 'password');
	assert.equal(requests, 2);
	assert.equal(await response.text(), 'cnonce=client\nresponse=digest');
});
