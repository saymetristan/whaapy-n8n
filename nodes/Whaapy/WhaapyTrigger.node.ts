import { createHmac, timingSafeEqual } from 'crypto';

import type {
  IDataObject,
  IHookFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { whaapyApiRequest } from './GenericFunctions';

const EVENT_OPTIONS = [
  { name: 'All Events', value: '*', description: 'Every event, including ones added in the future' },
  { name: 'Broadcast Completed', value: 'broadcast.completed' },
  { name: 'Broadcast Failed', value: 'broadcast.failed' },
  { name: 'Broadcast Sent', value: 'broadcast.sent' },
  { name: 'Contact Created', value: 'contact.created' },
  { name: 'Contact Deleted', value: 'contact.deleted' },
  { name: 'Contact Merged', value: 'contact.merged' },
  { name: 'Contact Stage Changed', value: 'contact.stage_changed', description: 'A contact moved to another funnel stage' },
  { name: 'Contact Updated', value: 'contact.updated' },
  { name: 'Conversation Assigned', value: 'conversation.assigned' },
  { name: 'Conversation Closed', value: 'conversation.closed' },
  { name: 'Conversation Created', value: 'conversation.created' },
  { name: 'Conversation Reopened', value: 'conversation.reopened' },
  { name: 'Conversation Unassigned', value: 'conversation.unassigned' },
  { name: 'Message Delivered', value: 'message.delivered' },
  { name: 'Message Failed', value: 'message.failed' },
  { name: 'Message Read', value: 'message.read' },
  { name: 'Message Received', value: 'message.received', description: 'An inbound WhatsApp message' },
  { name: 'Message Sent', value: 'message.sent' },
];

const MAX_REMEMBERED_DELIVERIES = 200;

type WhaapyWebhook = { id: string; url: string; events?: string[]; isActive?: boolean; secret?: string };

function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

function sameEvents(a: string[] = [], b: string[] = []): boolean {
  const left = [...new Set(a)].sort().join(',');
  const right = [...new Set(b)].sort().join(',');
  return left === right;
}

function getSelectedEvents(ctx: IHookFunctions | IWebhookFunctions): string[] {
  if (ctx.getNode().typeVersion >= 1.1) {
    const events = (ctx.getNodeParameter('events', []) as string[]).filter(Boolean);
    return events.includes('*') || events.length === 0 ? ['*'] : events;
  }
  return [ctx.getNodeParameter('event') as string];
}

async function listWebhooksForUrl(ctx: IHookFunctions, webhookUrl: string): Promise<WhaapyWebhook[]> {
  const response = await whaapyApiRequest.call(ctx, 'GET', '/user-webhooks');
  const webhooks = (response?.data ?? response?.webhooks ?? []) as WhaapyWebhook[];
  const target = normalizeUrl(webhookUrl);
  return webhooks.filter((webhook) => normalizeUrl(webhook.url) === target);
}

function isNotFound(error: unknown): boolean {
  return error instanceof NodeApiError && error.httpCode === '404';
}

function header(headers: IDataObject, name: string): string | undefined {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] as string;
  return typeof value === 'string' ? value : undefined;
}

