import type { Buffer } from 'node:buffer';
import { setInterval, setTimeout, clearInterval } from 'node:timers';
import { URLSearchParams } from 'node:url';
import type { URL } from 'node:url';
import { inspect } from 'node:util';
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
import { fetchWithDigest } from './protocol/http.js';
import { LinearClient, LinearEvent, WebsocketState, type LinearRequestParams } from './protocol/linear.js';
import { AssignableButtons } from './structures/AssignableButtons.js';
import { Audio } from './structures/Audio.js';
import { AutoBlackBalance } from './structures/AutoBlackBalance.js';
import { AutoUpload } from './structures/AutoUpload.js';
import { Buttons } from './structures/Buttons.js';
import { ClipInfo } from './structures/ClipInfo.js';
import { ColorBars } from './structures/ColorBars.js';
import { DeviceInfo } from './structures/DeviceInfo.js';
import { Focus } from './structures/Focus.js';
import { Gain } from './structures/Gain.js';
import { Gamma } from './structures/Gamma.js';
import { GlobalStatus } from './structures/GlobalStatus.js';
import { Iris } from './structures/Iris.js';
import { LensMount } from './structures/LensMount.js';
import { MainBattery } from './structures/MainBattery.js';
import { MainFile } from './structures/MainFile.js';
import { MediaCards } from './structures/MediaCard.js';
import { ND } from './structures/ND.js';
import { Record } from './structures/Record.js';
import { Shutter } from './structures/Shutter.js';
import { SlowAndQuick } from './structures/SlowAndQuick.js';
import { SystemConfig } from './structures/SystemConfig.js';
import { SystemFunctions } from './structures/SystemFunctions.js';
import { SystemMessages } from './structures/SystemMessages.js';
import { UploadJobs } from './structures/UploadJobs.js';
import { UploadSettings } from './structures/UploadSettings.js';
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

function formatError(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === 'string') return error;
	return inspect(error, { depth: 4 });
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

const NotificationSubscriptions = ['Notify.Properties', 'Notify.Process', 'Notify.Property', 'Notify.Capability'];
const MenuEventPropertyName = 'P.Menu.pmw-f5x.Event.EventID';
const ConnectionCheckInterval = 5_000;
const ConnectionCheckTimeout = 2_000;
const ConnectionCheckFailureLimit = 3;

