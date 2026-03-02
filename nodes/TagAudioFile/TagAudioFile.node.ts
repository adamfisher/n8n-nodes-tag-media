import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { readFile } from 'fs/promises';
import { join } from 'path';

import { getBinaryBuffer, runCommand, cleanupFiles } from '../shared/utils';

// Path to Python script (relative to compiled node location in dist/nodes/TagAudioFile/)
const SCRIPT_PATH = join(__dirname, '..', '..', '..', 'scripts', 'tag_audio.py');
import { createInputFilePath, writeTempFile, writeMetadataJson } from '../shared/tempFiles';

export class TagAudioFile implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tag Audio File',
		name: 'tagAudioFile',
		icon: 'file:../../images/tag-media.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Tag audio file',
		description: 'Write ID3, Vorbis, and MP4 tags to audio files',
		defaults: {
			name: 'Tag Audio File',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary property containing the audio file',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the track',
			},
			{
				displayName: 'Artist',
				name: 'artist',
				type: 'string',
				default: '',
				description: 'The performing artist',
			},
			{
				displayName: 'Album Artist',
				name: 'albumArtist',
				type: 'string',
				default: '',
				description: 'The album artist (for compilations)',
			},
			{
				displayName: 'Album',
				name: 'album',
				type: 'string',
				default: '',
				description: 'The album name',
			},
			{
				displayName: 'Year',
				name: 'year',
				type: 'string',
				default: '',
				description: 'The release year (e.g., 2024)',
			},
			{
				displayName: 'Genre',
				name: 'genre',
				type: 'string',
				default: '',
				description: 'The genre of the track',
			},
			{
				displayName: 'Track Number',
				name: 'trackNumber',
				type: 'string',
				default: '',
				description: 'Track number (e.g., "1" or "1/12")',
			},
			{
				displayName: 'Disc Number',
				name: 'discNumber',
				type: 'string',
				default: '1',
				description: 'Disc number (e.g., "1" or "1/2")',
			},
			{
				displayName: 'Composer',
				name: 'composer',
				type: 'string',
				default: '',
				description: 'The composer of the track',
			},
			{
				displayName: 'BPM',
				name: 'bpm',
				type: 'string',
				default: '',
				description: 'Beats per minute',
			},
			{
				displayName: 'Copyright',
				name: 'copyright',
				type: 'string',
				default: '',
				description: 'Copyright information',
			},
			{
				displayName: 'Publisher',
				name: 'publisher',
				type: 'string',
				default: '',
				description: 'The publisher or record label',
			},
			{
				displayName: 'Comment',
				name: 'comment',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				description: 'A comment or description. If empty, any existing comment will be cleared.',
			},
			{
				displayName: 'Lyrics',
				name: 'lyrics',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				default: '',
				description: 'Unsynced lyrics (USLT)',
			},
			{
				displayName: 'Extended Properties',
				name: 'extendedProperties',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description: 'Additional metadata fields. See <a href="https://docs.mp3tag.de/mapping/">field mapping reference</a> for format compatibility.',
				options: [
					{
						name: 'properties',
						displayName: 'Property',
						values: [
							{
								displayName: 'Field Name',
								name: 'key',
								type: 'options',
								default: 'LANGUAGE',
								description: 'Select a metadata field',
								options: [
									{ name: '── Custom ──', value: '__custom' },
									{ name: 'ACOUSTID_FINGERPRINT', value: 'ACOUSTID_FINGERPRINT' },
									{ name: 'ACOUSTID_ID', value: 'ACOUSTID_ID' },
									{ name: 'ALBUMARTISTSORT', value: 'ALBUMARTISTSORT' },
									{ name: 'ALBUMSORT', value: 'ALBUMSORT' },
									{ name: 'ARRANGER', value: 'ARRANGER' },
									{ name: 'ARTISTSORT', value: 'ARTISTSORT' },
									{ name: 'ASIN', value: 'ASIN' },
									{ name: 'BARCODE', value: 'BARCODE' },
									{ name: 'CATALOGNUMBER', value: 'CATALOGNUMBER' },
									{ name: 'COMPILATION', value: 'COMPILATION' },
									{ name: 'COMPOSERSORT', value: 'COMPOSERSORT' },
									{ name: 'CONDUCTOR', value: 'CONDUCTOR' },
									{ name: 'CONTENTGROUP', value: 'CONTENTGROUP' },
									{ name: 'DISCSUBTITLE', value: 'DISCSUBTITLE' },
									{ name: 'DJMIXER', value: 'DJMIXER' },
									{ name: 'ENCODEDBY', value: 'ENCODEDBY' },
									{ name: 'ENCODER', value: 'ENCODER' },
									{ name: 'ENCODERSETTINGS', value: 'ENCODERSETTINGS' },
									{ name: 'ENGINEER', value: 'ENGINEER' },
									{ name: 'INITIALKEY', value: 'INITIALKEY' },
									{ name: 'INVOLVEDPEOPLE', value: 'INVOLVEDPEOPLE' },
									{ name: 'ISRC', value: 'ISRC' },
									{ name: 'LABEL', value: 'LABEL' },
									{ name: 'LANGUAGE', value: 'LANGUAGE' },
									{ name: 'LYRICIST', value: 'LYRICIST' },
									{ name: 'MEDIATYPE', value: 'MEDIATYPE' },
									{ name: 'MIXER', value: 'MIXER' },
									{ name: 'MOOD', value: 'MOOD' },
									{ name: 'MOVEMENT', value: 'MOVEMENT' },
									{ name: 'MOVEMENTNUMBER', value: 'MOVEMENTNUMBER' },
									{ name: 'MOVEMENTTOTAL', value: 'MOVEMENTTOTAL' },
									{ name: 'MUSICBRAINZ_ALBUMARTISTID', value: 'MUSICBRAINZ_ALBUMARTISTID' },
									{ name: 'MUSICBRAINZ_ALBUMID', value: 'MUSICBRAINZ_ALBUMID' },
									{ name: 'MUSICBRAINZ_ARTISTID', value: 'MUSICBRAINZ_ARTISTID' },
									{ name: 'MUSICBRAINZ_RELEASEGROUPID', value: 'MUSICBRAINZ_RELEASEGROUPID' },
									{ name: 'MUSICBRAINZ_TRACKID', value: 'MUSICBRAINZ_TRACKID' },
									{ name: 'MUSICIANCREDITS', value: 'MUSICIANCREDITS' },
									{ name: 'ORIGINALALBUM', value: 'ORIGINALALBUM' },
									{ name: 'ORIGINALARTIST', value: 'ORIGINALARTIST' },
									{ name: 'ORIGINALYEAR', value: 'ORIGINALYEAR' },
									{ name: 'PRODUCER', value: 'PRODUCER' },
									{ name: 'RATING', value: 'RATING' },
									{ name: 'RELEASETYPE', value: 'RELEASETYPE' },
									{ name: 'REMIXEDBY', value: 'REMIXEDBY' },
									{ name: 'REPLAYGAIN_ALBUM_GAIN', value: 'REPLAYGAIN_ALBUM_GAIN' },
									{ name: 'REPLAYGAIN_ALBUM_PEAK', value: 'REPLAYGAIN_ALBUM_PEAK' },
									{ name: 'REPLAYGAIN_TRACK_GAIN', value: 'REPLAYGAIN_TRACK_GAIN' },
									{ name: 'REPLAYGAIN_TRACK_PEAK', value: 'REPLAYGAIN_TRACK_PEAK' },
									{ name: 'SCRIPT', value: 'SCRIPT' },
									{ name: 'SHOWMOVEMENT', value: 'SHOWMOVEMENT' },
									{ name: 'SUBTITLE', value: 'SUBTITLE' },
									{ name: 'TITLESORT', value: 'TITLESORT' },
									{ name: 'UNSYNCEDLYRICS', value: 'UNSYNCEDLYRICS' },
									{ name: 'WORK', value: 'WORK' },
									{ name: 'WWW', value: 'WWW' },
									{ name: 'WWWARTIST', value: 'WWWARTIST' },
									{ name: 'WWWCOMMERCIALINFO', value: 'WWWCOMMERCIALINFO' },
									{ name: 'WWWCOPYRIGHT', value: 'WWWCOPYRIGHT' },
									{ name: 'WWWPAYMENT', value: 'WWWPAYMENT' },
									{ name: 'WWWPUBLISHER', value: 'WWWPUBLISHER' },
									{ name: 'WWWRADIO', value: 'WWWRADIO' },
								],
							},
							{
								displayName: 'Custom Field Name',
								name: 'customKey',
								type: 'string',
								default: '',
								description: 'Enter a custom field name',
								displayOptions: {
									show: {
										key: ['__custom'],
									},
								},
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'The value for this field',
							},
							{
								displayName: 'If Exists',
								name: 'mode',
								type: 'options',
								default: 'overwrite',
								description: 'What to do if the field already has a value',
								options: [
									{
										name: 'Overwrite',
										value: 'overwrite',
										description: 'Replace the existing value',
									},
									{
										name: 'Preserve',
										value: 'preserve',
										description: 'Keep the existing value, do not write',
									},
								],
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const tempFiles: string[] = [];

			try {
				// Get parameters
				const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
				const title = this.getNodeParameter('title', itemIndex, '') as string;
				const artist = this.getNodeParameter('artist', itemIndex, '') as string;
				const albumArtist = this.getNodeParameter('albumArtist', itemIndex, '') as string;
				const album = this.getNodeParameter('album', itemIndex, '') as string;
				const year = this.getNodeParameter('year', itemIndex, '') as string;
				const genre = this.getNodeParameter('genre', itemIndex, '') as string;
				const trackNumber = this.getNodeParameter('trackNumber', itemIndex, '') as string;
				const discNumber = this.getNodeParameter('discNumber', itemIndex, '') as string;
				const composer = this.getNodeParameter('composer', itemIndex, '') as string;
				const bpm = this.getNodeParameter('bpm', itemIndex, '') as string;
				const copyright = this.getNodeParameter('copyright', itemIndex, '') as string;
				const publisher = this.getNodeParameter('publisher', itemIndex, '') as string;
				const comment = this.getNodeParameter('comment', itemIndex, '') as string;
				const lyrics = this.getNodeParameter('lyrics', itemIndex, '') as string;
				const extendedPropertiesData = this.getNodeParameter('extendedProperties', itemIndex, {}) as {
					properties?: Array<{ key: string; customKey?: string; value: string; mode?: string }>;
				};

				// Build extended properties object with mode
				const extended: Record<string, { value: string; mode: string }> = {};
				if (extendedPropertiesData.properties) {
					for (const prop of extendedPropertiesData.properties) {
						// Use customKey if key is __custom, otherwise use key
						const fieldName = prop.key === '__custom' ? prop.customKey : prop.key;
						if (fieldName && prop.value) {
							extended[fieldName] = {
								value: prop.value,
								mode: prop.mode || 'overwrite',
							};
						}
					}
				}

				// Get binary data
				const { buffer, fileName, extension } = await getBinaryBuffer(
					this,
					itemIndex,
					binaryPropertyName,
				);

				// Validate audio format
				const validExtensions = ['wav', 'mp3', 'flac', 'm4a', 'aac', 'mp4'];
				if (!validExtensions.includes(extension.toLowerCase())) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported audio format: ${extension}. Supported formats: WAV, MP3, FLAC, M4A`,
						{ itemIndex },
					);
				}

				// Create temp files
				const inputPath = createInputFilePath('tagaudio', extension);
				tempFiles.push(inputPath);
				await writeTempFile(inputPath, buffer);

				// Build metadata object
				const metadata = {
					title,
					artist,
					albumArtist,
					album,
					year,
					genre,
					trackNumber,
					discNumber,
					composer,
					bpm,
					copyright,
					publisher,
					comment,
					lyrics,
					extended,
				};

				const metaPath = await writeMetadataJson('tagaudio', metadata);
				tempFiles.push(metaPath);

				// Run Python script
				const result = await runCommand(this, itemIndex, 'python3', [
					SCRIPT_PATH,
					inputPath,
					metaPath,
				]);

				if (!result.includes('OK')) {
					throw new NodeOperationError(
						this.getNode(),
						`Tag audio script failed: ${result}`,
						{ itemIndex },
					);
				}

				// Read the modified file back
				const modifiedBuffer = await readFile(inputPath);

				// Create output item with binary data
				const newItem: INodeExecutionData = {
					json: items[itemIndex].json,
					binary: {
						[binaryPropertyName]: await this.helpers.prepareBinaryData(
							modifiedBuffer,
							fileName,
						),
					},
					pairedItem: { item: itemIndex },
				};

				returnData.push(newItem);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
				} else {
					throw error;
				}
			} finally {
				// Always clean up temp files
				await cleanupFiles(tempFiles);
			}
		}

		return [returnData];
	}
}
