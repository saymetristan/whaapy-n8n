import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

// Helper function to convert string to slug (for auto-generating IDs)
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '_')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .substring(0, 256);
}

// Build interactive message payload from structured fields
function buildInteractivePayload(params: {
  interactiveType: string;
  bodyText: string;
  headerType?: string;
  headerText?: string;
  headerMediaUrl?: string;
  footerText?: string;
  buttons?: Array<{ title: string; id?: string }>;
  listButtonText?: string;
  sections?: Array<{
    title?: string;
    rows: Array<{ title: string; description?: string; id?: string }>;
  }>;
  ctaButtonText?: string;
  ctaButtonUrl?: string;
}): object {
  const interactive: Record<string, any> = {
    type: params.interactiveType,
    body: {
      text: params.bodyText,
    },
  };

  // Add header if specified
  if (params.headerType && params.headerType !== 'none') {
    if (params.headerType === 'text' && params.headerText) {
      interactive.header = {
        type: 'text',
        text: params.headerText,
      };
    } else if (['image', 'video', 'document'].includes(params.headerType) && params.headerMediaUrl) {
      interactive.header = {
        type: params.headerType,
        [params.headerType]: {
          link: params.headerMediaUrl,
        },
      };
    }
  }

  // Add footer if specified and not empty
  if (params.footerText && params.footerText.trim()) {
    interactive.footer = {
      text: params.footerText.trim(),
    };
  }

  // Build action based on type
  if (params.interactiveType === 'button' && params.buttons && params.buttons.length > 0) {
    interactive.action = {
      buttons: params.buttons.map((btn) => ({
        type: 'reply',
        reply: {
          id: btn.id || slugify(btn.title),
          title: btn.title.substring(0, 20),
        },
      })),
    };
  } else if (params.interactiveType === 'list' && params.sections && params.sections.length > 0) {
    interactive.action = {
      button: params.listButtonText || 'Ver Opciones',
      sections: params.sections.map((section) => ({
        title: section.title || undefined,
        rows: section.rows.map((row) => ({
          id: row.id || slugify(row.title),
          title: row.title.substring(0, 24),
          description: row.description ? row.description.substring(0, 72) : undefined,
        })),
      })),
    };
  } else if (params.interactiveType === 'cta_url' && params.ctaButtonText && params.ctaButtonUrl) {
    interactive.action = {
      name: 'cta_url',
      parameters: {
        display_text: params.ctaButtonText.substring(0, 20),
        url: params.ctaButtonUrl,
      },
    };
  }

  return interactive;
}

