import type { SavonaClient } from '../savona.js';

export interface DeviceInfoValue {
	dateTime: string;
	deviceName: string;
	extUsbEthernetStatus: unknown;
	isExternal: boolean;
	modelName: string;
	name: string;
	serialNumber: string;
}

function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function devicePrefix(modelName: string) {
	const match = /^[A-Z]{3}-(?<name>.+)$/.exec(modelName);
	if (match?.groups?.name !== undefined) return match.groups.name;
	return modelName === '' ? 'Unknown' : modelName;
}

export class DeviceInfo {
	public static readonly DateTimePropertyName = 'System.DateTime.Time';

	public static readonly ExtUsbEthernetStatusPropertyName = 'Interface.USB.Receptacle';

	public static readonly ModelNamePropertyName = 'System.ModelName';

	public static readonly SerialNumberPropertyName = 'System.SerialNumber';

	public static readonly UsbNamePropertyName = 'Interface.USB.Name';

	public dateTime = '';

	public deviceName = '';

	public extUsbEthernetStatus: unknown;

	public modelName = '';

	public serialNumber = '';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(DeviceInfo.DateTimePropertyName, (data) => {
			if (typeof data === 'string') this.dateTime = data;
		});
		client.notifications.propertyValueChanged.on(DeviceInfo.ExtUsbEthernetStatusPropertyName, (data) => {
			this.extUsbEthernetStatus = asRecord(data).extusbether;
		});
		client.notifications.propertyValueChanged.on(DeviceInfo.ModelNamePropertyName, (data) => {
			if (typeof data === 'string') this.modelName = data;
		});
		client.notifications.propertyValueChanged.on(DeviceInfo.SerialNumberPropertyName, (data) => {
			if (typeof data === 'string') this.serialNumber = data;
		});
		client.notifications.propertyValueChanged.on(DeviceInfo.UsbNamePropertyName, (data) => {
			const deviceName = asRecord(data).usbether;
			if (typeof deviceName === 'string') this.deviceName = deviceName;
		});
	}

	public get isExternal() {
		return this.modelName.startsWith('CBK-WA');
	}

	public get name() {
		return `${devicePrefix(this.modelName)}_${this.serialNumber}`;
	}

	public get value(): DeviceInfoValue {
		return {
			dateTime: this.dateTime,
			deviceName: this.deviceName,
			extUsbEthernetStatus: this.extUsbEthernetStatus,
			isExternal: this.isExternal,
			modelName: this.modelName,
			name: this.name,
			serialNumber: this.serialNumber,
		};
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{
					[DeviceInfo.DateTimePropertyName]: ['*'],
					[DeviceInfo.ExtUsbEthernetStatusPropertyName]: 'extusbether',
					[DeviceInfo.ModelNamePropertyName]: ['*'],
					[DeviceInfo.SerialNumberPropertyName]: ['*'],
					[DeviceInfo.UsbNamePropertyName]: 'usbether',
				},
			],
		});

		this.updateFromResponse(response);
		return this.value;
	}

	public async fetchDateTime() {
		const response = await this.client.property.getValue({ params: [{ [DeviceInfo.DateTimePropertyName]: ['*'] }] });
		this.updateFromResponse(response);
		return this.dateTime;
	}

	public async fetchExtUsbEthernetStatus() {
		const response = await this.client.property.getValue({
			params: [{ [DeviceInfo.ExtUsbEthernetStatusPropertyName]: 'extusbether' }],
		});

		this.updateFromResponse(response);
		return this.extUsbEthernetStatus;
	}

	private updateFromResponse(response: unknown) {
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const values = response as Record<string, unknown>;
		const dateTime = values[DeviceInfo.DateTimePropertyName];
		if (typeof dateTime === 'string') {
			this.dateTime = dateTime;
		}

		if (DeviceInfo.ExtUsbEthernetStatusPropertyName in values) {
			this.extUsbEthernetStatus = asRecord(values[DeviceInfo.ExtUsbEthernetStatusPropertyName]).extusbether;
		}

		const modelName = values[DeviceInfo.ModelNamePropertyName];
		if (typeof modelName === 'string') {
			this.modelName = modelName;
		}

		const serialNumber = values[DeviceInfo.SerialNumberPropertyName];
		if (typeof serialNumber === 'string') {
			this.serialNumber = serialNumber;
		}

		if (DeviceInfo.UsbNamePropertyName in values) {
			const deviceName = asRecord(values[DeviceInfo.UsbNamePropertyName]).usbether;
			if (typeof deviceName === 'string') this.deviceName = deviceName;
		}
	}
}
