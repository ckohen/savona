import {
	EVENT_ABB_EXECUTE_FOR_GREY_OUT,
	EVENT_AWB_MODE_DISPLAY,
	EVENT_GAMMA_UPDATE,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENTKIND_POOLFEED_REFRESH,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export const enum GammaValue {
	DVW = 'STD1',
	HG3250G36 = 'HG1',
	HG3259G40 = 'HG3',
	HG4600G30 = 'HG2',
	HG4609G33 = 'HG4',
	M240 = 'STD4',
	R709 = 'STD5',
	X3_5 = 'STD3',
	X4_5 = 'STD2',
	X5_0 = 'STD6',
}

export class Gamma {
	public enabled: boolean = true;

	public type: 'HDR' | 'HyperGamma' | 'STD' = 'STD';

	public value: GammaValue = GammaValue.DVW;

	public HDRValue: string = 'HLG';

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyStatusChanged.on('Paint.Gamma.Enabled', async (data) => {
			this.status = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyValueChanged.on('Paint.Gamma.Enabled', async (data) => {
			this.enabled = data as boolean;
		});
		client.notifications.propertyValueChanged.on('Paint.Gamma.Type', async (data) => {
			this.type = data as 'HyperGamma' | 'STD';
		});
		client.notifications.propertyValueChanged.on('Paint.Gamma.Value', async (data) => {
			this.value = data as GammaValue;
		});
		client.notifications.propertyValueChanged.on('P.Menu.pmw-f5x.Event.EventID', async (data) => {
			if (
				[
					EVENT_PLAY_UPDATE,
					EVENT_THUMBNAIL_UPDATE,
					EVENT_RECORDE_UPDATE,
					EVENT_VIEW_UPDATE,
					EVENT_GAMMA_UPDATE,
					EVENT_ABB_EXECUTE_FOR_GREY_OUT,
					EVENT_AWB_MODE_DISPLAY,
					EVENTKIND_POOLFEED_REFRESH,
				].includes(data as number)
			) {
				await this.fetchStatus();
			}
		});
		client.notifications.propertyValueChanged.on('Paint.Gamma.HDR.Value', async (data) => {
			const hdrValue = data as { cam: string };
			this.HDRValue = hdrValue.cam;
		});
		client.notifications.propertyValueChanged.on('Camera.ShootingMode', async () => {
			await this.fetchValue();
		});
		client.notifications.propertyValueChanged.on('Camera.ShootingMode.QFHD.RecOut', async () => {
			await this.fetchValue();
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{
					'Paint.Gamma.Enabled': ['*'],
					'Paint.Gamma.Type': ['*'],
					'Paint.Gamma.Value': ['*'],
					'Paint.Gamma.HDR.Value': ['cam'],
					'Camera.ShootingMode': ['cam'],
					'Camera.ShootingMode.QFHD.RecOut': ['cam'],
				},
			],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const responseValue: { HDRValue?: string; enabled?: boolean; type?: 'HyperGamma' | 'STD'; value?: GammaValue } = {};

		if ('Paint.Gamma.Enabled' in response) {
			this.enabled = response['Paint.Gamma.Enabled'] as boolean;
			responseValue.enabled = this.enabled;
		}

		if ('Paint.Gamma.Type' in response) {
			this.type = response['Paint.Gamma.Type'] as 'HyperGamma' | 'STD';
			responseValue.type = this.type;
		}

		if ('Camera.ShootingMode' in response) {
			const shootingMode = response['Camera.ShootingMode'] as { cam: string };
			if (shootingMode.cam === 'HDR') {
				this.type = 'HDR';
			}
		}

		if ('Paint.Gamma.HDR.Value' in response && 'Camera.ShootingMode.QFHD.RecOut' in response) {
			const recOut = response['Camera.ShootingMode.QFHD.RecOut'] as { cam: string };
			if (recOut.cam === 'S-Log3') {
				this.HDRValue = 'S-Log3';
			} else {
				const hdrValue = response['Paint.Gamma.HDR.Value'] as { cam: string };
				this.HDRValue = hdrValue.cam;
			}

			responseValue.HDRValue = this.HDRValue;
		}

		if ('Paint.Gamma.Value' in response) {
			this.value = response['Paint.Gamma.Value'] as GammaValue;
			responseValue.value = this.value;
		}

		return responseValue;
	}

	public async setValue(value: GammaValue) {
		await this.client.property.setValue({
			params: [{ 'Paint.Gamma.Type': value.startsWith('HG') ? 'HG' : 'STD', 'Paint.Gamma.Value': value }],
		});
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({ params: [{ 'Paint.Gamma.Enabled': null }] });
		if (typeof response !== 'object' || response === null || !('Paint.Gamma.Enabled' in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response['Paint.Gamma.Enabled'] as 'Locked' | 'Unlocked';
		return response['Paint.Gamma.Enabled'] as 'Locked' | 'Unlocked';
	}
}
