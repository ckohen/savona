import { Buffer } from 'node:buffer';
import { constants, createCipheriv, createDecipheriv, publicEncrypt, randomBytes } from 'node:crypto';
import { clearTimeout, setTimeout } from 'node:timers';
import type { SavonaClient } from '../savona.js';

export type UploadSettingId = number;

export interface UploadCredential {
	ftpPassword?: string;
	ftpUserName?: string;
	raw?: Record<string, unknown>;
}

export interface UploadSettingOption extends Record<string, unknown> {
	ftp_certifciation_selected_option?: unknown;
	ftp_password?: string;
	ftp_user_name?: string;
	transfer?: Record<string, unknown> & {
		ftp_upload_dir?: string;
	};
}

export interface UploadSetting {
	credential?: UploadCredential;
	displayName: string;
	id: UploadSettingId;
	isDefault: boolean;
	option: UploadSettingOption;
	pluginId: string;
}

export interface UploadSettingInput {
	certificateOperateType?: unknown;
	credential?: {
		ftpPassword?: string;
		ftpUserName?: string;
	};
	displayName: string;
	id: UploadSettingId;
	option: UploadSettingOption;
	pluginId: string;
}

const UploadSettingProperties = [
	'Network.Service.Upload.Name',
	'Network.Service.Upload.DisplayName',
	'Network.Service.Upload.Option',
	'Network.Service.Upload.DefaultService',
	'Network.Service.Upload.Credential',
] as const;

interface CommonKey {
	iv: Buffer;
	key: Buffer;
}

function cloneOption(option: UploadSettingOption) {
	const cloned = { ...option };
	delete cloned.dependent_proc;
	delete cloned.ftp_user_name;
	delete cloned.ftp_password;
	return cloned;
}

