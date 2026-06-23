import type { SavonaClient } from '../savona.js';
import type { UploadSettingId } from './UploadSettings.js';

export type UploadJobId = number;

export type UploadJobSource = 'History' | 'Progress';

export interface UploadJob {
	clipName: string;
	drive: string;
	id: UploadJobId;
	name: string;
	percentage: number;
	service: UploadSettingId;
	source: UploadJobSource;
	status: UploadJobStatus;
	statusCode: number;
	total: number;
	transferred: number;
}

export interface UploadJobSummary {
	completedClips: number;
	currentBitsPerSecond: number;
	currentMegabitsPerSecond: number;
	percentage: number;
	remainingClips: number;
	remainingMinutes: number | null;
}

export const UploadJobStatusLabels = {
	'0': 'Waiting',
	'100': 'Transferring',
	'200': 'Completed',
	'300': 'Aborted',
	'400': 'OtherError',
	'401': 'DestinationAuthenticationFailed',
	'402': 'UploadError',
	'403': 'FileAccessError',
	'404': 'DestinationCertificateError',
	'405': 'MediaAccessError',
	'406': 'DestinationConnectionError',
	'407': 'DestinationServerError',
	'408': 'UploadError',
	'409': 'DestinationCertificateNotValid',
	'410': 'DestinationCertificateExpired',
	'411': 'RelayConnectionError',
	'412': 'RelayAuthenticationFailed',
	'413': 'RelayCertificateError',
	'414': 'PassiveModeNotSupported',
	'415': 'UnsupportedFormat',
} as const;

export type UploadJobStatus = (typeof UploadJobStatusLabels)[keyof typeof UploadJobStatusLabels] | 'Unknown';

const JobProperties = [
	'Network.Service.Upload.Progress.Service',
	'Network.Service.Upload.Progress.Drive',
	'Network.Service.Upload.Progress.ClipName',
	'Network.Service.Upload.Progress.Status',
	'Network.Service.Upload.Progress.Percentage',
	'Network.Service.Upload.Progress.Total',
	'Network.Service.Upload.Progress.Transferred',
	'Network.Service.Upload.Progress.Name',
	'Network.Service.Upload.History.Service',
	'Network.Service.Upload.History.Drive',
	'Network.Service.Upload.History.ClipName',
	'Network.Service.Upload.History.Status',
	'Network.Service.Upload.History.Percentage',
	'Network.Service.Upload.History.Total',
	'Network.Service.Upload.History.Transferred',
	'Network.Service.Upload.History.Name',
] as const;

function propertyName(source: UploadJobSource, suffix: string) {
	return `Network.Service.Upload.${source}.${suffix}`;
}

function uploadJobIdFromValue(value: unknown) {
	if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
	if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
	return Number.parseInt(value, 10);
}

function getString(data: Record<string, unknown>, source: UploadJobSource, suffix: string, id: UploadJobId) {
	const property = data[propertyName(source, suffix)] as Record<string, unknown> | undefined;
	const value = property?.[String(id)];
	return typeof value === 'string' ? value : '';
}

