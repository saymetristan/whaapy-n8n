import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseIdList, parseJsonParam, whaapyApiRequest, whaapyApiRequestOffset } from '../GenericFunctions';
import type { OperationResult } from './types';
import { getIdParameter, unsupportedOperation } from './types';

function parseRecipients(ctx: IExecuteFunctions, i: number): IDataObject[] {
  const raw = ctx.getNodeParameter('recipients', i);
  const looksLikeJson = typeof raw === 'string' && /^\s*[[{]/.test(raw);
  const value = looksLikeJson ? parseJsonParam(ctx, raw, 'Recipients', i, []) : raw;
  const entries: unknown[] = Array.isArray(value) ? value : parseIdList(value);

  return entries
    .map((entry): IDataObject | null => {
      if (typeof entry === 'string' || typeof entry === 'number') {
        const phoneNumber = String(entry).trim();
        return phoneNumber ? { phoneNumber } : null;
      }
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as IDataObject;
      const phoneNumber = String(record.phoneNumber ?? record.phone_number ?? record.phone ?? '').trim();
      if (!phoneNumber) return null;
      const templateParameters = record.templateParameters ?? record.template_parameters;
      return Array.isArray(templateParameters)
        ? { phoneNumber, templateParameters: templateParameters.map(String) }
        : { phoneNumber };
    })
    .filter((entry): entry is IDataObject => entry !== null);
}

export async function broadcastHandler(this: IExecuteFunctions, i: number, operation: string): Promise<OperationResult> {
  if (operation === 'list') {
    const filters = this.getNodeParameter('broadcastFilters', i, {}) as IDataObject;
    return whaapyApiRequestOffset.call(
      this,
      '/broadcasts',
      filters.status ? { status: filters.status } : {},
      this.getNodeParameter('returnAll', i, false) as boolean,
      this.getNodeParameter('limit', i, 50) as number,
      i,
    );
  }

  if (operation === 'create') {
    const options = this.getNodeParameter('broadcastOptions', i, {}) as IDataObject;
    const body: IDataObject = {
      name: this.getNodeParameter('broadcastName', i) as string,
      templateId: getIdParameter(this, 'broadcastTemplateId', i),
    };
    if (options.tagToApply) body.tagToApply = options.tagToApply;
    if (options.variableMapping) {
      const mapping = parseJsonParam<IDataObject>(this, options.variableMapping, 'Variable Mapping', i, {});
      if (Object.keys(mapping).length > 0) {
        body.variableMapping = Object.fromEntries(Object.entries(mapping).map(([key, value]) => [key, String(value)]));
      }
    }
    return whaapyApiRequest.call(this, 'POST', '/broadcasts', body, undefined, i);
  }

  const broadcastId = encodeURIComponent(getIdParameter(this, 'broadcastId', i));
  const base = `/broadcasts/${broadcastId}`;

  switch (operation) {
    case 'get':
      return whaapyApiRequest.call(this, 'GET', base, undefined, undefined, i);
    case 'getSummary':
      return whaapyApiRequest.call(this, 'GET', `${base}/summary`, undefined, undefined, i);
    case 'getRecipients': {
      const filters = this.getNodeParameter('recipientFilters', i, {}) as IDataObject;
      const qs: IDataObject = {};
      if (filters.status) qs.status = filters.status;
      if (filters.q) qs.q = filters.q;
      return whaapyApiRequestOffset.call(
        this,
        `${base}/recipients`,
        qs,
        this.getNodeParameter('returnAll', i, false) as boolean,
        this.getNodeParameter('limit', i, 50) as number,
        i,
      );
    }
    case 'addRecipients': {
      const source = this.getNodeParameter('recipientsSource', i, 'list') as string;
      if (source === 'all') {
        return whaapyApiRequest.call(this, 'POST', `${base}/recipients/all`, {}, undefined, i);
      }
      if (source === 'segments') {
        const segmentIds = parseIdList(this.getNodeParameter('segmentIds', i));
        if (segmentIds.length === 0) {
          throw new NodeOperationError(this.getNode(), 'Provide at least one Segment ID', { itemIndex: i });
        }
        return whaapyApiRequest.call(this, 'POST', `${base}/recipients/segments`, { segmentIds }, undefined, i);
      }
      const recipients = parseRecipients(this, i);
      if (recipients.length === 0) {
        throw new NodeOperationError(this.getNode(), 'Provide at least one recipient phone number', { itemIndex: i });
      }
      return whaapyApiRequest.call(this, 'POST', `${base}/recipients/csv`, { recipients }, undefined, i);
    }
    case 'send':
    case 'pause':
    case 'resume':
    case 'cancel':
      return whaapyApiRequest.call(this, 'POST', `${base}/${operation}`, {}, undefined, i);
    case 'retryFailed':
      return whaapyApiRequest.call(this, 'POST', `${base}/retry-failed`, {}, undefined, i);
    case 'delete':
      return whaapyApiRequest.call(this, 'DELETE', base, undefined, undefined, i);
    default:
      return unsupportedOperation(this, 'broadcast', operation, i);
  }
}
