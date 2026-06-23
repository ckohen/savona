import type { SavonaClient } from '../savona.js';

export class MainBattery {
	public type: 'Battery' | 'DC' = 'Battery';

	public percentage: number = -1;

	public voltage: number = -1;

	public minute: number = -1;

	public display: 'minute' | 'percent' | 'voltage' | 0 = 0;

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('System.Battery.Active.Type', (data) => {
			this.type = data as 'Battery' | 'DC';
		});
		client.notifications.propertyValueChanged.on('System.Battery.Active.Remain.Percentage', (data) => {
			this.percentage = data as number;
		});
		client.notifications.propertyValueChanged.on('System.Battery.Active.Remain.Minute', (data) => {
			this.minute = data as number;
		});
		client.notifications.propertyValueChanged.on('System.Battery.Active.Remain.Voltage', (data) => {
			this.voltage = data as number;
		});
		client.notifications.propertyValueChanged.on('System.Battery.Active.Remain.Display', (data) => {
			this.display = data as 'minute' | 'percent' | 'voltage' | 0;
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{
					'System.Battery.Active.Type': ['*'],
					'System.Battery.Active.Remain.Percentage': ['*'],
					'System.Battery.Active.Remain.Minute': ['*'],
					'System.Battery.Active.Remain.Voltage': ['*'],
					'System.Battery.Active.Remain.Display': ['*'],
				},
			],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const repsonseValue: {
			display?: 'minute' | 'percent' | 'voltage' | 0;
			minute?: number;
			percentage?: number;
			type?: string;
			voltage?: number;
		} = {};

		if ('System.Battery.Active.Type' in response) {
			this.type = response['System.Battery.Active.Type'] as 'Battery' | 'DC';
			repsonseValue.type = this.type;
		}

		if ('System.Battery.Active.Remain.Percentage' in response) {
			this.percentage = response['System.Battery.Active.Remain.Percentage'] as number;
			repsonseValue.percentage = this.percentage;
		}

		if ('System.Battery.Active.Remain.Minute' in response) {
			this.minute = response['System.Battery.Active.Remain.Minute'] as number;
			repsonseValue.minute = this.minute;
		}

		if ('System.Battery.Active.Remain.Voltage' in response) {
			this.voltage = response['System.Battery.Active.Remain.Voltage'] as number;
			repsonseValue.voltage = this.voltage;
		}

		if ('System.Battery.Active.Remain.Display' in response) {
			this.display = response['System.Battery.Active.Remain.Display'] as 'minute' | 'percent' | 'voltage' | 0;
			repsonseValue.display = this.display;
		}

		return repsonseValue;
	}
}