export class WhaapyTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Whaapy Trigger',
    name: 'whaapyTrigger',
    icon: 'file:whaapy.svg',
    group: ['trigger'],
    version: [1, 1.1],
    defaultVersion: 1.1,
    subtitle: '={{$parameter["events"] ? $parameter["events"].join(", ") : $parameter["event"]}}',
    description: 'Starts the workflow when Whaapy events occur',
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
        displayName: 'Whaapy only delivers events to public HTTPS URLs. Local n8n instances need a tunnel and WEBHOOK_URL set to it.',
        name: 'httpsNotice',
        type: 'notice',
        default: '',
      },
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        required: true,
        default: 'message.received',
        displayOptions: { show: { '@version': [1] } },
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
            name: 'Conversation Updated (Deprecated)',
            value: 'conversation.updated',
            description: 'Whaapy does not emit this event. Use Conversation Assigned/Closed/Reopened.',
          },
          {
            name: 'Conversation Handoff (Deprecated)',
            value: 'conversation.handoff',
            description: 'Whaapy does not emit this event. Use Conversation Assigned.',
          },
          {
            name: 'All Events',
            value: '*',
            description: 'Triggered for any event',
          },
        ],
      },
      {
        displayName: 'Events',
        name: 'events',
        type: 'multiOptions',
        required: true,
        default: ['message.received'],
        displayOptions: { show: { '@version': [1.1] } },
        options: EVENT_OPTIONS,
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: { show: { '@version': [1.1] } },
        options: [
          {
            displayName: 'Download Media',
            name: 'downloadMedia',
            type: 'boolean',
            default: false,
            description: 'Whether to download the file of inbound media messages (media_url) into binary data',
          },
          {
            displayName: 'Binary Property',
            name: 'binaryPropertyName',
            type: 'string',
            default: 'data',
            description: 'Binary property that receives the downloaded media',
            displayOptions: { show: { downloadMedia: [true] } },
          },
          {
            displayName: 'Ignore Duplicate Deliveries',
            name: 'ignoreDuplicates',
            type: 'boolean',
            default: true,
            description: 'Whether to skip retries of a delivery that already started this workflow (X-Webhook-Delivery-ID)',
          },
          {
            displayName: 'Verify Signature',
            name: 'verifySignature',
            type: 'boolean',
            default: true,
            description: 'Whether to reject requests whose X-Webhook-Signature does not match the webhook secret',
          },
        ],
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const events = getSelectedEvents(this);
        const staticData = this.getWorkflowStaticData('node');

        const match = (await listWebhooksForUrl(this, webhookUrl)).find(
          (webhook) => webhook.isActive !== false && sameEvents(webhook.events, events),
        );
        if (!match) return false;

        staticData.webhookId = match.id;
        if (match.secret) staticData.secret = match.secret;
        return true;
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const events = getSelectedEvents(this);
        const staticData = this.getWorkflowStaticData('node');

        if (!/^https:\/\//i.test(webhookUrl)) {
          throw new NodeOperationError(
            this.getNode(),
            `Whaapy only delivers webhooks to HTTPS URLs, but this n8n exposes ${webhookUrl}`,
            {
              description:
                'Set the WEBHOOK_URL environment variable of n8n to a public https:// URL (for local testing, use a tunnel such as ngrok or cloudflared).',
            },
          );
        }

        // The dispatcher dedupes deliveries by URL + event, so stale registrations for this URL
        // would sign with a different secret.
        for (const stale of await listWebhooksForUrl(this, webhookUrl)) {
          if (sameEvents(stale.events, events)) continue;
          try {
            await whaapyApiRequest.call(this, 'DELETE', `/user-webhooks/${stale.id}`);
          } catch (error) {
            if (!isNotFound(error)) throw error;
          }
        }

        const label = events.includes('*') ? 'all-events' : events.join('+').replace(/\./g, '-');
        const response = await whaapyApiRequest.call(this, 'POST', '/user-webhooks', {
          name: `n8n-${this.getWorkflow().id ?? 'workflow'}-${label}`.slice(0, 100),
          url: webhookUrl,
          events,
        });

        const webhook = (response?.data ?? response?.webhook ?? response) as WhaapyWebhook;
        if (!webhook?.id) {
          throw new NodeOperationError(this.getNode(), 'Whaapy did not return the created webhook ID');
        }
        staticData.webhookId = webhook.id;
        if (webhook.secret) staticData.secret = webhook.secret;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const staticData = this.getWorkflowStaticData('node');
        if (staticData.webhookId) {
          try {
            await whaapyApiRequest.call(this, 'DELETE', `/user-webhooks/${staticData.webhookId}`);
          } catch (error) {
            if (!isNotFound(error)) return false;
          }
        }
        delete staticData.webhookId;
        delete staticData.secret;
        delete staticData.recentDeliveries;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const req = this.getRequestObject();
    const headers = this.getHeaderData() as IDataObject;
    const body = this.getBodyData() as IDataObject;
    const isV1_1 = this.getNode().typeVersion >= 1.1;
    const options = (isV1_1 ? this.getNodeParameter('options', {}) : {}) as IDataObject;
    const staticData = this.getWorkflowStaticData('node');

    if (isV1_1 && options.verifySignature !== false) {
      const secret = await resolveSecret(this, header(headers, 'x-webhook-id'));
      if (secret) {
        const signature = header(headers, 'x-webhook-signature') ?? '';
        const raw = (req as unknown as { rawBody?: Buffer }).rawBody;
        const payload = raw && raw.length > 0 ? raw : Buffer.from(JSON.stringify(body));
        const expected = createHmac('sha256', secret).update(payload).digest('hex');
        const valid =
          signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        if (!valid) {
          const res = this.getResponseObject();
          res.status(401).json({ error: 'Invalid signature' });
          return { noWebhookResponse: true };
        }
      } else {
        this.logger.warn('Whaapy Trigger: webhook secret unavailable, skipping signature verification');
      }
    }

    const incomingEvent = (body.event as string) || (body.type as string) || header(headers, 'x-webhook-event') || '';
    const selectedEvents = getSelectedEvents(this);
    if (!selectedEvents.includes('*') && !selectedEvents.includes(incomingEvent)) {
      return { workflowData: [] };
    }

    const deliveryId = header(headers, 'x-webhook-delivery-id');
    if (isV1_1 && options.ignoreDuplicates !== false && deliveryId) {
      const seen = Array.isArray(staticData.recentDeliveries) ? (staticData.recentDeliveries as string[]) : [];
      if (seen.includes(deliveryId)) return { workflowData: [] };
      staticData.recentDeliveries = [...seen, deliveryId].slice(-MAX_REMEMBERED_DELIVERIES);
    }

    const data = (body.data || body.payload || body) as IDataObject;
    const item: INodeExecutionData = {
      json: {
        event: incomingEvent,
        timestamp: body.timestamp || new Date().toISOString(),
        data,
        headers,
        raw: body,
      },
    };

    if (isV1_1 && options.downloadMedia && typeof data?.media_url === 'string') {
      try {
        item.binary = {
          [(options.binaryPropertyName as string) || 'data']: await downloadMedia(this, data),
        };
      } catch (error) {
        item.json.media_download_error = (error as Error).message;
      }
    }

    return { workflowData: [[item]] };
  }
}

