import { Buffer } from 'node:buffer';
import { request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URLSearchParams, URL as NodeURL } from 'node:url';
import type { URL } from 'node:url';
import { DigestClient } from 'digest-fetch';

function headersFrom(headers: RequestInit['headers'] | undefined) {
	const result: { [key: string]: string } = {};
	if (headers === undefined) return result;

	if (headers instanceof Headers) {
		for (const [key, value] of headers) {
			result[key] = value;
		}

		return result;
	}

	if (Array.isArray(headers)) {
		for (const [key, value] of headers) {
			result[key] = value;
		}

		return result;
	}

	for (const [key, value] of Object.entries(headers)) {
		if (value === undefined) continue;
		result[key] = value;
	}

	return result;
}

function bodyBufferFrom(body: RequestInit['body'] | undefined) {
	if (body === undefined || body === null) return undefined;
	if (typeof body === 'string') return Buffer.from(body);
	if (body instanceof URLSearchParams) return Buffer.from(body.toString());
	if (body instanceof ArrayBuffer) return Buffer.from(body);
	if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
	throw new Error('Unsupported request body type');
}

function responseHeadersFrom(headers: IncomingHttpHeaders) {
	const responseHeaders = new Headers();
	for (const [key, value] of Object.entries(headers)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			for (const item of value) {
				responseHeaders.append(key, item);
			}
		} else {
			responseHeaders.set(key, value);
		}
	}

	return responseHeaders;
}

async function cameraFetch(url: URL | string, options: RequestInit = {}) {
	const requestUrl = new NodeURL(url.toString());
	if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') {
		throw new Error(`Unsupported camera fetch protocol: ${requestUrl.protocol}`);
	}

	const request = requestUrl.protocol === 'https:' ? httpsRequest : httpRequest;
	const headers = headersFrom(options.headers);
	const body = bodyBufferFrom(options.body);
	if (body !== undefined && !Object.keys(headers).some((header) => header.toLowerCase() === 'content-length')) {
		headers['content-length'] = String(body.byteLength);
	}

	return new Promise<Response>((resolve, reject) => {
		const req = request(
			requestUrl,
			{
				headers,
				insecureHTTPParser: true,
				method: options.method ?? 'GET',
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (chunk: Buffer | string) => {
					chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
				});
				res.on('end', () => {
					const status = res.statusCode;
					if (status === undefined) {
						reject(new Error('Camera HTTP response did not include a status code'));
						return;
					}

					resolve(
						new Response(Buffer.concat(chunks), {
							headers: responseHeadersFrom(res.headers),
							status,
							statusText: res.statusMessage,
						}),
					);
				});
			},
		);
		req.on('error', reject);
		if (body !== undefined) req.write(body);
		req.end();
	});
}

export async function fetchWithDigest(url: URL | string, username: string, password: string, options?: RequestInit) {
	const digestClient = new DigestClient(username, password);
	const requestUrl = url.toString();
	const firstResponse = await cameraFetch(requestUrl, digestClient.addAuth(requestUrl, { ...options }));
	if (firstResponse.status !== 401) return firstResponse;

	digestClient.parseAuth(firstResponse.headers.get('www-authenticate'));
	if (!digestClient.hasAuth) return firstResponse;

	return cameraFetch(requestUrl, digestClient.addAuth(requestUrl, { ...options }));
}
