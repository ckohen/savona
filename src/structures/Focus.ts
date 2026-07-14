import {
	EVENT_700P_ZOOM_FOCUS_REMOTE_ON_FOR_WIFI,
	EVENT_ATTACHLENS_NOTIFY_LENSEXTENDER_UPDATE,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENTKIND_ADJUSTFOCUS_FOCUSMODE_UPDATE,
	EVENTKIND_POOLFEED_REFRESH,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export class Focus {
	public distance = 0;

	public distanceStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public unit: 'Feet' | 'Meter' = 'Meter';

	public unitStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public mode: 'Automatic' | 'Manual' = 'Automatic';

	public modeStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('Camera.Focus.Distance', async (data) => {
			this.distance = data as number;
			await this.fetchStatus();
		});
		client.notifications.propertyValueChanged.on('Camera.Focus.SettingMethod', async (data) => {
			this.mode = data as 'Automatic' | 'Manual';
		});
		client.notifications.propertyValueChanged.on('Camera.Focus.Distance.Unit', async (data) => {
			this.unit = data as 'Feet' | 'Meter';
		});
		client.registerMenuEventRefresh(
			[
				EVENT_PLAY_UPDATE,
				EVENT_THUMBNAIL_UPDATE,
				EVENT_RECORDE_UPDATE,
				EVENT_VIEW_UPDATE,
				EVENTKIND_ADJUSTFOCUS_FOCUSMODE_UPDATE,
				EVENT_700P_ZOOM_FOCUS_REMOTE_ON_FOR_WIFI,
				EVENT_ATTACHLENS_NOTIFY_LENSEXTENDER_UPDATE,
				EVENTKIND_POOLFEED_REFRESH,
			],
			'Focus.fetchStatus',
			async () => this.fetchStatus(),
		);
		client.notifications.propertyStatusChanged.on('Camera.Focus.Distance', async (data) => {
			this.distanceStatus = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyStatusChanged.on('Camera.Focus.SettingMethod', async (data) => {
			this.modeStatus = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyStatusChanged.on('Camera.Focus.Distance.Unit', async (data) => {
			this.unitStatus = data as 'Locked' | 'Unlocked';
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{ 'Camera.Focus.Distance': ['*'], 'Camera.Focus.Distance.Unit': ['*'], 'Camera.Focus.SettingMethod': ['*'] },
			],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const responseValue: { distance?: number; mode?: 'Automatic' | 'Manual'; unit?: 'Feet' | 'Meter' } = {};

		if ('Camera.Focus.Distance' in response) {
			responseValue.distance = response['Camera.Focus.Distance'] as number;
			this.distance = responseValue.distance;
		}

		if ('Camera.Focus.Distance.Unit' in response) {
			responseValue.unit = response['Camera.Focus.Distance.Unit'] as 'Feet' | 'Meter';
			this.unit = responseValue.unit;
		}

		if ('Camera.Focus.SettingMethod' in response) {
			responseValue.mode = response['Camera.Focus.SettingMethod'] as 'Automatic' | 'Manual';
			this.mode = responseValue.mode;
		}

		return responseValue;
	}

	/**
	 * Sets the focus velocity. Must be set back to 0 to stop focus movement.
	 *
	 * @param value - A number between -8 and 8 representing the focus velocity.
	 */
	public async setVelocity(value: number) {
		await this.client.property.updateValue({
			params: [{ 'Camera.Focus.Velocity': value }],
		});
	}

	/**
	 * Steps the focus by the given velocity.
	 *
	 * @param value - A number between -8 and 8 representing the focus velocity.
	 */
	public async velocityStep(value: number) {
		await this.setVelocity(value);
		await this.setVelocity(0);
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({
			params: [
				{ 'Camera.Focus.Distance': null, 'Camera.Focus.SettingMethod': null, 'Camera.Focus.Distance.Unit': null },
			],
		});

		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const responseValue: {
			distance?: 'Locked' | 'Unlocked';
			mode?: 'Locked' | 'Unlocked';
			unit?: 'Locked' | 'Unlocked';
		} = {};

		if ('Camera.Focus.Distance' in response) {
			this.distanceStatus = response['Camera.Focus.Distance'] as 'Locked' | 'Unlocked';
			responseValue.distance = this.distanceStatus;
		}

		if ('Camera.Focus.SettingMethod' in response) {
			this.modeStatus = response['Camera.Focus.SettingMethod'] as 'Locked' | 'Unlocked';
			responseValue.mode = this.modeStatus;
		}

		if ('Camera.Focus.Distance.Unit' in response) {
			this.unitStatus = response['Camera.Focus.Distance.Unit'] as 'Locked' | 'Unlocked';
			responseValue.unit = this.unitStatus;
		}

		return responseValue;
	}
}
