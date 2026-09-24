import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getBaseUrl, toWhaapyApiError } from '../GenericFunctions';
import type { OperationResult } from './types';
import { unsupportedOperation } from './types';

const MIME_BY_MEDIA_TYPE: Record<string, string> = {
  image: 'image/jpeg',
  video: 'video/mp4',
  audio: 'audio/mpeg',
  document: 'application/pdf',
  sticker: 'image/webp',
};

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  image: 'jpg',
  video: 'mp4',
  audio: 'mp3',
  document: 'pdf',
  sticker: 'webp',
};

function firstString(...values: unknown[]): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0) as string | undefined;
}

async function upload(this: IExecuteFunctions, i: number): Promise<OperationResult> {
  const mediaType = this.getNodeParameter('mediaType', i) as string;
  const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
  const itemBinary = this.getInputData()[i].binary;

  if (!itemBinary || !itemBinary[binaryPropertyName]) {
    throw new NodeOperationError(
      this.getNode(),
      `Binary property "${binaryPropertyName}" not found. Attach a file first (for example with Read Binary File or HTTP Request Download).`,
      { itemIndex: i },
    );
  }

  const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
  const binaryData = itemBinary[binaryPropertyName];
  const raw = binaryData as unknown as Record<string, unknown>;

  const mime = firstString(binaryData.mimeType, raw.mime_type, raw.contentType, raw.content_type)
    ?.trim()
    .split(';')[0]
    .replace(/[^a-zA-Z0-9.+/-]/g, '');
  const contentType =
    mime && /^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(mime)
      ? mime
      : (MIME_BY_MEDIA_TYPE[mediaType] ?? 'application/octet-stream');

  const extension =
    firstString(binaryData.fileExtension, raw.file_extension)
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? EXTENSION_BY_MEDIA_TYPE[mediaType];
  const baseName = (binaryData.fileName || `${mediaType}-upload`).trim();
  const filename = baseName.includes('.') ? baseName : `${baseName}.${extension || 'bin'}`;

  try {
    // httpRequest has no multipart helper that sets knownLength; the legacy request helper does.
    return await this.helpers.requestWithAuthentication.call(this, 'whaapyApi', {
      method: 'POST',
      uri: `${await getBaseUrl.call(this)}/media/v1`,
      formData: {
        type: mediaType,
        file: {
          value: fileBuffer,
          options: { filename, contentType, knownLength: fileBuffer.length },
        },
      },
      json: true,
    });
  } catch (error) {
    throw toWhaapyApiError(this, error, i);
  }
}

export async function mediaHandler(this: IExecuteFunctions, i: number, operation: string): Promise<OperationResult> {
  if (operation === 'upload') return upload.call(this, i);
  return unsupportedOperation(this, 'media', operation, i);
}