interface MenuEventRefreshHandler {
	description: string;
	eventIds: ReadonlySet<number>;
	refresh(eventId: number): Promise<unknown> | unknown;
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
		propertyErrorOccurred: new AsyncEventEmitter<SavonaNotificationEvents>(),
		capabilitiesChanged: new AsyncEventEmitter<SavonaNotificationEvents>(),
		capabilityValueChanged: new AsyncEventEmitter<SavonaNotificationEvents>(),
		process: new AsyncEventEmitter<SavonaNotificationEvents>(),
	} as const;

	private readonly menuEventRefreshHandlers: MenuEventRefreshHandler[] = [];

	private menuEventRefreshTimer: NodeJS.Timeout | undefined;

	private isRefreshingMenuEvents = false;

	private readonly pendingMenuEventRefreshIds: Set<number> = new Set();

	public assignableButtons = new AssignableButtons(this);

	public audio = new Audio(this);

	public autoUpload = new AutoUpload(this);

	public autoBlackBalance = new AutoBlackBalance(this);

	public buttons = new Buttons(this);

	public clipInfo = new ClipInfo(this);

	public colorBars = new ColorBars(this);

	public deviceInfo = new DeviceInfo(this);

	public focus = new Focus(this);

	public gain = new Gain(this);

	public gamma = new Gamma(this);

	public globalStatus = new GlobalStatus(this);

	public iris = new Iris(this);

	public lensMount = new LensMount(this);

	public mainBattery = new MainBattery(this);

	public mainFile = new MainFile(this);

	public mediaCards = new MediaCards(this);

	public ND = new ND(this);

	public record = new Record(this);

	public shutter = new Shutter(this);

	public slowAndQuick = new SlowAndQuick(this);

	public systemConfig = new SystemConfig(this);

	public systemFunctions = new SystemFunctions(this);

	public systemMessages = new SystemMessages(this);

	public uploadJobs = new UploadJobs(this);

	public uploadSettings = new UploadSettings(this);

	public whiteBalance = new WhiteBalance(this);

	public zoom = new Zoom(this);

	private readonly linear: LinearClient;

	private isManualDisconnect = false;

	private readonly useSSL;

	private notificationSubscribe;

	private connectionCheckInterval: NodeJS.Timeout | undefined;

	private consecutiveConnectionCheckFailures = 0;

	private isConnectionCheckInFlight = false;

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

		this.setupNotificationErrorHandlers();
		this.notifications.propertyValueChanged.on(MenuEventPropertyName, (data) => this.queueMenuEventRefresh(data));

		this.linear.on(LinearEvent.Disconnect, (code, reason) => this.onDisconnect(code, reason));
		this.linear.on(LinearEvent.Notify, (notification) => this.onNotify(notification));
		this.linear.on(LinearEvent.Response, (response) => this.emit(SavonaEvent.Response, response));
		this.linear.on(LinearEvent.Request, (request) => this.emit(SavonaEvent.Request, request));
		this.linear.on(LinearEvent.Debug, (message) => this.emit(SavonaEvent.Debug, `[Linear Debug]: ${message}`));
		this.linear.on(LinearEvent.Error, (error) => this.emitError(`[Linear Error]: ${error}`));
	}

	public get state() {
		return this.linear.state;
	}

	public get httpBaseURL() {
		return `http${this.useSSL ? 's' : ''}://${this.hostname}`;
	}

	public async fetch(url: URL | string, options?: RequestInit) {
		return fetchWithDigest(url, this.username, this.password, options);
	}

	public async connect(timeout?: number) {
		this.isManualDisconnect = false;
		await this.linear.connect(timeout);
		try {
			await this.onConnect();
		} catch (error) {
			this.isManualDisconnect = true;
			try {
				await this.linear.disconnect();
			} catch {
				// The socket may already be closed by the time setup fails.
			}

			throw error;
		}
	}

	public async disconnect(reconnect = false) {
		if (!reconnect) this.isManualDisconnect = true;
		await this.linear.disconnect();
	}

	public async request(method: string, { timeout, params = [] }: SavonaRequestOptions = {}) {
		return this.linear.request({ method, timeout, params });
	}

	/**
	 * @internal
	 */
	public registerMenuEventRefresh(
		eventIds: readonly number[],
		description: string,
		refresh: (eventId: number) => Promise<unknown> | unknown,
	) {
		this.menuEventRefreshHandlers.push({ description, eventIds: new Set(eventIds), refresh });
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
		await this.notify.subscribe({ params: [NotificationSubscriptions] });
	}

	private async _unsubscribe() {
		await this.notify.unsubscribe({ params: [NotificationSubscriptions] });
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

			if (this.notificationSubscribe) {
				await this._subscribe();
			}
		} catch (error) {
			this.emit(
				SavonaEvent.Debug,
				`Error encountered while connecting: ${error instanceof Error ? error.message : error}`,
			);
			throw error;
		}

		this.checkConnection();
		this.emit(SavonaEvent.Connect);
	}

	private setupNotificationErrorHandlers() {
		for (const [name, emitter] of Object.entries(this.notifications)) {
			emitter.on('error', (error) => {
				this.emitError(`Notification listener error on ${name}: ${formatError(error)}`);
			});
		}
	}

	private queueMenuEventRefresh(data: unknown) {
		const eventId = Number(data);
		if (!Number.isFinite(eventId)) return;

		this.pendingMenuEventRefreshIds.add(eventId);
		if (this.isRefreshingMenuEvents || this.menuEventRefreshTimer !== undefined) return;

		this.menuEventRefreshTimer = setTimeout(() => {
			this.menuEventRefreshTimer = undefined;
			void this.refreshMenuEventStatuses();
		}, 0);
	}

	private async refreshMenuEventStatuses() {
		if (this.isRefreshingMenuEvents) return;
		this.isRefreshingMenuEvents = true;

		try {
			while (this.pendingMenuEventRefreshIds.size > 0) {
				const eventIds = [...this.pendingMenuEventRefreshIds];
				this.pendingMenuEventRefreshIds.clear();
				const refreshHandlers = new Map<MenuEventRefreshHandler, number>();

				for (const eventId of eventIds) {
					for (const handler of this.menuEventRefreshHandlers) {
						if (handler.eventIds.has(eventId) && !refreshHandlers.has(handler)) {
							refreshHandlers.set(handler, eventId);
						}
					}
				}

				for (const [handler, eventId] of refreshHandlers) {
					try {
						await handler.refresh(eventId);
					} catch (error) {
						this.emitError(`Menu event refresh failed for ${handler.description}: ${formatError(error)}`);
					}
				}
			}
		} finally {
			this.isRefreshingMenuEvents = false;
		}
	}

	private checkConnection() {
		clearInterval(this.connectionCheckInterval);
		this.consecutiveConnectionCheckFailures = 0;
		this.isConnectionCheckInFlight = false;
		this.connectionCheckInterval = setInterval(() => {
			void this.runConnectionCheck();
		}, ConnectionCheckInterval);
	}

	private async runConnectionCheck() {
		if (this.isConnectionCheckInFlight) return;
		this.isConnectionCheckInFlight = true;

		try {
			await this.property.getValue({
				params: [{ 'System.Config': ['RemoteSetting'] }],
				timeout: ConnectionCheckTimeout,
			});
			this.consecutiveConnectionCheckFailures = 0;
		} catch (error) {
			await this.handleConnectionCheckFailure(error);
		} finally {
			this.isConnectionCheckInFlight = false;
		}
	}

	private async handleConnectionCheckFailure(error: unknown) {
		if (this.isManualDisconnect) return;

		this.consecutiveConnectionCheckFailures += 1;
		this.emitError(
			`Connection check failed (${this.consecutiveConnectionCheckFailures}/${ConnectionCheckFailureLimit}): ${formatError(error)}`,
		);

		if (this.consecutiveConnectionCheckFailures < ConnectionCheckFailureLimit) return;

		this.emitError(
			`Disconnecting after ${this.consecutiveConnectionCheckFailures} consecutive connection check failures`,
		);
		clearInterval(this.connectionCheckInterval);
		this.connectionCheckInterval = undefined;

		try {
			await this.disconnect(true);
		} catch (disconnectError) {
			this.emitError(`Error disconnecting after failed connection checks: ${formatError(disconnectError)}`);
		}
	}

	private onDisconnect(code: number, reason?: Buffer) {
		clearInterval(this.connectionCheckInterval);
		this.connectionCheckInterval = undefined;
		this.emit(SavonaEvent.Disconnect, code, reason);
		if (this.isManualDisconnect) return;
		setTimeout(() => {
			void this.reconnect();
		}, 1_000);
	}

	private async reconnect() {
		try {
			await this.connect();
		} catch (error) {
			this.emitError(`Error reconnecting: ${formatError(error)}`);
		}
	}

	private onNotify({ name, data }: { data: unknown; name: string }) {
		this.emitNotification('raw', name, data);
		if (!Array.isArray(data)) {
			return;
		}

		const notificationData = data[0] as unknown;

		switch (name) {
			case 'Notify.Property.Value.Changed': {
				if (typeof notificationData !== 'object' || notificationData === null) return;
				for (const [key, value] of Object.entries(notificationData)) {
					this.emitNotification('propertyValueChanged', key, value);
				}

				break;
			}

			case 'Notify.Property.Status.Changed': {
				if (typeof notificationData !== 'object' || notificationData === null) return;
				for (const [key, value] of Object.entries(notificationData)) {
					this.emitNotification('propertyStatusChanged', key, value);
				}

				break;
			}

			case 'Notify.Property.ErrorOccurred': {
				if (typeof notificationData !== 'object' || notificationData === null) return;
				for (const [key, value] of Object.entries(notificationData)) {
					this.emitNotification('propertyErrorOccurred', key, value);
				}

				break;
			}

			case 'Notify.Capabilities.Changed': {
				if (typeof notificationData !== 'object' || notificationData === null) return;
				for (const [key, value] of Object.entries(notificationData)) {
					this.emitNotification('capabilitiesChanged', key, value);
				}

				break;
			}

			case 'Notify.Capability.Value.Changed': {
				if (typeof notificationData !== 'object' || notificationData === null) return;
				for (const [key, value] of Object.entries(notificationData)) {
					this.emitNotification('capabilityValueChanged', key, value);
				}

				break;
			}

			case 'Notify.Process.ErrorOccurred':
			case 'Notify.Process.Completed':
			case 'Notify.Process.Started':
			case 'Notify.Process.Aborted':
			case 'Notify.Process.Updated': {
				const eventName = name.split('.')[2] as string;
				this.emitNotification('process', eventName, notificationData);
				break;
			}
		}
	}

	private emitNotification<EmitterName extends keyof SavonaClient['notifications']>(
		emitterName: EmitterName,
		eventName: string,
		data: unknown,
	) {
		try {
			this.notifications[emitterName].emit(eventName, data);
		} catch (error) {
			this.emitError(`Notification listener error on ${String(emitterName)}: ${formatError(error)}`);
		}
	}

	private emitError(error: string) {
		if (this.listenerCount(SavonaEvent.Error) === 0) {
			console.error('Savona error:', error);
			return;
		}

		try {
			this.emit(SavonaEvent.Error, error);
		} catch (listenerError) {
			console.error('Savona error listener threw while handling:', error, listenerError);
		}
	}
}
