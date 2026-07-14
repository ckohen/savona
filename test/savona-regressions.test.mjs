import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as msgpack from '@msgpack/msgpack';
import { EVENT_RECORDE_UPDATE, SavonaClient, SavonaEvent } from '../dist/index.js';

const MenuEventPropertyName = 'P.Menu.pmw-f5x.Event.EventID';

function delay(ms = 0) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function createClient() {
	return new SavonaClient('127.0.0.1', 'user', 'password');
}

function clearConnectionCheck(client) {
	clearInterval(client.connectionCheckInterval);
	client.connectionCheckInterval = undefined;
}

function receiveLinearMessage(client, message) {
	client.linear._state = 'connected';
	client.linear._onmessage(msgpack.encode(message), true);
}

test('rejected async notification callbacks are reported without throwing', async () => {
	const client = createClient();
	const errors = [];
	client.on(SavonaEvent.Error, (error) => errors.push(error));
	client.notifications.propertyValueChanged.on('Camera.Test.Notification', async () => {
		throw new Error('listener failed loudly');
	});

	assert.doesNotThrow(() => {
		client.notifications.propertyValueChanged.emit('Camera.Test.Notification', true);
	});
	await delay(20);

	assert(errors.some((error) => error.includes('propertyValueChanged') && error.includes('listener failed loudly')));
});

test('notification callback failures are logged when the client has no error listener', async () => {
	const client = createClient();
	const errors = [];
	const originalError = console.error;
	console.error = (...args) => errors.push(args);
	client.notifications.propertyValueChanged.on('Camera.Test.UnobservedNotification', async () => {
		throw new Error('unobserved listener failure');
	});

	try {
		assert.doesNotThrow(() => {
			client.notifications.propertyValueChanged.emit('Camera.Test.UnobservedNotification', true);
		});
		await delay(20);

		assert(
			errors.some(
				(error) =>
					error[0] === 'Savona error:' &&
					String(error[1]).includes('propertyValueChanged') &&
					String(error[1]).includes('unobserved listener failure'),
			),
		);
	} finally {
		console.error = originalError;
	}
});

test('recent inbound notification activity suppresses a health poll', async () => {
	const client = createClient();
	let healthChecks = 0;
	client.property.getValue = async () => {
		healthChecks += 1;
		return {};
	};

	receiveLinearMessage(client, [2, 'Notify.Property.Value.Changed', [{ 'Camera.Test.Activity': true }]]);
	await client.runConnectionCheck();

	assert.equal(healthChecks, 0);
	clearConnectionCheck(client);
});

test('a normal inbound response counts as connection activity', async () => {
	const client = createClient();
	let healthChecks = 0;
	client.property.getValue = async () => {
		healthChecks += 1;
		return {};
	};

	receiveLinearMessage(client, [1, 1_234, null, {}]);
	await client.runConnectionCheck();

	assert(client.linear.lastInboundActivityAt > 0);
	assert.equal(healthChecks, 0);
	clearConnectionCheck(client);
});

test('activity arriving during a pending health request prevents a timeout failure', async () => {
	const client = createClient();
	const debug = [];
	const errors = [];
	client.on(SavonaEvent.Debug, (message) => debug.push(message));
	client.on(SavonaEvent.Error, (error) => errors.push(error));
	let rejectHealthCheck;
	client.property.getValue = () =>
		new Promise((_resolve, reject) => {
			rejectHealthCheck = reject;
		});

	const healthCheck = client.runConnectionCheck();
	await delay(5);
	receiveLinearMessage(client, [2, 'Notify.Property.Value.Changed', [{ 'Camera.Test.Activity': true }]]);
	rejectHealthCheck(new Error('Timed Out'));
	await healthCheck;

	assert.equal(client.consecutiveConnectionCheckFailures, 0);
	assert.deepEqual(debug, []);
	assert.deepEqual(errors, []);
	clearConnectionCheck(client);
});

test('the first two connection check failures emit Debug without disconnecting', async () => {
	const client = createClient();
	const debug = [];
	const errors = [];
	client.on(SavonaEvent.Debug, (message) => debug.push(message));
	client.on(SavonaEvent.Error, (error) => errors.push(error));
	let disconnects = 0;
	client.disconnect = async () => {
		disconnects += 1;
	};
	client.property.getValue = async () => {
		throw new Error('Timed Out');
	};

	await client.runConnectionCheck();
	await client.runConnectionCheck();

	assert.equal(disconnects, 0);
	assert.equal(debug.length, 2);
	assert(debug[0].includes('(1/3)') && debug[0].includes('Timed Out'));
	assert(debug[1].includes('(2/3)') && debug[1].includes('Timed Out'));
	assert.deepEqual(errors, []);
	clearConnectionCheck(client);
});

