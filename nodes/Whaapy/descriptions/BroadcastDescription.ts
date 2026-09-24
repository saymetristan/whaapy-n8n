import type { INodeProperties } from 'n8n-workflow';

import { broadcastLocator, returnAllAndLimit, templateIdLocator } from './common';

const show = (operation: string[]) => ({ resource: ['broadcast'], operation });

export const broadcastProperties: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['broadcast'] } },
    options: [
      {
        name: 'Add Recipients',
        value: 'addRecipients',
        action: 'Add recipients to a broadcast',
        description: 'Add all contacts, segments or a list of phone numbers to a draft broadcast',
      },
      { name: 'Cancel', value: 'cancel', action: 'Cancel a broadcast' },
      {
        name: 'Create',
        value: 'create',
        action: 'Create a broadcast',
        description: 'Create a draft broadcast with an approved template',
      },
      { name: 'Delete', value: 'delete', action: 'Delete a broadcast' },
      { name: 'Get', value: 'get', action: 'Get a broadcast' },
      { name: 'Get Many', value: 'list', action: 'Get many broadcasts' },
      { name: 'Get Recipients', value: 'getRecipients', action: 'Get broadcast recipients' },
      {
        name: 'Get Summary',
        value: 'getSummary',
        action: 'Get a broadcast summary',
        description: 'Delivery, read and failure counters',
      },
      { name: 'Pause', value: 'pause', action: 'Pause a broadcast' },
      { name: 'Resume', value: 'resume', action: 'Resume a broadcast' },
      {
        name: 'Retry Failed',
        value: 'retryFailed',
        action: 'Retry failed broadcast recipients',
        description: 'Re-queue recipients whose delivery failed',
      },
      { name: 'Send', value: 'send', action: 'Send a broadcast', description: 'Start sending a draft broadcast' },
    ],
    default: 'list',
  },

  broadcastLocator(
    show(['addRecipients', 'cancel', 'delete', 'get', 'getRecipients', 'getSummary', 'pause', 'resume', 'retryFailed', 'send']),
  ),

  // Create
  {
    displayName: 'Name',
    name: 'broadcastName',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'Promo Black Friday',
    displayOptions: { show: show(['create']) },
  },
  templateIdLocator('broadcastTemplateId', show(['create'])),
  {
    displayName: 'Options',
    name: 'broadcastOptions',
    type: 'collection',
    placeholder: 'Add Option',
    default: {},
    displayOptions: { show: show(['create']) },
    options: [
      {
        displayName: 'Tag to Apply',
        name: 'tagToApply',
        type: 'string',
        default: '',
        description: 'Tag added to every contact that receives the broadcast',
      },
      {
        displayName: 'Variable Mapping',
        name: 'variableMapping',
        type: 'json',
        default: '{}',
        description: 'Maps template variables to contact fields, e.g. {"1":"contact.name","2":"contact.phone"}',
      },
    ],
  },

  // Add recipients
  {
    displayName: 'Recipients Source',
    name: 'recipientsSource',
    type: 'options',
    default: 'list',
    options: [
      { name: 'Phone List', value: 'list', description: 'Phone numbers, optionally with per-recipient template parameters' },
      { name: 'Segments', value: 'segments', description: 'Contacts in one or more saved segments' },
      { name: 'All Contacts', value: 'all', description: 'Every contact in the business' },
    ],
    displayOptions: { show: show(['addRecipients']) },
  },
  {
    displayName: 'Recipients',
    name: 'recipients',
    type: 'json',
    required: true,
    default: '[{"phoneNumber":"+5215512345678"}]',
    description: 'Array of {"phoneNumber","templateParameters"} objects, or an array/comma-separated list of phone numbers',
    displayOptions: { show: { ...show(['addRecipients']), recipientsSource: ['list'] } },
  },
  {
    displayName: 'Segment IDs',
    name: 'segmentIds',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'uuid-1, uuid-2',
    displayOptions: { show: { ...show(['addRecipients']), recipientsSource: ['segments'] } },
  },

  // Lists
  ...returnAllAndLimit(show(['list']), 100, 50),
  {
    displayName: 'Filters',
    name: 'broadcastFilters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: { show: show(['list']) },
    options: [
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        default: 'draft',
        options: [
          { name: 'Cancelled', value: 'cancelled' },
          { name: 'Completed', value: 'completed' },
          { name: 'Draft', value: 'draft' },
          { name: 'Failed', value: 'failed' },
          { name: 'Paused', value: 'paused' },
          { name: 'Scheduled', value: 'scheduled' },
          { name: 'Sending', value: 'sending' },
        ],
      },
    ],
  },
  ...returnAllAndLimit(show(['getRecipients']), 100, 50),
  {
    displayName: 'Filters',
    name: 'recipientFilters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: { show: show(['getRecipients']) },
    options: [
      {
        displayName: 'Status',
        name: 'status',
        type: 'options',
        default: 'errors',
        options: [
          { name: 'Delivered', value: 'delivered' },
          { name: 'Errors (Failed or Undelivered)', value: 'errors' },
          { name: 'Pending', value: 'pending' },
          { name: 'Read', value: 'read' },
          { name: 'Responded', value: 'responded' },
          { name: 'Sent', value: 'sent' },
        ],
      },
      {
        displayName: 'Search',
        name: 'q',
        type: 'string',
        default: '',
        description: 'Filter by phone number or name',
      },
    ],
  },
];
