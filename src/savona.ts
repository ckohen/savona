import type { Buffer } from 'node:buffer';
import { setInterval, setTimeout, clearInterval } from 'node:timers';
import { URLSearchParams } from 'node:url';
import { AsyncEventEmitter } from '@vladfrangu/async_event_emitter';
import { DigestClient } from 'digest-fetch';
import { SavonaAlternate } from './clientMethods/alternate.js';
import { SavonaButton } from './clientMethods/button.js';
import { SavonaCapability } from './clientMethods/capability.js';
import { SavonaClip } from './clientMethods/clip/index.js';
import { SavonaNetwork } from './clientMethods/network.js';
import { SavonaNotify } from './clientMethods/notify.js';
import { SavonaP } from './clientMethods/p/index.js';
import { SavonaProcess } from './clientMethods/process/index.js';
import { SavonaProperty } from './clientMethods/property.js';
import { SavonaStorage } from './clientMethods/storage.js';
import { SavonaSystem } from './clientMethods/system/index.js';
import { LinearError } from './protocol/LinearErrors.js';
import { LinearClient, LinearEvent, WebsocketState, type LinearRequestParams } from './protocol/linear.js';
import { AssignableButtons } from './structures/AssignableButtons.js';
import { Audio } from './structures/Audio.js';
import { AutoBlackBalance } from './structures/AutoBlackBalance.js';
import { Buttons } from './structures/Buttons.js';
import { ClipInfo } from './structures/ClipInfo.js';
import { ColorBars } from './structures/ColorBars.js';
import { Focus } from './structures/Focus.js';
import { Gain } from './structures/Gain.js';
import { GlobalStatus } from './structures/GlobalStatus.js';
import { Iris } from './structures/Iris.js';
import { LensMount } from './structures/LensMount.js';
import { MainBattery } from './structures/MainBattery.js';
import { MainFile } from './structures/MainFile.js';
import { ND } from './structures/ND.js';
import { Shutter } from './structures/Shutter.js';
import { SlowAndQuick } from './structures/SlowAndQuick.js';
import { SystemConfig } from './structures/SystemConfig.js';
import { WhiteBalance } from './structures/WhiteBalance.js';
import { Zoom } from './structures/Zoom.js';

function isAuthenticationFailed(error: unknown) {
	if (!(error instanceof LinearError)) return false;
	return Array.isArray(error.data) && error.data.length === 2 && (error.data[0] === 403 || error.data[0] === 5_001);
}

async function getNonce(client: SavonaClient) {
	try {
		const response = await client.alternate.authentication.getNonce({ timeout: 1_000 });
		return response.nonce;
	} catch (error) {
		console.error('Savona getNonce failed', error);
		throw error;
	}
}

async function getDigest(nonce: string, baseURL: string, username: string, password: string) {
	const url = `${baseURL}/cgi-bin/getsavonadigest.cgi?nonce=${nonce}`;
	const res = (await new DigestClient(username, password).fetch(url)) as Response;
	if (!res.ok) {
		throw new Error(`Received error ${res.status}: ${res.statusText}`);
	}

	const data = await res.text();

	const asSearchParams = new URLSearchParams(data.split('\n').map((text) => text.split('=')) as [string, string][]);
	const digest = { cnonce: asSearchParams.get('cnonce'), response: asSearchParams.get('response') };
	if (digest.cnonce === null || digest.response === null) {
		throw new Error(`Did not receive cnonce or response: ${data}`);
	}

	return digest as { cnonce: string; response: string };
}

async function requestDigest(client: SavonaClient, digest: { cnonce: string; response: string }) {
	try {
		await client.alternate.authentication.digest({
			params: [digest],
			timeout: 1_000,
		});
	} catch (error) {
		if (isAuthenticationFailed(error)) {
			throw error;
		}

		console.log('Auth NG');
	}
}

export interface SavonaRequestOptions<Params extends LinearRequestParams = LinearRequestParams> {
	params?: Params;
	timeout?: number;
}

export const enum SavonaEvent {
	Connect = 'connect',
	Debug = 'debug',
	Disconnect = 'disconnect',
	Error = 'error',
	Notify = 'notify',
	Request = 'request',
	Response = 'response',
}

export interface SavonaEvents {
	[SavonaEvent.Connect]: [];
	[SavonaEvent.Debug]: [message: string];
	[SavonaEvent.Disconnect]: [code: number, reason?: Buffer];
	[SavonaEvent.Notify]: [{ data: unknown; name: string }];
	[SavonaEvent.Request]: [{ id: number; method: string; params: LinearRequestParams }];
	[SavonaEvent.Response]: [{ error: unknown; id: number; result: unknown }];
	[SavonaEvent.Error]: [error: string];
}

