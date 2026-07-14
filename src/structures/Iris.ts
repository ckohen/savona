import {
	EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
	EVENT_ATTACHLENS_NOTIFY_LENSEXTENDER_UPDATE,
	EVENT_IRISAUTOMODE_NOTIFY_DISPLAY,
	EVENT_IRISPOSITION_NOTIFY_DISPLAY,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENTKIND_POOLFEED_REFRESH,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export class Iris {
	public static readonly PropertyName = 'Camera.Iris.Value';

	public static readonly AutomaticPropertyName = 'Camera.Iris.SettingMethod';

	public value = 0;

	public closed = false;

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public closedStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public mode: 'Automatic' | 'Manual' = 'Manual';

	public automaticStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(Iris.PropertyName, async (data) => {
			this.value = data as number;
		});
		client.notifications.propertyValueChanged.on('Camera.Iris.Close.Enabled', async (data) => {
			this.closed = data as boolean;
		});
		client.notifications.propertyStatusChanged.on(Iris.AutomaticPropertyName, async (data) => {
			this.automaticStatus = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyStatusChanged.on('Camera.Iris.Mode', async () => {
			await this.fetchAutomaticStatus();
			await this.fetchStatus();
		});
		client.notifications.propertyValueChanged.on(Iris.AutomaticPropertyName, async (data) => {
			this.mode = data as 'Automatic' | 'Manual';
			await this.fetchStatus();
		});
		client.registerMenuEventRefresh(
			[
				EVENT_PLAY_UPDATE,
				EVENT_THUMBNAIL_UPDATE,
				EVENT_RECORDE_UPDATE,
				EVENT_VIEW_UPDATE,
				EVENT_IRISAUTOMODE_NOTIFY_DISPLAY,
				EVENT_ATTACHLENS_NOTIFY_LENSEXTENDER_UPDATE,
				EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
				EVENTKIND_POOLFEED_REFRESH,
			],
			'Iris.fetchAutomaticStatus',
			async () => this.fetchAutomaticStatus(),
		);
		client.registerMenuEventRefresh(
			[
				EVENT_THUMBNAIL_UPDATE,
				EVENT_PLAY_UPDATE,
				EVENT_RECORDE_UPDATE,
				EVENT_VIEW_UPDATE,
				EVENT_IRISPOSITION_NOTIFY_DISPLAY,
				EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
				EVENT_IRISAUTOMODE_NOTIFY_DISPLAY,
				EVENT_ATTACHLENS_NOTIFY_LENSEXTENDER_UPDATE,
				EVENTKIND_POOLFEED_REFRESH,
			],
			'Iris.fetchStatus',
			async () => this.fetchStatus(),
		);
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [{ [Iris.PropertyName]: ['*'], 'Camera.Iris.Close.Enabled': ['*'] }],
		});
		if (typeof response !== 'object' || response === null || !(Iris.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.value = response[Iris.PropertyName] as number;
		if ('Camera.Iris.Close.Enabled' in response) {
			this.closed = response['Camera.Iris.Close.Enabled'] as boolean;
		}

		return { close: this.closed, value: this.value };
	}

	public async setValue(value: number, closed = this.closed) {
		await this.client.property.setValue({
			params: [{ [Iris.PropertyName]: value, 'Camera.Iris.Close.Enabled': closed }],
		});
	}

	public async setClosed(closed: boolean) {
		await this.client.property.setValue({
			params: [{ [Iris.PropertyName]: this.value, 'Camera.Iris.Close.Enabled': closed }],
		});
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({
			params: [{ [Iris.PropertyName]: null, 'Camera.Iris.Close.Enabled': null }],
		});
		if (typeof response !== 'object' || response === null || !(Iris.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response[Iris.PropertyName] as 'Locked' | 'Unlocked';
		if ('Camera.Iris.Close.Enabled' in response) {
			this.closedStatus = response['Camera.Iris.Close.Enabled'] as 'Locked' | 'Unlocked';
		}

		return { closeStatus: this.closedStatus, status: this.status };
	}

	public async fetchAutomaticValue() {
		const response = await this.client.property.getValue({ params: [{ [Iris.AutomaticPropertyName]: ['*'] }] });
		if (typeof response !== 'object' || response === null || !(Iris.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.mode = response[Iris.AutomaticPropertyName] as 'Automatic' | 'Manual';
		return response[Iris.AutomaticPropertyName] as 'Automatic' | 'Manual';
	}

	public async setAutomaticValue(value: 'Automatic' | 'Manual') {
		await this.client.property.setValue({ params: [{ [Iris.AutomaticPropertyName]: value }] });
	}

	public async fetchAutomaticStatus() {
		const response = await this.client.property.getStatus({ params: [{ [Iris.AutomaticPropertyName]: null }] });
		if (typeof response !== 'object' || response === null || !(Iris.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.automaticStatus = response[Iris.AutomaticPropertyName] as 'Locked' | 'Unlocked';
		return response[Iris.AutomaticPropertyName] as 'Locked' | 'Unlocked';
	}
}
