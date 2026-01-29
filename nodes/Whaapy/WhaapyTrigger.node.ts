import {
  IHookFunctions,
  IWebhookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
  IDataObject,
} from 'n8n-workflow';

export class WhaapyTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Whaapy Trigger',
    name: 'whaapyTrigger',
    icon: 'file:whaapy.svg',
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["event"]}}',
    description: 'Listen for Whaapy webhook events',
    defaults: {
      name: 'Whaapy Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'whaapyApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        required: true,
        default: 'message.received',
        options: [
          {
            name: 'Message Received',
            value: 'message.received',
            description: 'Triggered when a new message is received',
          },
          {
            name: 'Message Sent',
            value: 'message.sent',
            description: 'Triggered when a message is sent',
          },
          {
            name: 'Message Delivered',
            value: 'message.delivered',
            description: 'Triggered when a message is delivered',
          },
          {
            name: 'Message Read',
            value: 'message.read',
            description: 'Triggered when a message is read',
          },
          {
            name: 'Message Failed',
            value: 'message.failed',
            description: 'Triggered when a message fails to send',
          },
          {
            name: 'Conversation Created',
            value: 'conversation.created',
            description: 'Triggered when a new conversation is created',
          },
          {
            name: 'Conversation Updated',
            value: 'conversation.updated',
            description: 'Triggered when a conversation is updated',
          },
          {
            name: 'Conversation Handoff',
            value: 'conversation.handoff',
            description: 'Triggered when AI hands off to a human',
          },
          {
            name: 'All Events',
            value: '*',
            description: 'Triggered for any event',
          },
        ],
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Webhook Secret',
            name: 'webhookSecret',
            type: 'string',
            typeOptions: { password: true },
            default: '',
            description: 'Secret to verify webhook signatures (optional)',
          },
        ],
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const event = this.getNodeParameter('event') as string;
        const credentials = await this.getCredentials('whaapyApi');

        try {
          const response = await this.helpers.request({
            method: 'GET',
            url: `${credentials.baseUrl}/webhooks/v1`,
            headers: {
              Authorization: `Bearer ${credentials.apiKey}`,
            },
            json: true,
          });

          const webhooks = response.webhooks || response.data || [];
          return webhooks.some(
            (webhook: IDataObject) =>
              webhook.url === webhookUrl &&
              (webhook.events as string[])?.includes(event)
          );
        } catch (error) {
          return false;
        }
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const event = this.getNodeParameter('event') as string;
        const options = this.getNodeParameter('options') as IDataObject;
        const credentials = await this.getCredentials('whaapyApi');

        const body: IDataObject = {
          url: webhookUrl,
          events: event === '*' ? ['*'] : [event],
        };

        if (options.webhookSecret) {
          body.secret = options.webhookSecret;
        }

        try {
          const response = await this.helpers.request({
            method: 'POST',
            url: `${credentials.baseUrl}/webhooks/v1`,
            headers: {
              Authorization: `Bearer ${credentials.apiKey}`,
              'Content-Type': 'application/json',
            },
            body,
            json: true,
          });

          const webhookData = this.getWorkflowStaticData('node');
          webhookData.webhookId = response.id || response.webhook?.id;
          return true;
        } catch (error) {
          return false;
        }
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        const credentials = await this.getCredentials('whaapyApi');

        if (!webhookData.webhookId) {
          return true;
        }

        try {
          await this.helpers.request({
            method: 'DELETE',
            url: `${credentials.baseUrl}/webhooks/v1/${webhookData.webhookId}`,
            headers: {
              Authorization: `Bearer ${credentials.apiKey}`,
            },
          });

          delete webhookData.webhookId;
          return true;
        } catch (error) {
          return false;
        }
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();
    const body = this.getBodyData() as IDataObject;
    const event = this.getNodeParameter('event') as string;

    // Check if the event matches
    const incomingEvent = body.event as string || body.type as string;
    
    if (event !== '*' && incomingEvent !== event) {
      // Event doesn't match, return empty
      return {
        workflowData: [],
      };
    }

    // Return the webhook data
    return {
      workflowData: [
        this.helpers.returnJsonArray([
          {
            event: incomingEvent,
            timestamp: body.timestamp || new Date().toISOString(),
            data: body.data || body.payload || body,
            headers: req.headers,
            raw: body,
          },
        ]),
      ],
    };
  }
}
