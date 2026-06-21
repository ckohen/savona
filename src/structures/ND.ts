import type { SavonaClient } from '../savona.js';

export class ND {
	public static readonly AutomaticPropertyName = 'Camera.NDFilter.SettingMethod';

	/**
	 * ND Filter value, 1 is CLEAR, 2 is 1/2, 3 is 1/3, etc.
	 */
	public value: number = 0;

	public enabled = false;

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public mode: 'Automatic' | 'Manual' = 'Manual';

	public automaticStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('Camera.NDFilter.Value', async (data) => {
			if (typeof data !== 'object' || data === null || !('cam' in data)) {
				return;
			}

			this.value = data.cam as number;
		});
		client.notifications.propertyValueChanged.on('Camera.NDFilter.Enabled', async (data) => {
			this.enabled = data as boolean;
		});
		client.notifications.propertyStatusChanged.on('Camera.NDFilter.Value', async (data) => {
			this.status = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyStatusChanged.on(ND.AutomaticPropertyName, async (data) => {
			this.automaticStatus = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyValueChanged.on(ND.AutomaticPropertyName, async (data) => {
			if (typeof data !== 'object' || data === null || !('cam' in data)) {
				return;
			}

			this.mode = data.cam as 'Automatic' | 'Manual';
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [{ 'Camera.NDFilter.Value': ['*'], 'Camera.NDFilter.Enabled': ['*'] }],
		});
		if (typeof response !== 'object' || response === null || !('Camera.NDFilter.Value' in response)) {
			throw new Error('Response does not match expected format');
		}

		const responseValue = response['Camera.NDFilter.Value'];
		const result: { enabled?: boolean; value?: number } = {};

		if (typeof responseValue !== 'object' || responseValue === null || !('cam' in responseValue)) {
			throw new Error('Response does not match expected format');
		}

		this.value = responseValue.cam as number;
		if (
			'Camera.NDFilter.Enabled' in response &&
			typeof response['Camera.NDFilter.Enabled'] === 'object' &&
			response['Camera.NDFilter.Enabled'] !== null &&
			'cam' in response['Camera.NDFilter.Enabled']
		) {
			this.enabled = response['Camera.NDFilter.Enabled'].cam as boolean;
			result.enabled = this.enabled;
		}

		return result;
	}

	public async setValue(value: number) {
		await this.client.property.setValue({ params: [{ 'Camera.NDFilter.Value': { cam: value } }] });
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({ params: [{ 'Camera.NDFilter.Value': null }] });
		if (typeof response !== 'object' || response === null || !('Camera.NDFilter.Value' in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response['Camera.NDFilter.Value'] as 'Locked' | 'Unlocked';
		return response['Camera.NDFilter.Value'] as 'Locked' | 'Unlocked';
	}

	public async fetchAutomaticValue() {
		const response = await this.client.property.getValue({ params: [{ [ND.AutomaticPropertyName]: ['cam'] }] });
		if (typeof response !== 'object' || response === null || !(ND.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		const responseValue = response[ND.AutomaticPropertyName];

		if (typeof responseValue !== 'object' || responseValue === null || !('cam' in responseValue)) {
			throw new Error('Response does not match expected format');
		}

		this.mode = responseValue.cam as 'Automatic' | 'Manual';
		return responseValue.cam as 'Automatic' | 'Manual';
	}

	public async setAutomaticValue(value: 'Automatic' | 'Manual') {
		await this.client.property.setValue({ params: [{ [ND.AutomaticPropertyName]: { cam: value } }] });
	}

	public async fetchAutomaticStatus() {
		const response = await this.client.property.getStatus({ params: [{ [ND.AutomaticPropertyName]: null }] });
		if (typeof response !== 'object' || response === null || !(ND.AutomaticPropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.automaticStatus = response[ND.AutomaticPropertyName] as 'Locked' | 'Unlocked';
		return response[ND.AutomaticPropertyName] as 'Locked' | 'Unlocked';
	}
}
