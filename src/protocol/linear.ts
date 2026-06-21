import type { Buffer } from 'node:buffer';
import { setTimeout, clearTimeout } from 'node:timers';
import * as msgpack from '@msgpack/msgpack';
import { AsyncEventEmitter } from '@vladfrangu/async_event_emitter';
import { WebSocket } from 'ws';
import { LinearError, LinearTimedOutError } from './LinearErrors.js';

export const enum MessageType {
	Request,
	Response,
	Notify,
}

export const enum WebsocketState {
	Connected = 'connected',
	Connecting = 'connecting',
	Disconnected = 'disconnected',
	Disconnecting = 'disconnecting',
}

export const enum LinearEvent {
	Connect = 'connect',
	Debug = 'debug',
	Disconnect = 'disconnect',
	Error = 'error',
	Notify = 'notify',
	Request = 'request',
	Response = 'response',
}

export type LinearRequestParams = (
	| (Record<string, unknown> | string[] | string)[][]
	| Record<string, unknown>
	| string[]
	| string
)[];

export interface LinearEvents {
	[LinearEvent.Connect]: [];
	[LinearEvent.Debug]: [message: string];
	[LinearEvent.Disconnect]: [code: number, reason?: Buffer];
	[LinearEvent.Notify]: [{ data: unknown; name: string }];
	[LinearEvent.Request]: [{ id: number; method: string; params: LinearRequestParams }];
	[LinearEvent.Response]: [{ error: unknown; id: number; result: unknown }];
	[LinearEvent.Error]: [error: string];
}

type LinearMessageRequest = [type: MessageType.Request, id: number, method: string, params: LinearRequestParams];
type LinearMessageResponse = [
	type: MessageType.Response,
	id: number,
	error: [code: number, description: string] | null,
	result: unknown[] | object | null,
];
type LinearMessageNotify = [type: MessageType.Notify, name: string, data: unknown];

type LinearMessage = LinearMessageNotify | LinearMessageRequest | LinearMessageResponse;

interface LinearRequest {
	id: number;
	resolve(result: LinearRequestResponse): void;
	timeout?: NodeJS.Timeout;
}

interface LinearRequestResponse {
	error: unknown;
	result: unknown;
}

export interface ConnectionOptions {
	channel?: string;
	host: string;
	port?: number;
	useSSL?: boolean;
}

function createWsURL({ channel = 'linear', host, useSSL = false, port = useSSL ? 443 : 80 }: ConnectionOptions) {
	const parsedChannel = channel.startsWith('/') ? channel : `/${channel}`;
	return `ws${useSSL ? 's' : ''}://${host}${port === (useSSL ? 443 : 80) ? '' : `:${port}`}${parsedChannel}`;
}

export class LinearClient extends AsyncEventEmitter<LinearEvents> {
	private readonly activeRequests: Map<number, LinearRequest> = new Map();

	private _state = WebsocketState.Disconnected;

	private msgId = 0;

	private socket?: WebSocket;

	private readonly url: string;

	private connectionPromise?: { promise: Promise<void>; reject(): void; resolve(): void };

	private disconnectionPromiseResolve?(): void;

	public constructor(connection: ConnectionOptions) {
		super();

		this.url = createWsURL(connection);
	}

	public get state() {
		return this._state;
	}

	public async connect(timeout = 30_000) {
		if (this._state === WebsocketState.Connecting || this._state === WebsocketState.Connected) {
			return this.connectionPromise?.promise;
		}

		let res: (value: PromiseLike<void> | void) => void;
		let rej: (reason?: any) => void;
		const promise = new Promise<void>((resolve, reject) => {
			res = resolve;
			rej = reject;
		});

		this.connectionPromise = { promise, resolve: res!, reject: rej! };

		this.emit(LinearEvent.Debug, `Connecting to ${this.url}`);
		this._state = WebsocketState.Connecting;
		try {
			this.socket = new WebSocket(this.url);
		} catch (error) {
			this._onclose(4_999);
			throw error;
		}

		this.socket.on('open', () => this._onopen());
		this.socket.on('close', (code, reason) => this._onclose(code, reason));
		this.socket.on('error', (error) => this._onclose(4_999, error));
		this.socket.on('message', (data, isBinary) => this._onmessage(data, isBinary));

		setTimeout(() => {
			if (this._state === WebsocketState.Connecting) {
				if (this.socket) {
					this.socket.close();
				}

				this.socket = undefined;
				this._onclose(4_999);
			}
		}, timeout);

		await this.connectionPromise?.promise;
	}

