import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { runListV1Paginated, whaapyApiRequest } from '../GenericFunctions';
import type { OperationResult } from './types';
import { getIdParameter, unsupportedOperation } from './types';

export async function templateHandler(this: IExecuteFunctions, i: number, operation: string): Promise<OperationResult> {
  switch (operation) {
    case 'list': {
      const filters = this.getNodeParameter('templateFilters', i, {}) as IDataObject;
      const qs: IDataObject = {};
      if (filters.status) qs.status = filters.status;
      return runListV1Paginated(this, {
        endpoint: '/templates/v1',
        qs,
        returnAll: this.getNodeParameter('returnAll', i, false) as boolean,
        limit: this.getNodeParameter('limit', i, 50) as number,
        itemIndex: i,
      });
    }
    case 'get': {
      const templateId = encodeURIComponent(getIdParameter(this, 'templateId', i));
      return whaapyApiRequest.call(this, 'GET', `/templates/v1/${templateId}`, undefined, undefined, i);
    }
    case 'getVariables':
      return whaapyApiRequest.call(this, 'GET', '/templates/v1/variables', undefined, undefined, i);
    case 'sync':
      return whaapyApiRequest.call(this, 'POST', '/templates/v1/sync', undefined, undefined, i);
    default:
      return unsupportedOperation(this, 'template', operation, i);
  }
}
