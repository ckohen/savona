import type { SavonaClient } from '../savona.js';

export class LensMount {
	public static readonly PropertyName = 'Camera.Lens.Mount';

	public connected: boolean = true;

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(LensMount.PropertyName, (data) => {
			this.connected = data !== 'Disconnected';
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({ params: [{ [LensMount.PropertyName]: null }] });
		if (typeof response !== 'object' || response === null || !(LensMount.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.connected = response[LensMount.PropertyName] !== 'Disconnected';

		return this.connected;
	}
}
