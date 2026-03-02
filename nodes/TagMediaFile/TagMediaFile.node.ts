import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { readFile } from 'fs/promises';

import { getBinaryBuffer, cleanupFiles, runCommand } from '../shared/utils';
import { createInputFilePath, writeTempFile } from '../shared/tempFiles';

export class TagMediaFile implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tag Media File',
		name: 'tagMediaFile',
		icon: 'file:../../images/tag-media.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Tag media file',
		description: 'Write EXIF, IPTC, and XMP tags to images and PDFs',
		defaults: {
			name: 'Tag Media File',
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
				description: 'Name of the binary property containing the media file',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the media',
			},
			{
				displayName: 'Creator / Author',
				name: 'creator',
				type: 'string',
				default: '',
				description: 'The creator or author of the media',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				description: 'A description of the media content',
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
				description: 'The publisher of the media',
			},
			{
				displayName: 'Keywords',
				name: 'keywords',
				type: 'string',
				default: '',
				description: 'Keywords for the media (comma-separated)',
			},
			{
				displayName: 'Date Created',
				name: 'dateCreated',
				type: 'string',
				default: '',
				description: 'Creation date in ISO 8601 format (e.g., 2024-01-15)',
			},
			{
				displayName: 'Rights',
				name: 'rights',
				type: 'string',
				default: '',
				description: 'Rights or usage terms',
			},
			{
				displayName: 'Extended Properties',
				name: 'extendedProperties',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description:
					'Additional metadata fields. See <a href="https://exiftool.org/TagNames/">exiftool tag reference</a>.',
				options: [
					{
						name: 'properties',
						displayName: 'Property',
						values: [
							{
								displayName: 'Tag Name',
								name: 'key',
								type: 'options',
								default: 'Artist',
								description: 'Select a metadata tag',
								options: [
									{ name: '── Custom ──', value: '__custom' },
									{ name: 'Artist', value: 'Artist' },
									{ name: 'Byline', value: 'By-line' },
									{ name: 'Byline Title', value: 'By-lineTitle' },
									{ name: 'Caption Abstract', value: 'Caption-Abstract' },
									{ name: 'Category', value: 'Category' },
									{ name: 'City', value: 'City' },
									{ name: 'Copyright Notice', value: 'CopyrightNotice' },
									{ name: 'Country Primary Location Name', value: 'Country-PrimaryLocationName' },
									{ name: 'Credit', value: 'Credit' },
									{ name: 'GPS Altitude', value: 'GPSAltitude' },
									{ name: 'GPS Altitude Ref', value: 'GPSAltitudeRef' },
									{ name: 'GPS Latitude', value: 'GPSLatitude' },
									{ name: 'GPS Latitude Ref', value: 'GPSLatitudeRef' },
									{ name: 'GPS Longitude', value: 'GPSLongitude' },
									{ name: 'GPS Longitude Ref', value: 'GPSLongitudeRef' },
									{ name: 'Headline', value: 'Headline' },
									{ name: 'Image Description', value: 'ImageDescription' },
									{ name: 'Make (Camera)', value: 'Make' },
									{ name: 'Model (Camera)', value: 'Model' },
									{ name: 'Object Name', value: 'ObjectName' },
									{ name: 'Original Transmission Reference', value: 'OriginalTransmissionReference' },
									{ name: 'PDF:Author', value: 'PDF:Author' },
									{ name: 'PDF:Creation Date', value: 'PDF:CreationDate' },
									{ name: 'PDF:Creator', value: 'PDF:Creator' },
									{ name: 'PDF:Keywords', value: 'PDF:Keywords' },
									{ name: 'PDF:Mod Date', value: 'PDF:ModDate' },
									{ name: 'PDF:Producer', value: 'PDF:Producer' },
									{ name: 'PDF:Subject', value: 'PDF:Subject' },
									{ name: 'PDF:Title', value: 'PDF:Title' },
									{ name: 'Province State', value: 'Province-State' },
									{ name: 'Software', value: 'Software' },
									{ name: 'Source', value: 'Source' },
									{ name: 'Special Instructions', value: 'SpecialInstructions' },
									{ name: 'Sublocation', value: 'Sub-location' },
									{ name: 'Supplemental Categories', value: 'SupplementalCategories' },
									{ name: 'Urgency', value: 'Urgency' },
									{ name: 'User Comment', value: 'UserComment' },
									{ name: 'Writer Editor', value: 'Writer-Editor' },
									{ name: 'XMP-dc:Creator', value: 'XMP-dc:Creator' },
									{ name: 'XMP-dc:Description', value: 'XMP-dc:Description' },
									{ name: 'XMP-dc:Format', value: 'XMP-dc:Format' },
									{ name: 'XMP-dc:Identifier', value: 'XMP-dc:Identifier' },
									{ name: 'XMP-dc:Language', value: 'XMP-dc:Language' },
									{ name: 'XMP-dc:Publisher', value: 'XMP-dc:Publisher' },
									{ name: 'XMP-dc:Relation', value: 'XMP-dc:Relation' },
									{ name: 'XMP-dc:Rights', value: 'XMP-dc:Rights' },
									{ name: 'XMP-dc:Source', value: 'XMP-dc:Source' },
									{ name: 'XMP-dc:Subject', value: 'XMP-dc:Subject' },
									{ name: 'XMP-dc:Title', value: 'XMP-dc:Title' },
									{ name: 'XMP-dc:Type', value: 'XMP-dc:Type' },
									{ name: 'XMP-photoshop:Authors Position', value: 'XMP-photoshop:AuthorsPosition' },
									{ name: 'XMP-photoshop:Caption Writer', value: 'XMP-photoshop:CaptionWriter' },
									{ name: 'XMP-photoshop:City', value: 'XMP-photoshop:City' },
									{ name: 'XMP-photoshop:Country', value: 'XMP-photoshop:Country' },
									{ name: 'XMP-photoshop:Credit', value: 'XMP-photoshop:Credit' },
									{ name: 'XMP-photoshop:Date Created', value: 'XMP-photoshop:DateCreated' },
									{ name: 'XMP-photoshop:Headline', value: 'XMP-photoshop:Headline' },
									{ name: 'XMP-photoshop:Instructions', value: 'XMP-photoshop:Instructions' },
									{ name: 'XMP-photoshop:Source', value: 'XMP-photoshop:Source' },
									{ name: 'XMP-photoshop:State', value: 'XMP-photoshop:State' },
									{ name: 'XMP-photoshop:Transmission Reference', value: 'XMP-photoshop:TransmissionReference' },
									{ name: 'XMP-xmpRights:Certificate', value: 'XMP-xmpRights:Certificate' },
									{ name: 'XMP-xmpRights:Marked', value: 'XMP-xmpRights:Marked' },
									{ name: 'XMP-xmpRights:Owner', value: 'XMP-xmpRights:Owner' },
									{ name: 'XMP-xmpRights:Usage Terms', value: 'XMP-xmpRights:UsageTerms' },
									{ name: 'XMP-xmpRights:Web Statement', value: 'XMP-xmpRights:WebStatement' },
								],
							},
							{
								displayName: 'Custom Tag Name',
								name: 'customKey',
								type: 'string',
								default: '',
								description: 'Enter a custom exiftool tag name',
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
								description: 'The value for this tag',
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
				const creator = this.getNodeParameter('creator', itemIndex, '') as string;
				const descriptionParam = this.getNodeParameter('description', itemIndex, '') as string;
				const copyright = this.getNodeParameter('copyright', itemIndex, '') as string;
				const publisher = this.getNodeParameter('publisher', itemIndex, '') as string;
				const keywords = this.getNodeParameter('keywords', itemIndex, '') as string;
				const dateCreated = this.getNodeParameter('dateCreated', itemIndex, '') as string;
				const rights = this.getNodeParameter('rights', itemIndex, '') as string;
				const extendedPropertiesData = this.getNodeParameter(
					'extendedProperties',
					itemIndex,
					{},
				) as {
					properties?: Array<{ key: string; customKey?: string; value: string }>;
				};

				// Get binary data
				const { buffer, fileName, extension } = await getBinaryBuffer(
					this,
					itemIndex,
					binaryPropertyName,
				);

				// Validate media format
				const validExtensions = ['jpg', 'jpeg', 'tif', 'tiff', 'png', 'pdf'];
				if (!validExtensions.includes(extension.toLowerCase())) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported media format: ${extension}. Supported formats: JPEG, TIFF, PNG, PDF`,
						{ itemIndex },
					);
				}

				// Create temp file
				const inputPath = createInputFilePath('tagmedia', extension);
				tempFiles.push(inputPath);
				await writeTempFile(inputPath, buffer);

				// Build exiftool arguments
				const args: string[] = ['-overwrite_original'];

				// Add standard tags (only if non-empty)
				if (title) args.push(`-Title=${title}`);
				if (creator) args.push(`-Creator=${creator}`);
				if (descriptionParam) args.push(`-Description=${descriptionParam}`);
				if (copyright) args.push(`-Copyright=${copyright}`);
				if (publisher) args.push(`-Publisher=${publisher}`);
				if (keywords) args.push(`-Keywords=${keywords}`);
				if (dateCreated) args.push(`-DateCreated=${dateCreated}`);
				if (rights) args.push(`-Rights=${rights}`);

				// Add extended properties
				if (extendedPropertiesData.properties) {
					for (const prop of extendedPropertiesData.properties) {
						// Use customKey if key is __custom, otherwise use key
						const tagName = prop.key === '__custom' ? prop.customKey : prop.key;
						if (tagName && prop.value) {
							args.push(`-${tagName}=${prop.value}`);
						}
					}
				}

				// Add the file path
				args.push(inputPath);

				// Only run exiftool if we have tags to write
				if (args.length > 2) {
					// More than just -overwrite_original and filepath
					await runCommand(this, itemIndex, 'exiftool', args);
				}

				// Read the modified file back
				const modifiedBuffer = await readFile(inputPath);

				// Create output item with binary data
				const newItem: INodeExecutionData = {
					json: items[itemIndex].json,
					binary: {
						[binaryPropertyName]: await this.helpers.prepareBinaryData(modifiedBuffer, fileName),
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
