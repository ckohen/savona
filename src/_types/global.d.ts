// msgpack uses browser types
declare type BufferSource = ArrayBuffer | ArrayBufferView;

// node-fetch types are used in digest-fetch
declare module 'node-fetch' {
	export default fetch;
	export type Response = globalThis.Response;
}
