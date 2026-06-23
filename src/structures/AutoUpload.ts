import type { SavonaClient } from '../savona.js';

export class AutoUpload {
	public static readonly PropertyName = 'Clip.Recorder.PostProcessing';

	public enabled = false;

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(AutoUpload.PropertyName, (data) => {
			this.updateFromValue(data);
		});
	}

	public get mode() {
		return this.enabled ? 'Upload' : 'Inaction';
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({ params: [{ [AutoUpload.PropertyName]: 'sd' }] });
		if (typeof response !== 'object' || response === null || !(AutoUpload.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.updateFromValue(response[AutoUpload.PropertyName]);
		return this.enabled;
	}

	public async setValue(enabled: boolean) {
		const mode = enabled ? 'Upload' : 'Inaction';
		await this.client.property.setValue({
			params: [{ [AutoUpload.PropertyName]: { sd: mode } }],
		});
	}

	private updateFromValue(data: unknown) {
		if (typeof data !== 'object' || data === null || !('sd' in data)) return;

		this.enabled = data.sd === 'Upload';
	}
}
