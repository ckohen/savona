import {
	EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
	EVENT_ABB_EXECUTE_FOR_GREY_OUT,
	EVENT_ATW_HOLD_DISPLAY,
	EVENT_AWB_MODE_DISPLAY,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENTKIND_POOLFEED_REFRESH,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export type WhiteBalanceMode = 'ATW' | 'Memory A' | 'Memory B' | 'Memory C' | 'Preset';

export class WhiteBalance {
	public static readonly PropertyName = 'Camera.WhiteBalance.ColorTemperature.Value';

	public static readonly MemoryPropertyName = 'Camera.WhiteBalance.ColorTemperature.MemoryValue';

	public static readonly ModePropertyName = 'Camera.WhiteBalance.Mode';

	public static readonly AutomaticPropertyName = 'Camera.WhiteBalance.AutoAdjust.Enabled';

	public static readonly TrackingPropertyName = 'Camera.WhiteBalance.SettingMethod';

	public memoryValue: { [key in WhiteBalanceMode]?: string } = {};

	public mode: WhiteBalanceMode = 'ATW';

	public automaticEnabled = false;

	public trackingMode: 'Automatic' | 'Manual' = 'Manual';

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public trackingStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(WhiteBalance.MemoryPropertyName, async (data) => {
			this.memoryValue = data as { [key in WhiteBalanceMode]?: string };
		});
		client.notifications.propertyValueChanged.on(WhiteBalance.ModePropertyName, async (data) => {
			this.mode = data as WhiteBalanceMode;
		});
		client.notifications.propertyStatusChanged.on(WhiteBalance.PropertyName, async (data) => {
			this.status = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyStatusChanged.on(WhiteBalance.AutomaticPropertyName, async () => {
			await this.fetchAutomaticEnabled();
		});
		client.notifications.propertyValueChanged.on(WhiteBalance.AutomaticPropertyName, async () => {
			await this.fetchAutomaticEnabled();
		});
		client.notifications.propertyStatusChanged.on(WhiteBalance.TrackingPropertyName, async (data) => {
			this.trackingStatus = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyValueChanged.on(WhiteBalance.TrackingPropertyName, async (data) => {
			this.trackingMode = data as 'Automatic' | 'Manual';
		});
		client.notifications.propertyValueChanged.on('P.Menu.pmw-f5x.Event.EventID', async (data) => {
			if (
				[
					EVENT_PLAY_UPDATE,
					EVENT_THUMBNAIL_UPDATE,
					EVENT_RECORDE_UPDATE,
					EVENT_VIEW_UPDATE,
					EVENT_ATW_HOLD_DISPLAY,
					EVENT_ABB_EXECUTE_FOR_GREY_OUT,
					EVENT_AWB_MODE_DISPLAY,
					EVENTKIND_POOLFEED_REFRESH,
				].includes(data as number)
			) {
				await this.fetchTrackingModeStatus();
			}

			if (
				[
					EVENT_PLAY_UPDATE,
					EVENT_THUMBNAIL_UPDATE,
					EVENT_RECORDE_UPDATE,
					EVENT_VIEW_UPDATE,
					EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
					EVENT_AWB_MODE_DISPLAY,
					EVENT_ABB_EXECUTE_FOR_GREY_OUT,
					EVENTKIND_POOLFEED_REFRESH,
				].includes(data as number)
			) {
				await this.fetchStatus();
			}
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [{ [WhiteBalance.MemoryPropertyName]: ['*'], [WhiteBalance.ModePropertyName]: ['*'] }],
		});
		if (typeof response !== 'object' || response === null || !(WhiteBalance.MemoryPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		const responseValue: {
			memoryValue: { [key in WhiteBalanceMode]?: string };
			mode?: WhiteBalanceMode;
		} = {
			memoryValue: response[WhiteBalance.MemoryPropertyName] as { [key in WhiteBalanceMode]?: string },
		};

		this.memoryValue = responseValue.memoryValue;

		if (WhiteBalance.ModePropertyName in response) {
			responseValue.mode = response[WhiteBalance.ModePropertyName] as WhiteBalanceMode;
			this.mode = responseValue.mode;
		}

		return responseValue;
	}

	public async execute() {
		await this.client.process.execute.automaticAdjustment({ params: [['Camera.WhiteBalance']] });
	}

	public async setMode(mode: WhiteBalanceMode) {
		await this.client.property.setValue({ params: [{ 'Camera.WhiteBalance.Mode': mode }] });
	}

	public async setSliderValue(value: number) {
		await this.client.property.setValue({ params: [{ 'P.Control.ColorTemperature.Slider': value }] });
	}

	public async setValue(value: number) {
		await this.client.property.setValue({ params: [{ [WhiteBalance.PropertyName]: value }] });
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({
			params: [{ [WhiteBalance.PropertyName]: null }],
		});
		if (typeof response !== 'object' || response === null || !(WhiteBalance.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response[WhiteBalance.PropertyName] as 'Locked' | 'Unlocked';
		return response[WhiteBalance.PropertyName] as 'Locked' | 'Unlocked';
	}

	public async fetchAutomaticEnabled() {
		const response = await this.client.property.getValue({
			params: [{ [WhiteBalance.AutomaticPropertyName]: null }],
		});
		if (typeof response !== 'object' || response === null || !(WhiteBalance.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		const responseValue = response[WhiteBalance.AutomaticPropertyName];

		if (typeof responseValue !== 'object' || responseValue === null || !('cam' in responseValue)) {
			throw new Error('Response does not match expected format');
		}

		this.automaticEnabled = responseValue.cam as boolean;
		return responseValue.cam as boolean;
	}

	public async fetchTrackingMode() {
		const response = await this.client.property.getValue({
			params: [{ [WhiteBalance.TrackingPropertyName]: ['*'] }],
		});
		if (typeof response !== 'object' || response === null || !(WhiteBalance.TrackingPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.trackingMode = response[WhiteBalance.TrackingPropertyName] as 'Automatic' | 'Manual';
		return response[WhiteBalance.TrackingPropertyName] as 'Automatic' | 'Manual';
	}

	public async setTrackingMode(value: 'Automatic' | 'Manual') {
		await this.client.property.setValue({ params: [{ [WhiteBalance.TrackingPropertyName]: value }] });
	}

	public async fetchTrackingModeStatus() {
		const response = await this.client.property.getStatus({
			params: [{ [WhiteBalance.TrackingPropertyName]: null }],
		});
		if (typeof response !== 'object' || response === null || !(WhiteBalance.TrackingPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.trackingStatus = response[WhiteBalance.TrackingPropertyName] as 'Locked' | 'Unlocked';
		return response[WhiteBalance.TrackingPropertyName] as 'Locked' | 'Unlocked';
	}
}
