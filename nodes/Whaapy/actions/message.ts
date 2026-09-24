import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
  buildInteractivePayload,
  mergeTemplateComponents,
  parseJsonParam,
  parseTemplateComponents,
  parseTemplateParameters,
  parseTemplateQuickReplyOverrides,
  parseTemplateUrlButtonParameters,
  whaapyApiRequest,
} from '../GenericFunctions';
import type { OperationResult } from './types';
import { isV1_1, unsupportedOperation } from './types';

const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker'];

function applyMedia(ctx: IExecuteFunctions, i: number, messageType: string, body: IDataObject) {
  const mediaSource = ctx.getNodeParameter('mediaSource', i, 'url') as string;
  const mediaValue = String(
    mediaSource === 'media_id' ? ctx.getNodeParameter('mediaId', i, '') : ctx.getNodeParameter('mediaUrl', i, ''),
  ).trim();

  if (!mediaValue) {
    throw new NodeOperationError(ctx.getNode(), `Media ${mediaSource === 'media_id' ? 'ID' : 'URL'} is required`, {
      itemIndex: i,
    });
  }

  // Workflows created before Media Source existed put Media IDs in the URL field.
  const isLink = mediaSource === 'url' && /^https?:\/\//i.test(mediaValue);
  const media: IDataObject = isLink ? { link: mediaValue } : { id: mediaValue };

  if (['image', 'video', 'document'].includes(messageType)) {
    const caption = ctx.getNodeParameter('caption', i, '') as string;
    if (caption) media.caption = caption;
  }
  if (messageType === 'document') {
    const filename = String(ctx.getNodeParameter('mediaFilename', i, '')).trim();
    if (filename) media.filename = filename;
  }
  if (messageType === 'audio' && ctx.getNodeParameter('voiceNote', i, false)) {
    media.voice = true;
  }

  body[messageType] = media;
}

function mappedTemplateValues(ctx: IExecuteFunctions, i: number) {
  if (!isV1_1(ctx)) return { body: [] as string[], buttons: [] as IDataObject[] };

  const mapper = ctx.getNodeParameter('templateVariables', i, {}) as { value?: IDataObject | null };
  const values = mapper?.value ?? {};
  const bodyEntries: Array<[number, string]> = [];
  const buttons: IDataObject[] = [];

  for (const [key, raw] of Object.entries(values)) {
    if (raw === undefined || raw === null) continue;
    const value = String(raw);
    const bodyMatch = /^body_(\d+)$/.exec(key);
    if (bodyMatch) {
      bodyEntries.push([Number(bodyMatch[1]), value]);
      continue;
    }
    const buttonMatch = /^button_(\d+)$/.exec(key);
    if (buttonMatch && value.trim()) {
      buttons.push({
        type: 'button',
        sub_type: 'url',
        index: buttonMatch[1],
        parameters: [{ type: 'text', text: value.trim() }],
      });
    }
  }

  const body: string[] = [];
  for (const [index, value] of bodyEntries.sort(([a], [b]) => a - b)) {
    body[index - 1] = value;
  }
  return { body: Array.from(body, (value) => value ?? ''), buttons };
}

