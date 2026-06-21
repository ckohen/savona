import type { SavonaClient } from '../savona.js';

export type FormatEncoding =
	| 'AVCHD'
	| 'DNxHD'
	| 'DVCAM'
	| 'MPEG_IMX'
	| 'MPEG2_MP4'
	| 'MPEG2'
	| 'ProRes'
	| 'SStP'
	| 'XAVC'
	| 'XAVCLong';

export class MainFile {
	public formatWidth: number = -1;

	public formatHeight: number = -1;

	public formatEncoding: FormatEncoding = 'XAVC';

	public frameRate: string = '';

	public scanMode: 'Interleave' | 'Progressive' = 'Progressive';

	public subsampling: string = '';

	public bitRate: number = -1;

	public aspectRatioHeight: number = 9;

	public aspectRatioWidth: number = 16;

	public constructor(public client: SavonaClient) {
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.Width', (data) => {
			this.formatWidth = data as number;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.Height', (data) => {
			this.formatHeight = data as number;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.Encoding', (data) => {
			this.formatEncoding = data as FormatEncoding;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.FrameRate', (data) => {
			this.frameRate = data as string;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.Scanning.Format', (data) => {
			this.scanMode = data as 'Interleave' | 'Progressive';
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.Chroma.Subsampling', (data) => {
			this.subsampling = data as string;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.BitRate.Value', (data) => {
			this.bitRate = data as number;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.AspectRatio.Height', (data) => {
			this.aspectRatioHeight = data as number;
		});
		client.notifications.propertyValueChanged.on('P.Clip.Mediabox.Video.Format.AspectRatio.Width', (data) => {
			this.aspectRatioWidth = data as number;
		});
	}

	public async fetchValue() {
		const response = await this.client.property.getValue({
			params: [
				{
					'P.Clip.Mediabox.Video.Format.AspectRatio.Height': ['*'],
					'P.Clip.Mediabox.Video.Format.AspectRatio.Width': ['*'],
					'P.Clip.Mediabox.Video.Format.BitRate.Value': ['*'],
					'P.Clip.Mediabox.Video.Format.Chroma.Subsampling': ['*'],
					'P.Clip.Mediabox.Video.Format.Encoding': ['*'],
					'P.Clip.Mediabox.Video.Format.FrameRate': ['*'],
					'P.Clip.Mediabox.Video.Format.Height': ['*'],
					'P.Clip.Mediabox.Video.Format.Scanning.Format': ['*'],
					'P.Clip.Mediabox.Video.Format.Width': ['*'],
				},
			],
		});
		if (typeof response !== 'object' || response === null) {
			throw new Error('Response does not match expected format');
		}

		const repsonseValue: {
			aspectRatioHeight?: number;
			aspectRatioWidth?: number;
			bitRate?: number;
			formatEncoding?: FormatEncoding;
			formatHeight?: number;
			formatWidth?: number;
			frameRate?: string;
			scanMode?: 'Interleave' | 'Progressive';
			subsampling?: string;
		} = {};

		if ('P.Clip.Mediabox.Video.Format.AspectRatio.Height' in response) {
			this.aspectRatioHeight = response['P.Clip.Mediabox.Video.Format.AspectRatio.Height'] as number;
			repsonseValue.aspectRatioHeight = this.aspectRatioHeight;
		}

		if ('P.Clip.Mediabox.Video.Format.AspectRatio.Width' in response) {
			this.aspectRatioWidth = response['P.Clip.Mediabox.Video.Format.AspectRatio.Width'] as number;
			repsonseValue.aspectRatioWidth = this.aspectRatioWidth;
		}

		if ('P.Clip.Mediabox.Video.Format.BitRate.Value' in response) {
			this.bitRate = response['P.Clip.Mediabox.Video.Format.BitRate.Value'] as number;
			repsonseValue.bitRate = this.bitRate;
		}

		if ('P.Clip.Mediabox.Video.Format.Chroma.Subsampling' in response) {
			this.subsampling = response['P.Clip.Mediabox.Video.Format.Chroma.Subsampling'] as string;
			repsonseValue.subsampling = this.subsampling;
		}

		if ('P.Clip.Mediabox.Video.Format.Encoding' in response) {
			this.formatEncoding = response['P.Clip.Mediabox.Video.Format.Encoding'] as FormatEncoding;
			repsonseValue.formatEncoding = this.formatEncoding;
		}

		if ('P.Clip.Mediabox.Video.Format.FrameRate' in response) {
			this.frameRate = response['P.Clip.Mediabox.Video.Format.FrameRate'] as string;
			repsonseValue.frameRate = this.frameRate;
		}

		if ('P.Clip.Mediabox.Video.Format.Height' in response) {
			this.formatHeight = response['P.Clip.Mediabox.Video.Format.Height'] as number;
			repsonseValue.formatHeight = this.formatHeight;
		}

		if ('P.Clip.Mediabox.Video.Format.Scanning.Format' in response) {
			const scanMode = response['P.Clip.Mediabox.Video.Format.Scanning.Format'] as 'Interleave' | 'Progressive';
			if (scanMode === 'Interleave' || scanMode === 'Progressive') {
				this.scanMode = scanMode;
				repsonseValue.scanMode = this.scanMode;
			}
		}

		if ('P.Clip.Mediabox.Video.Format.Width' in response) {
			this.formatWidth = response['P.Clip.Mediabox.Video.Format.Width'] as number;
			repsonseValue.formatWidth = this.formatWidth;
		}

		return repsonseValue;
	}
}