export interface SavonaNotificationEvents {
	[name: string]: [data: unknown];
}

export class SavonaClient extends AsyncEventEmitter<SavonaEvents> {
	public version = '2.7.1';

	public property = new SavonaProperty(this);

	public capability = new SavonaCapability(this);

	public process = new SavonaProcess(this);

	public system = new SavonaSystem(this);

	public clip = new SavonaClip(this);

	public storage = new SavonaStorage(this);

	public button = new SavonaButton(this);

	public notify = new SavonaNotify(this);

	// eslint-disable-next-line id-length
	public p = new SavonaP(this);

	public alternate = new SavonaAlternate(this);

	public network = new SavonaNetwork(this);

	public readonly notifications = {
		raw: new AsyncEventEmitter<SavonaNotificationEvents>(),
		propertyValueChanged: new AsyncEventEmitter<SavonaNotificationEvents>(),
		propertyStatusChanged: new AsyncEventEmitter<SavonaNotificationEvents>(),
		process: new AsyncEventEmitter<SavonaNotificationEvents>(),
	} as const;

	public assignableButtons = new AssignableButtons(this);

	public audio = new Audio(this);

	public autoBlackBalance = new AutoBlackBalance(this);

	public buttons = new Buttons(this);

	public clipInfo = new ClipInfo(this);

	public colorBars = new ColorBars(this);

	public focus = new Focus(this);

	public gain = new Gain(this);

	public globalStatus = new GlobalStatus(this);

	public iris = new Iris(this);

	public lensMount = new LensMount(this);

	public mainBattery = new MainBattery(this);

	public mainFile = new MainFile(this);

	public ND = new ND(this);

	public shutter = new Shutter(this);

	public slowAndQuick = new SlowAndQuick(this);

	public systemConfig = new SystemConfig(this);

	public whiteBalance = new WhiteBalance(this);

	public zoom = new Zoom(this);

	private readonly linear: LinearClient;

	private isManualDisconnect = false;

	private readonly useSSL;

	private notificationSubscribe;

	private connectionCheckInterval: NodeJS.Timeout | undefined;

	public constructor(
		public readonly hostname: string,
		private readonly username: string,
		private readonly password: string,
		{ useSSL = false, subscribeToNotifications = false } = {},
	) {
		super();
		this.useSSL = useSSL;
		this.notificationSubscribe = subscribeToNotifications;
		this.linear = new LinearClient({ host: hostname, useSSL });

		this.linear.on(LinearEvent.Connect, async () => this.onConnect());
		this.linear.on(LinearEvent.Disconnect, (code, reason) => this.onDisconnect(code, reason));
		this.linear.on(LinearEvent.Notify, (notification) => this.onNotify(notification));
		this.linear.on(LinearEvent.Response, (response) => this.emit(SavonaEvent.Response, response));
		this.linear.on(LinearEvent.Request, (request) => this.emit(SavonaEvent.Request, request));
		this.linear.on(LinearEvent.Debug, (message) => this.emit(SavonaEvent.Debug, `[Linear Debug]: ${message}`));
		this.linear.on(LinearEvent.Error, (error) => this.emit(SavonaEvent.Error, `[Linear Error]: ${error}`));
	}

	public get state() {
		return this.linear.state;
	}

	public async connect(timeout?: number) {
		this.isManualDisconnect = false;
		await this.linear.connect(timeout);
	}

	public async disconnect(reconnect = false) {
		if (!reconnect) this.isManualDisconnect = true;
		await this.linear.disconnect();
	}

	public async request(method: string, { timeout, params = [] }: SavonaRequestOptions = {}) {
		return this.linear.request({ method, timeout, params });
	}

	public async subscribeToNotifications() {
		this.notificationSubscribe = true;
		if (this.state === WebsocketState.Connected) {
			await this._subscribe();
		}
	}

	public async unsubscribeFromNotifications() {
		this.notificationSubscribe = false;
		if (this.state === WebsocketState.Connected) {
			await this._unsubscribe();
		}
	}

	private async _subscribe() {
		await this.notify.subscribe({ params: [['Notify.Properties', 'Notify.Process', 'Notify.Property']] });
	}

	private async _unsubscribe() {
		await this.notify.unsubscribe({ params: [['Notify.Properties', 'Notify.Process', 'Notify.Property']] });
	}