	public async disconnect() {
		if (this._state === WebsocketState.Disconnected) return;
		this._state = WebsocketState.Disconnecting;
		this.socket?.close();
		await new Promise<void>((resolve) => {
			this.disconnectionPromiseResolve = resolve;
		});
	}

	private incrementId() {
		while (this.activeRequests.has(this.msgId)) {
			this.msgId = this.msgId >= 4_294_967_295 ? 0 : this.msgId + 1;
		}

		return this.msgId;
	}

	public async request({
		method,
		params,
		timeout = 30_000,
	}: {
		method: string;
		params: LinearRequestParams;
		timeout?: number;
	}) {
		const id = this.incrementId();
		let res: (data: LinearRequestResponse) => void;
		let rej: (reason: Error) => void;
		const resPromise = new Promise<LinearRequestResponse>((resolve, reject) => {
			res = resolve;
			rej = reject;
		});
		let timer;
		if (timeout !== 0) {
			timer = setTimeout(() => {
				rej(new LinearTimedOutError());
				this.activeRequests.delete(id);
			}, timeout);
		}

		this.activeRequests.set(id, {
			id,
			resolve: res!,
			timeout: timer,
		});

		await this.send([MessageType.Request, id, method, params]);
		const resolved = await resPromise;
		if (resolved.error) {
			throw new LinearError(resolved.error);
		}

		return resolved.result;
	}

	public async response(data: { error?: unknown; id: number; result?: unknown }) {
		await this.send([MessageType.Response, data.id, data.error, data.result]);
	}

	public async notify(options: { data: unknown; name: string }) {
		await this.send([MessageType.Notify, options.name, options.data]);
	}

	private async send(data: unknown) {
		if (this._state === WebsocketState.Disconnected || this._state === WebsocketState.Disconnecting) {
			throw new Error('Attempted to send data before opening websocket');
		}

		if (this._state === WebsocketState.Connecting) {
			await this.connectionPromise?.promise;
		}

		this.socket?.send(msgpack.encode(data));
	}

	private _onopen() {
		this.connectionPromise?.resolve();
		this.connectionPromise = undefined;
		if (this._state !== WebsocketState.Connecting) return;
		this.emit(LinearEvent.Debug, `Websocket connection opened`);
		this._state = WebsocketState.Connected;
		this.emit(LinearEvent.Connect);
	}

	private _onclose(code: number, reason?: Buffer | Error) {
		if (code === 4_999) {
			this.emit(LinearEvent.Error, `Error connecting webscoket, ${reason instanceof Error ? reason.message : reason}`);
		}

		this.connectionPromise?.reject();
		this.connectionPromise = undefined;
		this.disconnectionPromiseResolve?.();
		if (this._state !== WebsocketState.Disconnected) {
			this._state = WebsocketState.Disconnected;
			this.socket = undefined;
			if (code === 4_999) return;
			this.emit(LinearEvent.Disconnect, code, reason as Buffer);
		}
	}

	private _onmessage(rawMessage: WebSocket.RawData, _isBinary: boolean) {
		if (this._state !== WebsocketState.Connected) return;

		let toDecode;
		if (Array.isArray(rawMessage)) {
			toDecode = rawMessage;
		} else {
			toDecode = [rawMessage];
		}

		const decoded = toDecode.map((elem) => msgpack.decode(elem) as LinearMessage);
		for (const body of decoded)
			switch (body[0]) {
				case MessageType.Request:
					this.emit(LinearEvent.Request, { id: body[1], method: body[2], params: body[3] });
					break;
				case MessageType.Response: {
					const reqId = body[1];
					const activeRequest = this.activeRequests.get(reqId);
					if (activeRequest) {
						clearTimeout(activeRequest.timeout);
						activeRequest.resolve({
							error: body[2],
							result: body[3],
						});

						this.activeRequests.delete(reqId);
					} else {
						this.emit(LinearEvent.Response, { id: reqId, error: body[2], result: body[3] });
					}

					break;
				}

				case MessageType.Notify:
					this.emit(LinearEvent.Notify, { name: body[1], data: body[2] });
					break;
				default:
					console.warn('invalid data received on websocket', decoded);
			}
	}
}
