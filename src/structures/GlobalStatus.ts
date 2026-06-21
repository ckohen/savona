import type { SavonaClient } from '../savona.js';

export class GlobalStatus {
	public static readonly PropertyName = 'Network.RemoteControl.Allow';

	public read: boolean = true;

	public write: boolean = true;

	public execute: boolean = true;

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(GlobalStatus.PropertyName, (data) => {
			const values = data as { execute: boolean; read: boolean; write: boolean };

			this.execute = values.execute;
			this.read = values.read;
			this.write = values.write;
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({ params: [{ [GlobalStatus.PropertyName]: null }] });
		if (typeof response !== 'object' || response === null || !(GlobalStatus.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		const values = response[GlobalStatus.PropertyName] as { execute: boolean; read: boolean; write: boolean };

		this.execute = values.execute;
		this.read = values.read;
		this.write = values.write;

		return values;
	}
}
