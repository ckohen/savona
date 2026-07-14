import {
	EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
	EVENT_ABB_EXECUTE_FOR_GREY_OUT,
	EVENT_AWB_MODE_DISPLAY,
	EVENT_GAIN_AGC_MODE,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENTKIND_POOLFEED_REFRESH,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export class Gain {
	public static readonly PropertyName = 'Camera.Gain.Value';

	public static readonly AutomaticPropertyName = 'Camera.Gain.SettingMethod';

	public value: number = 0;

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public mode: 'Automatic' | 'Manual' = 'Manual';

	public modeStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(Gain.PropertyName, async (data) => {
			this.value = Number.parseInt(data as string, 10);
		});
		client.notifications.propertyStatusChanged.on(Gain.PropertyName, async (data) => {
			this.status = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyStatusChanged.on(Gain.AutomaticPropertyName, async (data) => {
			this.modeStatus = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyValueChanged.on(Gain.AutomaticPropertyName, async (data) => {
			this.mode = data as 'Automatic' | 'Manual';
		});
		client.registerMenuEventRefresh(
			[EVENT_PLAY_UPDATE, EVENT_THUMBNAIL_UPDATE, EVENT_RECORDE_UPDATE, EVENT_VIEW_UPDATE, EVENT_GAIN_AGC_MODE],
			'Gain.fetchModeStatus',
			async () => this.fetchModeStatus(),
		);
		client.registerMenuEventRefresh(
			[
				EVENT_PLAY_UPDATE,
				EVENT_THUMBNAIL_UPDATE,
				EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
				EVENT_ABB_EXECUTE_FOR_GREY_OUT,
				EVENT_AWB_MODE_DISPLAY,
				EVENT_VIEW_UPDATE,
				EVENTKIND_POOLFEED_REFRESH,
			],
			'Gain.fetchStatus',
			async () => this.fetchStatus(),
		);
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({ params: [{ [Gain.PropertyName]: ['*'] }] });
		if (typeof response !== 'object' || response === null || !(Gain.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.value = Number.parseInt(response[Gain.PropertyName] as string, 10);
		return this.value;
	}

	/**
	 * Sets the gain value.
	 *
	 * @param value - One of -3, 0, 3, 6, 9, 12, 15, 18
	 */
	public async setValue(value: number) {
		await this.client.property.setValue({ params: [{ [Gain.PropertyName]: `${value}dB` }] });
	}

	public async fetchMode() {
		const response = await this.client.property.getValue({ params: [{ [Gain.AutomaticPropertyName]: ['*'] }] });
		if (typeof response !== 'object' || response === null || !(Gain.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.mode = response[Gain.AutomaticPropertyName] as 'Automatic' | 'Manual';
		return response[Gain.AutomaticPropertyName] as 'Automatic' | 'Manual';
	}

	public async setMode(value: 'Automatic' | 'Manual') {
		await this.client.property.setValue({ params: [{ [Gain.AutomaticPropertyName]: value }] });
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({ params: [{ 'Camera.Gain.Mode': null }] });
		if (typeof response !== 'object' || response === null || !('Camera.Gain.Mode' in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response['Camera.Gain.Mode'] as 'Locked' | 'Unlocked';
		return response['Camera.Gain.Mode'] as 'Locked' | 'Unlocked';
	}

	public async fetchModeStatus() {
		const response = await this.client.property.getStatus({ params: [{ [Gain.AutomaticPropertyName]: null }] });
		if (typeof response !== 'object' || response === null || !(Gain.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.modeStatus = response[Gain.AutomaticPropertyName] as 'Locked' | 'Unlocked';
		return response[Gain.AutomaticPropertyName] as 'Locked' | 'Unlocked';
	}
}
