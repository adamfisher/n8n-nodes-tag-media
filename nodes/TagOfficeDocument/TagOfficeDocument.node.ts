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

// Path to Python script (relative to compiled node location in dist/nodes/TagOfficeDocument/)
const SCRIPT_PATH = join(__dirname, '..', '..', '..', 'scripts', 'tag_office.py');
import { createInputFilePath, writeTempFile, writeMetadataJson } from '../shared/tempFiles';

export class TagOfficeDocument implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Tag Office Document',
		name: 'tagOfficeDocument',
		icon: 'file:../../images/tag-media.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Tag Office document',
		description: 'Write document properties to Word, Excel, and PowerPoint files',
		defaults: {
			name: 'Tag Office Document',
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
				description: 'Name of the binary property containing the document',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The document title',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				description: 'The document subject',
			},
			{
				displayName: 'Author',
				name: 'author',
				type: 'string',
				default: '',
				description: 'The document author',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 3,
				},
				default: '',
				description: 'A description or comment about the document',
			},
			{
				displayName: 'Keywords',
				name: 'keywords',
				type: 'string',
				default: '',
				description: 'Keywords for the document (comma-separated)',
			},
			{
				displayName: 'Category',
				name: 'category',
				type: 'string',
				default: '',
				description: 'The document category',
			},
			{
				displayName: 'Company',
				name: 'company',
				type: 'string',
				default: '',
				description: 'The company or organization',
			},
			{
				displayName: 'Manager',
				name: 'manager',
				type: 'string',
				default: '',
				description: 'The manager name',
			},
			{
				displayName: 'Created Date',
				name: 'createdDate',
				type: 'string',
				default: '',
				description: 'Creation date in ISO 8601 format (e.g., 2024-01-15T10:30:00)',
			},
			{
				displayName: 'Last Modified By',
				name: 'lastModifiedBy',
				type: 'string',
				default: '',
				description: 'Name of the person who last modified the document',
			},
			{
				displayName: 'Extended Properties',
				name: 'extendedProperties',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description: 'Custom document properties (stored in docProps/custom.xml)',
				options: [
					{
						name: 'properties',
						displayName: 'Property',
						values: [
							{
								displayName: 'Property Name',
								name: 'key',
								type: 'string',
								default: '',
								description: 'The custom property name',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'The value for this property',
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
				const subject = this.getNodeParameter('subject', itemIndex, '') as string;
				const author = this.getNodeParameter('author', itemIndex, '') as string;
				const description = this.getNodeParameter('description', itemIndex, '') as string;
				const keywords = this.getNodeParameter('keywords', itemIndex, '') as string;
				const category = this.getNodeParameter('category', itemIndex, '') as string;
				const company = this.getNodeParameter('company', itemIndex, '') as string;
				const manager = this.getNodeParameter('manager', itemIndex, '') as string;
				const createdDate = this.getNodeParameter('createdDate', itemIndex, '') as string;
				const lastModifiedBy = this.getNodeParameter('lastModifiedBy', itemIndex, '') as string;
				const extendedPropertiesData = this.getNodeParameter(
					'extendedProperties',
					itemIndex,
					{},
				) as {
					properties?: Array<{ key: string; value: string }>;
				};

				// Get binary data
				const { buffer, fileName, extension } = await getBinaryBuffer(
					this,
					itemIndex,
					binaryPropertyName,
				);

				// Validate document format
				const validExtensions = ['docx', 'xlsx', 'pptx'];
				if (!validExtensions.includes(extension.toLowerCase())) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported document format: ${extension}. Supported formats: DOCX, XLSX, PPTX`,
						{ itemIndex },
					);
				}

				// Create temp files
				const inputPath = createInputFilePath('tagoffice', extension);
				tempFiles.push(inputPath);
				await writeTempFile(inputPath, buffer);

				// Build extended properties object
				const extended: Record<string, string> = {};
				if (extendedPropertiesData.properties) {
					for (const prop of extendedPropertiesData.properties) {
						if (prop.key && prop.value) {
							extended[prop.key] = prop.value;
						}
					}
				}

				// Build metadata object
				const metadata = {
					title,
					subject,
					author,
					description,
					keywords,
					category,
					company,
					manager,
					createdDate,
					lastModifiedBy,
					extended,
				};

				const metaPath = await writeMetadataJson('tagoffice', metadata);
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
						`Tag office script failed: ${result}`,
						{ itemIndex },
					);
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
