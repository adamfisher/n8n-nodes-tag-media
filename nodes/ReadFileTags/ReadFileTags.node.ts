import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { getBinaryBuffer, cleanupFiles } from '../shared/utils';
import { createInputFilePath, writeTempFile } from '../shared/tempFiles';

const execFileAsync = promisify(execFile);

export class ReadFileTags implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Read File Tags',
		name: 'readFileTags',
		icon: 'file:../../images/tag-media.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Read tags from file',
		description: 'Extract metadata from audio, images, PDFs, and Office files',
		defaults: {
			name: 'Read File Tags',
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
				description: 'Name of the binary property containing the file',
			},
			{
				displayName: 'Field Operation',
				name: 'fieldOperation',
				type: 'options',
				default: 'includeAll',
				description: 'How to filter the output fields',
				options: [
					{
						name: 'Include All',
						value: 'includeAll',
						description: 'Return all metadata fields',
					},
					{
						name: 'Include',
						value: 'include',
						description: 'Only return the specified fields',
					},
					{
						name: 'Exclude',
						value: 'exclude',
						description: 'Return all fields except the specified ones',
					},
				],
			},
			{
				displayName: 'Selected Fields',
				name: 'selectedFields',
				type: 'string',
				default: '',
				description: 'Comma-separated list of field names to include or exclude',
				displayOptions: {
					hide: {
						fieldOperation: ['includeAll'],
					},
				},
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
				const fieldOperation = this.getNodeParameter('fieldOperation', itemIndex) as string;
				const selectedFieldsRaw = this.getNodeParameter('selectedFields', itemIndex, '') as string;

				// Parse selected fields
				const selectedFields = selectedFieldsRaw
					.split(',')
					.map((f) => f.trim())
					.filter((f) => f);

				// Get binary data
				const { buffer, extension } = await getBinaryBuffer(this, itemIndex, binaryPropertyName);

				// Create temp file
				const inputPath = createInputFilePath('readtags', extension);
				tempFiles.push(inputPath);
				await writeTempFile(inputPath, buffer);

				// Run exiftool
				const { stdout, stderr } = await execFileAsync('exiftool', ['-json', inputPath], {
					maxBuffer: 10 * 1024 * 1024, // 10MB buffer
				});

				if (stderr && stderr.trim()) {
					console.warn(`exiftool stderr: ${stderr}`);
				}

				// Parse JSON output
				let metadata: IDataObject;
				try {
					const parsed = JSON.parse(stdout);
					// exiftool returns an array with one object per file
					metadata = (Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : {}) as IDataObject;
				} catch {
					// If parsing fails, return empty object
					metadata = {};
				}

				// Remove internal exiftool fields that aren't useful
				delete metadata.SourceFile;
				delete metadata.Directory;
				delete metadata.ExifToolVersion;

				// Apply field filtering
				if (fieldOperation === 'include' && selectedFields.length > 0) {
					const filtered: IDataObject = {};
					for (const field of selectedFields) {
						if (field in metadata) {
							filtered[field] = metadata[field];
						}
					}
					metadata = filtered;
				} else if (fieldOperation === 'exclude' && selectedFields.length > 0) {
					for (const field of selectedFields) {
						delete metadata[field];
					}
				}

				// Create output item
				const newItem: INodeExecutionData = {
					json: metadata,
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
