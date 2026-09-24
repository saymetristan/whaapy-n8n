import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ resource: ['contact'], operation });

export const contactExtraProperties: INodeProperties[] = [
  // Add Note
  {
    displayName: 'Note',
    name: 'noteBody',
    type: 'string',
    typeOptions: { rows: 3 },
    required: true,
    default: '',
    displayOptions: { show: show(['addNote']) },
  },

  // Create Lead
  {
    displayName: 'Phone Number',
    name: 'leadPhone',
    type: 'string',
    required: true,
    default: '',
    placeholder: '+5215512345678',
    description: 'Phone number with country code',
    displayOptions: { show: show(['createLead']) },
  },
  {
    displayName: 'Additional Fields',
    name: 'leadFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: { show: show(['createLead']) },
    options: [
      {
        displayName: 'Custom Fields',
        name: 'customFields',
        type: 'json',
        default: '{}',
      },
      {
        displayName: 'Email',
        name: 'email',
        type: 'string',
        placeholder: 'name@email.com',
        default: '',
      },
      {
        displayName: 'External ID',
        name: 'externalId',
        type: 'string',
        default: '',
        description: 'ID of the lead in the source system (CRM, form, ads)',
      },
      {
        displayName: 'Name',
        name: 'name',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Source',
        name: 'source',
        type: 'string',
        default: 'n8n',
      },
      {
        displayName: 'Tags',
        name: 'tags',
        type: 'string',
        default: '',
        description: 'Comma-separated tags',
      },
      {
        displayName: 'Template ID',
        name: 'templateId',
        type: 'string',
        default: '',
        description: 'Approved template sent to the lead right after it is created',
      },
      {
        displayName: 'Template Variables',
        name: 'templateVariables',
        type: 'json',
        default: '{}',
        description: 'Values for the template variables, e.g. {"1":"Juan"}',
      },
    ],
  },
];