function getNumber(data: Record<string, unknown>, source: UploadJobSource, suffix: string, id: UploadJobId) {
	const property = data[propertyName(source, suffix)] as Record<string, unknown> | undefined;
	const value = property?.[String(id)];
	if (typeof value === 'number') return value;
	if (typeof value !== 'string') return 0;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function getUploadSettingId(data: Record<string, unknown>, source: UploadJobSource, suffix: string, id: UploadJobId) {
	const value = getNumber(data, source, suffix, id);
	return Number.isNaN(value) ? 0 : value;
}

function statusFromCode(code: number): UploadJobStatus {
	return (UploadJobStatusLabels as Record<string, UploadJobStatus | undefined>)[String(code)] ?? 'Unknown';
}

function isRestartableStatusCode(code: number) {
	return code === 300 || code >= 400;
}

export class UploadJobs {
	public jobs = new Map<UploadJobId, UploadJob>();

	public summary: UploadJobSummary = {
		completedClips: 0,
		currentBitsPerSecond: 0,
		currentMegabitsPerSecond: 0,
		percentage: 0,
		remainingClips: 0,
		remainingMinutes: 0,
	};

	private previousTransferredBytes = 0;

	private previousTransferredId: UploadJobId | null = null;

	private previousTransferredTime = 0;

	public constructor(public client: SavonaClient) {
		for (const property of JobProperties) {
			client.notifications.propertyValueChanged.on(property, () => void this.fetchValue());
		}
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [Object.fromEntries(JobProperties.map((property) => [property, ['*']]))],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const data = response as Record<string, unknown>;
		this.jobs = new Map([...this.parseJobs(data, 'Progress'), ...this.parseJobs(data, 'History')].map((job) => [job.id, job]));
		this.summary = this.parseSummary(data);
		return { jobs: this.jobs, summary: this.summary };
	}

	public async abortJobs(ids: UploadJobId[]) {
		const jobs = ids.map((id) => this.jobs.get(id)).filter((job): job is UploadJob => job !== undefined);
		const status: Record<string, string> = {};

		for (const job of jobs) {
			if (job.source === 'Progress' && job.status !== 'Completed' && job.status !== 'Aborted') {
				status[String(job.id)] = '300';
			}
		}

		if (Object.keys(status).length === 0) return;
		await this.client.property.setValue({ params: [{ 'Network.Service.Upload.Progress.Status': status }] });
	}

	public async restartJobs(ids: UploadJobId[]) {
		const jobs = ids.map((id) => this.jobs.get(id)).filter((job): job is UploadJob => job !== undefined);
		const status: Record<string, string> = {};

		for (const job of jobs) {
			if (job.source === 'History' && isRestartableStatusCode(job.statusCode)) {
				status[String(job.id)] = '0';
			}
		}

		if (Object.keys(status).length === 0) return;
		await this.client.property.setValue({ params: [{ 'Network.Service.Upload.History.Status': status }] });
	}

	public async deleteJobs(ids: UploadJobId[]) {
		if (ids.length === 0) return;
		const keys = ids.map(String);
		await this.client.property.deleteValue({
			params: [{ 'Network.Service.Upload.Progress.Status': keys, 'Network.Service.Upload.History.Status': keys }],
		});
	}

	public async clearCompletedJobs() {
		const ids = [...this.jobs.values()].filter((job) => job.status === 'Completed').map((job) => job.id);
		if (ids.length === 0) return;
		await this.client.property.deleteValue({ params: [{ 'Network.Service.Upload.History.Status': ids.map(String) }] });
	}

	public hasIncomplete() {
		return [...this.jobs.values()].some((job) => [0, 100, 400, 401, 402].includes(job.statusCode));
	}

	private parseJobs(data: Record<string, unknown>, source: UploadJobSource) {
		const service = data[propertyName(source, 'Service')] as Record<string, unknown> | undefined;
		if (service === undefined) return [];

		return Object.keys(service).flatMap((key): UploadJob[] => {
			const id = uploadJobIdFromValue(key);
			if (id === undefined) return [];

			const numericStatusCode = getNumber(data, source, 'Status', id);
			return [
				{
					clipName: getString(data, source, 'ClipName', id),
					drive: getString(data, source, 'Drive', id),
					id,
					name: getString(data, source, 'Name', id),
					percentage: getNumber(data, source, 'Percentage', id),
					service: getUploadSettingId(data, source, 'Service', id),
					source,
					status: statusFromCode(numericStatusCode),
					statusCode: numericStatusCode,
					total: getNumber(data, source, 'Total', id),
					transferred: getNumber(data, source, 'Transferred', id),
				},
			];
		});
	}

	private parseSummary(data: Record<string, unknown>): UploadJobSummary {
		let completedClips = 0;
		let remainingClips = 0;
		let totalBytes = 0;
		let transferredBytes = 0;
		let currentTransferredBytes = this.previousTransferredBytes;
		let currentTransferredId = this.previousTransferredId;
		let currentTotalBytes = 0;
		let transferring = false;

		for (const source of ['History', 'Progress'] as const) {
			for (const job of this.parseJobs(data, source)) {
				totalBytes += job.total;
				transferredBytes += job.transferred;
				if (job.status === 'Completed') {
					completedClips++;
				} else {
					remainingClips++;
				}

				if (job.statusCode === 100) {
					currentTransferredBytes = job.transferred;
					currentTransferredId = job.id;
					currentTotalBytes = job.total;
					transferring = true;
				}
			}
		}

		const now = Date.now();
		const canMeasure =
			this.previousTransferredId === currentTransferredId &&
			this.previousTransferredBytes > 0 &&
			currentTransferredBytes > this.previousTransferredBytes &&
			this.previousTransferredTime > 0;
		const bitsPerSecond = canMeasure
			? ((currentTransferredBytes - this.previousTransferredBytes) * 8) /
				((now - this.previousTransferredTime) / 1_000)
			: 0;

		this.previousTransferredBytes = currentTransferredBytes;
		this.previousTransferredId = currentTransferredId;
		this.previousTransferredTime = now;

		let remainingMinutes: number | null = transferring ? null : 0;
		if (transferring && canMeasure && bitsPerSecond > 0) {
			const remainingBytes = currentTotalBytes - currentTransferredBytes;
			remainingMinutes = Math.min(Math.ceil((remainingBytes * 8) / bitsPerSecond / 60), 9_999);
		}

		return {
			completedClips,
			currentBitsPerSecond: bitsPerSecond,
			currentMegabitsPerSecond: Math.round((bitsPerSecond / 1_048_576) * 10) / 10,
			percentage: totalBytes === 0 ? 0 : Math.trunc((transferredBytes / totalBytes) * 100),
			remainingClips,
			remainingMinutes,
		};
	}
}