	private async onConnect() {
		try {
			const nonce = await getNonce(this);
			const digest = await getDigest(
				nonce,
				`http${this.useSSL ? 's' : ''}://${this.hostname}`,
				this.username,
				this.password,
			);
			await requestDigest(this, digest);
		} catch (error) {
			this.emit(
				SavonaEvent.Debug,
				`Error encountered while connecting: ${error instanceof Error ? error.message : error}`,
			);
		}

		// subscribe to events, get current values / status
		this.checkConnection();
		if (this.notificationSubscribe) {
			await this._subscribe();
		}

		this.emit(SavonaEvent.Connect);
	}

	private checkConnection() {
		this.connectionCheckInterval = setInterval(async () => {
			try {
				await this.property.getValue({ params: [{ 'System.Config': ['RemoteSetting'] }], timeout: 2_000 });
			} catch (error) {
				if (!this.isManualDisconnect) {
					this.emit(
						SavonaEvent.Error,
						`Error encountered during connection check: ${error instanceof Error ? error.message : error}`,
					);
					await this.disconnect();
					clearInterval(this.connectionCheckInterval);
				}

				this.connectionCheckInterval = undefined;
			}
		}, 5_000);
	}

	private onDisconnect(code: number, reason?: Buffer) {
		clearInterval(this.connectionCheckInterval);
		this.connectionCheckInterval = undefined;
		this.emit(SavonaEvent.Disconnect, code, reason);
		if (this.isManualDisconnect) return;
		setTimeout(async () => this.connect(), 1_000);
	}

	private onNotify({ name, data }: { data: unknown; name: string }) {
		this.notifications.raw.emit(name, data);
		if (!Array.isArray(data)) {
			return;
		}

		const notificationData = data[0] as unknown;

		switch (name) {
			case 'Notify.Property.Value.Changed': {
				if (typeof notificationData !== 'object' || notificationData === null) return;
				for (const [key, value] of Object.entries(notificationData)) {
					this.notifications.propertyValueChanged.emit(key, value);
				}

				break;
			}

			case 'Notify.Property.Status.Changed': {
				if (typeof notificationData !== 'object' || notificationData === null) return;
				for (const [key, value] of Object.entries(notificationData)) {
					this.notifications.propertyStatusChanged.emit(key, value);
				}

				break;
			}

			case 'Notify.Process.ErrorOccurred':
			case 'Notify.Process.Completed':
			case 'Notify.Process.Started':
			case 'Notify.Process.Aborted': {
				const eventName = name.split('.')[2] as string;
				this.notifications.process.emit(eventName, notificationData);
				break;
			}
		}
	}
}

// client.onnotify = function (event) {
// 	let jsonstring;
// 	let objArrItems;
// 	if (typeof JSON !== 'undefined') {
// 		jsonstring = JSON.stringify(event.data);
// 	} else {
// 		// sorry, IE does not have JSON.stringify
// 		jsonstring = event.data;
// 	}

// 	if (event.name == 'Notify.Property.Value.Changed') {
// 		objArrItems = JSON.parse(jsonstring)[0];
// 		j.each(objArrItems, (key, value) => {
// 			if (key == 'Security.Credential.LatestUpdated') {
// 				disconnect(key);
// 			}
// 		});
// 		NotifyMessagePopupProperties(objArrItems);
// 		ShutterCtrl.NotifySetShutterData(objArrItems);

// 		AssignCtrl.NotifySetAssignData(objArrItems);
// 		ColorBarsCtrl.NotifySetColorBarsData(objArrItems);
// 		SQFPSCtrl.NotifySetSQFPSData(objArrItems);
// 		WhiteCtrl.NotifySetClrTempData(objArrItems);
// 		GammaCtrl.NotifySetGammaData(objArrItems);
// 		SetCardNotifyData(objArrItems); // Card Notify
// 		MainBtteryNotifyData(objArrItems); // MainBattery Notify
// 		SetAudioNotifyData(objArrItems); // Audio
// 		SetClipNotifyData(objArrItems); // Clip number
// 		AutoIrisCtrl.NotifySetAutoIrisData(objArrItems);
// 		RecordCtrl.NotifySetRecorderData(objArrItems);
// 		ATWCtrl.NotifySetATWData(objArrItems);
// 		AWBCtrl.NotifySetAWBData(objArrItems);
// 		ABBCtrl.NotifySetABBData(objArrItems);
// 		LensMountCtrl.NotifySetLensMountData(objArrItems);
// 		FocusCtrl.NotifySetFocusData(objArrItems);
// 		ZoomCtrl.NotifySetZoomData(objArrItems);
// 		IrisCtrl.NotifySetIrisData(objArrItems);
// 		MainFileNotifyData(objArrItems); // Main File
// 		GainCtrl.NotifySetGainData(objArrItems);
// 		ClipNameCtrl.NotifySetClipNameData(objArrItems);
// 		NDCtrl.NotifySetNDFilterData(objArrItems);
// 		AGCCtrl.NotifySetAGCData(objArrItems);
// 		AutoShutterCtrl.NotifySetAutoShutterData(objArrItems);
// 		AutoNDCtrl.NotifySetANDData(objArrItems);
// 		SystemConfigCtrl.NotifySystemConfigData(objArrItems);
// 	} else if (event.name == 'Notify.Property.Status.Changed') {
// 		objArrItems = JSON.parse(jsonstring)[0];

