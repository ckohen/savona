import {
	EVENT_PLAY_UPDATE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENT_RETURN_SANDQMOTION_ISAVAILABLE,
	EVENT_RETURN_SANDQMOTION_UNAVAILABLE,
	EVENT_NOTIFY_SANDQMOTION_UNAVAILABLE,
	EVENT_NOTIFY_SANDQMOTION_ISAVAILABLE,
	EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
	EVENTKIND_POOLFEED_REFRESH,
	EVENTKIND_BLACKSHADING_REFRESH,
	EVENT_WHITESHADING_UPDATE,
	EVENT_ABB_EXECUTE_FOR_GREY_OUT,
	EVENT_AWB_MODE_DISPLAY,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export class ColorBars {
	public static readonly PropertyName = 'Camera.ColorBar.Enabled';

	public enabled = false;

	public type = 'SMPTE';

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(ColorBars.PropertyName, async (data) => {
			this.enabled = data as boolean;
		});
		client.notifications.propertyValueChanged.on('Camera.ColorBar.Type', async (data) => {
			this.type = data as string;
		});
		client.registerMenuEventRefresh(
			[
				EVENT_PLAY_UPDATE,
				EVENT_THUMBNAIL_UPDATE,
				EVENT_RECORDE_UPDATE,
				EVENT_VIEW_UPDATE,
				EVENT_RETURN_SANDQMOTION_ISAVAILABLE,
				EVENT_RETURN_SANDQMOTION_UNAVAILABLE,
				EVENT_NOTIFY_SANDQMOTION_UNAVAILABLE,
				EVENT_NOTIFY_SANDQMOTION_ISAVAILABLE,
				EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
				EVENTKIND_POOLFEED_REFRESH,
				EVENTKIND_BLACKSHADING_REFRESH,
				EVENT_WHITESHADING_UPDATE,
				EVENT_ABB_EXECUTE_FOR_GREY_OUT,
				EVENT_AWB_MODE_DISPLAY,
			],
			'ColorBars.fetchStatus',
			async () => this.fetchStatus(),
		);
		client.notifications.propertyStatusChanged.on(ColorBars.PropertyName, async (data) => {
			this.status = data as 'Locked' | 'Unlocked';
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [{ [ColorBars.PropertyName]: ['*'], 'Camera.ColorBar.Type': ['*'] }],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const responseValue: { enabled?: boolean; type?: string } = {};

		if ('Camera.ColorBar.Type' in response) {
			this.type = response['Camera.ColorBar.Type'] as string;
			responseValue.type = this.type;
		}

		if (ColorBars.PropertyName in response) {
			responseValue.enabled = response[ColorBars.PropertyName] as boolean;
			this.enabled = responseValue.enabled;
		}

		return responseValue;
	}

	public async setValue({
		enabled,
		type,
	}: { enabled?: boolean | undefined; type?: string | undefined } = {}) {
		const params: Record<string, boolean | string> = {};
		if (enabled !== undefined) {
			params[ColorBars.PropertyName] = enabled;
		}

		if (type !== undefined) {
			params['Camera.ColorBar.Type'] = type;
		}

		await this.client.property.setValue({ params: [params] });
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({ params: [{ [ColorBars.PropertyName]: null }] });
		if (typeof response !== 'object' || response === null || !(ColorBars.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response[ColorBars.PropertyName] as 'Locked' | 'Unlocked';
		return response[ColorBars.PropertyName] as 'Locked' | 'Unlocked';
	}
}
