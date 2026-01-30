import { INodeType, INodeTypeDescription } from 'n8n-workflow';

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
    requestDefaults: {
      baseURL: '={{$credentials.baseUrl}}',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
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
            routing: {
              request: {
                method: 'POST',
                url: '/messages/v1',
              },
            },
          },
          {
            name: 'Retry',
            value: 'retry',
            action: 'Retry a failed message',
            description: 'Retry sending a failed message',
            routing: {
              request: {
                method: 'POST',
                url: '=/messages/v1/{{$parameter.messageId}}/retry',
              },
            },
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
        routing: {
          send: { type: 'body', property: 'to' },
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
        routing: {
          send: { type: 'body', property: 'type' },
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
        },
        routing: {
          send: { type: 'body', property: 'content' },
        },
      },

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
        routing: {
          send: { type: 'body', property: '={{$parameter.messageType}}.link' },
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
        routing: {
          send: { type: 'body', property: '={{$parameter.messageType}}.caption' },
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
        },
        routing: {
          send: { type: 'body', property: 'templateName' },
        },
      },

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
          { name: 'Spanish (Mexico)', value: 'es_MX' },
          { name: 'Spanish (Spain)', value: 'es_ES' },
          { name: 'Spanish (Argentina)', value: 'es_AR' },
          { name: 'English (US)', value: 'en_US' },
          { name: 'English (UK)', value: 'en_GB' },
          { name: 'Portuguese (Brazil)', value: 'pt_BR' },
          { name: 'French', value: 'fr' },
          { name: 'German', value: 'de' },
          { name: 'Italian', value: 'it' },
        ],
        routing: {
          send: { type: 'body', property: 'language' },
        },
      },

      // Message: Send - Template parameters
      {
        displayName: 'Body Parameters',
        name: 'templateParameters',
        type: 'string',
        default: '',
        placeholder: 'Juan Pérez, #ORD-12345, $1500',
        description: 'Comma-separated values for {{1}}, {{2}}, etc. placeholders in the template body. Example: "Juan, #12345, $100"',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
        },
        routing: {
          send: { 
            type: 'body', 
            property: 'template_parameters',
            value: '={{ $value ? $value.split(",").map(v => v.trim()) : [] }}',
          },
        },
      },

      // Message: Send - Template Header Media
      {
        displayName: 'Header Media',
        name: 'templateHeaderMedia',
        type: 'collection',
        placeholder: 'Add Header Media',
        default: {},
        description: 'Optional media for template header (image, video, or document)',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['template'] },
        },
        options: [
          {
            displayName: 'Media Type',
            name: 'type',
            type: 'options',
            default: 'image',
            options: [
              { name: 'Image', value: 'image' },
              { name: 'Video', value: 'video' },
              { name: 'Document', value: 'document' },
            ],
            routing: {
              send: { type: 'body', property: 'header_media.type' },
            },
          },
          {
            displayName: 'Media URL',
            name: 'url',
            type: 'string',
            default: '',
            placeholder: 'https://example.com/image.jpg',
            description: 'Public URL of the media file',
            routing: {
              send: { type: 'body', property: 'header_media.url' },
            },
          },
        ],
      },

      // Message: Send - Interactive content
      {
        displayName: 'Interactive Content',
        name: 'interactiveContent',
        type: 'json',
        required: true,
        default: '{}',
        description: 'Interactive message content (buttons, lists)',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['interactive'] },
        },
        routing: {
          send: { type: 'body', property: 'interactive' },
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
        },
        routing: {
          send: { type: 'body', property: 'location.latitude' },
        },
      },
      {
        displayName: 'Longitude',
        name: 'longitude',
        type: 'number',
        required: true,
        default: 0,
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
        },
        routing: {
          send: { type: 'body', property: 'location.longitude' },
        },
      },
      {
        displayName: 'Location Name',
        name: 'locationName',
        type: 'string',
        default: '',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['location'] },
        },
        routing: {
          send: { type: 'body', property: 'location.name' },
        },
      },

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
        },
        routing: {
          send: { type: 'body', property: 'contacts' },
        },
      },

      // Message: Send - Reaction
      {
        displayName: 'Message ID to React',
        name: 'reactionMessageId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['reaction'] },
        },
        routing: {
          send: { type: 'body', property: 'reaction.message_id' },
        },
      },
      {
        displayName: 'Emoji',
        name: 'reactionEmoji',
        type: 'string',
        required: true,
        default: '👍',
        displayOptions: {
          show: { resource: ['message'], operation: ['send'], messageType: ['reaction'] },
        },
        routing: {
          send: { type: 'body', property: 'reaction.emoji' },
        },
      },

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
            description: 'Pause AI after sending this message',
            routing: {
              send: { type: 'body', property: 'ai.pause' },
            },
          },
          {
            displayName: 'Pause Duration (Minutes)',
            name: 'pauseDuration',
            type: 'number',
            default: 5,
            description: 'How long to pause AI (1-1440 minutes)',
            routing: {
              send: { type: 'body', property: 'ai.pauseDuration' },
            },
          },
          {
            displayName: 'Disable AI',
            name: 'disableAi',
            type: 'boolean',
            default: false,
            description: 'Permanently disable AI for this conversation',
            routing: {
              send: { type: 'body', property: 'ai.disable' },
            },
          },
          {
            displayName: 'Reply To Message ID',
            name: 'replyTo',
            type: 'string',
            default: '',
            description: 'Message ID to reply to',
            routing: {
              send: { type: 'body', property: 'context.message_id' },
            },
          },
          {
            displayName: 'Create Conversation',
            name: 'createConversation',
            type: 'boolean',
            default: true,
            description: 'Create a conversation if it doesn\'t exist',
            routing: {
              send: { type: 'body', property: 'createConversation' },
            },
          },
          {
            displayName: 'Metadata',
            name: 'metadata',
            type: 'json',
            default: '{}',
            description: 'Custom metadata to attach to the message',
            routing: {
              send: { type: 'body', property: 'metadata' },
            },
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
            description: 'Upload media to WhatsApp CDN',
            routing: {
              request: {
                method: 'POST',
                url: '/media/v1',
              },
            },
          },
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
        },
        routing: {
          send: { type: 'body', property: 'type' },
        },
      },

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
            description: 'Get all conversations',
            routing: {
              request: {
                method: 'GET',
                url: '/conversations/v1',
              },
            },
          },
          {
            name: 'Get',
            value: 'get',
            action: 'Get a conversation',
            description: 'Get a specific conversation',
            routing: {
              request: {
                method: 'GET',
                url: '=/conversations/v1/{{$parameter.conversationId}}',
              },
            },
          },
          {
            name: 'Get by Phone',
            value: 'getByPhone',
            action: 'Get conversation by phone',
            description: 'Find conversation by phone number',
            routing: {
              request: {
                method: 'GET',
                url: '=/conversations/v1/by-phone/{{$parameter.phoneNumber}}',
              },
            },
          },
          {
            name: 'Get Messages',
            value: 'getMessages',
            action: 'Get conversation messages',
            description: 'Get message history of a conversation',
            routing: {
              request: {
                method: 'GET',
                url: '=/conversations/v1/{{$parameter.conversationId}}/messages',
              },
            },
          },
          {
            name: 'Close',
            value: 'close',
            action: 'Close a conversation',
            description: 'Close a conversation',
            routing: {
              request: {
                method: 'POST',
                url: '=/conversations/v1/{{$parameter.conversationId}}/close',
              },
            },
          },
          {
            name: 'Archive',
            value: 'archive',
            action: 'Archive a conversation',
            description: 'Archive a conversation',
            routing: {
              request: {
                method: 'POST',
                url: '=/conversations/v1/{{$parameter.conversationId}}/archive',
              },
            },
          },
          {
            name: 'Mark Read',
            value: 'markRead',
            action: 'Mark conversation as read',
            description: 'Mark a conversation as read',
            routing: {
              request: {
                method: 'PATCH',
                url: '=/conversations/v1/{{$parameter.conversationId}}/mark-read',
              },
            },
          },
          {
            name: 'Set AI',
            value: 'setAi',
            action: 'Enable/disable AI',
            description: 'Enable or disable AI for a conversation',
            routing: {
              request: {
                method: 'PATCH',
                url: '=/conversations/v1/{{$parameter.conversationId}}/ai',
              },
            },
          },
          {
            name: 'Pause AI',
            value: 'pauseAi',
            action: 'Pause AI temporarily',
            description: 'Pause AI for a conversation',
            routing: {
              request: {
                method: 'POST',
                url: '=/conversations/v1/{{$parameter.conversationId}}/ai/pause',
              },
            },
          },
          {
            name: 'AI Suggest',
            value: 'aiSuggest',
            action: 'Get AI suggestion',
            description: 'Get an AI suggestion without sending',
            routing: {
              request: {
                method: 'POST',
                url: '=/conversations/v1/{{$parameter.conversationId}}/ai-suggest',
              },
            },
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
        },
        routing: {
          send: { type: 'body', property: 'aiEnabled' },
        },
      },

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
        },
        routing: {
          send: { type: 'body', property: 'duration' },
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
            description: 'Search by name or phone',
            routing: {
              send: { type: 'query', property: 'search' },
            },
          },
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
            default: 'all',
            routing: {
              send: { type: 'query', property: 'status' },
            },
          },
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20,
            description: 'Max results (1-100)',
            routing: {
              send: { type: 'query', property: 'limit' },
            },
          },
          {
            displayName: 'Offset',
            name: 'offset',
            type: 'number',
            default: 0,
            routing: {
              send: { type: 'query', property: 'offset' },
            },
          },
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
            default: 50,
            routing: {
              send: { type: 'query', property: 'limit' },
            },
          },
          {
            displayName: 'Cursor',
            name: 'cursor',
            type: 'string',
            default: '',
            description: 'Pagination cursor',
            routing: {
              send: { type: 'query', property: 'cursor' },
            },
          },
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
            description: 'Enable or disable AI globally',
            routing: {
              request: {
                method: 'POST',
                url: '/agent/v1/toggle',
              },
            },
          },
          {
            name: 'Pause',
            value: 'pause',
            action: 'Pause AI globally',
            description: 'Pause AI globally for X minutes',
            routing: {
              request: {
                method: 'POST',
                url: '/agent/v1/pause',
              },
            },
          },
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
        },
        routing: {
          send: { type: 'body', property: 'enabled' },
        },
      },

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
        },
        routing: {
          send: { type: 'body', property: 'duration' },
        },
      },

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
            description: 'Get all WhatsApp templates',
            routing: {
              request: {
                method: 'GET',
                url: '/templates/v1',
              },
            },
          },
          {
            name: 'Get',
            value: 'get',
            action: 'Get a template',
            description: 'Get a specific template',
            routing: {
              request: {
                method: 'GET',
                url: '=/templates/v1/{{$parameter.templateId}}',
              },
            },
          },
          {
            name: 'Get Variables',
            value: 'getVariables',
            action: 'Get template variables',
            description: 'Get available template variables',
            routing: {
              request: {
                method: 'GET',
                url: '/templates/v1/variables',
              },
            },
          },
          {
            name: 'Sync',
            value: 'sync',
            action: 'Sync templates',
            description: 'Sync templates from Meta',
            routing: {
              request: {
                method: 'POST',
                url: '/templates/v1/sync',
              },
            },
          },
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
            description: 'Filter by template status',
            routing: {
              send: { type: 'query', property: 'status' },
            },
          },
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20,
            routing: {
              send: { type: 'query', property: 'limit' },
            },
          },
          {
            displayName: 'Offset',
            name: 'offset',
            type: 'number',
            default: 0,
            routing: {
              send: { type: 'query', property: 'offset' },
            },
          },
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
            description: 'Get all contacts',
            routing: {
              request: {
                method: 'GET',
                url: '/contacts/v1',
              },
            },
          },
          {
            name: 'Get',
            value: 'get',
            action: 'Get a contact',
            description: 'Get a specific contact',
            routing: {
              request: {
                method: 'GET',
                url: '=/contacts/v1/{{$parameter.contactId}}',
              },
            },
          },
          {
            name: 'Create',
            value: 'create',
            action: 'Create a contact',
            description: 'Create a new contact',
            routing: {
              request: {
                method: 'POST',
                url: '/contacts/v1',
              },
            },
          },
          {
            name: 'Update',
            value: 'update',
            action: 'Update a contact',
            description: 'Update an existing contact',
            routing: {
              request: {
                method: 'PATCH',
                url: '=/contacts/v1/{{$parameter.contactId}}',
              },
            },
          },
          {
            name: 'Delete',
            value: 'delete',
            action: 'Delete a contact',
            description: 'Delete a contact',
            routing: {
              request: {
                method: 'DELETE',
                url: '=/contacts/v1/{{$parameter.contactId}}',
              },
            },
          },
          {
            name: 'Search',
            value: 'search',
            action: 'Search contacts',
            description: 'Advanced search for contacts',
            routing: {
              request: {
                method: 'POST',
                url: '/contacts/v1/search',
              },
            },
          },
          {
            name: 'Bulk',
            value: 'bulk',
            action: 'Bulk operations',
            description: 'Perform bulk operations on contacts',
            routing: {
              request: {
                method: 'POST',
                url: '/contacts/v1/bulk',
              },
            },
          },
          {
            name: 'Merge',
            value: 'merge',
            action: 'Merge contacts',
            description: 'Merge two contacts',
            routing: {
              request: {
                method: 'POST',
                url: '=/contacts/v1/{{$parameter.contactId}}/merge',
              },
            },
          },
          {
            name: 'Get Tags',
            value: 'getTags',
            action: 'Get all tags',
            description: 'Get all available tags',
            routing: {
              request: {
                method: 'GET',
                url: '/contacts/v1/tags',
              },
            },
          },
          {
            name: 'Get Fields',
            value: 'getFields',
            action: 'Get custom fields',
            description: 'Get available custom fields',
            routing: {
              request: {
                method: 'GET',
                url: '/contacts/v1/fields',
              },
            },
          },
        ],
        default: 'list',
      },

      // Contact: ID field
      {
        displayName: 'Contact ID',
        name: 'contactId',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['contact'],
            operation: ['get', 'update', 'delete', 'merge'],
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
        },
        routing: {
          send: { type: 'body', property: 'name' },
        },
      },
      {
        displayName: 'Phone Number',
        name: 'contactPhone',
        type: 'string',
        required: true,
        default: '',
        placeholder: '+5215512345678',
        displayOptions: {
          show: { resource: ['contact'], operation: ['create'] },
        },
        routing: {
          send: { type: 'body', property: 'phoneNumber' },
        },
      },
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
            default: '',
            routing: {
              send: { type: 'body', property: 'email' },
            },
          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            description: 'Comma-separated list of tags',
            routing: {
              send: { type: 'body', property: 'tags' },
            },
          },
          {
            displayName: 'Custom Fields',
            name: 'customFields',
            type: 'json',
            default: '{}',
            routing: {
              send: { type: 'body', property: 'customFields' },
            },
          },
          {
            displayName: 'Metadata',
            name: 'metadata',
            type: 'json',
            default: '{}',
            routing: {
              send: { type: 'body', property: 'metadata' },
            },
          },
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
            default: '',
            routing: {
              send: { type: 'body', property: 'name' },
            },
          },
          {
            displayName: 'Phone Number',
            name: 'phoneNumber',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'body', property: 'phoneNumber' },
            },
          },
          {
            displayName: 'Email',
            name: 'email',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'body', property: 'email' },
            },
          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            description: 'Comma-separated list of tags',
            routing: {
              send: { type: 'body', property: 'tags' },
            },
          },
          {
            displayName: 'Custom Fields',
            name: 'customFields',
            type: 'json',
            default: '{}',
            routing: {
              send: { type: 'body', property: 'customFields' },
            },
          },
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
        },
        routing: {
          send: { type: 'body', property: 'query' },
        },
      },
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
            default: '{}',
            routing: {
              send: { type: 'body', property: 'filters' },
            },
          },
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20,
            routing: {
              send: { type: 'body', property: 'limit' },
            },
          },
          {
            displayName: 'Cursor',
            name: 'cursor',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'body', property: 'cursor' },
            },
          },
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
        },
        routing: {
          send: { type: 'body', property: 'operation' },
        },
      },
      {
        displayName: 'Contacts Data',
        name: 'bulkContacts',
        type: 'json',
        required: true,
        default: '[]',
        description: 'Array of contacts or contact IDs',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'] },
        },
        routing: {
          send: { type: 'body', property: 'contacts' },
        },
      },
      {
        displayName: 'Operation Data',
        name: 'bulkData',
        type: 'json',
        default: '{}',
        description: 'Additional data for the operation',
        displayOptions: {
          show: { resource: ['contact'], operation: ['bulk'] },
        },
        routing: {
          send: { type: 'body', property: 'data' },
        },
      },

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
        },
        routing: {
          send: { type: 'body', property: 'mergeWith' },
        },
      },

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
            default: '',
            routing: {
              send: { type: 'query', property: 'search' },
            },
          },
          {
            displayName: 'Tags',
            name: 'tags',
            type: 'string',
            default: '',
            description: 'Comma-separated list of tags',
            routing: {
              send: { type: 'query', property: 'tags' },
            },
          },
          {
            displayName: 'Funnel Stage ID',
            name: 'funnelStageId',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'query', property: 'funnel_stage_id' },
            },
          },
          {
            displayName: 'Source',
            name: 'source',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'query', property: 'source' },
            },
          },
          {
            displayName: 'Sort By',
            name: 'sortBy',
            type: 'options',
            options: [
              { name: 'Created At', value: 'created_at' },
              { name: 'Updated At', value: 'updated_at' },
              { name: 'Name', value: 'name' },
            ],
            default: 'created_at',
            routing: {
              send: { type: 'query', property: 'sort_by' },
            },
          },
          {
            displayName: 'Sort Order',
            name: 'sortOrder',
            type: 'options',
            options: [
              { name: 'Ascending', value: 'asc' },
              { name: 'Descending', value: 'desc' },
            ],
            default: 'desc',
            routing: {
              send: { type: 'query', property: 'sort_order' },
            },
          },
          {
            displayName: 'Limit',
            name: 'limit',
            type: 'number',
            default: 20,
            routing: {
              send: { type: 'query', property: 'limit' },
            },
          },
          {
            displayName: 'Cursor',
            name: 'cursor',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'query', property: 'cursor' },
            },
          },
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
            description: 'Get all funnel stages',
            routing: {
              request: {
                method: 'GET',
                url: '/funnel/v1/stages',
              },
            },
          },
          {
            name: 'Get Stage',
            value: 'getStage',
            action: 'Get a funnel stage',
            description: 'Get a specific funnel stage',
            routing: {
              request: {
                method: 'GET',
                url: '=/funnel/v1/stages/{{$parameter.stageId}}',
              },
            },
          },
          {
            name: 'Create Stage',
            value: 'createStage',
            action: 'Create a funnel stage',
            description: 'Create a new funnel stage',
            routing: {
              request: {
                method: 'POST',
                url: '/funnel/v1/stages',
              },
            },
          },
          {
            name: 'Update Stage',
            value: 'updateStage',
            action: 'Update a funnel stage',
            description: 'Update an existing funnel stage',
            routing: {
              request: {
                method: 'PATCH',
                url: '=/funnel/v1/stages/{{$parameter.stageId}}',
              },
            },
          },
          {
            name: 'Delete Stage',
            value: 'deleteStage',
            action: 'Delete a funnel stage',
            description: 'Delete a funnel stage',
            routing: {
              request: {
                method: 'DELETE',
                url: '=/funnel/v1/stages/{{$parameter.stageId}}',
              },
            },
          },
          {
            name: 'Reorder Stages',
            value: 'reorderStages',
            action: 'Reorder funnel stages',
            description: 'Reorder the funnel stages',
            routing: {
              request: {
                method: 'PATCH',
                url: '/funnel/v1/stages/reorder',
              },
            },
          },
          {
            name: 'Move Contact',
            value: 'moveContact',
            action: 'Move contact to stage',
            description: 'Move a contact to a funnel stage',
            routing: {
              request: {
                method: 'POST',
                url: '=/funnel/v1/contacts/{{$parameter.contactIdFunnel}}/move',
              },
            },
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
        },
        routing: {
          send: { type: 'body', property: 'name' },
        },
      },
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
            default: 0,
            routing: {
              send: { type: 'body', property: 'position' },
            },
          },
          {
            displayName: 'Color',
            name: 'color',
            type: 'string',
            default: '#3B82F6',
            description: 'Hex color code',
            routing: {
              send: { type: 'body', property: 'color' },
            },
          },
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'body', property: 'description' },
            },
          },
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
            default: '',
            routing: {
              send: { type: 'body', property: 'name' },
            },
          },
          {
            displayName: 'Position',
            name: 'position',
            type: 'number',
            default: 0,
            routing: {
              send: { type: 'body', property: 'position' },
            },
          },
          {
            displayName: 'Color',
            name: 'color',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'body', property: 'color' },
            },
          },
          {
            displayName: 'Description',
            name: 'description',
            type: 'string',
            default: '',
            routing: {
              send: { type: 'body', property: 'description' },
            },
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
        description: 'Array of objects with id and position',
        displayOptions: {
          show: { resource: ['funnel'], operation: ['reorderStages'] },
        },
        routing: {
          send: { type: 'body', property: 'stages' },
        },
      },

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
        },
        routing: {
          send: { type: 'body', property: 'stageId' },
        },
      },

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
            default: 20,
            routing: {
              send: { type: 'query', property: 'limit' },
            },
          },
          {
            displayName: 'Offset',
            name: 'offset',
            type: 'number',
            default: 0,
            routing: {
              send: { type: 'query', property: 'offset' },
            },
          },
        ],
      },
    ],
  };
}