test('the third consecutive connection check failure emits Error and disconnects with reconnect enabled', async () => {
	const client = createClient();
	const debug = [];
	const errors = [];
	client.on(SavonaEvent.Debug, (message) => debug.push(message));
	client.on(SavonaEvent.Error, (error) => errors.push(error));
	const reconnectFlags = [];
	client.disconnect = async (reconnect = false) => {
		reconnectFlags.push(reconnect);
	};
	client.property.getValue = async () => {
		throw new Error('Timed Out');
	};

	await client.runConnectionCheck();
	await client.runConnectionCheck();
	await client.runConnectionCheck();

	assert.deepEqual(reconnectFlags, [true]);
	assert.equal(debug.length, 2);
	assert.equal(errors.length, 2);
	assert(errors[0].includes('(3/3)') && errors[0].includes('Timed Out'));
	assert(errors[1].includes('Disconnecting after 3 consecutive'));
	clearConnectionCheck(client);
});

test('an idle client still performs a health check', async () => {
	const client = createClient();
	let healthChecks = 0;
	client.property.getValue = async () => {
		healthChecks += 1;
		return {};
	};

	await client.runConnectionCheck();

	assert.equal(healthChecks, 1);
	assert.equal(client.consecutiveConnectionCheckFailures, 0);
	clearConnectionCheck(client);
});

test('connection checks do not overlap', async () => {
	const client = createClient();
	let calls = 0;
	let inFlight = 0;
	let maxInFlight = 0;
	let resolveRequest;
	const request = new Promise((resolve) => {
		resolveRequest = resolve;
	});
	client.property.getValue = async () => {
		calls += 1;
		inFlight += 1;
		maxInFlight = Math.max(maxInFlight, inFlight);
		await request;
		inFlight -= 1;
		return {};
	};

	const first = client.runConnectionCheck();
	const second = client.runConnectionCheck();
	await delay(10);
	resolveRequest();
	await Promise.all([first, second]);

	assert.equal(calls, 1);
	assert.equal(maxInFlight, 1);
	clearConnectionCheck(client);
});

test('record update menu events are coalesced and refreshed sequentially', async () => {
	const client = createClient();
	const requests = [];
	let inFlight = 0;
	let maxInFlight = 0;
	client.property.getStatus = async ({ params }) => {
		const request = params[0];
		requests.push(request);
		inFlight += 1;
		maxInFlight = Math.max(maxInFlight, inFlight);
		await delay(1);
		inFlight -= 1;
		return Object.fromEntries(Object.keys(request).map((property) => [property, 'Unlocked']));
	};

	client.notifications.propertyValueChanged.emit(MenuEventPropertyName, EVENT_RECORDE_UPDATE);
	await delay(100);
	const singleEventRequestCount = requests.length;

	client.notifications.propertyValueChanged.emit(MenuEventPropertyName, EVENT_RECORDE_UPDATE);
	client.notifications.propertyValueChanged.emit(MenuEventPropertyName, EVENT_RECORDE_UPDATE);
	await delay(100);
	const repeatedEventRequestCount = requests.length - singleEventRequestCount;

	assert(singleEventRequestCount > 0);
	assert.equal(repeatedEventRequestCount, singleEventRequestCount);
	assert.equal(maxInFlight, 1);
	clearConnectionCheck(client);
});

test('adding an external EventID listener does not trigger the listener warning', () => {
	const warnings = [];
	const originalWarn = console.warn;
	console.warn = (...args) => {
		warnings.push(args.join(' '));
	};

	try {
		const client = createClient();
		client.notifications.propertyValueChanged.on(MenuEventPropertyName, () => {});

		assert.equal(client.notifications.propertyValueChanged.listenerCount(MenuEventPropertyName), 2);
		assert(!warnings.some((warning) => warning.includes('Possible AsyncEventEmitter memory leak detected')));
	} finally {
		console.warn = originalWarn;
	}
});

test('an actual WebSocket close emits disconnect and schedules reconnection', async () => {
	const client = createClient();
	const disconnects = [];
	let reconnects = 0;
	client.on(SavonaEvent.Disconnect, (code, reason) => disconnects.push({ code, reason: reason.toString() }));
	client.reconnect = async () => {
		reconnects += 1;
	};
	client.linear._state = 'connected';

	client.linear._onclose(1_006, Buffer.from('connection lost'));

	assert.deepEqual(disconnects, [{ code: 1_006, reason: 'connection lost' }]);
	assert.equal(client.state, 'disconnected');
	await delay(1_050);
	assert.equal(reconnects, 1);
});
