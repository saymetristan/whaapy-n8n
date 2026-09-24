import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { runListV1Paginated, whaapyApiRequest } from '../GenericFunctions';
import type { OperationResult } from './types';
import { unsupportedOperation } from './types';

export async function conversationHandler(
  this: IExecuteFunctions,
  i: number,
  operation: string,
): Promise<OperationResult> {
  if (operation === 'list') {
    const filters = this.getNodeParameter('conversationFilters', i, {}) as IDataObject;
    const qs: IDataObject = {};
    if (filters.search) qs.search = filters.search;
    if (filters.status && filters.status !== 'all') qs.status = filters.status;
    return runListV1Paginated(this, {
      endpoint: '/conversations/v1',
      qs,
      returnAll: this.getNodeParameter('returnAll', i, false) as boolean,
      limit: this.getNodeParameter('limit', i, 20) as number,
      itemIndex: i,
    });
  }

  if (operation === 'getByPhone') {
    const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
    return whaapyApiRequest.call(
      this,
      'GET',
      `/conversations/v1/by-phone/${encodeURIComponent(phoneNumber)}`,
      undefined,
      undefined,
      i,
    );
  }

  const conversationId = encodeURIComponent(this.getNodeParameter('conversationId', i) as string);
  const base = `/conversations/v1/${conversationId}`;

  switch (operation) {
    case 'get':
      return whaapyApiRequest.call(this, 'GET', base, undefined, undefined, i);
    case 'getMessages':
      return runListV1Paginated(this, {
        endpoint: `${base}/messages`,
        returnAll: this.getNodeParameter('returnAll', i, false) as boolean,
        limit: this.getNodeParameter('limit', i, 50) as number,
        itemIndex: i,
      });
    case 'close':
      return whaapyApiRequest.call(this, 'POST', `${base}/close`, undefined, undefined, i);
    case 'archive':
      return whaapyApiRequest.call(this, 'POST', `${base}/archive`, undefined, undefined, i);
    case 'markRead':
      return whaapyApiRequest.call(this, 'PATCH', `${base}/mark-read`, undefined, undefined, i);
    case 'markUnread':
      return whaapyApiRequest.call(this, 'PATCH', `${base}/mark-unread`, undefined, undefined, i);
    case 'setAi':
      return whaapyApiRequest.call(
        this,
        'PATCH',
        `${base}/ai`,
        { aiEnabled: this.getNodeParameter('aiEnabled', i) as boolean },
        undefined,
        i,
      );
    case 'pauseAi':
      return whaapyApiRequest.call(
        this,
        'POST',
        `${base}/ai/pause`,
        { duration: this.getNodeParameter('pauseDurationConv', i) as number },
        undefined,
        i,
      );
    case 'aiSuggest':
      return whaapyApiRequest.call(this, 'POST', `${base}/ai-suggest`, undefined, undefined, i);
    default:
      return unsupportedOperation(this, 'conversation', operation, i);
  }
}
