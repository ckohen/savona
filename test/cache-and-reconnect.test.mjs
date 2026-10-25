import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { EVENT_RECORDE_UPDATE, SavonaClient, SavonaEvent } from '../dist/index.js';

const createClient = () => new SavonaClient('127.0.0.1', 'user', 'password');
const flush = () => setImmediate();
const delay = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(predicate) {
	for (let attempt = 0; attempt < 50; attempt++) {
		if (predicate()) return;
		await delay(5);
	}
	assert.fail('Expected condition was not reached');
}

function uploadData(status = 200) {
	return {
		'Network.Service.Upload.History.Service': { 42: '1001' },
		'Network.Service.Upload.History.Status': { 42: status },
	};
}

test('an upload notification burst performs one refresh and reports cache completion', async () => {
	const client = createClient();
	let fetches = 0;
	const updates = [];
	client.property.getValue = async () => {
		fetches += 1;
		return uploadData();
	};
	client.on(SavonaEvent.CacheUpdate, (structure) => {
		if (structure === 'uploadJobs') updates.push(client.uploadJobs.jobs.get(42).status);
	});
	for (const source of ['Progress', 'History']) {
		for (const suffix of ['Service', 'Drive', 'ClipName', 'Status', 'Percentage', 'Total', 'Transferred', 'Name']) {
			client.notifications.propertyValueChanged.emit(`Network.Service.Upload.${source}.${suffix}`, {});
		}
	}
	await delay(10);
	assert.equal(fetches, 1);
	assert.deepEqual(updates, ['Completed']);
});

test('upload changes during a refresh schedule one follow-up without overlapping fetches', async () => {
	const client = createClient();
	const responses = [];
	let inFlight = 0;
	let maxInFlight = 0;
	const updates = [];
	client.property.getValue = () => {
		inFlight += 1;
		maxInFlight = Math.max(maxInFlight, inFlight);
		return new Promise((resolve) =>
			responses.push((data) => {
				inFlight -= 1;
				resolve(data);
			}),
		);
	};
	client.on(SavonaEvent.CacheUpdate, (structure) => {
		if (structure === 'uploadJobs') updates.push(client.uploadJobs.jobs.get(42).status);
	});
	const emitChange = () => client.notifications.propertyValueChanged.emit('Network.Service.Upload.Progress.Status', {});
	emitChange();
	await delay(5);
	assert.equal(responses.length, 1);
	emitChange();
	emitChange();
	assert.deepEqual(updates, []);
	responses[0](uploadData(100));
	await flush();
	assert.equal(responses.length, 2);
	responses[1](uploadData(200));
	await flush();
	assert.equal(maxInFlight, 1);
	assert.deepEqual(updates, ['Transferring', 'Completed']);
});

test('upload refresh failures are reported once and later notifications can recover', async () => {
	const client = createClient();
	const errors = [];
	client.on(SavonaEvent.Error, (error) => errors.push(error));
	client.property.getValue = async () => {
		throw new Error('upload request failed');
	};
	for (let index = 0; index < 16; index++) {
		client.notifications.propertyValueChanged.emit('Network.Service.Upload.Progress.Status', {});
	}
	await delay(10);
	assert.equal(errors.length, 1);
	assert.match(errors[0], /UploadJobs.*upload request failed/);
	client.property.getValue = async () => uploadData();
	client.notifications.propertyValueChanged.emit('Network.Service.Upload.Progress.Status', {});
	await delay(10);
	assert.equal(client.uploadJobs.jobs.get(42).status, 'Completed');
});

test('cache updates follow asynchronous notification refresh completion', async () => {
	const client = createClient();
	let finish;
	client.property.getStatus = () =>
		new Promise((resolve) => {
			finish = resolve;
		});
	const updates = [];
	client.on(SavonaEvent.CacheUpdate, (structure) => {
		if (structure === 'focus') updates.push(client.focus.distanceStatus);
	});
	client.notifications.propertyValueChanged.emit('Camera.Focus.Distance', 10);
	assert.deepEqual(updates, []);
	finish({ 'Camera.Focus.Distance': 'Locked' });
	await flush();
	assert.deepEqual(updates, ['Locked']);
});

test('menu refresh cache updates occur after status mutation', async () => {
	const client = createClient();
	client.property.getStatus = async ({ params }) =>
		Object.fromEntries(Object.keys(params[0]).map((key) => [key, 'Locked']));
	const updates = [];
	client.on(SavonaEvent.CacheUpdate, (structure) => {
		if (structure === 'colorBars') updates.push(client.colorBars.status);
	});
	client.notifications.propertyValueChanged.emit('P.Menu.pmw-f5x.Event.EventID', EVENT_RECORDE_UPDATE);
	await delay(10);
	assert.deepEqual(updates, ['Locked']);
});

