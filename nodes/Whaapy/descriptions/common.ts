import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';

export const V1 = [1];
export const V1_1 = [1.1];

type Show = NonNullable<IDisplayOptions['show']>;

/** Restricts a property to the given node versions without touching its other display conditions. */
export function forVersion(property: INodeProperties, versions: number[]): INodeProperties {
  return {
    ...property,
    displayOptions: {
      ...property.displayOptions,
      show: {
        ...(property.displayOptions?.show ?? {}),
        '@version': versions,
      },
    },
  };
}

const UUID_REGEX = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

function idMode(placeholder = '8f0c1f3e-2b7a-4c1e-9a55-0d3f7e0b1a2c') {
  return {
    displayName: 'By ID',
    name: 'id',
    type: 'string' as const,
    placeholder,
    validation: [
      {
        type: 'regex' as const,
        properties: { regex: UUID_REGEX, errorMessage: 'Not a valid Whaapy ID (UUID)' },
      },
    ],
  };
}

export function templateNameLocator(show: Show): INodeProperties {
  return {
    displayName: 'Template',
    name: 'templateName',
    type: 'resourceLocator',
    required: true,
    default: { mode: 'list', value: '' },
    description: 'Approved WhatsApp template to send',
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchTemplateNames', searchable: true },
      },
      {
        displayName: 'By Name',
        name: 'name',
        type: 'string',
        placeholder: 'orden_confirmada',
      },
    ],
    displayOptions: { show },
  };
}

export function templateIdLocator(name: string, show: Show): INodeProperties {
  return {
    displayName: 'Template',
    name,
    type: 'resourceLocator',
    required: true,
    default: { mode: 'list', value: '' },
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchTemplates', searchable: true },
      },
      idMode(),
    ],
    displayOptions: { show },
  };
}

export function funnelStageLocator(name: string, displayName: string, show: Show): INodeProperties {
  return {
    displayName,
    name,
    type: 'resourceLocator',
    required: true,
    default: { mode: 'list', value: '' },
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchFunnelStages', searchable: true },
      },
      idMode(),
    ],
    displayOptions: { show },
  };
}

export function broadcastLocator(show: Show): INodeProperties {
  return {
    displayName: 'Broadcast',
    name: 'broadcastId',
    type: 'resourceLocator',
    required: true,
    default: { mode: 'list', value: '' },
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchBroadcasts', searchable: true },
      },
      idMode(),
    ],
    displayOptions: { show },
  };
}

export function returnAllAndLimit(show: Show, maxLimit = 100, defaultLimit = 50): INodeProperties[] {
  return [
    {
      displayName: 'Return All',
      name: 'returnAll',
      type: 'boolean',
      default: false,
      description: 'Whether to return all results or only up to a given limit',
      displayOptions: { show },
    },
    {
      displayName: 'Limit',
      name: 'limit',
      type: 'number',
      typeOptions: { minValue: 1, maxValue: maxLimit },
      default: defaultLimit,
      description: 'Max number of results to return',
      displayOptions: { show: { ...show, returnAll: [false] } },
    },
  ];
}