async function resolveSecret(ctx: IWebhookFunctions, headerWebhookId?: string): Promise<string | undefined> {
  const staticData = ctx.getWorkflowStaticData('node');
  const webhookId = headerWebhookId || (staticData.webhookId as string | undefined);
  if (typeof staticData.secret === 'string' && (!headerWebhookId || headerWebhookId === staticData.webhookId)) {
    return staticData.secret;
  }
  if (!webhookId) return undefined;

  try {
    const response = await whaapyApiRequest.call(ctx, 'GET', `/user-webhooks/${encodeURIComponent(webhookId)}`);
    const webhook = (response?.data ?? response) as WhaapyWebhook;
    const ownUrl = normalizeUrl(ctx.getNodeWebhookUrl('default') as string);
    if (!webhook?.secret || normalizeUrl(webhook.url) !== ownUrl) return undefined;
    staticData.webhookId = webhook.id;
    staticData.secret = webhook.secret;
    return webhook.secret;
  } catch (error) {
    ctx.logger.warn(`Whaapy Trigger: could not load webhook secret: ${(error as Error).message}`);
    return undefined;
  }
}

async function downloadMedia(ctx: IWebhookFunctions, data: IDataObject) {
  const response = (await ctx.helpers.httpRequest({
    method: 'GET',
    url: data.media_url as string,
    encoding: 'arraybuffer',
    returnFullResponse: true,
  })) as { body: ArrayBuffer; headers: IDataObject };

  const message = (data.message ?? {}) as IDataObject;
  const media = (message[message.type as string] ?? {}) as IDataObject;
  const contentType = String(response.headers?.['content-type'] ?? media.mime_type ?? 'application/octet-stream');
  const filename = typeof media.filename === 'string' ? media.filename : undefined;

  return ctx.helpers.prepareBinaryData(Buffer.from(response.body), filename, contentType.split(';')[0]);
}
