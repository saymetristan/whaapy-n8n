import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { extractItems, whaapyApiRequest } from '../GenericFunctions';
import type { OperationResult } from './types';
import { unsupportedOperation } from './types';

export async function teamHandler(this: IExecuteFunctions, i: number, operation: string): Promise<OperationResult> {
  if (operation !== 'listMembers') return unsupportedOperation(this, 'team', operation, i);

  const response = await whaapyApiRequest.call(this, 'GET', '/team/v1', undefined, undefined, i);
  const agents = extractItems(response, ['agents', 'data']) as IDataObject[];
  const onlyAvailable = this.getNodeParameter('onlyAvailable', i, false) as boolean;
  return onlyAvailable ? agents.filter((agent) => agent.is_available === true) : agents;
}
