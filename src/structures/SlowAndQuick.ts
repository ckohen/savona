import {
	EVENT_AWB_MODE_DISPLAY,
	EVENT_NOTIFY_SANDQMOTION_ISAVAILABLE,
	EVENT_NOTIFY_SANDQMOTION_UNAVAILABLE,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_RETURN_SANDQMOTION_ISAVAILABLE,
	EVENT_RETURN_SANDQMOTION_UNAVAILABLE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export class SlowAndQuick {
	public framerate = 0;

	public enabled = false;

	public highFramerateEnabled = false;

	public capability: number[] = [];

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('Camera.SlowAndQuickMotion.Enabled', async (data) => {
			this.enabled = data as boolean;
		});
		client.notifications.propertyValueChanged.on('Camera.SlowAndQuickMotion.FrameRate', async (data) => {
			this.framerate = data as number;
		});
		client.notifications.propertyValueChanged.on('Camera.SlowAndQuickMotion.HighFrameRate.Enabled', async (data) => {
			this.highFramerateEnabled = data as boolean;
		});
		client.registerMenuEventRefresh(
			[
				EVENT_PLAY_UPDATE,
				EVENT_THUMBNAIL_UPDATE,
				EVENT_RECORDE_UPDATE,
				EVENT_VIEW_UPDATE,
				EVENT_RETURN_SANDQMOTION_ISAVAILABLE,
				EVENT_RETURN_SANDQMOTION_UNAVAILABLE,
				EVENT_NOTIFY_SANDQMOTION_ISAVAILABLE,
				EVENT_NOTIFY_SANDQMOTION_UNAVAILABLE,
				EVENT_AWB_MODE_DISPLAY,
			],
			'SlowAndQuick.fetchStatus',
			async () => this.fetchStatus(),
		);
		client.notifications.propertyStatusChanged.on('Camera.SlowAndQuickMotion.Enabled', async (data) => {
			this.status = data as 'Locked' | 'Unlocked';
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{
					'Camera.SlowAndQuickMotion.Enabled': ['*'],
					'Camera.SlowAndQuickMotion.HighFrameRate.Enabled': ['*'],
					'Camera.SlowAndQuickMotion.FrameRate': ['*'],
				},
			],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const result: { enabled?: boolean; framerate?: number; highFramerateEnabled?: boolean } = {};

		if ('Camera.SlowAndQuickMotion.Enabled' in response) {
			this.enabled = response['Camera.SlowAndQuickMotion.Enabled'] as boolean;
			result.enabled = this.enabled;
		}

		if ('Camera.SlowAndQuickMotion.FrameRate' in response) {
			this.framerate = response['Camera.SlowAndQuickMotion.FrameRate'] as number;
			result.framerate = this.framerate;
		}

		if ('Camera.SlowAndQuickMotion.HighFrameRate.Enabled' in response) {
			this.highFramerateEnabled = response['Camera.SlowAndQuickMotion.HighFrameRate.Enabled'] as boolean;
			result.highFramerateEnabled = this.highFramerateEnabled;
		}

		return result;
	}

	public async fetchCapability() {
		const response = await this.client.capability.getValue({ params: [['Camera.SlowAndQuickMotion.FrameRate']] });
		if (typeof response !== 'object' || response === null || !('Camera.SlowAndQuickMotion.FrameRate' in response)) {
			throw new Error('Response does not match expected format');
		}

		const data = response['Camera.SlowAndQuickMotion.FrameRate'] as [boolean, number, number[]];
		this.capability = data[2];
		return this.capability;
	}

	public async setValue(value: number) {
		await this.client.property.setValue({
			params: [
				{
					'Camera.SlowAndQuickMotion.Enabled': true,
					'Camera.SlowAndQuickMotion.HighFrameRate.Enabled': false,
					'Camera.SlowAndQuickMotion.FrameRate': value,
				},
			],
		});
	}

	public async setDisabled(framerate?: number) {
		const params: Record<string, boolean | number> = {
			'Camera.SlowAndQuickMotion.Enabled': false,
			'Camera.SlowAndQuickMotion.HighFrameRate.Enabled': false,
		};

		if (framerate !== undefined) {
			params['Camera.SlowAndQuickMotion.FrameRate'] = framerate;
		}

		await this.client.property.setValue({ params: [params] });
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({ params: [{ 'Camera.SlowAndQuickMotion.Enabled': null }] });
		if (typeof response !== 'object' || response === null || !('Camera.SlowAndQuickMotion.Enabled' in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response['Camera.SlowAndQuickMotion.Enabled'] as 'Locked' | 'Unlocked';
		return response['Camera.SlowAndQuickMotion.Enabled'] as 'Locked' | 'Unlocked';
	}
}
