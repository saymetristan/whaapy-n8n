import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

import { executeWhaapyOperation } from './actions/router';
import { broadcastProperties } from './descriptions/BroadcastDescription';
import { contactExtraProperties } from './descriptions/ContactExtraDescription';
import { teamProperties } from './descriptions/TeamDescription';
import {
  forVersion,
  funnelStageLocator,
  templateIdLocator,
  templateNameLocator,
  V1,
  V1_1,
} from './descriptions/common';
import { listSearch, loadOptions, resourceMapping } from './methods';

export class Whaapy implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Whaapy',
    name: 'whaapy',
    icon: 'file:whaapy.svg',
    group: ['output'],
    version: [1, 1.1],
    defaultVersion: 1.1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'WhatsApp Business API with AI - Send messages, manage conversations, contacts, broadcasts and AI agents',
    defaults: {
      name: 'Whaapy',
    },
    usableAsTool: true,
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'whaapyApi',
        required: true,
      },
    ],
    properties: [
      // ===========================================
      // RESOURCE SELECTOR
      // ===========================================
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Agent', value: 'agent' },
          { name: 'Broadcast', value: 'broadcast' },
          { name: 'Contact', value: 'contact' },
          { name: 'Conversation', value: 'conversation' },
          { name: 'Funnel', value: 'funnel' },
          { name: 'Media', value: 'media' },
          { name: 'Message', value: 'message' },
          { name: 'Team', value: 'team' },
          { name: 'Template', value: 'template' },
        ],
        default: 'message',
      },

      ...broadcastProperties,
      ...teamProperties,

      // ===========================================
      // MESSAGE OPERATIONS
      // ===========================================
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['message'] },
        },
        options: [
          {
            name: 'Send',
            value: 'send',
            action: 'Send a message',
            description: 'Send a WhatsApp message',
          },
          {
            name: 'Retry',
            value: 'retry',
            action: 'Retry a failed message',
            description: 'Retry sending a failed message',
          },
        ],
        default: 'send',
      },

      // Message: Send - Recipient
      {
        displayName: 'Send To',
        name: 'sendTo',
        type: 'options',
        noDataExpression: true,
        default: 'phone',
        options: [
          { name: 'Phone Number', value: 'phone' },
          { name: 'Conversation ID', value: 'conversation' },
        ],
        displayOptions: {
          show: { resource: ['message'], operation: ['send'] },
        },
      },
      {
        displayName: 'To',
        name: 'to',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+5215512345678',
        description: 'Phone number with country code',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], sendTo: ['phone'] },
        },
      },
      {
        displayName: 'Conversation ID',
        name: 'sendConversationId',
        type: 'string',
        required: true,
        default: '',
        description: 'Whaapy conversation ID to reply in (e.g. from the Whaapy Trigger: data.conversation_id)',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], sendTo: ['conversation'] },
        },
      },

      // Message: Send - Type
      {
        displayName: 'Message Type',
        name: 'messageType',
        type: 'options',
        required: true,
        options: [
          { name: 'Text', value: 'text' },
          { name: 'Image', value: 'image' },
          { name: 'Video', value: 'video' },
          { name: 'Audio', value: 'audio' },
          { name: 'Document', value: 'document' },
          { name: 'Template', value: 'template' },
          { name: 'Interactive', value: 'interactive' },
          { name: 'Location', value: 'location' },
          { name: 'Contacts', value: 'contacts' },
          { name: 'Sticker', value: 'sticker' },
          { name: 'Reaction', value: 'reaction' },
        ],
        default: 'text',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'] },
        },
      },

      // Message: Send - Text content
      {
        displayName: 'Message Text',
        name: 'textContent',
        type: 'string',
        typeOptions: { rows: 3 },
        required: true,
        default: '',
        description: 'The text content of the message',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['text'] },
        }      },

      // Message: Send - Media source (for image, video, audio, document, sticker)
      {
        displayName: 'Media Source',
        name: 'mediaSource',
        type: 'options',
        default: 'url',
        options: [
          { name: 'URL', value: 'url' },
          { name: 'Media ID', value: 'media_id' },
        ],
        description: 'Send a public URL or a Media ID returned by Media → Upload',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['image', 'video', 'audio', 'document', 'sticker'],
          },
        },
      },
      {
        displayName: 'Media URL',
        name: 'mediaUrl',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'https://example.com/image.jpg',
        description: 'Public URL of the media file',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['image', 'video', 'audio', 'document', 'sticker'],
            mediaSource: ['url'],
          },
        },
      },
      {
        displayName: 'Media ID',
        name: 'mediaId',
        type: 'string',
        required: true,
        default: '',
        placeholder: '155857201882704',
        description: 'Meta Media ID uploaded to the same WhatsApp number (Media → Upload output). Meta keeps it for 30 days.',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['image', 'video', 'audio', 'document', 'sticker'],
            mediaSource: ['media_id'],
          },
        },
      },
      {
        displayName: 'Filename',
        name: 'mediaFilename',
        type: 'string',
        default: '',
        placeholder: 'cotizacion.pdf',
        description: 'Filename shown to the recipient',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['document'] },
        },
      },
      {
        displayName: 'Send as Voice Note',
        name: 'voiceNote',
        type: 'boolean',
        default: false,
        description: 'Whether to send the audio as a push-to-talk voice note (OGG/Opus recommended)',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['audio'] },
        },
      },

      // Message: Send - Caption (for media)
      {
        displayName: 'Caption',
        name: 'caption',
        type: 'string',
        default: '',
        description: 'Caption for the media',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['image', 'video', 'document'],
          },
        },
      },

      // Message: Send - Template name
      forVersion(
        {
          displayName: 'Template Name',
          name: 'templateName',
          type: 'string',
          required: true,
          default: '',
          placeholder: 'orden_confirmada',
          description: 'Exact name of the WhatsApp template as it appears in Meta Business Manager',
          displayOptions: {
            show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
          },
        },
        V1,
      ),
      forVersion(
        templateNameLocator({ resource: ['message'], operation: ['send'], messageType: ['template'] }),
        V1_1,
      ),

      // Message: Send - Template Language
      {
        displayName: 'Language',
        name: 'templateLanguage',
        type: 'options',
        default: 'es_MX',
        description: 'Template language code',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
        },
        options: [
          { name: 'Afrikaans', value: 'af' },
          { name: 'Albanian', value: 'sq' },
          { name: 'Arabic', value: 'ar' },
          { name: 'Azerbaijani', value: 'az' },
          { name: 'Bengali', value: 'bn' },
          { name: 'Bulgarian', value: 'bg' },
          { name: 'Catalan', value: 'ca' },
          { name: 'Chinese (China)', value: 'zh_CN' },
          { name: 'Chinese (Hong Kong)', value: 'zh_HK' },
          { name: 'Chinese (Taiwan)', value: 'zh_TW' },
          { name: 'Croatian', value: 'hr' },
          { name: 'Czech', value: 'cs' },
          { name: 'Danish', value: 'da' },
          { name: 'Dutch', value: 'nl' },
          { name: 'English', value: 'en' },
          { name: 'English (UK)', value: 'en_GB' },
          { name: 'English (US)', value: 'en_US' },
          { name: 'Estonian', value: 'et' },
          { name: 'Filipino', value: 'fil' },
          { name: 'Finnish', value: 'fi' },
          { name: 'French', value: 'fr' },
          { name: 'Georgian', value: 'ka' },
          { name: 'German', value: 'de' },
          { name: 'Greek', value: 'el' },
          { name: 'Gujarati', value: 'gu' },
          { name: 'Hausa', value: 'ha' },
          { name: 'Hebrew', value: 'he' },
          { name: 'Hindi', value: 'hi' },
          { name: 'Hungarian', value: 'hu' },
          { name: 'Indonesian', value: 'id' },
          { name: 'Irish', value: 'ga' },
          { name: 'Italian', value: 'it' },
          { name: 'Japanese', value: 'ja' },
          { name: 'Kannada', value: 'kn' },
          { name: 'Kazakh', value: 'kk' },
          { name: 'Kinyarwanda', value: 'rw_RW' },
          { name: 'Kyrgyz (Kyrgyzstan)', value: 'ky_KG' },
          { name: 'Korean', value: 'ko' },
          { name: 'Lao', value: 'lo' },
          { name: 'Latvian', value: 'lv' },
          { name: 'Lithuanian', value: 'lt' },
          { name: 'Macedonian', value: 'mk' },
          { name: 'Malay', value: 'ms' },
          { name: 'Malayalam', value: 'ml' },
          { name: 'Marathi', value: 'mr' },
          { name: 'Norwegian', value: 'nb' },
          { name: 'Persian', value: 'fa' },
          { name: 'Polish', value: 'pl' },
          { name: 'Portuguese (Brazil)', value: 'pt_BR' },
          { name: 'Portuguese (Portugal)', value: 'pt_PT' },
          { name: 'Punjabi', value: 'pa' },
          { name: 'Romanian', value: 'ro' },
          { name: 'Russian', value: 'ru' },
          { name: 'Serbian', value: 'sr' },
          { name: 'Slovak', value: 'sk' },
          { name: 'Slovenian', value: 'sl' },
          { name: 'Spanish', value: 'es' },
          { name: 'Spanish (Argentina)', value: 'es_AR' },
          { name: 'Spanish (Mexico)', value: 'es_MX' },
          { name: 'Spanish (Spain)', value: 'es_ES' },
          { name: 'Swahili', value: 'sw' },
          { name: 'Swedish', value: 'sv' },
          { name: 'Tamil', value: 'ta' },
          { name: 'Telugu', value: 'te' },
          { name: 'Thai', value: 'th' },
          { name: 'Turkish', value: 'tr' },
          { name: 'Ukrainian', value: 'uk' },
          { name: 'Urdu', value: 'ur' },
          { name: 'Uzbek', value: 'uz' },
          { name: 'Vietnamese', value: 'vi' },
          { name: 'Zulu', value: 'zu' },
          { name: 'Custom (Enter Manually)', value: '__custom__' },
        ],
      },
      {
        displayName: 'Custom Language Code',
        name: 'templateLanguageCustom',
        type: 'string',
        default: '',
        placeholder: 'e.g. en_AU',
        description: 'Custom WhatsApp template locale code',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['template'],
            templateLanguage: ['__custom__'],
          },
        },
      },

      forVersion(
        {
          displayName: 'Template Variables',
          name: 'templateVariables',
          type: 'resourceMapper',
          noDataExpression: true,
          default: { mappingMode: 'defineBelow', value: null },
          typeOptions: {
            loadOptionsDependsOn: ['templateName.value', 'templateLanguage', 'templateLanguageCustom'],
            resourceMapper: {
              resourceMapperMethod: 'getTemplateVariableFields',
              mode: 'add',
              fieldWords: { singular: 'variable', plural: 'variables' },
              addAllFields: true,
              multiKeyMatch: false,
              supportAutoMap: false,
              noFieldsError: 'This template has no body or URL button variables',
            },
          },
          description: 'Values for the {{n}} placeholders of the selected template. Leave empty to use Template Options → Body Parameters instead.',
          displayOptions: {
            show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
          },
        },
        V1_1,
      ),

      // Message: Send - Template Additional Options
      {
        displayName: 'Template Options',
        name: 'templateOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
        },
        options: [
          {
            displayName: 'Body Parameters',
            name: 'parameters',
            type: 'string',
            default: '',
            placeholder: 'Juan Pérez, #ORD-12345, $1500',
            description: 'Comma-separated values for {{1}}, {{2}}, etc. placeholders in the template body',
          },
          {
            displayName: 'Header Media Type',
            name: 'headerMediaType',
            type: 'options',
            default: 'image',
            options: [
              { name: 'Image', value: 'image' },
              { name: 'Video', value: 'video' },
              { name: 'Document', value: 'document' },
            ]          },
          {
            displayName: 'Header Media Source',
            name: 'headerMediaSource',
            type: 'options',
            default: 'url',
            options: [
              { name: 'URL', value: 'url' },
              { name: 'Media ID', value: 'media_id' },
            ],
            description: 'Choose whether to send a public URL or a previously uploaded Meta Media ID',
          },
          {
            displayName: 'Header Media URL',
            name: 'headerMediaUrl',
            type: 'string',
            default: '',
            placeholder: 'https://example.com/image.jpg',
            description: 'Public URL of the media file for header (used when Header Media Source = URL)',
          },
          {
            displayName: 'Header Media ID',
            name: 'headerMediaId',
            type: 'string',
            default: '',
            placeholder: '155857201882704',
            description: 'Meta Media ID previously uploaded in the same WhatsApp account (used when Header Media Source = Media ID)',
          },
          {
            displayName: 'Allow Button Payload Override',
            name: 'allowButtonIdOverride',
            type: 'boolean',
            default: false,
            description: 'If enabled, lets this request override quick-reply payload IDs configured in the business template',
          },
          {
            displayName: 'Quick Reply Payload Overrides',
            name: 'quickReplyPayloadOverrides',
            type: 'json',
            default: '{}',
            description: 'Advanced. JSON map index->payload (e.g. {"0":"confirm_order","1":"talk_to_agent"}) or array [{index,payload}]',
          },
          {
            displayName: 'URL Button Parameters',
            name: 'urlButtonParameters',
            type: 'json',
            default: '[]',
            description: 'JSON array for dynamic URL buttons. Example: [{"index":1,"text":"ENV-789"}]',
          },
          {
            displayName: 'Template Components',
            name: 'templateComponents',
            type: 'json',
            default: '[]',
            description: 'Advanced. Raw Meta template components array. Merged after body/header fields and can override them.',
          },
        ],
      },

      // ===========================================
      // INTERACTIVE MESSAGE FIELDS (Structured)
      // ===========================================

      // Interactive: Type selector (button, list, or cta_url)
      {
        displayName: 'Interactive Type',
        name: 'interactiveType',
        type: 'options',
        required: true,
        options: [
          { name: 'Buttons (Reply Buttons)', value: 'button' },
          { name: 'List (Menu)', value: 'list' },
          { name: 'CTA URL (Link Button)', value: 'cta_url' },
        ],
        default: 'button',
        description: 'Type of interactive message. Buttons: up to 3 reply options. List: menu with sections. CTA URL: single button that opens a URL.',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['interactive'] },
        },
      },

      // Interactive: Body text (required)
      {
        displayName: 'Body Text',
        name: 'interactiveBodyText',
        type: 'string',
        typeOptions: { rows: 3 },
        required: true,
        default: '',
        placeholder: '¿Cómo podemos ayudarte hoy?',
        description: 'Main text of the message. Max 1024 characters.',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['interactive'] },
        },
      },

      // Interactive: Header type (optional)
      {
        displayName: 'Header Type',
        name: 'interactiveHeaderType',
        type: 'options',
        default: 'none',
        options: [
          { name: 'None', value: 'none' },
          { name: 'Text', value: 'text' },
          { name: 'Image', value: 'image' },
          { name: 'Video', value: 'video' },
          { name: 'Document', value: 'document' },
        ],
        description: 'Optional header for the message',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['interactive'] },
        },
      },

      // Interactive: Header text (if type=text)
      {
        displayName: 'Header Text',
        name: 'interactiveHeaderText',
        type: 'string',
        default: '',
        placeholder: '🍕 Pizzería Whaapy',
        description: 'Header text. Max 60 characters.',
        displayOptions: {
          show: { 
            resource: ['message'], 
            operation: ['send'], 
            messageType: ['interactive'],
            interactiveHeaderType: ['text'],
            
          },
        },
      },

      // Interactive: Header media (if type=image|video|document)
      {
        displayName: 'Header Media Source',
        name: 'interactiveHeaderMediaSource',
        type: 'options',
        default: 'url',
        options: [
          { name: 'URL', value: 'url' },
          { name: 'Media ID', value: 'media_id' },
        ],
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['interactive'],
            interactiveHeaderType: ['image', 'video', 'document'],
          },
        },
      },
      {
        displayName: 'Header Media URL',
        name: 'interactiveHeaderMediaUrl',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/image.jpg',
        description: 'Public URL of the media file for header',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['interactive'],
            interactiveHeaderType: ['image', 'video', 'document'],
            interactiveHeaderMediaSource: ['url'],
          },
        },
      },
      {
        displayName: 'Header Media ID',
        name: 'interactiveHeaderMediaId',
        type: 'string',
        default: '',
        placeholder: '155857201882704',
        description: 'Media ID returned by Media → Upload',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['interactive'],
            interactiveHeaderType: ['image', 'video', 'document'],
            interactiveHeaderMediaSource: ['media_id'],
          },
        },
      },

      // Interactive: Footer text (optional)
      {
        displayName: 'Footer Text',
        name: 'interactiveFooterText',
        type: 'string',
        default: '',
        placeholder: 'Responde con una opción',
        description: 'Optional footer text in gray. Max 60 characters. Leave empty to omit.',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['interactive'] },
        },
      },

      // Interactive: Buttons (if type=button)
      {
        displayName: 'Buttons',
        name: 'interactiveButtons',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
          maxValue: 3,
        },
        default: { buttonValues: [] },
        description: 'Reply buttons (1-3). Users tap to respond.',
        displayOptions: {
          show: { 
            resource: ['message'], 
            operation: ['send'], 
            messageType: ['interactive'],
            interactiveType: ['button'],
            
          },
        },
        options: [
          {
            displayName: 'Button',
            name: 'buttonValues',
            values: [
              {
                displayName: 'Title',
                name: 'title',
                type: 'string',
                required: true,
                default: '',
                placeholder: 'Ver Menú',
                description: 'Button text visible to user. Max 20 characters.',
              },
              {
                displayName: 'ID',
                name: 'id',
                type: 'string',
                default: '',
                placeholder: 'ver_menu (optional, auto-generated if empty)',
                description: 'Unique ID returned in webhook when user clicks. If empty, generated from title.',
              },
            ],
          },
        ],
      },

      // Interactive: List button text (if type=list)
      {
        displayName: 'List Button Text',
        name: 'interactiveListButtonText',
        type: 'string',
        required: true,
        default: 'Ver Opciones',
        placeholder: 'Ver Menú',
        description: 'Text for the button that opens the list menu. Max 20 characters.',
        displayOptions: {
          show: { 
            resource: ['message'], 
            operation: ['send'], 
            messageType: ['interactive'],
            interactiveType: ['list'],
            
          },
        },
      },

      // Interactive: Sections (if type=list)
      {
        displayName: 'Sections',
        name: 'interactiveSections',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
          maxValue: 10,
        },
        default: { sectionValues: [] },
        description: 'Menu sections. Each section has a title and rows (options).',
        displayOptions: {
          show: { 
            resource: ['message'], 
            operation: ['send'], 
            messageType: ['interactive'],
            interactiveType: ['list'],
            
          },
        },
        options: [
          {
            displayName: 'Section',
            name: 'sectionValues',
            values: [
              {
                displayName: 'Section Title',
                name: 'title',
                type: 'string',
                default: '',
                placeholder: 'Pizzas',
                description: 'Section title. Required if more than 1 section. Max 24 characters.',
              },
              {
                displayName: 'Rows',
                name: 'rows',
                type: 'fixedCollection',
                typeOptions: {
                  multipleValues: true,
                  maxValue: 10,
                },
                default: { rowValues: [] },
                description: 'Options in this section',
                options: [
                  {
                    displayName: 'Row',
                    name: 'rowValues',
                    values: [
                      {
                        displayName: 'Title',
                        name: 'title',
                        type: 'string',
                        required: true,
                        default: '',
                        placeholder: 'Margarita',
                        description: 'Row title. Max 24 characters.',
                      },
                      {
                        displayName: 'Description',
                        name: 'description',
                        type: 'string',
                        default: '',
                        placeholder: 'Tomate, mozzarella - $150',
                        description: 'Row description. Optional. Max 72 characters.',
                      },
                      {
                        displayName: 'ID',
                        name: 'id',
                        type: 'string',
                        default: '',
                        placeholder: 'pizza_margarita (optional)',
                        description: 'Unique ID returned in webhook. If empty, generated from title.',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },

      // Interactive: CTA URL Button Text (if type=cta_url)
      {
        displayName: 'Button Text',
        name: 'ctaButtonText',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'Ver Sitio Web',
        description: 'Text displayed on the button. Max 20 characters.',
        displayOptions: {
          show: { 
            resource: ['message'], 
            operation: ['send'], 
            messageType: ['interactive'],
            interactiveType: ['cta_url'],
          },
        },
      },

      // Interactive: CTA URL Button URL (if type=cta_url)
      {
        displayName: 'Button URL',
        name: 'ctaButtonUrl',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'https://example.com/page',
        description: 'URL that opens when the user taps the button.',
        displayOptions: {
          show: { 
            resource: ['message'], 
            operation: ['send'], 
            messageType: ['interactive'],
            interactiveType: ['cta_url'],
          },
        },
      },


      // Message: Send - Location
      {
        displayName: 'Latitude',
        name: 'latitude',
        type: 'number',
        required: true,
        default: 0,
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
        }      },
      {
        displayName: 'Longitude',
        name: 'longitude',
        type: 'number',
        required: true,
        default: 0,
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
        }      },
      {
        displayName: 'Location Name',
        name: 'locationName',
        type: 'string',
        default: '',
        description: 'Name of the location (e.g., "Starbucks Centro")',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
        }      },
      {
        displayName: 'Address',
        name: 'locationAddress',
        type: 'string',
        default: '',
        description: 'Address of the location (e.g., "Av. Reforma 123, CDMX")',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
        }      },

      // Message: Send - Contacts
      {
        displayName: 'Contacts',
        name: 'contactsData',
        type: 'json',
        required: true,
        default: `[
  {
    "name": {
      "formatted_name": "Juan Pérez",
      "first_name": "Juan",
      "last_name": "Pérez"
    },
    "phones": [
      { "phone": "+5215512345678", "type": "WORK" }
    ],
    "emails": [
      { "email": "juan@empresa.com", "type": "WORK" }
    ],
    "org": {
      "company": "Empresa SA",
      "title": "Director"
    }
  }
]`,
        description: 'Array of contact cards to send. Each contact needs: name.formatted_name (required), phones[].phone (required). Optional: emails, org, addresses.',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['contacts'] },
        }      },

      // Message: Send - Reaction
      {
        displayName: 'Message ID to React',
        name: 'reactionMessageId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['reaction'] },
        }      },
      {
        displayName: 'Emoji',
        name: 'reactionEmoji',
        type: 'string',
        required: true,
        default: '👍',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['reaction'] },
        }      },

      // Message: Send - Additional Fields
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: { resource: ['message'], operation: ['send'] },
        },
        options: [
          {
            displayName: 'Pause AI',
            name: 'pauseAi',
            type: 'boolean',
            default: false,
            description: 'Pause AI after sending this message'          },
          {
            displayName: 'Pause Duration (Minutes)',
            name: 'pauseDuration',
            type: 'number',
            default: 5,
            description: 'How long to pause AI (1-1440 minutes)'          },
          {
            displayName: 'Disable AI',
            name: 'disableAi',
            type: 'boolean',
            default: false,
            description: 'Permanently disable AI for this conversation'          },
          {
            displayName: 'Reply To Message ID',
            name: 'replyTo',
            type: 'string',
            default: '',
            description: 'Message ID to reply to'          },
          {
            displayName: 'Create Conversation',
            name: 'createConversation',
            type: 'boolean',
            default: true,
            description: 'Create a conversation if it doesn\'t exist'          },
          {
            displayName: 'Metadata',
            name: 'metadata',
            type: 'json',
            default: '{}',
            description: 'Custom metadata to attach to the message'          },
          {
            displayName: 'Link Preview',
            name: 'previewUrl',
            type: 'boolean',
            default: false,
            description: 'Whether WhatsApp should render a preview for the first URL in a text message',
          },
        ],
      },

      // Message: Retry - Message ID
      {
        displayName: 'Message ID',
        name: 'messageId',
        type: 'string',
        required: true,
        default: '',
        description: 'ID of the failed message to retry',
        displayOptions: {
          show: { resource: ['message'], operation: ['retry'] },
        },
      },

      // ===========================================
      // MEDIA OPERATIONS
      // ===========================================
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['media'] },
        },
        options: [
          {
            name: 'Upload',
            value: 'upload',
            action: 'Upload media',
            description: 'Upload media to WhatsApp CDN'          },
        ],
        default: 'upload',
      },

      // Media: Upload - Type
      {
        displayName: 'Media Type',
        name: 'mediaType',
        type: 'options',
        required: true,
        options: [
          { name: 'Image', value: 'image' },
          { name: 'Video', value: 'video' },
          { name: 'Audio', value: 'audio' },
          { name: 'Document', value: 'document' },
          { name: 'Sticker', value: 'sticker' },
        ],
        default: 'image',
        displayOptions: {
          show: { resource: ['media'], operation: ['upload'] },
        }      },

      // Media: Upload - Binary property
      {
        displayName: 'Binary Property',
        name: 'binaryPropertyName',
        type: 'string',
        required: true,
        default: 'data',
        description: 'Name of the binary property containing the file',
        displayOptions: {
          show: { resource: ['media'], operation: ['upload'] },
        },
      },

      // ===========================================
      // CONVERSATION OPERATIONS
      // ===========================================
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['conversation'] },
        },
        options: [
          {
            name: 'List',
            value: 'list',
            action: 'List conversations',
            description: 'Get all conversations'          },
          {
            name: 'Get',
            value: 'get',
            action: 'Get a conversation',
            description: 'Get a specific conversation',
          },
          {
            name: 'Get by Phone',
            value: 'getByPhone',
            action: 'Get conversation by phone',
            description: 'Find conversation by phone number',
          },
          {
            name: 'Get Messages',
            value: 'getMessages',
            action: 'Get conversation messages',
            description: 'Get message history of a conversation',
          },
          {
            name: 'Close',
            value: 'close',
            action: 'Close a conversation',
            description: 'Close a conversation',
          },
          {
            name: 'Archive',
            value: 'archive',
            action: 'Archive a conversation',
            description: 'Archive a conversation',
          },
          {
            name: 'Mark Read',
            value: 'markRead',
            action: 'Mark conversation as read',
            description: 'Mark a conversation as read',
          },
          {
            name: 'Mark Unread',
            value: 'markUnread',
            action: 'Mark conversation as unread',
            description: 'Mark a conversation as unread so it shows up in the inbox again',
          },
          {
            name: 'Set AI',
            value: 'setAi',
            action: 'Enable disable ai',
            description: 'Enable or disable AI for a conversation',
          },
          {
            name: 'Pause AI',
            value: 'pauseAi',
            action: 'Pause AI temporarily',
            description: 'Pause AI for a conversation',
          },
          {
            name: 'AI Suggest',
            value: 'aiSuggest',
            action: 'Get AI suggestion',
            description: 'Get an AI suggestion without sending',
          },
        ],
        default: 'list',
      },

      // Conversation: ID field
      {
        displayName: 'Conversation ID',
        name: 'conversationId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['conversation'],
            operation: ['get', 'getMessages', 'close', 'archive', 'markRead', 'markUnread', 'setAi', 'pauseAi', 'aiSuggest'],
          },
        },
      },

      // Conversation: Phone number field
      {
        displayName: 'Phone Number',
        name: 'phoneNumber',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+5215512345678',
        displayOptions: {
          show: { resource: ['conversation'], operation: ['getByPhone'] },
        },
      },

      // Conversation: Set AI - Enabled
      {
        displayName: 'AI Enabled',
        name: 'aiEnabled',
        type: 'boolean',
        required: true,
        default: true,
        displayOptions: {
          show: { resource: ['conversation'], operation: ['setAi'] },
        }      },

      // Conversation: Pause AI - Duration
      {
        displayName: 'Pause Duration (Minutes)',
        name: 'pauseDurationConv',
        type: 'number',
        required: true,
        default: 5,
        description: 'How long to pause AI (1-1440 minutes)',
        displayOptions: {
          show: { resource: ['conversation'], operation: ['pauseAi'] },
        }      },

      // Conversation: List - Return All toggle (paginación nativa n8n)
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
        displayOptions: {
          show: { resource: ['conversation'], operation: ['list'] },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 20,
        description: 'Max number of results to return',
        displayOptions: {
          show: { resource: ['conversation'], operation: ['list'], returnAll: [false] },
        },
      },
      {
        displayName: 'Page Size',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 100,
        description: 'Max number of results to return',
        displayOptions: {
          show: { resource: ['conversation'], operation: ['list'], returnAll: [true] },
        },
      },
      // Conversation: List - Filters
      {
        displayName: 'Filters',
        name: 'conversationFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: {
          show: { resource: ['conversation'], operation: ['list'] },
        },
        options: [
          {
            displayName: 'Search',
            name: 'search',
            type: 'string',
            default: '',
            description: 'Search by name or phone'          },
          {
            displayName: 'Status',
            name: 'status',
            type: 'options',
            options: [
              { name: 'All', value: 'all' },
              { name: 'Active', value: 'active' },
              { name: 'Closed', value: 'closed' },
              { name: 'Archived', value: 'archived' },
            ],
            default: 'all'          },
        ],
      },

      // Conversation: Get Messages - Return All toggle
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
        displayOptions: {
          show: { resource: ['conversation'], operation: ['getMessages'] },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        description: 'Max number of results to return',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 50,
        displayOptions: {
          show: { resource: ['conversation'], operation: ['getMessages'], returnAll: [false] },
        },
      },
      {
        displayName: 'Page Size',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 100,
        description: 'Max number of results to return',
        displayOptions: {
          show: { resource: ['conversation'], operation: ['getMessages'], returnAll: [true] },
        },
      },

      // ===========================================
      // AGENT OPERATIONS
      // ===========================================
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['agent'] },
        },
        options: [
          {
            name: 'Toggle',
            value: 'toggle',
            action: 'Toggle AI globally',
            description: 'Enable or disable AI globally'          },
          {
            name: 'Pause',
            value: 'pause',
            action: 'Pause AI globally',
            description: 'Pause AI globally for X minutes'          },
        ],
        default: 'toggle',
      },

      // Agent: Toggle - Enabled
      {
        displayName: 'Enabled',
        name: 'agentEnabled',
        type: 'boolean',
        required: true,
        default: true,
        displayOptions: {
          show: { resource: ['agent'], operation: ['toggle'] },
        }      },

      // Agent: Pause - Duration
      {
        displayName: 'Duration (Minutes)',
        name: 'agentPauseDuration',
        type: 'number',
        required: true,
        default: 30,
        description: 'How long to pause AI globally',
        displayOptions: {
          show: { resource: ['agent'], operation: ['pause'] },
        }      },

      // ===========================================
      // TEMPLATE OPERATIONS
      // ===========================================
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['template'] },
        },
        options: [
          {
            name: 'List',
            value: 'list',
            action: 'List templates',
            description: 'Get all WhatsApp templates'          },
          {
            name: 'Get',
            value: 'get',
            action: 'Get a template',
            description: 'Get a specific template',
          },
          {
            name: 'Get Variables',
            value: 'getVariables',
            action: 'Get template variables',
            description: 'Get available template variables'          },
          {
            name: 'Sync',
            value: 'sync',
            action: 'Sync templates',
            description: 'Sync templates from Meta'          },
        ],
        default: 'list',
      },

      // Template: Get - ID
      forVersion(
        {
          displayName: 'Template ID',
          name: 'templateId',
          type: 'string',
          required: true,
          default: '',
          displayOptions: {
            show: { resource: ['template'], operation: ['get'] },
          },
        },
        V1,
      ),
      forVersion(templateIdLocator('templateId', { resource: ['template'], operation: ['get'] }), V1_1),

      // Template: List - Filters
      {
        displayName: 'Filters',
        name: 'templateFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: {
          show: { resource: ['template'], operation: ['list'] },
        },
        options: [
          {
            displayName: 'Status',
            name: 'status',
            type: 'string',
            default: '',
            description: 'Filter by template status'          },
        ],
      },
      // Template: List - Return All toggle
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
        displayOptions: {
          show: { resource: ['template'], operation: ['list'] },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        description: 'Max number of results to return',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 50,
        displayOptions: {
          show: { resource: ['template'], operation: ['list'], returnAll: [false] },
        },
      },
      {
        displayName: 'Page Size',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 100,
        description: 'Max number of results to return',
        displayOptions: {
          show: { resource: ['template'], operation: ['list'], returnAll: [true] },
        },
      },

      // ===========================================
      // CONTACT OPERATIONS
      // ===========================================
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['contact'] },
        },
        options: [
          {
            name: 'List',
            value: 'list',
            action: 'List contacts',
            description: 'Get all contacts'          },
          {
            name: 'Get',
            value: 'get',
            action: 'Get a contact',
            description: 'Get a specific contact',
          },
          {
            name: 'Create',
            value: 'create',
            action: 'Create a contact',
            description: 'Create a new contact'          },
          {
            name: 'Create or Update',
            value: 'upsert',
            action: 'Create or update a contact',
            description: 'Create a new record, or update the current one if it already exists (upsert)',
          },
          {
            name: 'Create Lead',
            value: 'createLead',
            action: 'Create an inbound lead',
            description: 'Create or update a lead and optionally send it a template in one call',
          },
          {
            name: 'Add Note',
            value: 'addNote',
            action: 'Add a note to a contact',
            description: 'Add an internal note to the contact timeline',
          },
          {
            name: 'Update',
            value: 'update',
            action: 'Update a contact',
            description: 'Update an existing contact',
          },
          {
            name: 'Delete',
            value: 'delete',
            action: 'Delete a contact',
            description: 'Delete a contact',
          },
          {
            name: 'Search',
            value: 'search',
            action: 'Search contacts',
            description: 'Advanced search for contacts'          },
          {
            name: 'Bulk',
            value: 'bulk',
            action: 'Bulk operations',
            description: 'Perform bulk operations on contacts'          },
          {
            name: 'Merge',
            value: 'merge',
            action: 'Merge contacts',
            description: 'Merge two contacts',
          },
          {
            name: 'Get Tags',
            value: 'getTags',
            action: 'Get all tags',
            description: 'Get all available tags'          },
          {
            name: 'Get Fields',
            value: 'getFields',
            action: 'Get custom fields',
            description: 'Get available custom fields'          },
        ],
        default: 'list',
      },

      // Contact: Get - Lookup By selector
      {
        displayName: 'Lookup By',
        name: 'contactLookupBy',
        type: 'options',
        options: [
          { name: 'ID', value: 'id' },
          { name: 'Phone Number', value: 'phone' },
        ],
        default: 'id',
        description: 'Whether to look up the contact by ID or phone number',
        displayOptions: {
          show: { resource: ['contact'], operation: ['get'] },
        },
      },

      // Contact: ID field (for get by ID + update/delete/merge)
      {
        displayName: 'Contact ID',
        name: 'contactId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['update', 'delete', 'merge', 'addNote'],
          },
        },
      },
      {
        displayName: 'Contact ID',
        name: 'contactId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['get'],
            contactLookupBy: ['id'],
          },
        },
      },

      // Contact: Get by Phone
      {
        displayName: 'Phone Number',
        name: 'contactPhone_lookup',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+5215512345678',
        description: 'Phone number of the contact to look up (with country code)',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['get'],
            contactLookupBy: ['phone'],
          },
        },
      },

      // Contact: Create - Fields
      {
        displayName: 'Name',
        name: 'contactName',
        type: 'string',
        default: '',
        displayOptions: {
          show: { resource: ['contact'], operation: ['create', 'upsert'] },
        }      },
      {
        displayName: 'Phone Number',
        name: 'contactPhone',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+5215512345678',
        displayOptions: {
          show: { resource: ['contact'], operation: ['create', 'upsert'] },
        }      },
      {
        displayName: 'Additional Fields',
        name: 'contactAdditional',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: { resource: ['contact'], operation: ['create', 'upsert'] },
        },
        options: [
          {
            displayName: 'Assigned Agent Name or ID',
            name: 'assignedAgentId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getTeamMembers' },
            default: '',
            description: 'Human agent responsible for this contact. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
          },
          {
            displayName: 'Company',
            name: 'company',
            type: 'string',
            default: '',
          },
          {
            displayName: 'Custom Fields',
            name: 'customFields',
            type: 'json',
            default: '{}'          },
          {
            displayName: 'Deal Value',
            name: 'dealValue',
            type: 'number',
            default: 0,
          },
          {
            displayName: 'Email',
            name: 'email',
            type: 'string',
            placeholder: 'name@email.com',
            default: ''          },
          {
            displayName: 'Funnel Stage Name or ID',
            name: 'funnelStageId',
            type: 'options',
            typeOptions: { loadOptionsMethod: 'getFunnelStages' },
            default: '',
            description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
          },
          {
            displayName: 'Notes',
            name: 'notes',
            type: 'string',
            typeOptions: { rows: 3 },
            default: '',
          },
          {
            displayName: 'Source',
            name: 'source',
            type: 'string',
            default: 'n8n',
            description: 'Where the contact came from (max 50 characters)',
          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            description: 'Comma-separated list of tags'          },
        ],
      },

      // Contact: Update - Fields
      {
        displayName: 'Update Fields',
        name: 'contactUpdateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: { resource: ['contact'], operation: ['update'] },
        },
        options: [
          {
            displayName: 'Name',
            name: 'name',
            type: 'string',
            default: ''          },
          {
            displayName: 'Email',
            name: 'email',
            type: 'string',
            placeholder: 'name@email.com',
            default: ''          },
          {
            displayName: 'Assigned Agent ID',
            name: 'assignedAgentId',
            type: 'string',
            default: '',
            description: 'Team member ID (see Team → List). Use "none" to unassign.',
          },
          {
            displayName: 'Company',
            name: 'company',
            type: 'string',
            default: '',
          },
          {
            displayName: 'Deal Value',
            name: 'dealValue',
            type: 'number',
            default: 0,
          },
          {
            displayName: 'Notes',
            name: 'notes',
            type: 'string',
            typeOptions: { rows: 3 },
            default: '',
            description: 'Appended as a new note on the contact',
          },
          {
            displayName: 'Add Tags',
            name: 'addTags',
            type: 'string',
            default: '',
            description: 'Comma-separated tags to add without removing existing tags'          },
          {
            displayName: 'Remove Tags',
            name: 'removeTags',
            type: 'string',
            default: '',
            description: 'Comma-separated tags to remove from the contact'          },
          {
            displayName: 'Replace Tags',
            name: 'tags',
            type: 'string',
            default: '',
            description: 'Comma-separated tags that replace all existing tags'          },
          {
            displayName: 'Funnel Stage ID',
            name: 'funnelStageId',
            type: 'string',
            default: '',
            description: 'ID of the funnel stage to assign the contact to'          },
          {
            displayName: 'Custom Fields',
            name: 'customFields',
            type: 'json',
            default: '{}'          },
        ],
      },

      // Contact: Search - Fields
      {
        displayName: 'Search Query',
        name: 'searchQuery',
        type: 'string',
        default: '',
        description: 'Text matched against name, phone, email and company. Leave empty to only use filters.',
        displayOptions: {
          show: { resource: ['contact'], operation: ['search'] },
        }      },
      {
        displayName: 'Search Options',
        name: 'searchOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: { resource: ['contact'], operation: ['search'] },
        },
        options: [
          {
            displayName: 'Filters',
            name: 'filters',
            type: 'json',
            default: '{}'          },
        ],
      },
      // Contact: Search - Return All toggle
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
        displayOptions: {
          show: { resource: ['contact'], operation: ['search'] },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        description: 'Max number of results to return',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 20,
        displayOptions: {
          show: { resource: ['contact'], operation: ['search'], returnAll: [false] },
        },
      },
      {
        displayName: 'Page Size',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 100,
        description: 'Max number of results to return',
        displayOptions: {
          show: { resource: ['contact'], operation: ['search'], returnAll: [true] },
        },
      },

      // Contact: Bulk - Fields
      {
        displayName: 'Bulk Operation',
        name: 'bulkOperation',
        type: 'options',
        required: true,
        options: [
          { name: 'Create', value: 'create' },
          { name: 'Update', value: 'update' },
          { name: 'Delete', value: 'delete' },
          { name: 'Add Tags', value: 'tag' },
          { name: 'Remove Tags', value: 'untag' },
          { name: 'Set Funnel Stage', value: 'set_funnel_stage' },
        ],
        default: 'create',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'] },
        }      },
      {
        displayName: 'Contacts Data',
        name: 'bulkContacts',
        type: 'json',
        required: true,
        default: '[]',
        description: 'Array (max 100) of contacts in API format. Create: [{"phone_number":"+52...","name":"..."}]. Update: [{"ID":"uuid","name":"..."}].',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'], bulkOperation: ['create', 'update'], '@version': [1.1] },
        }      },
      {
        displayName: 'Contacts Data',
        name: 'bulkContacts',
        type: 'json',
        default: '[]',
        description: 'Create/Update: array of contacts in API format. Other operations: array of contact IDs (or use Contact IDs).',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'], '@version': [1] },
        }      },
      {
        displayName: 'Contact IDs',
        name: 'bulkContactIds',
        type: 'string',
        default: '',
        placeholder: 'uuid-1, uuid-2',
        description: 'Up to 100 contact IDs, comma-separated or as an array expression',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'], bulkOperation: ['delete', 'tag', 'untag', 'set_funnel_stage'] },
        }      },
      {
        displayName: 'Tags',
        name: 'bulkTags',
        type: 'string',
        default: '',
        placeholder: 'vip, black-friday',
        description: 'Comma-separated tags (max 20)',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'], bulkOperation: ['tag', 'untag'] },
        }      },
      {
        displayName: 'Funnel Stage Name or ID',
        name: 'bulkFunnelStageId',
        type: 'options',
        typeOptions: { loadOptionsMethod: 'getFunnelStages' },
        required: true,
        default: '',
        description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'], bulkOperation: ['set_funnel_stage'] },
        }      },
      {
        displayName: 'Operation Data',
        name: 'bulkData',
        type: 'json',
        default: '{}',
        description: 'Legacy field. Only read when Contact IDs or Tags are empty (keys: "contact_ids", "tags").',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'], '@version': [1], bulkOperation: ['delete', 'tag', 'untag'] },
        }      },

      // Contact: Merge - Merge With ID
      {
        displayName: 'Merge With Contact ID',
        name: 'mergeWithId',
        type: 'string',
        required: true,
        default: '',
        description: 'ID of the duplicate contact. It is merged into Contact ID and then removed.',
        displayOptions: {
          show: { resource: ['contact'], operation: ['merge'] },
        }      },

      // Contact: List - Filters
      {
        displayName: 'Filters',
        name: 'contactFilters',
        type: 'collection',
        placeholder: 'Add Filter',
        default: {},
        displayOptions: {
          show: { resource: ['contact'], operation: ['list'] },
        },
        options: [
          {
            displayName: 'Search',
            name: 'search',
            type: 'string',
            default: ''          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            description: 'Comma-separated list of tags'          },
          {
            displayName: 'Funnel Stage ID',
            name: 'funnelStageId',
            type: 'string',
            default: ''          },
          {
            displayName: 'Source',
            name: 'source',
            type: 'string',
            default: ''          },
          {
            displayName: 'Sort By',
            name: 'sortBy',
            type: 'options',
            options: [
              { name: 'Created At', value: 'created_at' },
              { name: 'Updated At', value: 'updated_at' },
              { name: 'Name', value: 'name' },
            ],
            default: 'created_at'          },
          {
            displayName: 'Sort Order',
            name: 'sortOrder',
            type: 'options',
            options: [
              { name: 'Ascending', value: 'asc' },
              { name: 'Descending', value: 'desc' },
            ],
            default: 'desc'          },
        ],
      },
      // Contact: List - Return All toggle
      {
        displayName: 'Return All',
        name: 'returnAll',
        type: 'boolean',
        default: false,
        description: 'Whether to return all results or only up to a given limit',
        displayOptions: {
          show: { resource: ['contact'], operation: ['list'] },
        },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        description: 'Max number of results to return',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 20,
        displayOptions: {
          show: { resource: ['contact'], operation: ['list'], returnAll: [false] },
        },
      },
      {
        displayName: 'Page Size',
        name: 'limit',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 100,
        description: 'Max number of results to return',
        displayOptions: {
          show: { resource: ['contact'], operation: ['list'], returnAll: [true] },
        },
      },

      // ===========================================
      // FUNNEL OPERATIONS
      // ===========================================
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        displayOptions: {
          show: { resource: ['funnel'] },
        },
        options: [
          {
            name: 'List Stages',
            value: 'listStages',
            action: 'List funnel stages',
            description: 'Get all funnel stages'          },
          {
            name: 'Get Stage',
            value: 'getStage',
            action: 'Get a funnel stage',
            description: 'Get a specific funnel stage',
          },
          {
            name: 'Create Stage',
            value: 'createStage',
            action: 'Create a funnel stage',
            description: 'Create a new funnel stage'          },
          {
            name: 'Update Stage',
            value: 'updateStage',
            action: 'Update a funnel stage',
            description: 'Update an existing funnel stage',
          },
          {
            name: 'Delete Stage',
            value: 'deleteStage',
            action: 'Delete a funnel stage',
            description: 'Delete a funnel stage',
          },
          {
            name: 'Reorder Stages',
            value: 'reorderStages',
            action: 'Reorder funnel stages',
            description: 'Reorder the funnel stages'          },
          {
            name: 'Move Contact',
            value: 'moveContact',
            action: 'Move contact to stage',
            description: 'Move a contact to a funnel stage',
          },
        ],
        default: 'listStages',
      },

      // Funnel: Stage ID
      forVersion(
        {
          displayName: 'Stage ID',
          name: 'stageId',
          type: 'string',
          required: true,
          default: '',
          displayOptions: {
            show: {
              resource: ['funnel'],
              operation: ['getStage', 'updateStage', 'deleteStage'],
            },
          },
        },
        V1,
      ),
      forVersion(
        funnelStageLocator('stageId', 'Stage', { resource: ['funnel'], operation: ['getStage', 'updateStage', 'deleteStage'] }),
        V1_1,
      ),

      // Funnel: Create Stage - Fields
      {
        displayName: 'Stage Name',
        name: 'stageName',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: { resource: ['funnel'], operation: ['createStage'] },
        }      },
      {
        displayName: 'Stage Options',
        name: 'stageOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: { resource: ['funnel'], operation: ['createStage'] },
        },
        options: [
          {
            displayName: 'Position',
            name: 'position',
            type: 'number',
            typeOptions: { minValue: 0 },
            default: 0,
            description: 'Zero-based position. Defaults to the end of the funnel.',
          },
          {
            displayName: 'Color',
            name: 'color',
            type: 'color',
            default: '#3B82F6',
            description: 'Hex color code'          },
        ],
      },

      // Funnel: Update Stage - Fields
      {
        displayName: 'Update Fields',
        name: 'stageUpdateFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: { resource: ['funnel'], operation: ['updateStage'] },
        },
        options: [
          {
            displayName: 'Name',
            name: 'name',
            type: 'string',
            default: ''          },
          {
            displayName: 'Color',
            name: 'color',
            type: 'color',
            default: '#3B82F6',
          },
        ],
      },

      // Funnel: Reorder Stages
      {
        displayName: 'Stages Order',
        name: 'stagesOrder',
        type: 'json',
        required: true,
        default: '[]',
        description: 'Stage IDs in the new order: ["uuid-1","uuid-2"] or comma-separated. Legacy [{"ID","position"}] arrays are sorted by position.',
        displayOptions: {
          show: { resource: ['funnel'], operation: ['reorderStages'] },
        }      },

      // Funnel: Move Contact - Fields
      {
        displayName: 'Contact ID',
        name: 'contactIdFunnel',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: { resource: ['funnel'], operation: ['moveContact'] },
        },
      },
      forVersion(
        {
          displayName: 'Target Stage ID',
          name: 'targetStageId',
          type: 'string',
          required: true,
          default: '',
          displayOptions: {
            show: { resource: ['funnel'], operation: ['moveContact'] },
          },
        },
        V1,
      ),
      forVersion(
        funnelStageLocator('targetStageId', 'Target Stage', { resource: ['funnel'], operation: ['moveContact'] }),
        V1_1,
      ),

      // Funnel: List Stages (v1 kept its pagination toggle; the endpoint always returns every stage)
      forVersion(
        {
          displayName: 'Return All',
          name: 'returnAll',
          type: 'boolean',
          default: true,
          description: 'Whether to return all results or only up to a given limit',
          displayOptions: {
            show: { resource: ['funnel'], operation: ['listStages'] },
          },
        },
        V1,
      ),
      forVersion(
        {
          displayName: 'Limit',
          name: 'limit',
          type: 'number',
          typeOptions: { minValue: 1, maxValue: 100 },
          default: 100,
          description: 'Max number of results to return',
          displayOptions: {
            show: { resource: ['funnel'], operation: ['listStages'] },
          },
        },
        V1,
      ),

      ...contactExtraProperties,
    ],
  };

  methods = { listSearch, loadOptions, resourceMapping };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    return executeWhaapyOperation.call(this);
  }
}