// 		NDCtrl.NotifyNDFilterStatusData(objArrItems);
// 		IrisCtrl.NotifyIrisStatusData(objArrItems);
// 		FocusCtrl.NotifyFocusStatusData(objArrItems);
// 		ZoomCtrl.NotifyZoomStatusData(objArrItems);
// 		SQFPSCtrl.NotifySQFPSStatusData(objArrItems);
// 		ShutterCtrl.NotifyShutterStatusData(objArrItems);
// 		WhiteCtrl.NotifyWhiteStatusData(objArrItems);
// 		GammaCtrl.NotifyGammaStatusData(objArrItems);
// 		AutoIrisCtrl.NotifyAutoIrisStatusData(objArrItems);
// 		AutoShutterCtrl.NotifyAutoShutterStatusData(objArrItems);
// 		AGCCtrl.NotifyAGCStatusData(objArrItems);
// 		AutoNDCtrl.NotifyAutoNDStatusData(objArrItems);
// 		GainCtrl.NotifyGainStatusData(objArrItems);
// 		ATWCtrl.NotifyATWStatusData(objArrItems);
// 		ColorBarsCtrl.NotifyColorBarsStatusData(objArrItems);
// 		AWBCtrl.NotifyAWBtatusData(objArrItems);
// 	} else if (event.name == 'Notify.Process.ErrorOccurred') {
// 		objArrItems = JSON.parse(jsonstring)[0];
// 		if (objArrItems == 'Camera.WhiteBalance') {
// 			g_objABStatusDlg.userData.SetTitle('Auto White');
// 			g_objABStatusDlg.userData.SetText('Auto White Balance', 'NG');
// 			g_objABStatusDlg.userData.ShowDialog();
// 		}

// 		if (objArrItems == 'Camera.BlackBalance') {
// 			g_objABStatusDlg.userData.SetTitle('Auto Black');
// 			g_objABStatusDlg.userData.SetText('Auto Black Balance', 'NG');
// 			g_objABStatusDlg.userData.ShowDialog();
// 		}
// 	} else if (event.name == 'Notify.Process.Completed') {
// 		objArrItems = JSON.parse(jsonstring)[0];
// 		if (objArrItems == 'Camera.WhiteBalance') {
// 			// g_objABStatusDlg.userData.clearMessage();
// 			g_objABStatusDlg.userData.SetTitle('Auto White');
// 			g_objABStatusDlg.userData.SetText('Auto White Balance', 'OK');
// 			g_objABStatusDlg.userData.ShowDialog();
// 		}

// 		if (objArrItems == 'Camera.BlackBalance') {
// 			g_objABStatusDlg.userData.SetTitle('Auto Black');
// 			g_objABStatusDlg.userData.SetText('Auto Black Balance', 'OK');
// 			g_objABStatusDlg.userData.ShowDialog();
// 		}
// 	} else if (event.name == 'Notify.Process.Started') {
// 		closeAllShowingDialog();
// 		objArrItems = JSON.parse(jsonstring)[0];
// 		j.each(objArrItems, (key, value) => {
// 			if (key == 'Camera.WhiteBalance') {
// 				g_objABStatusDlg.userData.ShowDialog(false);
// 			}

// 			if (key == 'Camera.BlackBalance') {
// 				g_objABStatusDlg.userData.ShowDialog(false);
// 			}
// 		});
// 	} else if (event.name == 'Notify.Process.Aborted') {
// 		objArrItems = JSON.parse(jsonstring)[0];
// 		j.each(objArrItems, (key, value) => {
// 			if (key == 'Camera.WhiteBalance') {
// 				g_objABStatusDlg.userData.SetTitle('Auto White');
// 				g_objABStatusDlg.userData.SetText('Auto White Balance', 'Cancelled');
// 				g_objABStatusDlg.userData.ShowDialog();
// 			}

// 			if (key == 'Camera.BlackBalance') {
// 				g_objABStatusDlg.userData.SetTitle('Auto Black');
// 				g_objABStatusDlg.userData.SetText('Auto Black Balance', 'Cancelled');
// 				g_objABStatusDlg.userData.ShowDialog();
// 			}
// 		});
// 	}
// };
