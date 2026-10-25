import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as msgpack from '@msgpack/msgpack';
import { LinearClient } from '../dist/protocol/linear.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connectedClient() {
	const client = new LinearClient({ host: '127.0.0.1' });
	const sent = [];
	client._state = 'connected';
	client.socket = {
		readyState: 1,
		send(data, callback) {
			sent.push(msgpack.decode(data));
			callback();
		},
		close() {
			client._onclose(1_000);
		},
		terminate() {},
	};
	return { client, sent };
}

function respond(client, id, result) {
	client._onmessage(msgpack.encode([1, id, null, result]), true);
}

test('completed and timed-out requests use distinct IDs and late replies are isolated', async () => {
	const { client, sent } = connectedClient();
	const first = client.request({ method: 'Property.GetValue', params: [] });
	respond(client, sent[0][1], { first: true });
	assert.deepEqual(await first, { first: true });

	await assert.rejects(client.request({ method: 'Property.GetValue', params: [], timeout: 5 }), /Timed Out/);
	const timedOutId = sent[1][1];
	let settled = false;
	const stop = client.request({ method: 'Clip.Recorder.Stop', params: ['main'] }).then((result) => {
		settled = true;
		return result;
	});
	assert.equal(new Set(sent.map((message) => message[1])).size, 3);
	respond(client, timedOutId, { health: true });
	await Promise.resolve();
	assert.equal(settled, false);
	respond(client, sent[2][1], { stopped: true });
	assert.deepEqual(await stop, { stopped: true });
	assert.equal(client.activeRequests.size, 0);
});

test('request IDs wrap at the protocol limit and skip outstanding requests', async () => {
	const { client, sent } = connectedClient();
	const zero = client.request({ method: 'First', params: [] });
	client.msgId = 4_294_967_295;
	const maximum = client.request({ method: 'Second', params: [] });
	const wrapped = client.request({ method: 'Third', params: [] });
	assert.deepEqual(
		sent.map((message) => message[1]),
		[0, 4_294_967_295, 1],
	);
	for (const message of sent) respond(client, message[1], null);
	await Promise.all([zero, maximum, wrapped]);
});

test('disconnected requests reject without leaving a timeout promise behind', async () => {
	const client = new LinearClient({ host: '127.0.0.1' });
	await assert.rejects(
		client.request({ method: 'Clip.Recorder.Stop', params: ['main'], timeout: 5 }),
		/before opening websocket/,
	);
	assert.equal(client.activeRequests.size, 0);
	await delay(15);
});

test('asynchronous send failures clear pending requests and timers', async () => {
	const { client } = connectedClient();
	let failSend;
	client.socket.send = (_data, callback) => {
		failSend = callback;
	};
	const request = client.request({ method: 'Clip.Recorder.Stop', params: ['main'], timeout: 5 });
	const pending = [...client.activeRequests.values()][0];
	failSend(new Error('write failed'));
	await assert.rejects(request, /write failed/);
	assert.equal(client.activeRequests.size, 0);
	assert.equal(pending.timeout._destroyed, true);
	await delay(15);
});

test('socket closure promptly rejects requests including requests with no timeout', async () => {
	const { client } = connectedClient();
	const timed = client.request({ method: 'Timed', params: [] });
	const untimed = client.request({ method: 'Untimed', params: [], timeout: 0 });
	const pending = [...client.activeRequests.values()];
	client._onclose(1_006);
	await Promise.all([assert.rejects(timed, /WebSocket closed/), assert.rejects(untimed, /WebSocket closed/)]);
	assert.equal(client.activeRequests.size, 0);
	assert.equal(pending[0].timeout._destroyed, true);
});

test('response, send error, and close races settle each request once', async () => {
	const { client, sent } = connectedClient();
	let failSend;
	client.socket.send = (data, callback) => {
		sent.push(msgpack.decode(data));
		failSend = callback;
	};
	const request = client.request({ method: 'Test', params: [] });
	respond(client, sent[0][1], { success: true });
	failSend(new Error('late send error'));
	client._onclose(1_006);
	assert.deepEqual(await request, { success: true });
	assert.equal(client.activeRequests.size, 0);
});

test('disconnect waits for a synchronous close and can be called repeatedly', async () => {
	const { client } = connectedClient();
	await Promise.all([client.disconnect(), client.disconnect()]);
	assert.equal(client.state, 'disconnected');
});

test('malformed messages are reported without counting as inbound activity', () => {
	const { client } = connectedClient();
	const errors = [];
	client.on('error', (error) => errors.push(error));
	assert.doesNotThrow(() => client._onmessage(Uint8Array.of(0xc1), true));
	assert.doesNotThrow(() => client._onmessage(msgpack.encode([2]), true));
	assert.equal(client.lastInboundActivityAt, 0);
	assert.equal(errors.length, 2);
});

test('fragmented message buffers are decoded as one message', () => {
	const { client } = connectedClient();
	const notifications = [];
	client.on('notify', (notification) => notifications.push(notification));
	const encoded = Buffer.from(msgpack.encode([2, 'Notify.Test', [true]]));
	client._onmessage([encoded.subarray(0, 3), encoded.subarray(3)], true);
	assert.deepEqual(notifications, [{ name: 'Notify.Test', data: [true] }]);
	assert(client.lastInboundActivityAt > 0);
});

test('socket errors reject pending requests and emit one disconnect', async () => {
	const { client } = connectedClient();
	const errors = [];
	const disconnects = [];
	client.on('error', (error) => errors.push(error));
	client.on('disconnect', (code) => disconnects.push(code));
	const pending = client.request({ method: 'Pending', params: [], timeout: 0 });
	client._onclose(4_999, new Error('socket failure'));
	client._onclose(1_006);
	await assert.rejects(pending, /socket failure/);
	assert.equal(errors.length, 1);
	assert.deepEqual(disconnects, [4_999]);
	assert.equal(client.activeRequests.size, 0);
});
