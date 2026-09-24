import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { whaapyApiRequest } from '../GenericFunctions';
import type { OperationResult } from './types';
import { unsupportedOperation } from './types';

export async function agentHandler(this: IExecuteFunctions, i: number, operation: string): Promise<OperationResult> {
  if (operation === 'toggle') {
    const body: IDataObject = { enabled: this.getNodeParameter('agentEnabled', i) as boolean };
    return whaapyApiRequest.call(this, 'POST', '/agent/v1/toggle', body, undefined, i);
  }
  if (operation === 'pause') {
    const body: IDataObject = { duration: this.getNodeParameter('agentPauseDuration', i) as number };
    return whaapyApiRequest.call(this, 'POST', '/agent/v1/pause', body, undefined, i);
  }
  return unsupportedOperation(this, 'agent', operation, i);
}
