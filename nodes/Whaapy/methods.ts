import type {
  IDataObject,
  ILoadOptionsFunctions,
  INodeListSearchItems,
  INodeListSearchResult,
  INodePropertyOptions,
  ResourceMapperField,
  ResourceMapperFields,
} from 'n8n-workflow';

import { extractItems, whaapyApiRequest } from './GenericFunctions';

function matchesFilter(filter: string | undefined, ...values: unknown[]): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return values.some((value) => typeof value === 'string' && value.toLowerCase().includes(needle));
}

async function fetchTemplates(ctx: ILoadOptionsFunctions): Promise<IDataObject[]> {
  const response = await whaapyApiRequest.call(ctx, 'GET', '/templates/v1');
  return extractItems(response, ['data', 'templates']);
}

async function fetchStages(ctx: ILoadOptionsFunctions): Promise<IDataObject[]> {
  const response = await whaapyApiRequest.call(ctx, 'GET', '/funnel/v1/stages');
  return extractItems(response, ['data', 'stages']);
}

async function searchTemplateNames(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
  const templates = await fetchTemplates(this);
  const languagesByName = new Map<string, string[]>();
  for (const template of templates) {
    const name = String(template.name ?? '');
    if (!name || !matchesFilter(filter, name)) continue;
    const languages = languagesByName.get(name) ?? [];
    if (template.language) languages.push(String(template.language));
    languagesByName.set(name, languages);
  }

  const results: INodeListSearchItems[] = [...languagesByName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, languages]) => ({
      name: languages.length ? `${name} (${languages.join(', ')})` : name,
      value: name,
    }));
  return { results };
}

async function searchTemplates(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
  const templates = await fetchTemplates(this);
  const results: INodeListSearchItems[] = templates
    .filter((template) => matchesFilter(filter, template.name, template.id))
    .map((template) => ({
      name: `${template.name}${template.language ? ` (${template.language})` : ''}`,
      value: String(template.id),
    }));
  return { results };
}

async function searchFunnelStages(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
  const stages = await fetchStages(this);
  const results: INodeListSearchItems[] = stages
    .filter((stage) => matchesFilter(filter, stage.name, stage.id))
    .map((stage) => ({ name: String(stage.name), value: String(stage.id) }));
  return { results };
}

async function searchBroadcasts(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
  const response = await whaapyApiRequest.call(this, 'GET', '/broadcasts', undefined, { limit: 100, offset: 0 });
  const results: INodeListSearchItems[] = extractItems(response, ['data'])
    .filter((broadcast: IDataObject) => matchesFilter(filter, broadcast.name, broadcast.id))
    .map((broadcast: IDataObject) => ({
      name: `${broadcast.name}${broadcast.status ? ` · ${broadcast.status}` : ''}`,
      value: String(broadcast.id),
    }));
  return { results };
}

export const listSearch = {
  searchTemplateNames,
  searchTemplates,
  searchFunnelStages,
  searchBroadcasts,
};

async function getTeamMembers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const response = await whaapyApiRequest.call(this, 'GET', '/team/v1');
  return extractItems(response, ['agents', 'data']).map((agent: IDataObject) => ({
    name: `${agent.name || agent.email}${agent.role ? ` (${agent.role})` : ''}`,
    value: String(agent.id),
    description: typeof agent.email === 'string' ? agent.email : undefined,
  }));
}

async function getFunnelStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const stages = await fetchStages(this);
  return stages.map((stage) => ({ name: String(stage.name), value: String(stage.id) }));
}

export const loadOptions = {
  getTeamMembers,
  getFunnelStages,
};

function resolveTemplateLanguage(ctx: ILoadOptionsFunctions): string {
  const selected = String(ctx.getCurrentNodeParameter('templateLanguage') ?? '');
  if (selected === '__custom__') return String(ctx.getCurrentNodeParameter('templateLanguageCustom') ?? '').trim();
  return selected;
}

async function getTemplateVariableFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
  const templateName = String(this.getCurrentNodeParameter('templateName', { extractValue: true }) ?? '').trim();
  if (!templateName) return { fields: [] };

  const language = resolveTemplateLanguage(this);
  const candidates = (await fetchTemplates(this)).filter((template) => template.name === templateName);
  const template = candidates.find((candidate) => candidate.language === language) ?? candidates[0];
  if (!template) {
    return { fields: [], emptyFieldsNotice: `Template "${templateName}" was not found among approved templates` };
  }

  const fields: ResourceMapperField[] = [];
  const bodyVariables = Array.isArray(template.bodyVariables) ? (template.bodyVariables as IDataObject[]) : [];
  for (const variable of bodyVariables) {
    const example = typeof variable.example === 'string' ? ` (e.g. ${variable.example})` : '';
    fields.push({
      id: `body_${variable.index}`,
      displayName: `Body {{${variable.index}}}${example}`,
      required: true,
      defaultMatch: false,
      display: true,
      type: 'string',
      canBeUsedToMatch: false,
    });
  }

  const buttonVariables = Array.isArray(template.buttonVariables) ? (template.buttonVariables as IDataObject[]) : [];
  for (const button of buttonVariables) {
    const label = button.text ? `"${button.text}"` : `#${button.index}`;
    fields.push({
      id: `button_${button.index}`,
      displayName: `URL Button ${label} suffix`,
      required: true,
      defaultMatch: false,
      display: true,
      type: 'string',
      canBeUsedToMatch: false,
    });
  }

  return { fields };
}

export const resourceMapping = {
  getTemplateVariableFields,
};
