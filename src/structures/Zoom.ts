import {
	EVENT_700P_ZOOM_FOCUS_REMOTE_ON_FOR_WIFI,
	EVENT_ATTACHLENS_NOTIFY_LENSEXTENDER_UPDATE,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENTKIND_POOLFEED_REFRESH,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export class Zoom {
	public static readonly PropertyName = 'Camera.Zoom.Value';

	public static readonly VelocityPropertyName = 'Camera.Zoom.Velocity';

	public value = 0;

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(Zoom.PropertyName, async (data) => {
			this.value = data as number;
		});
		client.notifications.propertyValueChanged.on('P.Menu.pmw-f5x.Event.EventID', async (data) => {
			if (
				[
					EVENT_PLAY_UPDATE,
					EVENT_THUMBNAIL_UPDATE,
					EVENT_RECORDE_UPDATE,
					EVENT_VIEW_UPDATE,
					EVENT_700P_ZOOM_FOCUS_REMOTE_ON_FOR_WIFI,
					EVENT_ATTACHLENS_NOTIFY_LENSEXTENDER_UPDATE,
					EVENTKIND_POOLFEED_REFRESH,
				].includes(data as number)
			) {
				await this.fetchStatus();
			}
		});
		client.notifications.propertyStatusChanged.on(Zoom.PropertyName, async (data) => {
			this.status = data as 'Locked' | 'Unlocked';
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [{ [Zoom.PropertyName]: ['*'] }],
		});
		if (typeof response !== 'object' || response === null || !(Zoom.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.value = response[Zoom.PropertyName] as number;
		return response[Zoom.PropertyName] as number;
	}

	/**
	 * Sets the zoom velocity. Must be set back to 0 to stop zoom movement.
	 *
	 * @param value - A number between -8 and 8 representing the zoom velocity.
	 */
	public async setVelocity(value: number) {
		await this.client.property.updateValue({
			params: [{ [Zoom.VelocityPropertyName]: value }],
		});
	}

	/**
	 * Steps the zoom by the given velocity.
	 *
	 * @param value - A number between -8 and 8 representing the zoom velocity.
	 */
	public async velocityStep(value: number) {
		await this.setVelocity(value);
		await this.setVelocity(0);
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({
			params: [{ [Zoom.PropertyName]: null }],
		});

		if (typeof response !== 'object' || response === null || !(Zoom.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response[Zoom.PropertyName] as 'Locked' | 'Unlocked';

		return response[Zoom.PropertyName] as 'Locked' | 'Unlocked';
	}
}
