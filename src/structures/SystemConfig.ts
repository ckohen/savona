import type { SavonaClient } from '../savona.js';

export interface SystemConfigEnabled {
	enabled: true;
	method?: string;
	type?: string[];
}

export interface SystemConfigDisabled {
	enabled: false;
}

export type SystemConfigOption<ExtraOptions extends object = object> =
	| SystemConfigDisabled
	| (ExtraOptions & SystemConfigEnabled);

export class SystemConfig {
	public static readonly PropertyName = 'SystemConfig';

	public fileTransfer: SystemConfigOption<{ filetype: string[] }> = { enabled: false };

	public liveLogging: SystemConfigOption = { enabled: false };

	public NRTMetaEdit: SystemConfigOption = { enabled: false };

	public networkModule: SystemConfigOption = { enabled: true, method: 'savona', type: ['CAM'] };

	public planningMetadata: SystemConfigOption<{ path: { read: string; write: string } }> = { enabled: false };

	public proxyRec: SystemConfigOption = { enabled: false };

	public remoteControl: SystemConfigOption = { enabled: false };

	public remoteDeleteClip: SystemConfigOption = { enabled: false };

	public remoteMediaFormat: SystemConfigOption = { enabled: false };

	public remoteRenameClip: SystemConfigOption = { enabled: false };

	public remoteSetting: SystemConfigOption = { enabled: true };

	public storyBoard: SystemConfigOption<{ path: { read: string; write: string } }> = { enabled: false };

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on(SystemConfig.PropertyName, (data) => {
			const values = data as {
				FileTransfer?: SystemConfigOption<{ filetype: string[] }>;
				LiveLogging?: SystemConfigOption;
				NRTMetaEdit?: SystemConfigOption;
				NetworkModule?: SystemConfigOption;
				PlanningMetadata?: SystemConfigOption<{ path: { read: string; write: string } }>;
				ProxyRec?: SystemConfigOption;
				RemoteControl?: SystemConfigOption;
				RemoteDeleteClip?: SystemConfigOption;
				RemoteMediaFormat?: SystemConfigOption;
				RemoteRenameClip?: SystemConfigOption;
				RemoteSetting?: SystemConfigOption;
				StoryBoard?: SystemConfigOption<{ path: { read: string; write: string } }>;
			};
			if (values.FileTransfer) {
				this.fileTransfer = values.FileTransfer;
			}

			if (values.LiveLogging) {
				this.liveLogging = values.LiveLogging;
			}

			if (values.NRTMetaEdit) {
				this.NRTMetaEdit = values.NRTMetaEdit;
			}

			if (values.NetworkModule) {
				this.networkModule = values.NetworkModule;
			}

			if (values.PlanningMetadata) {
				this.planningMetadata = values.PlanningMetadata;
			}

			if (values.ProxyRec) {
				this.proxyRec = values.ProxyRec;
			}

			if (values.RemoteControl) {
				this.remoteControl = values.RemoteControl;
			}

			if (values.RemoteDeleteClip) {
				this.remoteDeleteClip = values.RemoteDeleteClip;
			}

			if (values.RemoteMediaFormat) {
				this.remoteMediaFormat = values.RemoteMediaFormat;
			}

			if (values.RemoteRenameClip) {
				this.remoteRenameClip = values.RemoteRenameClip;
			}

			if (values.RemoteSetting) {
				this.remoteSetting = values.RemoteSetting;
			}

			if (values.StoryBoard) {
				this.storyBoard = values.StoryBoard;
			}
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({ params: [{ [SystemConfig.PropertyName]: null }] });
		if (typeof response !== 'object' || response === null || !(SystemConfig.PropertyName in response)) {
			throw new Error('Response does not match expected format');
		}

		const responseValue = response[SystemConfig.PropertyName];

		if (typeof responseValue !== 'object' || responseValue === null) {
			throw new Error('Response does not match expected format');
		}

		const returnValue: {
			NRTMetaEdit?: SystemConfigOption;
			fileTransfer?: SystemConfigOption<{ filetype: string[] }>;
			liveLogging?: SystemConfigOption;
			networkModule?: SystemConfigOption;
			planningMetadata?: SystemConfigOption<{ path: { read: string; write: string } }>;
			proxyRec?: SystemConfigOption;
			remoteControl?: SystemConfigOption;
			remoteDeleteClip?: SystemConfigOption;
			remoteMediaFormat?: SystemConfigOption;
			remoteRenameClip?: SystemConfigOption;
			remoteSetting?: SystemConfigOption;
			storyBoard?: SystemConfigOption<{ path: { read: string; write: string } }>;
		} = {};

		if ('FileTransfer' in responseValue) {
			returnValue.fileTransfer = responseValue.FileTransfer as SystemConfigOption<{ filetype: string[] }>;
			this.fileTransfer = returnValue.fileTransfer;
		}

		if ('LiveLogging' in responseValue) {
			returnValue.liveLogging = responseValue.LiveLogging as SystemConfigOption;
			this.liveLogging = returnValue.liveLogging;
		}

		if ('NTRMetaEdit' in responseValue) {
			returnValue.NRTMetaEdit = responseValue.NTRMetaEdit as SystemConfigOption;
			this.NRTMetaEdit = returnValue.NRTMetaEdit;
		}

		if ('NetworkModule' in responseValue) {
			returnValue.networkModule = responseValue.NetworkModule as SystemConfigOption;
			this.networkModule = returnValue.networkModule;
		}

		if ('PlanningMetadata' in responseValue) {
			returnValue.planningMetadata = responseValue.PlanningMetadata as SystemConfigOption<{
				path: { read: string; write: string };
			}>;
			this.planningMetadata = returnValue.planningMetadata;
		}

		if ('ProxyRec' in responseValue) {
			returnValue.proxyRec = responseValue.ProxyRec as SystemConfigOption;
			this.proxyRec = returnValue.proxyRec;
		}

		if ('RemoteControl' in responseValue) {
			returnValue.remoteControl = responseValue.RemoteControl as SystemConfigOption;
			this.remoteControl = returnValue.remoteControl;
		}

		if ('RemoteDeleteClip' in responseValue) {
			returnValue.remoteDeleteClip = responseValue.RemoteDeleteClip as SystemConfigOption;
			this.remoteDeleteClip = returnValue.remoteDeleteClip;
		}

		if ('RemoteMediaFormat' in responseValue) {
			returnValue.remoteMediaFormat = responseValue.RemoteMediaFormat as SystemConfigOption;
			this.remoteMediaFormat = returnValue.remoteMediaFormat;
		}

		if ('RemoteRenameClip' in responseValue) {
			returnValue.remoteRenameClip = responseValue.RemoteRenameClip as SystemConfigOption;
			this.remoteRenameClip = returnValue.remoteRenameClip;
		}

		if ('RemoteSetting' in responseValue) {
			returnValue.remoteSetting = responseValue.RemoteSetting as SystemConfigOption;
			this.remoteSetting = returnValue.remoteSetting;
		}

		if ('StoryBoard' in responseValue) {
			returnValue.storyBoard = responseValue.StoryBoard as SystemConfigOption<{
				path: { read: string; write: string };
			}>;
			this.storyBoard = returnValue.storyBoard;
		}

		return returnValue;
	}
}