export class Whaapy implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Whaapy',
    name: 'whaapy',
    icon: 'file:whaapy.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'WhatsApp Business API with AI - Send messages, manage conversations, and automate with AI agents',
    defaults: {
      name: 'Whaapy',
    },
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
          { name: 'Message', value: 'message' },
          { name: 'Media', value: 'media' },
          { name: 'Conversation', value: 'conversation' },
          { name: 'Agent', value: 'agent' },
          { name: 'Template', value: 'template' },
          { name: 'Contact', value: 'contact' },
          { name: 'Funnel', value: 'funnel' },
        ],
        default: 'message',
      },

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

      // Message: Send - To field
      {
        displayName: 'To',
        name: 'to',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+5215512345678',
        description: 'Phone number with country code',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'] },
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

      // Message: Send - Media URL (for image, video, audio, document, sticker)
      {
        displayName: 'Media URL',
        name: 'mediaUrl',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'https://example.com/image.jpg',
        description: 'URL of the media file or Media ID from upload',
        displayOptions: {
          show: {
            resource: ['message'],
            operation: ['send'],
            messageType: ['image', 'video', 'audio', 'document', 'sticker'],
          },
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
        }      },

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
          { name: 'Custom (Enter manually)', value: '__custom__' },
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
            displayName: 'Header Media URL',
            name: 'headerMediaUrl',
            type: 'string',
            default: '',
            placeholder: 'https://example.com/image.jpg',
            description: 'Public URL of the media file for header'          },
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

      // Interactive: Header media URL (if type=image|video|document)
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
            name: 'Set AI',
            value: 'setAi',
            action: 'Enable/disable AI',
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
            operation: ['get', 'getMessages', 'close', 'archive', 'markRead', 'setAi', 'pauseAi', 'aiSuggest'],
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
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20,
            description: 'Max results (1-100)'          },
          {
            displayName: 'Offset',
            name: 'offset',
            type: 'number',
            default: 0          },
        ],
      },

      // Conversation: Get Messages - Pagination
      {
        displayName: 'Options',
        name: 'messagesOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: { resource: ['conversation'], operation: ['getMessages'] },
        },
        options: [
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 50          },
          {
            displayName: 'Cursor',
            name: 'cursor',
            type: 'string',
            default: '',
            description: 'Pagination cursor'          },
        ],
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
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20          },
          {
            displayName: 'Offset',
            name: 'offset',
            type: 'number',
            default: 0          },
        ],
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
            operation: ['update', 'delete', 'merge'],
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
        required: true,
        default: '',
        displayOptions: {
          show: { resource: ['contact'], operation: ['create'] },
        }      },
      {
        displayName: 'Phone Number',
        name: 'contactPhone',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+5215512345678',
        displayOptions: {
          show: { resource: ['contact'], operation: ['create'] },
        }      },
      {
        displayName: 'Additional Fields',
        name: 'contactAdditional',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
          show: { resource: ['contact'], operation: ['create'] },
        },
        options: [
          {
            displayName: 'Email',
            name: 'email',
            type: 'string',
            default: ''          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            description: 'Comma-separated list of tags'          },
          {
            displayName: 'Custom Fields',
            name: 'customFields',
            type: 'json',
            default: '{}'          },
          {
            displayName: 'Metadata',
            name: 'metadata',
            type: 'json',
            default: '{}'          },
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
            displayName: 'Phone Number',
            name: 'phoneNumber',
            type: 'string',
            default: ''          },
          {
            displayName: 'Email',
            name: 'email',
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
        required: true,
        default: '',
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
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20          },
          {
            displayName: 'Cursor',
            name: 'cursor',
            type: 'string',
            default: ''          },
        ],
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
          { name: 'Tag', value: 'tag' },
          { name: 'Untag', value: 'untag' },
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
        description: 'Array of contacts or contact IDs',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'] },
        }      },
      {
        displayName: 'Operation Data',
        name: 'bulkData',
        type: 'json',
        default: '{}',
        description: 'Additional data for the operation',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'] },
        }      },

      // Contact: Merge - Merge With ID
      {
        displayName: 'Merge With Contact ID',
        name: 'mergeWithId',
        type: 'string',
        required: true,
        default: '',
        description: 'ID of the contact to merge into the primary contact',
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
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20          },
          {
            displayName: 'Cursor',
            name: 'cursor',
            type: 'string',
            default: ''          },
        ],
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
            default: 0          },
          {
            displayName: 'Color',
            name: 'color',
            type: 'string',
            default: '#3B82F6',
            description: 'Hex color code'          },
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: ''          },
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
            displayName: 'Position',
            name: 'position',
            type: 'number',
            default: 0          },
          {
            displayName: 'Color',
            name: 'color',
            type: 'string',
            default: ''          },
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: ''          },
        ],
      },

      // Funnel: Reorder Stages
      {
        displayName: 'Stages Order',
        name: 'stagesOrder',
        type: 'json',
        required: true,
        default: '[]',
        description: 'Array of objects with id and position',
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
      {
        displayName: 'Target Stage ID',
        name: 'targetStageId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: { resource: ['funnel'], operation: ['moveContact'] },
        }      },

      // Funnel: List Stages - Filters
      {
        displayName: 'Options',
        name: 'stageListOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: { resource: ['funnel'], operation: ['listStages'] },
        },
        options: [
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20          },
          {
            displayName: 'Offset',
            name: 'offset',
            type: 'number',
            default: 0          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;
        const credentials = await this.getCredentials('whaapyApi');
        const baseUrl = credentials.baseUrl as string;
        const apiKey = credentials.apiKey as string;

        let response: any;

        // ===========================================
        // MESSAGE RESOURCE
        // ===========================================
        if (resource === 'message') {
          if (operation === 'send') {
            const to = this.getNodeParameter('to', i) as string;
            const messageType = this.getNodeParameter('messageType', i) as string;
            const body: Record<string, any> = { to, type: messageType };

            // Handle different message types
            if (messageType === 'text') {
              body.content = this.getNodeParameter('textContent', i) as string;
            } else if (['image', 'video', 'audio', 'document', 'sticker'].includes(messageType)) {
              const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
              body[messageType] = { link: mediaUrl };
              if (['image', 'video', 'document'].includes(messageType)) {
                const caption = this.getNodeParameter('caption', i, '') as string;
                if (caption) body[messageType].caption = caption;
              }
            } else if (messageType === 'template') {
              body.templateName = this.getNodeParameter('templateName', i) as string;
              const selectedTemplateLanguage = this.getNodeParameter('templateLanguage', i) as string;
              const templateLanguage = selectedTemplateLanguage === '__custom__'
                ? (this.getNodeParameter('templateLanguageCustom', i, '') as string).trim()
                : selectedTemplateLanguage;

              if (!templateLanguage) {
                throw new NodeOperationError(this.getNode(), 'Template language is required. Select a language or enter a custom language code.');
              }

              body.language = templateLanguage;
              const templateOptions = this.getNodeParameter('templateOptions', i, {}) as Record<string, any>;
              if (templateOptions.parameters) {
                body.template_parameters = templateOptions.parameters.split(',').map((v: string) => v.trim());
              }
              if (templateOptions.headerMediaType && templateOptions.headerMediaUrl) {
                body.header_media = {
                  type: templateOptions.headerMediaType,
                  url: templateOptions.headerMediaUrl,
                };
              }
            } else if (messageType === 'interactive') {
              // Build interactive message from structured fields
              const interactiveType = this.getNodeParameter('interactiveType', i) as string;
              const bodyText = this.getNodeParameter('interactiveBodyText', i) as string;
              const headerType = this.getNodeParameter('interactiveHeaderType', i, 'none') as string;
              const headerText = this.getNodeParameter('interactiveHeaderText', i, '') as string;
              const headerMediaUrl = this.getNodeParameter('interactiveHeaderMediaUrl', i, '') as string;
              const footerText = this.getNodeParameter('interactiveFooterText', i, '') as string;

              // Build buttons array
              let buttons: Array<{ title: string; id?: string }> = [];
              if (interactiveType === 'button') {
                const buttonsData = this.getNodeParameter('interactiveButtons', i, { buttonValues: [] }) as {
                  buttonValues?: Array<{ title: string; id?: string }>;
                };
                buttons = buttonsData.buttonValues || [];
              }

              // Build sections array
              let sections: Array<{ title?: string; rows: Array<{ title: string; description?: string; id?: string }> }> = [];
              let listButtonText = '';
              if (interactiveType === 'list') {
                listButtonText = this.getNodeParameter('interactiveListButtonText', i, 'Ver Opciones') as string;
                const sectionsData = this.getNodeParameter('interactiveSections', i, { sectionValues: [] }) as {
                  sectionValues?: Array<{
                    title?: string;
                    rows?: { rowValues?: Array<{ title: string; description?: string; id?: string }> };
                  }>;
                };

                if (sectionsData.sectionValues) {
                  sections = sectionsData.sectionValues.map((section) => ({
                    title: section.title,
                    rows: section.rows?.rowValues || [],
                  }));
                }
              }

              // CTA URL button
              let ctaButtonText = '';
              let ctaButtonUrl = '';
              if (interactiveType === 'cta_url') {
                ctaButtonText = this.getNodeParameter('ctaButtonText', i, '') as string;
                ctaButtonUrl = this.getNodeParameter('ctaButtonUrl', i, '') as string;
              }

              body.interactive = buildInteractivePayload({
                interactiveType,
                bodyText,
                headerType,
                headerText,
                headerMediaUrl,
                footerText,
                buttons,
                listButtonText,
                sections,
                ctaButtonText,
                ctaButtonUrl,
              });
            } else if (messageType === 'location') {
              const locationName = this.getNodeParameter('locationName', i, '') as string;
              const locationAddress = this.getNodeParameter('locationAddress', i, '') as string;
              body.location = {
                latitude: this.getNodeParameter('latitude', i) as number,
                longitude: this.getNodeParameter('longitude', i) as number,
                name: locationName || undefined,
                address: locationAddress || undefined,
              };
            } else if (messageType === 'contacts') {
              const contactsData = this.getNodeParameter('contactsData', i) as string;
              body.contacts = typeof contactsData === 'string' ? JSON.parse(contactsData) : contactsData;
            } else if (messageType === 'reaction') {
              body.reaction = {
                message_id: this.getNodeParameter('reactionMessageId', i) as string,
                emoji: this.getNodeParameter('reactionEmoji', i) as string,
              };
            }

            // Add additional fields
            const additionalFields = this.getNodeParameter('additionalFields', i, {}) as Record<string, any>;
            if (additionalFields.pauseAi) {
              body.ai = body.ai || {};
              body.ai.pause = additionalFields.pauseAi;
            }
            if (additionalFields.pauseDuration) {
              body.ai = body.ai || {};
              body.ai.pauseDuration = additionalFields.pauseDuration;
            }
            if (additionalFields.disableAi) {
              body.ai = body.ai || {};
              body.ai.disable = additionalFields.disableAi;
            }
            if (additionalFields.replyTo) {
              body.context = { message_id: additionalFields.replyTo };
            }
            if (additionalFields.createConversation !== undefined) {
              body.createConversation = additionalFields.createConversation;
            }
            if (additionalFields.metadata) {
              body.metadata = typeof additionalFields.metadata === 'string' 
                ? JSON.parse(additionalFields.metadata) 
                : additionalFields.metadata;
            }

            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/messages/v1`,
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body,
              json: true,
            });
          } else if (operation === 'retry') {
            const messageId = this.getNodeParameter('messageId', i) as string;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/messages/v1/${messageId}/retry`,
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              json: true,
            });
          }
        }

        // ===========================================
        // CONVERSATION RESOURCE
        // ===========================================
        else if (resource === 'conversation') {
          if (operation === 'list') {
            const filters = this.getNodeParameter('conversationFilters', i, {}) as Record<string, any>;
            const qs: Record<string, any> = {};
            if (filters.search) qs.search = filters.search;
            if (filters.status && filters.status !== 'all') qs.status = filters.status;
            if (filters.limit) qs.limit = filters.limit;
            if (filters.offset) qs.offset = filters.offset;

            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/conversations/v1`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              qs,
              json: true,
            });
          } else if (operation === 'get') {
            const conversationId = this.getNodeParameter('conversationId', i) as string;
            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/conversations/v1/${conversationId}`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'getByPhone') {
            const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/conversations/v1/by-phone/${encodeURIComponent(phoneNumber)}`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'getMessages') {
            const conversationId = this.getNodeParameter('conversationId', i) as string;
            const options = this.getNodeParameter('messagesOptions', i, {}) as Record<string, any>;
            const qs: Record<string, any> = {};
            if (options.limit) qs.limit = options.limit;
            if (options.cursor) qs.cursor = options.cursor;

            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/conversations/v1/${conversationId}/messages`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              qs,
              json: true,
            });
          } else if (operation === 'close') {
            const conversationId = this.getNodeParameter('conversationId', i) as string;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/conversations/v1/${conversationId}/close`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'archive') {
            const conversationId = this.getNodeParameter('conversationId', i) as string;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/conversations/v1/${conversationId}/archive`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'markRead') {
            const conversationId = this.getNodeParameter('conversationId', i) as string;
            response = await this.helpers.request({
              method: 'PATCH',
              url: `${baseUrl}/conversations/v1/${conversationId}/mark-read`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'setAi') {
            const conversationId = this.getNodeParameter('conversationId', i) as string;
            const aiEnabled = this.getNodeParameter('aiEnabled', i) as boolean;
            response = await this.helpers.request({
              method: 'PATCH',
              url: `${baseUrl}/conversations/v1/${conversationId}/ai`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: { aiEnabled },
              json: true,
            });
          } else if (operation === 'pauseAi') {
            const conversationId = this.getNodeParameter('conversationId', i) as string;
            const duration = this.getNodeParameter('pauseDurationConv', i) as number;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/conversations/v1/${conversationId}/ai/pause`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: { duration },
              json: true,
            });
          } else if (operation === 'aiSuggest') {
            const conversationId = this.getNodeParameter('conversationId', i) as string;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/conversations/v1/${conversationId}/ai-suggest`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          }
        }

        // ===========================================
        // AGENT RESOURCE
        // ===========================================
        else if (resource === 'agent') {
          if (operation === 'toggle') {
            const enabled = this.getNodeParameter('agentEnabled', i) as boolean;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/agent/v1/toggle`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: { enabled },
              json: true,
            });
          } else if (operation === 'pause') {
            const duration = this.getNodeParameter('agentPauseDuration', i) as number;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/agent/v1/pause`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: { duration },
              json: true,
            });
          }
        }

        // ===========================================
        // TEMPLATE RESOURCE
        // ===========================================
        else if (resource === 'template') {
          if (operation === 'list') {
            const filters = this.getNodeParameter('templateFilters', i, {}) as Record<string, any>;
            const qs: Record<string, any> = {};
            if (filters.status) qs.status = filters.status;
            if (filters.limit) qs.limit = filters.limit;
            if (filters.offset) qs.offset = filters.offset;

            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/templates/v1`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              qs,
              json: true,
            });
          } else if (operation === 'get') {
            const templateId = this.getNodeParameter('templateId', i) as string;
            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/templates/v1/${templateId}`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'getVariables') {
            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/templates/v1/variables`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'sync') {
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/templates/v1/sync`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          }
        }

        // ===========================================
        // MEDIA RESOURCE
        // ===========================================
        else if (resource === 'media') {
          if (operation === 'upload') {
            // Media upload requires special handling with binary data
            const mediaType = this.getNodeParameter('mediaType', i) as string;
            const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
            
            // For now, just return an error - binary upload needs special handling
            throw new NodeOperationError(
              this.getNode(),
              'Media upload from n8n requires binary data handling. Use the HTTP Request node with binary data or upload via URL.',
              { itemIndex: i },
            );
          }
        }

        // ===========================================
        // CONTACT RESOURCE
        // ===========================================
        else if (resource === 'contact') {
          if (operation === 'list') {
            const filters = this.getNodeParameter('contactFilters', i, {}) as Record<string, any>;
            const qs: Record<string, any> = {};
            Object.entries(filters).forEach(([key, value]) => {
              if (value !== undefined && value !== '') {
                qs[key === 'sortBy' ? 'sort_by' : key === 'sortOrder' ? 'sort_order' : key === 'funnelStageId' ? 'funnel_stage_id' : key] = value;
              }
            });

            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/contacts/v1`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              qs,
              json: true,
            });
          } else if (operation === 'get') {
            const lookupBy = this.getNodeParameter('contactLookupBy', i, 'id') as string;
            let resolvedContactId: string;

            if (lookupBy === 'phone') {
              const phone = this.getNodeParameter('contactPhone_lookup', i) as string;
              const checkResponse = await this.helpers.request({
                method: 'GET',
                url: `${baseUrl}/contacts/check-phone`,
                headers: { 'Authorization': `Bearer ${apiKey}` },
                qs: { phone },
                json: true,
              });

              if (!checkResponse.exists || !checkResponse.contact) {
                throw new NodeOperationError(
                  this.getNode(),
                  `No contact found with phone number: ${phone}`,
                  { itemIndex: i },
                );
              }
              resolvedContactId = checkResponse.contact.id;
            } else {
              resolvedContactId = this.getNodeParameter('contactId', i) as string;
            }

            // Always use the V1 endpoint for consistent response format
            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/contacts/v1/${resolvedContactId}`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'create') {
            const name = this.getNodeParameter('contactName', i) as string;
            const phoneNumber = this.getNodeParameter('contactPhone', i) as string;
            const additional = this.getNodeParameter('contactAdditional', i, {}) as Record<string, any>;
            const body: Record<string, any> = { name, phoneNumber };
            if (additional.email) body.email = additional.email;
            if (additional.tags) body.tags = additional.tags;
            if (additional.customFields) {
              body.customFields = typeof additional.customFields === 'string' 
                ? JSON.parse(additional.customFields) 
                : additional.customFields;
            }
            if (additional.metadata) {
              body.metadata = typeof additional.metadata === 'string' 
                ? JSON.parse(additional.metadata) 
                : additional.metadata;
            }

            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/contacts/v1`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body,
              json: true,
            });
          } else if (operation === 'update') {
            const contactId = this.getNodeParameter('contactId', i) as string;
            const updateFields = this.getNodeParameter('contactUpdateFields', i, {}) as Record<string, any>;
            const body: Record<string, any> = {};
            
            // Map camelCase to snake_case for API compatibility
            const fieldMapping: Record<string, string> = {
              phoneNumber: 'phone_number',
              funnelStageId: 'funnel_stage_id',
              customFields: 'custom_fields',
            };
            
            Object.entries(updateFields).forEach(([key, value]) => {
              if (value !== undefined && value !== '') {
                const mappedKey = fieldMapping[key] || key;
                if (key === 'customFields') {
                  body[mappedKey] = typeof value === 'string' ? JSON.parse(value) : value;
                } else {
                  body[mappedKey] = value;
                }
              }
            });

            response = await this.helpers.request({
              method: 'PATCH',
              url: `${baseUrl}/contacts/v1/${contactId}`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body,
              json: true,
            });
          } else if (operation === 'delete') {
            const contactId = this.getNodeParameter('contactId', i) as string;
            response = await this.helpers.request({
              method: 'DELETE',
              url: `${baseUrl}/contacts/v1/${contactId}`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'search') {
            const query = this.getNodeParameter('searchQuery', i) as string;
            const options = this.getNodeParameter('searchOptions', i, {}) as Record<string, any>;
            const body: Record<string, any> = { query };
            if (options.filters) {
              body.filters = typeof options.filters === 'string' ? JSON.parse(options.filters) : options.filters;
            }
            if (options.limit) body.limit = options.limit;
            if (options.cursor) body.cursor = options.cursor;

            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/contacts/v1/search`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body,
              json: true,
            });
          } else if (operation === 'bulk') {
            const bulkOperation = this.getNodeParameter('bulkOperation', i) as string;
            const contacts = this.getNodeParameter('bulkContacts', i) as string;
            const data = this.getNodeParameter('bulkData', i, '{}') as string;

            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/contacts/v1/bulk`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: {
                operation: bulkOperation,
                contacts: typeof contacts === 'string' ? JSON.parse(contacts) : contacts,
                data: typeof data === 'string' ? JSON.parse(data) : data,
              },
              json: true,
            });
          } else if (operation === 'merge') {
            const contactId = this.getNodeParameter('contactId', i) as string;
            const mergeWith = this.getNodeParameter('mergeWithId', i) as string;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/contacts/v1/${contactId}/merge`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: { mergeWith },
              json: true,
            });
          } else if (operation === 'getTags') {
            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/contacts/v1/tags`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'getFields') {
            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/contacts/v1/fields`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          }
        }

        // ===========================================
        // FUNNEL RESOURCE
        // ===========================================
        else if (resource === 'funnel') {
          if (operation === 'listStages') {
            const options = this.getNodeParameter('stageListOptions', i, {}) as Record<string, any>;
            const qs: Record<string, any> = {};
            if (options.limit) qs.limit = options.limit;
            if (options.offset) qs.offset = options.offset;

            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/funnel/v1/stages`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              qs,
              json: true,
            });
          } else if (operation === 'getStage') {
            const stageId = this.getNodeParameter('stageId', i) as string;
            response = await this.helpers.request({
              method: 'GET',
              url: `${baseUrl}/funnel/v1/stages/${stageId}`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'createStage') {
            const name = this.getNodeParameter('stageName', i) as string;
            const options = this.getNodeParameter('stageOptions', i, {}) as Record<string, any>;
            const body: Record<string, any> = { name };
            if (options.position !== undefined) body.position = options.position;
            if (options.color) body.color = options.color;
            if (options.description) body.description = options.description;

            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/funnel/v1/stages`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body,
              json: true,
            });
          } else if (operation === 'updateStage') {
            const stageId = this.getNodeParameter('stageId', i) as string;
            const updateFields = this.getNodeParameter('stageUpdateFields', i, {}) as Record<string, any>;
            const body: Record<string, any> = {};
            Object.entries(updateFields).forEach(([key, value]) => {
              if (value !== undefined && value !== '') {
                body[key] = value;
              }
            });

            response = await this.helpers.request({
              method: 'PATCH',
              url: `${baseUrl}/funnel/v1/stages/${stageId}`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body,
              json: true,
            });
          } else if (operation === 'deleteStage') {
            const stageId = this.getNodeParameter('stageId', i) as string;
            response = await this.helpers.request({
              method: 'DELETE',
              url: `${baseUrl}/funnel/v1/stages/${stageId}`,
              headers: { 'Authorization': `Bearer ${apiKey}` },
              json: true,
            });
          } else if (operation === 'reorderStages') {
            const stages = this.getNodeParameter('stagesOrder', i) as string;
            response = await this.helpers.request({
              method: 'PATCH',
              url: `${baseUrl}/funnel/v1/stages/reorder`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: { stages: typeof stages === 'string' ? JSON.parse(stages) : stages },
              json: true,
            });
          } else if (operation === 'moveContact') {
            const contactId = this.getNodeParameter('contactIdFunnel', i) as string;
            const stageId = this.getNodeParameter('targetStageId', i) as string;
            response = await this.helpers.request({
              method: 'POST',
              url: `${baseUrl}/funnel/v1/contacts/${contactId}/move`,
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: { stage_id: stageId },
              json: true,
            });
          }
        }

        if (response) {
          returnData.push({ json: response });
        }

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
