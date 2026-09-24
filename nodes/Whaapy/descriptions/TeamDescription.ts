import type { INodeProperties } from 'n8n-workflow';

export const teamProperties: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['team'] } },
    options: [
      {
        name: 'Get Many Members',
        value: 'listMembers',
        action: 'Get many team members',
        description: 'List agents with their availability and assigned conversation count',
      },
    ],
    default: 'listMembers',
  },
  {
    displayName: 'Only Available',
    name: 'onlyAvailable',
    type: 'boolean',
    default: false,
    description: 'Whether to return only agents currently marked as available',
    displayOptions: { show: { resource: ['team'], operation: ['listMembers'] } },
  },
];