test('automatic reconnect retries with backoff until recovery', async (context) => {
	const client = createClient();
	client.reconnectDelay = 1;
	context.after(() => {
		client.isManualDisconnect = true;
		client.cancelReconnect();
		clearInterval(client.connectionCheckInterval);
	});
	const errors = [];
	const delays = [];
	let attempts = 0;
	let connects = 0;
	client.on(SavonaEvent.Error, (error) => errors.push(error));
	client.on(SavonaEvent.Connect, () => {
		connects += 1;
	});
	client.linear.connect = async () => {
		attempts += 1;
		delays.push(client.reconnectDelay);
		if (attempts < 3) throw new Error('camera unavailable');
		client.linear._state = 'connected';
	};
	client.onConnect = async () => {};
	client.onDisconnect(1_006);
	client.onDisconnect(1_006);
	await until(() => connects === 1);
	assert.equal(attempts, 3);
	assert.deepEqual(delays, [1, 2, 4]);
	assert.equal(errors.length, 2);
	assert.equal(connects, 1);
	assert.equal(client.reconnectTimer, undefined);
	assert.equal(client.reconnectDelay, 1_000);
	clearInterval(client.connectionCheckInterval);
});

test('explicit disconnect cancels scheduled automatic retries', async () => {
	const client = createClient();
	client.reconnectDelay = 5;
	let attempts = 0;
	client.linear.connect = async () => {
		attempts += 1;
		throw new Error('should not reconnect');
	};
	client.onDisconnect(1_006);
	await client.disconnect();
	await delay(20);
	assert.equal(attempts, 0);
	assert.equal(client.reconnectTimer, undefined);
});

test('explicit disconnect during reconnect setup prevents delayed recovery', async () => {
	const client = createClient();
	client.reconnectDelay = 1;
	let finishSetup;
	let connects = 0;
	client.linear.connect = async () => {};
	client.onConnect = () =>
		new Promise((resolve) => {
			finishSetup = resolve;
		});
	client.on(SavonaEvent.Connect, () => {
		connects += 1;
	});
	client.onDisconnect(1_006);
	await until(() => finishSetup !== undefined);
	await client.disconnect();
	finishSetup();
	await flush();
	await delay(20);
	assert.equal(connects, 0);
	assert.equal(client.reconnectTimer, undefined);
});

test('an explicit initial connection failure rejects without starting retries', async () => {
	const client = createClient();
	let attempts = 0;
	client.linear.connect = async () => {
		attempts += 1;
		throw new Error('initial failure');
	};
	await assert.rejects(client.connect(), /initial failure/);
	await flush();
	assert.equal(attempts, 1);
	assert.equal(client.reconnectTimer, undefined);
});

test('digest setup failures reject connect and leave no health timer or retries', async () => {
	const client = createClient();
	client.linear.connect = async () => {
		client.linear._state = 'connected';
	};
	client.alternate.authentication.getNonce = async () => ({ nonce: 'test' });
	client.fetch = async () => new Response('cnonce=test\nresponse=test');
	client.alternate.authentication.digest = async () => {
		throw new Error('digest request timed out');
	};
	await assert.rejects(client.connect(), /digest request timed out/);
	assert.equal(client.state, 'disconnected');
	assert.equal(client.connectionCheckInterval, undefined);
	assert.equal(client.reconnectTimer, undefined);
});

test('explicit disconnect aborts the HTTP authentication exchange', async () => {
	const client = createClient();
	let authStarted = false;
	client.linear.connect = async () => {
		client.linear._state = 'connected';
	};
	client.alternate.authentication.getNonce = async () => ({ nonce: 'test' });
	client.fetch = async (_url, { signal }) => {
		authStarted = true;
		return new Promise((_resolve, reject) => {
			signal.addEventListener('abort', () => reject(signal.reason), { once: true });
		});
	};
	const connection = client.connect();
	await until(() => authStarted);
	await client.disconnect();
	await assert.rejects(connection, /cancelled/);
	assert.equal(client.isConnecting, false);
	assert.equal(client.reconnectTimer, undefined);
});

test('a rejected CacheUpdate consumer is reported through the error channel', async () => {
	const client = createClient();
	const errors = [];
	client.on(SavonaEvent.Error, (error) => errors.push(error));
	client.on(SavonaEvent.CacheUpdate, async () => {
		throw new Error('consumer failed');
	});
	client.notifications.propertyValueChanged.emit('P.Clip.Mediabox.Speed', 1);
	await delay(10);
	assert.deepEqual(errors, ['consumer failed']);
});

test('an upload notification queued before disconnect does not fetch afterward', async () => {
	const client = createClient();
	let fetches = 0;
	client.property.getValue = async () => {
		fetches += 1;
		return uploadData();
	};
	client.notifications.propertyValueChanged.emit('Network.Service.Upload.Progress.Status', {});
	client.isManualDisconnect = true;
	client.onDisconnect(1_000);
	await delay(10);
	assert.equal(fetches, 0);
});