function asRecord(value: unknown) {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function uploadSettingIdFromValue(value: unknown) {
	if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
	if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
	return Number.parseInt(value, 10);
}

function encodedBinary(value: string) {
	return Buffer.from(value, 'utf8');
}

function base64StringFromValue(value: unknown) {
	if (typeof value === 'string') return value;
	if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8');
	return '';
}

function ensureSavonaTagged(value: string) {
	if (!value.endsWith('@SAV')) {
		throw new Error('Savona credential exchange returned an invalid tagged value');
	}

	return value.slice(0, -4);
}

function noop() {}

export class UploadSettings {
	public static readonly PublicKeyPropertyName = 'System.Network.Publickey';

	public static readonly PublicKeyStatusPropertyName = 'System.Network.Publickey.Status';

	public credentialStatus: 'Locked' | 'Unlocked' = 'Unlocked';

	public defaultService: UploadSettingId | null = null;

	public publicKeyStatus = '';

	public settings = new Map<UploadSettingId, UploadSetting>();

	private commonKey: CommonKey | undefined;

	public constructor(public client: SavonaClient) {
		for (const property of UploadSettingProperties) {
			client.notifications.propertyValueChanged.on(property, (data) => {
				this.updateFromResponse({ [property]: data });
			});
		}

		client.notifications.propertyStatusChanged.on('Network.Service.Upload.Credential', (data) => {
			this.credentialStatus = data as 'Locked' | 'Unlocked';
		});
		client.notifications.propertyValueChanged.on(UploadSettings.PublicKeyStatusPropertyName, (data) => {
			const status = asRecord(data).credential;
			if (typeof status === 'string') {
				this.publicKeyStatus = status;
			}
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [Object.fromEntries(UploadSettingProperties.map((property) => [property, ['*']]))],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		this.updateFromResponse(response as Record<string, unknown>, true);
		return this.settings;
	}

	public async fetchCredentialStatus() {
		const response = await this.client.property.getStatus({
			params: [{ 'Network.Service.Upload.Credential': '*' }],
		});
		if (typeof response !== 'object' || response === null || !('Network.Service.Upload.Credential' in response)) {
			throw new Error('Response does not match expected format');
		}

		this.credentialStatus = response['Network.Service.Upload.Credential'] as 'Locked' | 'Unlocked';
		return this.credentialStatus;
	}

	public async initializeCredentialKey(timeout = 60_000) {
		const response = await this.client.property.getValue({
			params: [
				{
					[UploadSettings.PublicKeyPropertyName]: 'credential',
					[UploadSettings.PublicKeyStatusPropertyName]: 'credential',
				},
			],
			timeout,
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const responseData = response as Record<string, unknown>;
		const status = asRecord(responseData[UploadSettings.PublicKeyStatusPropertyName]).credential;
		if (status !== 'Created') {
			this.commonKey = undefined;
			this.publicKeyStatus = typeof status === 'string' ? status : '';
			return false;
		}

		const publicKey = asRecord(responseData[UploadSettings.PublicKeyPropertyName]).credential;
		if (typeof publicKey !== 'string') {
			throw new TypeError('Response does not include a credential public key');
		}

		const temporaryKey = randomBytes(16);
		const temporaryIv = randomBytes(16);
		const encryptedKey = publicEncrypt(
			{ key: publicKey, padding: constants.RSA_PKCS1_PADDING },
			Buffer.from(`${temporaryKey.toString('hex')}@SAV`, 'utf8'),
		);
		const encryptedIv = publicEncrypt(
			{ key: publicKey, padding: constants.RSA_PKCS1_PADDING },
			Buffer.from(`${temporaryIv.toString('hex')}@SAV`, 'utf8'),
		);

		const processId = await this.client.p.process.execute({
			params: [
				'get_savona_enc_key',
				{
					tmpiv: encodedBinary(encryptedIv.toString('base64')),
					tmpkey: encodedBinary(encryptedKey.toString('base64')),
				},
			],
			timeout,
		});
		const result = await this.waitForProcessResult('P.Process.Execute', processId, timeout);
		const encryptedCommonKey = result.commonkey;
		const encryptedCommonIv = result.commoniv;
		if (typeof encryptedCommonKey !== 'string' || typeof encryptedCommonIv !== 'string') {
			throw new TypeError('Credential key process did not return common key material');
		}

		this.commonKey = {
			iv: Buffer.from(ensureSavonaTagged(this.decryptWithAes(temporaryKey, temporaryIv, encryptedCommonIv)), 'hex'),
			key: Buffer.from(ensureSavonaTagged(this.decryptWithAes(temporaryKey, temporaryIv, encryptedCommonKey)), 'hex'),
		};
		this.publicKeyStatus = 'Created';
		return true;
	}

	public async setDefault(id: UploadSettingId) {
		await this.client.property.setValue({ params: [{ 'Network.Service.Upload.DefaultService': String(id) }] });
	}

	public async update(setting: UploadSettingInput) {
		const key = String(setting.id);
		const option = cloneOption(setting.option);
		const certificateOperateType = setting.certificateOperateType ?? setting.option.ftp_certifciation_selected_option;
		const params: Record<string, unknown> =
			setting.id === 2
				? { 'Network.Service.Upload.Option': { [key]: option } }
				: {
						'Network.Service.Upload.DisplayName': { [key]: setting.displayName },
						'Network.Service.Upload.Name': { [key]: setting.pluginId },
						'Network.Service.Upload.Option': { [key]: option },
					};

		if (setting.id !== 2 && certificateOperateType !== undefined) {
			params['Network.Service.Upload.Certificate.Operate.Type'] = { [key]: certificateOperateType };
		}

		if (setting.id !== 2 && setting.credential !== undefined) {
			params['Network.Service.Upload.Credential'] = { [key]: this.encryptedCredential(setting.credential) };
		}

		await this.client.property.setValue({ params: [params] });
	}

	public decryptCredentialValue(value: unknown) {
		if (this.commonKey === undefined) return undefined;
		const decrypted = this.decryptWithAes(this.commonKey.key, this.commonKey.iv, base64StringFromValue(value));
		return ensureSavonaTagged(decrypted);
	}

	public clearCredentialKey() {
		this.commonKey = undefined;
		this.publicKeyStatus = '';
	}

	private encryptedCredential(credential: NonNullable<UploadSettingInput['credential']>) {
		if (this.commonKey === undefined) {
			throw new Error('Credential common key has not been initialized');
		}

		const encrypted: Record<string, Buffer> = {};
		if (credential.ftpUserName !== undefined) {
			encrypted.ftp_user_name = encodedBinary(this.encryptWithAes(this.commonKey.key, this.commonKey.iv, credential.ftpUserName));
		}

		if (credential.ftpPassword !== undefined) {
			encrypted.ftp_password = encodedBinary(this.encryptWithAes(this.commonKey.key, this.commonKey.iv, credential.ftpPassword));
		}

		return encrypted;
	}

	private updateFromResponse(response: Record<string, unknown>, replace = false) {
		const names = asRecord(response['Network.Service.Upload.Name']);
		const displayNames = asRecord(response['Network.Service.Upload.DisplayName']);
		const options = asRecord(response['Network.Service.Upload.Option']);
		const credentials = asRecord(response['Network.Service.Upload.Credential']);
		const existingSettings = new Map(this.settings);
		const defaultService = response['Network.Service.Upload.DefaultService'];
		if (defaultService !== undefined) {
			this.defaultService = uploadSettingIdFromValue(defaultService) ?? null;
		}

		const ids = new Set<UploadSettingId>(replace ? [] : this.settings.keys());
		for (const key of [...Object.keys(names), ...Object.keys(displayNames), ...Object.keys(options), ...Object.keys(credentials)]) {
			const id = uploadSettingIdFromValue(key);
			if (id !== undefined) ids.add(id);
		}

		if (replace) {
			this.settings.clear();
		}

		for (const id of ids) {
			const key = String(id);
			const existing = existingSettings.get(id);
			const option = asRecord(options[key]) as UploadSettingOption;
			const credential = asRecord(credentials[key]);
			const setting: UploadSetting = {
				credential: existing?.credential,
				displayName: typeof displayNames[key] === 'string' ? (displayNames[key] as string) : (existing?.displayName ?? ''),
				id,
				isDefault: id === this.defaultService,
				option: Object.keys(option).length === 0 ? (existing?.option ?? {}) : cloneOption(option),
				pluginId: typeof names[key] === 'string' ? (names[key] as string) : (existing?.pluginId ?? ''),
			};

			if (Object.keys(credential).length > 0) {
				setting.credential = {
					ftpPassword: this.decryptCredentialValue(credential.ftp_password),
					ftpUserName: this.decryptCredentialValue(credential.ftp_user_name),
					raw: credential,
				};
			}

			this.settings.set(id, setting);
		}

		this.updateDefaultFlags();
	}

	private updateDefaultFlags() {
		for (const setting of this.settings.values()) {
			setting.isDefault = setting.id === this.defaultService;
		}
	}

	private encryptWithAes(key: Buffer, iv: Buffer, value: string) {
		const cipher = createCipheriv('aes-128-cbc', key, iv);
		return Buffer.concat([cipher.update(`${value}@SAV`, 'utf8'), cipher.final()]).toString('base64');
	}

	private decryptWithAes(key: Buffer, iv: Buffer, value: string) {
		const decipher = createDecipheriv('aes-128-cbc', key, iv);
		return Buffer.concat([decipher.update(Buffer.from(value, 'base64')), decipher.final()]).toString('utf8');
	}

	private async waitForProcessResult(apiName: string, processId: unknown, timeout: number) {
		return new Promise<Record<string, unknown>>((resolve, reject) => {
			let cleanup = noop;
			const onCompleted = (data: unknown) => {
				if (Array.isArray(data) && data[0] === apiName && data[1] === processId) {
					cleanup();
					resolve(asRecord(data[2]));
				}
			};

			const onError = (data: unknown) => {
				if (Array.isArray(data) && data[0] === apiName && data[1] === processId) {
					cleanup();
					reject(new Error(`Savona process ${apiName} failed: ${String(data[2])}`));
				}
			};

			const timer = setTimeout(() => {
				cleanup();
				reject(new Error(`Timed out waiting for Savona process ${apiName}`));
			}, timeout);

			cleanup = () => {
				clearTimeout(timer);
				this.client.notifications.process.off('Completed', onCompleted);
				this.client.notifications.process.off('ErrorOccurred', onError);
			};

			this.client.notifications.process.on('Completed', onCompleted);
			this.client.notifications.process.on('ErrorOccurred', onError);
		});
	}
}
