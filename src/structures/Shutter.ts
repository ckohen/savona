import {
	ABB_GRAYOUT_SHUTTER,
	AUTOSHUTTER_GRAYOUT_SHUTTERSPEED,
	EVENT_AWB_MODE_DISPLAY,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENTKIND_POOLFEED_REFRESH,
	RPN_GRAYOUT_SHUTTER,
	SANDQ_GRAYOUT_SLOWSHUTTER,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export class Shutter {
	public static readonly AutomaticPropertyName = 'Camera.Shutter.SettingMethod';

	public enabled = false;

	public ecsEnabled = false;

	public slowEnabled = false;

	public mode: 'Angle' | 'Speed' = 'Speed';

	public value: string = '';

	public slowFrames = 0;

	public shutterSpeedList: string[] = [];

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public automaticMode: 'Automatic' | 'Manual' = 'Manual';

	public automaticStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('Camera.Shutter.Enabled', async (data) => {
			this.enabled = data as boolean;
		});
		client.notifications.propertyValueChanged.on('Camera.Shutter.Slow.Enabled', async (data) => {
			this.slowEnabled = data as boolean;
			await this.fetchStatus();
		});
		client.notifications.propertyValueChanged.on('Camera.Shutter.Slow.Frames', async (data) => {
			this.slowFrames = data as number;
		});
		client.notifications.propertyValueChanged.on('Camera.Shutter.ECS.Enabled', async (data) => {
			this.ecsEnabled = data as boolean;
		});
		client.notifications.propertyValueChanged.on('Camera.Shutter.Mode', async (data) => {
			this.mode = data as 'Angle' | 'Speed';
		});
		client.notifications.propertyValueChanged.on('Camera.Shutter.Value', async (data) => {
			this.value = data as string;
		});
		client.notifications.propertyValueChanged.on('P.Menu.pmw-f5x.Event.EventID', async (data) => {
			if (
				[
					EVENT_PLAY_UPDATE,
					EVENT_THUMBNAIL_UPDATE,
					EVENT_RECORDE_UPDATE,
					EVENT_VIEW_UPDATE,
					AUTOSHUTTER_GRAYOUT_SHUTTERSPEED,
					SANDQ_GRAYOUT_SLOWSHUTTER,
					RPN_GRAYOUT_SHUTTER,
					ABB_GRAYOUT_SHUTTER,
					EVENT_AWB_MODE_DISPLAY,
					EVENTKIND_POOLFEED_REFRESH,
				].includes(data as number)
			) {
				await this.fetchStatus();
			}
		});
		client.notifications.propertyStatusChanged.on('Camera.Shutter.Enabled', async (data) => {
			this.status = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyStatusChanged.on(Shutter.AutomaticPropertyName, async (data) => {
			this.automaticStatus = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyValueChanged.on(Shutter.AutomaticPropertyName, async (data) => {
			this.automaticMode = data as 'Automatic' | 'Manual';
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{
					'Camera.Shutter.Enabled': ['*'],
					'Camera.Shutter.Mode': ['*'],
					'Camera.Shutter.Value': ['*'],
					'Camera.Shutter.Slow.Enabled': ['*'],
					'Camera.Shutter.Slow.Frames': ['*'],
					'Camera.Shutter.ECS.Enabled': ['*'],
				},
			],
		});

		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const responseValue: {
			ecsEnabled?: boolean;
			enabled?: boolean;
			mode?: 'Angle' | 'Speed';
			slowEnabled?: boolean;
			slowFrames?: number;
			value?: string;
		} = {};

		if ('Camera.Shutter.Enabled' in response) {
			responseValue.enabled = response['Camera.Shutter.Enabled'] as boolean;
			this.enabled = responseValue.enabled;
		}

		if ('Camera.Shutter.Mode' in response) {
			responseValue.mode = response['Camera.Shutter.Mode'] as 'Angle' | 'Speed';
			this.mode = responseValue.mode;
		}

		if ('Camera.Shutter.Value' in response) {
			responseValue.value = response['Camera.Shutter.Value'] as string;
			this.value = responseValue.value;
		}

		if ('Camera.Shutter.Slow.Enabled' in response) {
			responseValue.slowEnabled = response['Camera.Shutter.Slow.Enabled'] as boolean;
			this.slowEnabled = responseValue.slowEnabled;
		}

		if ('Camera.Shutter.Slow.Frames' in response) {
			responseValue.slowFrames = response['Camera.Shutter.Slow.Frames'] as number;
			this.slowFrames = responseValue.slowFrames;
		}

		if ('Camera.Shutter.ECS.Enabled' in response) {
			responseValue.ecsEnabled = response['Camera.Shutter.ECS.Enabled'] as boolean;
			this.ecsEnabled = responseValue.ecsEnabled;
		}

		return responseValue;
	}

	public async setValue(value: string, ecs = false, mode: 'Angle' | 'Speed' = this.mode) {
		const params: Record<string, boolean | string> = {};

		if (value === 'Off') {
			params['Camera.Shutter.Enabled'] = false;
		} else if (ecs) {
			params['Camera.Shutter.ECS.Enabled'] = true;
			params['Camera.Shutter.Mode'] = mode;
		} else {
			params['Camera.Shutter.ECS.Enabled'] = false;
			params['Camera.Shutter.Mode'] = mode;
			params['Camera.Shutter.Value'] = value;
		}

		await this.client.property.setValue({ params: [params] });
	}

	public async setDisabled() {
		await this.client.property.setValue({ params: [{ 'Camera.Shutter.Enabled': false }] });
	}

	public async setECSValue(value: string) {
		await this.client.property.setValue({ params: [{ 'Camera.Shutter.Mode': 'ECS', 'Camera.Shutter.Value': value }] });
	}

	public async setSliderValue(value: number) {
		await this.client.property.setValue({ params: [{ 'P.Control.Shutter.Value.Slider': value }] });
	}

	public async fetchShutterSpeedList() {
		const response = await this.client.capability.getValue({ params: [['Camera.Shutter.Speed']] });
		if (typeof response !== 'object' || response === null || !('Camera.Shutter.Speed' in response)) {
			throw new Error('Response does not match expected format');
		}

		this.shutterSpeedList = (response['Camera.Shutter.Speed'] as [boolean, string, string[]])[2];
		return this.shutterSpeedList;
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({ params: [{ 'Camera.Shutter.Enabled': null }] });
		if (typeof response !== 'object' || response === null || !('Camera.Shutter.Enabled' in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response['Camera.Shutter.Enabled'] as 'Locked' | 'Unlocked';
		return this.status;
	}

	public async fetchAutomaticValue() {
		const response = await this.client.property.getValue({ params: [{ [Shutter.AutomaticPropertyName]: ['cam'] }] });
		if (typeof response !== 'object' || response === null || !(Shutter.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.automaticMode = response[Shutter.AutomaticPropertyName] as 'Automatic' | 'Manual';
		return response[Shutter.AutomaticPropertyName] as 'Automatic' | 'Manual';
	}

	public async setAutomaticValue(value: 'Automatic' | 'Manual') {
		await this.client.property.setValue({ params: [{ [Shutter.AutomaticPropertyName]: value }] });
	}

	public async fetchAutomaticStatus() {
		const response = await this.client.property.getStatus({ params: [{ [Shutter.AutomaticPropertyName]: null }] });
		if (typeof response !== 'object' || response === null || !(Shutter.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.automaticStatus = response[Shutter.AutomaticPropertyName] as 'Locked' | 'Unlocked';
		return response[Shutter.AutomaticPropertyName] as 'Locked' | 'Unlocked';
	}
}
