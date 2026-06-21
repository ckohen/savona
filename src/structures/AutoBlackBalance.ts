import {
	EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
	EVENT_AWB_MODE_DISPLAY,
	EVENT_CCD_DCOFFSET_UPDATE,
	EVENT_CCD_GAINOFFSET_UPDATE,
	EVENT_COLORBAR_ON,
	EVENT_PLAY_UPDATE,
	EVENT_RECORDE_UPDATE,
	EVENT_RPN_EXECUTEING,
	EVENT_TESTSAW_ON,
	EVENT_THUMBNAIL_UPDATE,
	EVENT_VIEW_UPDATE,
	EVENT_WHITESHADING_UPDATE,
	EVENTKIND_BLACKSHADING_REFRESH,
	EVENTKIND_POOLFEED_REFRESH,
} from '../constants.js';
import type { SavonaClient } from '../savona.js';

export class AutoBlackBalance {
	public static readonly PropertyName = 'P.Control.u2x500.AutoBlackBalance';

	public status: 'Locked' | 'Unlocked' = 'Unlocked';

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('P.Menu.pmw-f5x.Event.EventID', async (data) => {
			if (
				[
					EVENT_PLAY_UPDATE,
					EVENT_THUMBNAIL_UPDATE,
					EVENT_RECORDE_UPDATE,
					EVENT_VIEW_UPDATE,
					EVENT_TESTSAW_ON,
					EVENT_COLORBAR_ON,
					EVENT_AWB_MODE_DISPLAY,
					EVENT_RPN_EXECUTEING,
					EVENT_WHITESHADING_UPDATE,
					EVENTKIND_BLACKSHADING_REFRESH,
					EVENT_CCD_GAINOFFSET_UPDATE,
					EVENT_CCD_DCOFFSET_UPDATE,
					EVENTKIND_POOLFEED_REFRESH,
					EVENT_700P_CONNECTION_STATUS_REFRESH_WIFI,
				].includes(data as number)
			) {
				await this.fetchStatus();
			}
		});
	}

	public async execute() {
		await this.client.process.execute.automaticAdjustment({ params: [['Camera.BlackBalance']] });
	}

	public async fetchStatus() {
		const response = await this.client.property.getStatus({ params: [{ [AutoBlackBalance.PropertyName]: ['*'] }] });
		if (typeof response !== 'object' || response === null || !(AutoBlackBalance.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		this.status = response[AutoBlackBalance.PropertyName] as 'Locked' | 'Unlocked';
		return response[AutoBlackBalance.PropertyName] as 'Locked' | 'Unlocked';
	}
}
