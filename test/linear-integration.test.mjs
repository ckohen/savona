import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { WebSocketServer } from 'ws';
import { LinearClient } from '../dist/protocol/linear.js';

async function fixture(context) {
	const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
	await once(server, 'listening');
	const client = new LinearClient({ host: '127.0.0.1', port: server.address().port });
	context.after(async () => {
		await client.disconnect();
		for (const socket of server.clients) socket.terminate();
		await new Promise((resolve) => server.close(resolve));
	});
	return { server, client };
}

test('a real WebSocket reconnect clears connection timers and ignores old socket events', async (context) => {
	const { client } = await fixture(context);
	await client.connect();
	const firstSocket = client.socket;
	assert.equal(client.connectionTimeout, undefined);
	await client.disconnect();
	await client.connect();
	assert.notEqual(client.socket, firstSocket);
	firstSocket.emit('close', 1_006, Buffer.from('late close'));
	firstSocket.emit('error', new Error('late socket error'));
	assert.equal(client.state, 'connected');
	assert.equal(client.connectionTimeout, undefined);
});

test('a real remote close rejects outstanding requests before their timeout', async (context) => {
	const { server, client } = await fixture(context);
	await client.connect();
	const serverSocket = [...server.clients][0];
	const pending = client.request({ method: 'Clip.Recorder.Stop', params: ['main'], timeout: 0 });
	serverSocket.terminate();
	await assert.rejects(pending, /WebSocket closed/);
	assert.equal(client.state, 'disconnected');
	assert.equal(client.activeRequests.size, 0);
});
