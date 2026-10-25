import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SavonaClient } from '../dist/index.js';

const createClient = () => new SavonaClient('127.0.0.1', 'user', 'password');

test('assignable status refresh accepts the requested property and preserves cached button identity', async () => {
	const client = createClient();
	client.property.getValue = async () => ({ 'Button.Assign': { 'Assignable.1': ['Rec', 'On'] } });
	await client.assignableButtons.fetchValues();
	const button = client.assignableButtons.buttons.get(1);
	client.property.getStatus = async ({ params }) => {
		assert.deepEqual(Object.keys(params[0]), ['P.Control.ProxyRec.StartStop']);
		return { 'P.Control.ProxyRec.StartStop': 'Locked' };
	};
	client.capability.getValue = async () => ({ 'Button.Assign': { 'Assignable.1': [true, 'Rec', ['Rec', 'None']] } });
	assert.equal(await client.assignableButtons.fetchStatus(), 'Locked');
	assert.equal(client.assignableButtons.buttons.get(1), button);
	assert.equal(button.status, true);
	assert.deepEqual(button.capability, ['Rec', 'None']);
	let keys;
	client.button.sendKeys = async (options) => {
		keys = options.params;
	};
	await button.press();
	assert.deepEqual(keys, [['Assignable.1']]);
});

test('upload summaries use the same deduplicated jobs as the public cache', async () => {
	const client = createClient();
	client.property.getValue = async () => ({
		'Network.Service.Upload.Progress.Service': { 42: '1001' },
		'Network.Service.Upload.Progress.Status': { 42: 100 },
		'Network.Service.Upload.Progress.Total': { 42: 100 },
		'Network.Service.Upload.Progress.Transferred': { 42: 50 },
		'Network.Service.Upload.History.Service': { 42: '1001' },
		'Network.Service.Upload.History.Status': { 42: 400 },
		'Network.Service.Upload.History.Total': { 42: 100 },
		'Network.Service.Upload.History.Transferred': { 42: 10 },
	});
	const { jobs, summary } = await client.uploadJobs.fetchValue();
	assert.equal(jobs.size, 1);
	assert.equal(jobs.get(42).status, 'Transferring');
	assert.equal(summary.remainingClips, 1);
	assert.equal(summary.percentage, 50);
});

test('upload speed stays finite for samples in the same clock tick', async (context) => {
	context.mock.method(Date, 'now', () => 100_000);
	const client = createClient();
	let transferred = 10;
	client.property.getValue = async () => ({
		'Network.Service.Upload.Progress.Service': { 42: '1001' },
		'Network.Service.Upload.Progress.Status': { 42: 100 },
		'Network.Service.Upload.Progress.Total': { 42: 100 },
		'Network.Service.Upload.Progress.Transferred': { 42: transferred },
	});
	await client.uploadJobs.fetchValue();
	transferred = 20;
	const { summary } = await client.uploadJobs.fetchValue();
	assert.equal(summary.currentBitsPerSecond, 0);
	assert.equal(summary.remainingMinutes, null);
});
