import type { SavonaClient } from '../savona.js';
import type { RecordStatus } from './Record.js';

export class ClipInfo {
	public total = 100;

	public position = 0;

	public status: RecordStatus = 'Standby';

	public name = '';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.TotalClips', async (data) => {
			this.total = data as number;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.ClipPosition', async (data) => {
			this.position = data as number;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Status', async (data) => {
			this.status = data as RecordStatus;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.ClipName', async (data) => {
			this.name = data as string;
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{ 'P.Clip.Mediabox.TotalClips': ['*'], 'P.Clip.Mediabox.ClipPosition': ['*'], 'P.Clip.Mediabox.Status': ['*'] },
			],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const responseValue: { position?: number; status?: RecordStatus; total?: number } = {};

		if ('P.Clip.Mediabox.ClipPosition' in response) {
			responseValue.position = response['P.Clip.Mediabox.ClipPosition'] as number;
			this.position = responseValue.position;
		}

		if ('P.Clip.Mediabox.Status' in response) {
			responseValue.status = response['P.Clip.Mediabox.Status'] as RecordStatus;
			this.status = responseValue.status;
		}

		if ('P.Clip.Mediabox.TotalClips' in response) {
			responseValue.total = response['P.Clip.Mediabox.TotalClips'] as number;
			this.total = responseValue.total;
		}

		return responseValue;
	}

	public async fetchName() {
		const response = await this.client.property.getValue({ params: [{ 'P.Clip.Mediabox.ClipName': ['*'] }] });
		if (typeof response !== 'object' || response === null || !('P.Clip.Mediabox.ClipName' in response)) {
			throw new Error('Response does not match expected format');
		}

		this.name = response['P.Clip.Mediabox.ClipName'] as string;
		return response['P.Clip.Mediabox.ClipName'] as string;
	}
}
