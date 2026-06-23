import type { SavonaClient } from '../savona.js';

export type RecordStatus =
	| 'NoMedia'
	| 'Pausing'
	| 'Playing'
	| 'Ready'
	| 'Recording'
	| 'RecordingWithCall'
	| 'RecPausing'
	| 'Standby'
	| 'Stopping';

export type RecordMode = 'ClipContinuous' | 'Frame' | 'Interval' | 'Normal' | 'PictureCache' | 'S&Q';

export class Record {
	public mode: RecordMode = 'Normal';

	public simulRecEnabled = false;

	public simulRecMode: 'NONE' | 'SLOT_A' | 'SLOT_AB' | 'SLOT_B' = 'NONE';

	public speed = 0;

	public status: RecordStatus = 'Standby';

	public timeCodeType: 'Counter' | 'Duration' | 'TimeCode' | 'UB' | 'Unknown' = 'Unknown';

	public timeCodeValue = '00:00:00.00';

	public timeCodeLocked = false;

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Status', (data) => {
			this.status = data as RecordStatus;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Mode', (data) => {
			this.mode = data as RecordMode;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Speed', (data) => {
			this.speed = data as number;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.TimeCode.Type', (data) => {
			this.timeCodeType = data as 'Counter' | 'Duration' | 'TimeCode' | 'UB' | 'Unknown';
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.TimeCode.Value', (data) => {
			this.timeCodeValue = data as string;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.TimeCode.Locked', (data) => {
			this.timeCodeLocked = data as boolean;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.SimulRec.Enabled', (data) => {
			this.simulRecEnabled = data as boolean;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.SimulRec.Mode', (data) => {
			this.simulRecMode = data as 'NONE' | 'SLOT_A' | 'SLOT_AB' | 'SLOT_B';
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{
					'P.Clip.Mediabox.Mode': ['*'],
					'P.Clip.Mediabox.Speed': ['*'],
					'P.Clip.Mediabox.Status': ['*'],
					'P.Clip.Mediabox.TimeCode.Type': ['*'],
					'P.Clip.Mediabox.TimeCode.Value': ['*'],
					'P.Clip.Mediabox.TimeCode.Locked': ['*'],
					'P.Clip.Mediabox.SimulRec.Enabled': ['*'],
					'P.Clip.Mediabox.SimulRec.Mode': ['*'],
				},
			],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const repsonseValue: {
			mode?: RecordMode;
			simulRecEnabled?: boolean;
			simulRecMode?: string;
			speed?: number;
			status?: RecordStatus;
			timeCodeLocked?: boolean;
			timeCodeType?: 'Counter' | 'Duration' | 'TimeCode' | 'UB' | 'Unknown';
			timeCodeValue?: string;
		} = {};

		if ('P.Clip.Mediabox.Mode' in response) {
			repsonseValue.mode = response['P.Clip.Mediabox.Mode'] as RecordMode;
			this.mode = repsonseValue.mode;
		}

		if ('P.Clip.Mediabox.Speed' in response) {
			repsonseValue.speed = response['P.Clip.Mediabox.Speed'] as number;
			this.speed = repsonseValue.speed;
		}

		if ('P.Clip.Mediabox.Status' in response) {
			repsonseValue.status = response['P.Clip.Mediabox.Status'] as RecordStatus;
			this.status = repsonseValue.status;
		}

		if ('P.Clip.Mediabox.TimeCode.Type' in response) {
			repsonseValue.timeCodeType = response['P.Clip.Mediabox.TimeCode.Type'] as
				| 'Counter'
				| 'Duration'
				| 'UB'
				| 'Unknown';
			this.timeCodeType = repsonseValue.timeCodeType;
		}

		if ('P.Clip.Mediabox.TimeCode.Value' in response) {
			repsonseValue.timeCodeValue = response['P.Clip.Mediabox.TimeCode.Value'] as string;
			this.timeCodeValue = repsonseValue.timeCodeValue;
		}

		if ('P.Clip.Mediabox.TimeCode.Locked' in response) {
			repsonseValue.timeCodeLocked = response['P.Clip.Mediabox.TimeCode.Locked'] as boolean;
			this.timeCodeLocked = repsonseValue.timeCodeLocked;
		}

		if ('P.Clip.Mediabox.SimulRec.Enabled' in response) {
			repsonseValue.simulRecEnabled = response['P.Clip.Mediabox.SimulRec.Enabled'] as boolean;
			this.simulRecEnabled = repsonseValue.simulRecEnabled;
		}

		if ('P.Clip.Mediabox.SimulRec.Mode' in response) {
			repsonseValue.simulRecMode = response['P.Clip.Mediabox.SimulRec.Mode'] as string;
			this.simulRecMode = repsonseValue.simulRecMode as 'NONE' | 'SLOT_A' | 'SLOT_AB' | 'SLOT_B';
		}

		return repsonseValue;
	}

	public async open() {
		return this.client.clip.recorder.open({ params: [] });
	}

	public async stop(main = true) {
		return this.client.clip.recorder.stop({ params: [main ? 'main' : 'proxy'] });
	}

	public async start(main = true) {
		return this.client.clip.recorder.start({ params: [main ? 'main' : 'proxy'] });
	}
}
