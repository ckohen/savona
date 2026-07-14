import assert from 'node:assert/strict';
import { test } from 'node:test';
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

test('one transient connection check failure does not disconnect', async () => {
	const client = createClient();
	const errors = [];
	client.on(SavonaEvent.Error, (error) => errors.push(error));
	let disconnects = 0;
	client.disconnect = async () => {
		disconnects += 1;
	};
	client.property.getValue = async () => {
		throw new Error('Timed Out');
	};

	await client.runConnectionCheck();

	assert.equal(disconnects, 0);
	assert.equal(errors.length, 1);
	clearConnectionCheck(client);
});

test('consecutive connection check failures disconnect with reconnect enabled', async () => {
	const client = createClient();
	const errors = [];
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
	assert.equal(errors.length, 4);
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
