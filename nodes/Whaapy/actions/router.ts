import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { agentHandler } from './agent';
import { broadcastHandler } from './broadcast';
import { contactHandler } from './contact';
import { conversationHandler } from './conversation';
import { funnelHandler } from './funnel';
import { mediaHandler } from './media';
import { messageHandler } from './message';
import { teamHandler } from './team';
import { templateHandler } from './template';
import type { ResourceHandler } from './types';

const HANDLERS: Record<string, ResourceHandler> = {
  agent: agentHandler,
  broadcast: broadcastHandler,
  contact: contactHandler,
  conversation: conversationHandler,
  funnel: funnelHandler,
  media: mediaHandler,
  message: messageHandler,
  team: teamHandler,
  template: templateHandler,
};

export async function executeWhaapyOperation(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const resource = this.getNodeParameter('resource', i) as string;
      const operation = this.getNodeParameter('operation', i) as string;
      const handler = HANDLERS[resource];
      if (!handler) {
        throw new NodeOperationError(this.getNode(), `The resource "${resource}" is not supported`, { itemIndex: i });
      }

      const result = await handler.call(this, i, operation);
      const results: IDataObject[] = Array.isArray(result) ? result : [result ?? { success: true }];
      for (const json of results) {
        returnData.push({ json, pairedItem: { item: i } });
      }
    } catch (error) {
      if (this.continueOnFail()) {
        returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
        continue;
      }
      if (error instanceof NodeApiError || error instanceof NodeOperationError) throw error;
      throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
    }
  }

  return [returnData];
}