function applyTemplate(ctx: IExecuteFunctions, i: number, body: IDataObject) {
  const strict = isV1_1(ctx);
  const templateName = String(ctx.getNodeParameter('templateName', i, '', { extractValue: true }) ?? '').trim();
  if (!templateName) {
    throw new NodeOperationError(ctx.getNode(), 'Template name is required', { itemIndex: i });
  }

  const selectedLanguage = ctx.getNodeParameter('templateLanguage', i) as string;
  const templateLanguage =
    selectedLanguage === '__custom__'
      ? String(ctx.getNodeParameter('templateLanguageCustom', i, '')).trim()
      : selectedLanguage;
  if (!templateLanguage) {
    throw new NodeOperationError(
      ctx.getNode(),
      'Template language is required. Select a language or enter a custom language code.',
      { itemIndex: i },
    );
  }

  body.templateName = templateName;
  body.language = templateLanguage;

  const options = ctx.getNodeParameter('templateOptions', i, {}) as IDataObject;
  const mapped = mappedTemplateValues(ctx, i);
  const bodyParameters = mapped.body.length > 0 ? mapped.body : parseTemplateParameters(options.parameters);
  if (bodyParameters.length > 0) body.template_parameters = bodyParameters;

  const components: IDataObject[] = [];

  const headerUrl = typeof options.headerMediaUrl === 'string' ? options.headerMediaUrl.trim() : '';
  const headerId = typeof options.headerMediaId === 'string' ? options.headerMediaId.trim() : '';
  const headerSource = (options.headerMediaSource as string) || 'url';

  if (headerUrl && headerId) {
    throw new NodeOperationError(
      ctx.getNode(),
      'Template header media is ambiguous. Provide either Header Media URL or Header Media ID, not both.',
      { itemIndex: i },
    );
  }

  const headerType = options.headerMediaType as string | undefined;
  if ((headerUrl || headerId) && !headerType && strict) {
    throw new NodeOperationError(ctx.getNode(), 'Select a Header Media Type in Template Options to send header media', {
      itemIndex: i,
    });
  }

  if (headerType && (headerUrl || headerId)) {
    const useId = headerSource === 'media_id' ? Boolean(headerId) : !headerUrl;
    body.header_media = useId ? { type: headerType, media_id: headerId } : { type: headerType, url: headerUrl };
    components.push({
      type: 'header',
      parameters: [{ type: headerType, [headerType]: useId ? { id: headerId } : { link: headerUrl } }],
    });
  }

  if (bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters.map((text) => ({ type: 'text', text })),
    });
  }

  const urlButtons = [
    ...parseTemplateUrlButtonParameters(options.urlButtonParameters, strict).map((override) => ({
      type: 'button',
      sub_type: 'url',
      index: override.index,
      parameters: override.parameters,
    })),
    ...mapped.buttons,
  ];

  let merged = mergeTemplateComponents(components, [
    ...urlButtons,
    ...parseTemplateComponents(options.templateComponents, strict),
  ]);

  if (options.allowButtonIdOverride) {
    body.allowButtonIdOverride = true;
    const overrides = Object.entries(parseTemplateQuickReplyOverrides(options.quickReplyPayloadOverrides, strict));
    if (overrides.length > 0) {
      body.quickReplyPayloadOverrides = Object.fromEntries(
        overrides.map(([index, payload]) => [String(index), String(payload)]),
      );
      merged = mergeTemplateComponents(
        merged,
        overrides.map(([index, payload]) => ({
          type: 'button',
          sub_type: 'quick_reply',
          index,
          parameters: [{ type: 'payload', payload }],
        })),
      );
    }
  }

  if (merged.length > 0) {
    body.template = {
      name: templateName,
      language: { code: templateLanguage, policy: 'deterministic' },
      components: merged,
    };
  }
}

function applyInteractive(ctx: IExecuteFunctions, i: number, body: IDataObject) {
  const interactiveType = ctx.getNodeParameter('interactiveType', i) as string;
  const headerMediaSource = ctx.getNodeParameter('interactiveHeaderMediaSource', i, 'url') as string;

  let buttons: Array<{ title: string; id?: string }> = [];
  if (interactiveType === 'button') {
    const data = ctx.getNodeParameter('interactiveButtons', i, { buttonValues: [] }) as {
      buttonValues?: Array<{ title: string; id?: string }>;
    };
    buttons = data.buttonValues || [];
  }

  let sections: Array<{ title?: string; rows: Array<{ title: string; description?: string; id?: string }> }> = [];
  let listButtonText = '';
  if (interactiveType === 'list') {
    listButtonText = ctx.getNodeParameter('interactiveListButtonText', i, 'Ver Opciones') as string;
    const data = ctx.getNodeParameter('interactiveSections', i, { sectionValues: [] }) as {
      sectionValues?: Array<{
        title?: string;
        rows?: { rowValues?: Array<{ title: string; description?: string; id?: string }> };
      }>;
    };
    sections = (data.sectionValues || []).map((section) => ({
      title: section.title,
      rows: section.rows?.rowValues || [],
    }));
  }

  body.interactive = buildInteractivePayload({
    interactiveType,
    bodyText: ctx.getNodeParameter('interactiveBodyText', i) as string,
    headerType: ctx.getNodeParameter('interactiveHeaderType', i, 'none') as string,
    headerText: ctx.getNodeParameter('interactiveHeaderText', i, '') as string,
    headerMediaUrl:
      headerMediaSource === 'url' ? String(ctx.getNodeParameter('interactiveHeaderMediaUrl', i, '')).trim() : '',
    headerMediaId:
      headerMediaSource === 'media_id' ? String(ctx.getNodeParameter('interactiveHeaderMediaId', i, '')).trim() : '',
    footerText: ctx.getNodeParameter('interactiveFooterText', i, '') as string,
    buttons,
    listButtonText,
    sections,
    ctaButtonText: interactiveType === 'cta_url' ? (ctx.getNodeParameter('ctaButtonText', i, '') as string) : '',
    ctaButtonUrl: interactiveType === 'cta_url' ? (ctx.getNodeParameter('ctaButtonUrl', i, '') as string) : '',
  });
}

