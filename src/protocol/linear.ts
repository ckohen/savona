import { Buffer } from 'node:buffer';
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
	(Record<string, unknown> | string[] | string)[][] | Record<string, unknown> | string[] | string
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
	reject(error: Error): void;
	resolve(result: LinearRequestResponse): void;
	timeout?: NodeJS.Timeout;
}

function isLinearMessage(value: unknown): value is LinearMessage {
	if (!Array.isArray(value)) return false;
	const [type, idOrName] = value;
	if (type === MessageType.Notify) return value.length === 3 && typeof idOrName === 'string';
	if (!Number.isInteger(idOrName) || idOrName < 0 || idOrName > 4_294_967_295) return false;
	if (type === MessageType.Request) {
		return value.length === 4 && typeof value[2] === 'string' && Array.isArray(value[3]);
	}

	return type === MessageType.Response && value.length === 4;
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

	private _lastInboundActivityAt = 0;

	private msgId = 0;

	private socket?: WebSocket;

	private readonly url: string;

	private connectionPromise?: { promise: Promise<void>; reject(error: Error): void; resolve(): void };

	private connectionTimeout?: NodeJS.Timeout;

	private disconnectionPromise?: Promise<void>;

	private disconnectionPromiseResolve?(): void;

	public constructor(connection: ConnectionOptions) {
		super();

		this.url = createWsURL(connection);
	}

	public get state() {
		return this._state;
	}

	/**
	 * @internal
	 */
	public get lastInboundActivityAt() {
		return this._lastInboundActivityAt;
	}

	public async connect(timeout = 30_000) {
		if (this._state === WebsocketState.Connecting || this._state === WebsocketState.Connected) {
			return this.connectionPromise?.promise;
		}

		let res: (value: PromiseLike<void> | void) => void;
		let rej: (reason: Error) => void;
		const promise = new Promise<void>((resolve, reject) => {
			res = resolve;
			rej = reject;
		});

		this.connectionPromise = { promise, resolve: res!, reject: rej! };

		this.emit(LinearEvent.Debug, `Connecting to ${this.url}`);
		this._state = WebsocketState.Connecting;
		this._lastInboundActivityAt = 0;
		try {
			this.socket = new WebSocket(this.url);
		} catch (error) {
			this._onclose(4_999, error instanceof Error ? error : new Error(String(error)));
			return promise;
		}

		const socket = this.socket;
		socket.on('open', () => {
			if (this.socket === socket) this._onopen();
		});
		socket.on('close', (code, reason) => {
			if (this.socket === socket) this._onclose(code, reason);
		});
		socket.on('error', (error) => {
			if (this.socket === socket) this._onclose(4_999, error);
		});
		socket.on('message', (data, isBinary) => {
			if (this.socket === socket) this._onmessage(data, isBinary);
		});

		this.connectionTimeout = setTimeout(() => {
			if (this.socket === socket && this._state === WebsocketState.Connecting) {
				this._onclose(4_999, new Error('WebSocket connection timed out'));
				socket.terminate();
			}
		}, timeout);

		await promise;
	}

	public async disconnect() {
		if (this._state === WebsocketState.Disconnected) return;
		if (this.disconnectionPromise) return this.disconnectionPromise;
		this._state = WebsocketState.Disconnecting;
		this.disconnectionPromise = new Promise<void>((resolve) => {
			this.disconnectionPromiseResolve = resolve;
		});
		const promise = this.disconnectionPromise;
		if (this.socket) this.socket.close();
		else this._onclose(1_000);
		await promise;
	}

	private incrementId() {
		const firstId = this.msgId;
		do {
			const id = this.msgId;
			this.msgId = this.msgId >= 4_294_967_295 ? 0 : this.msgId + 1;
			if (!this.activeRequests.has(id)) return id;
		} while (this.msgId !== firstId);

		throw new Error('All Linear request IDs are in use');
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
		const resolved = await new Promise<LinearRequestResponse>((resolve, reject) => {
			const pending: LinearRequest = {
				reject: (error) => {
					if (this.finishRequest(id, pending)) reject(error);
				},
				resolve: (response) => {
					if (this.finishRequest(id, pending)) resolve(response);
				},
			};
			this.activeRequests.set(id, pending);
			if (timeout !== 0) pending.timeout = setTimeout(() => pending.reject(new LinearTimedOutError()), timeout);
			void this.send([MessageType.Request, id, method, params]).catch((error: Error) => pending.reject(error));
		});

		if (resolved.error) {
			throw new LinearError(resolved.error);
		}

		return resolved.result;
	}

	private finishRequest(id: number, pending: LinearRequest) {
		if (this.activeRequests.get(id) !== pending) return false;
		this.activeRequests.delete(id);
		clearTimeout(pending.timeout);
		return true;
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

		const socket = this.socket;
		if (socket?.readyState !== WebSocket.OPEN) {
			throw new Error('Attempted to send data before opening websocket');
		}

		await new Promise<void>((resolve, reject) => {
			socket.send(msgpack.encode(data), (error) => {
				if (error) reject(error);
				else resolve();
			});
		});
	}

	private _onopen() {
		if (this._state !== WebsocketState.Connecting) return;
		clearTimeout(this.connectionTimeout);
		this.connectionTimeout = undefined;
		this._state = WebsocketState.Connected;
		this.connectionPromise?.resolve();
		this.connectionPromise = undefined;
		this.emit(LinearEvent.Debug, `Websocket connection opened`);
		this.emit(LinearEvent.Connect);
	}

	private _onclose(code: number, reason?: Buffer | Error) {
		if (this._state === WebsocketState.Disconnected) return;
		const socket = this.socket;
		const error =
			reason instanceof Error ? reason : new Error(`WebSocket closed (${code}): ${reason?.toString() ?? ''}`);
		clearTimeout(this.connectionTimeout);
		this.connectionTimeout = undefined;
		this._state = WebsocketState.Disconnected;
		this.socket = undefined;
		this.connectionPromise?.reject(error);
		this.connectionPromise = undefined;
		for (const pending of this.activeRequests.values()) pending.reject(error);
		this.disconnectionPromiseResolve?.();
		this.disconnectionPromiseResolve = undefined;
		this.disconnectionPromise = undefined;
		if (code === 4_999) {
			if (socket && socket.readyState !== WebSocket.CLOSED) socket.terminate();
			this.emit(LinearEvent.Error, `WebSocket error: ${error.message}`);
		}

		this.emit(LinearEvent.Disconnect, code, reason instanceof Error ? undefined : reason);
	}

	private _onmessage(rawMessage: WebSocket.RawData, _isBinary: boolean) {
		if (this._state !== WebsocketState.Connected) return;

		let body: unknown;
		try {
			body = msgpack.decode(Array.isArray(rawMessage) ? Buffer.concat(rawMessage) : rawMessage);
		} catch (error) {
			this.emit(LinearEvent.Error, `Invalid WebSocket message: ${error instanceof Error ? error.message : error}`);
			return;
		}

		if (!isLinearMessage(body)) {
			this.emit(LinearEvent.Error, 'Invalid Linear message received on WebSocket');
			return;
		}

		this._lastInboundActivityAt = Date.now();
		switch (body[0]) {
			case MessageType.Request:
				this.emit(LinearEvent.Request, { id: body[1], method: body[2], params: body[3] });
				break;
			case MessageType.Response: {
				const reqId = body[1];
				const activeRequest = this.activeRequests.get(reqId);
				if (activeRequest) {
					activeRequest.resolve({
						error: body[2],
						result: body[3],
					});
				} else {
					this.emit(LinearEvent.Response, { id: reqId, error: body[2], result: body[3] });
				}

				break;
			}

			case MessageType.Notify:
				this.emit(LinearEvent.Notify, { name: body[1], data: body[2] });
				break;
		}
	}
}
