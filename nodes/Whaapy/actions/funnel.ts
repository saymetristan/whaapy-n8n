import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { compactObject, parseIdList, parseJsonParam, runListV1Paginated, whaapyApiRequest } from '../GenericFunctions';
import type { OperationResult } from './types';
import { getIdParameter, isV1_1, unsupportedOperation } from './types';

/** Accepts ["id", ...], "id1,id2" or the legacy [{ id, position }] shape. */
function parseStageOrder(ctx: IExecuteFunctions, i: number): string[] {
  const raw = ctx.getNodeParameter('stagesOrder', i);
  const looksLikeJson = typeof raw === 'string' && /^\s*[[{]/.test(raw);
  const value = looksLikeJson ? parseJsonParam(ctx, raw, 'Stages Order', i, []) : raw;

  if (Array.isArray(value) && value.some((entry) => entry && typeof entry === 'object')) {
    return [...(value as IDataObject[])]
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((entry) => String(entry.id ?? '').trim())
      .filter(Boolean);
  }
  return parseIdList(value);
}

export async function funnelHandler(this: IExecuteFunctions, i: number, operation: string): Promise<OperationResult> {
  switch (operation) {
    case 'listStages':
      return runListV1Paginated(this, {
        endpoint: '/funnel/v1/stages',
        returnAll: isV1_1(this) ? true : (this.getNodeParameter('returnAll', i, true) as boolean),
        limit: isV1_1(this) ? 100 : (this.getNodeParameter('limit', i, 100) as number),
        itemIndex: i,
        dataKeys: ['data', 'stages'],
      });
    case 'getStage': {
      const stageId = encodeURIComponent(getIdParameter(this, 'stageId', i));
      return whaapyApiRequest.call(this, 'GET', `/funnel/v1/stages/${stageId}`, undefined, undefined, i);
    }
    case 'createStage': {
      const options = this.getNodeParameter('stageOptions', i, {}) as IDataObject;
      const body: IDataObject = compactObject({
        name: this.getNodeParameter('stageName', i) as string,
        color: options.color,
      });
      if (options.position !== undefined && options.position !== '') body.position = Number(options.position);
      return whaapyApiRequest.call(this, 'POST', '/funnel/v1/stages', body, undefined, i);
    }
    case 'updateStage': {
      const stageId = encodeURIComponent(getIdParameter(this, 'stageId', i));
      const fields = this.getNodeParameter('stageUpdateFields', i, {}) as IDataObject;
      const body = compactObject({ name: fields.name, color: fields.color });
      if (Object.keys(body).length === 0) {
        throw new NodeOperationError(this.getNode(), 'Add a Name or Color to update the stage', { itemIndex: i });
      }
      return whaapyApiRequest.call(this, 'PATCH', `/funnel/v1/stages/${stageId}`, body, undefined, i);
    }
    case 'deleteStage': {
      const stageId = encodeURIComponent(getIdParameter(this, 'stageId', i));
      return whaapyApiRequest.call(this, 'DELETE', `/funnel/v1/stages/${stageId}`, undefined, undefined, i);
    }
    case 'reorderStages': {
      const stageIds = parseStageOrder(this, i);
      if (stageIds.length === 0) {
        throw new NodeOperationError(this.getNode(), 'Stages Order must contain at least one stage ID', { itemIndex: i });
      }
      return whaapyApiRequest.call(this, 'PATCH', '/funnel/v1/stages/reorder', { stage_ids: stageIds }, undefined, i);
    }
    case 'moveContact': {
      const contactId = encodeURIComponent(this.getNodeParameter('contactIdFunnel', i) as string);
      const stageId = getIdParameter(this, 'targetStageId', i);
      return whaapyApiRequest.call(this, 'POST', `/funnel/v1/contacts/${contactId}/move`, { stage_id: stageId }, undefined, i);
    }
    default:
      return unsupportedOperation(this, 'funnel', operation, i);
  }
}