function applyAdditionalFields(ctx: IExecuteFunctions, i: number, body: IDataObject) {
  const fields = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
  const ai: IDataObject = {};
  if (fields.pauseAi) ai.pause = fields.pauseAi;
  if (fields.pauseDuration) ai.pauseDuration = fields.pauseDuration;
  if (fields.disableAi) ai.disable = fields.disableAi;
  if (Object.keys(ai).length > 0) body.ai = ai;

  if (fields.replyTo) body.context = { message_id: fields.replyTo };
  if (fields.createConversation !== undefined) body.createConversation = fields.createConversation;
  if (fields.metadata) body.metadata = parseJsonParam(ctx, fields.metadata, 'Metadata', i, {});

  if (fields.previewUrl && typeof body.content === 'string') {
    body.text = { body: body.content, preview_url: true };
    delete body.content;
  }
}

async function send(this: IExecuteFunctions, i: number): Promise<IDataObject> {
  const messageType = this.getNodeParameter('messageType', i) as string;
  const body: IDataObject = { type: messageType };

  if (this.getNodeParameter('sendTo', i, 'phone') === 'conversation') {
    const conversationId = String(this.getNodeParameter('sendConversationId', i, '')).trim();
    if (!conversationId) {
      throw new NodeOperationError(this.getNode(), 'Conversation ID is required', { itemIndex: i });
    }
    body.conversationId = conversationId;
  } else {
    body.to = this.getNodeParameter('to', i) as string;
  }

  if (messageType === 'text') {
    body.content = this.getNodeParameter('textContent', i) as string;
  } else if (MEDIA_TYPES.includes(messageType)) {
    applyMedia(this, i, messageType, body);
  } else if (messageType === 'template') {
    applyTemplate(this, i, body);
  } else if (messageType === 'interactive') {
    applyInteractive(this, i, body);
  } else if (messageType === 'location') {
    const latitude = Number(this.getNodeParameter('latitude', i));
    const longitude = Number(this.getNodeParameter('longitude', i));
    if (latitude === 0 && longitude === 0) {
      throw new NodeOperationError(this.getNode(), 'Latitude and Longitude are required for location messages', {
        itemIndex: i,
      });
    }
    body.location = {
      latitude,
      longitude,
      name: (this.getNodeParameter('locationName', i, '') as string) || undefined,
      address: (this.getNodeParameter('locationAddress', i, '') as string) || undefined,
    };
  } else if (messageType === 'contacts') {
    body.contacts = parseJsonParam(this, this.getNodeParameter('contactsData', i), 'Contacts', i, []);
  } else if (messageType === 'reaction') {
    body.reaction = {
      message_id: this.getNodeParameter('reactionMessageId', i) as string,
      emoji: this.getNodeParameter('reactionEmoji', i) as string,
    };
  }

  applyAdditionalFields(this, i, body);

  return whaapyApiRequest.call(this, 'POST', '/messages/v1', body, undefined, i);
}

export async function messageHandler(this: IExecuteFunctions, i: number, operation: string): Promise<OperationResult> {
  if (operation === 'send') return send.call(this, i);
  if (operation === 'retry') {
    const messageId = this.getNodeParameter('messageId', i) as string;
    return whaapyApiRequest.call(this, 'POST', `/messages/v1/${encodeURIComponent(messageId)}/retry`, undefined, undefined, i);
  }
  return unsupportedOperation(this, 'message', operation, i);
}
