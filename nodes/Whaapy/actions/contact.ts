import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
  compactObject,
  getBaseUrl,
  parseIdList,
  parseJsonParam,
  parseTags,
  runListV1Paginated,
  toWhaapyApiError,
  whaapyApiRequest,
} from '../GenericFunctions';
import type { OperationResult } from './types';
import { isV1_1, unsupportedOperation } from './types';

const BULK_OPERATION_MAP: Record<string, string> = {
  tag: 'add_tags',
  untag: 'remove_tags',
};

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Fields shared by create and update, mapped to the snake_case API contract. */
function mapContactFields(ctx: IExecuteFunctions, i: number, fields: IDataObject): IDataObject {
  const body: IDataObject = {
    name: fields.name,
    email: fields.email,
    company: fields.company,
    notes: fields.notes,
    source: fields.source,
    deal_value: toNumber(fields.dealValue),
    funnel_stage_id: fields.funnelStageId,
  };

  if (fields.assignedAgentId !== undefined && fields.assignedAgentId !== '') {
    body.assigned_agent_id = fields.assignedAgentId === 'none' ? null : fields.assignedAgentId;
  }
  if (fields.tags !== undefined && fields.tags !== '') body.tags = parseTags(fields.tags);
  if (fields.addTags) body.add_tags = parseTags(fields.addTags);
  if (fields.removeTags) body.remove_tags = parseTags(fields.removeTags);
  if (fields.customFields) body.custom_fields = parseJsonParam(ctx, fields.customFields, 'Custom Fields', i, {});

  const compacted = compactObject(body);
  if (body.assigned_agent_id === null) compacted.assigned_agent_id = null;
  return compacted;
}

function buildCreateBody(ctx: IExecuteFunctions, i: number): IDataObject {
  const phone = String(ctx.getNodeParameter('contactPhone', i)).trim();
  if (!phone) {
    throw new NodeOperationError(ctx.getNode(), 'Phone Number is required', { itemIndex: i });
  }
  const additional = ctx.getNodeParameter('contactAdditional', i, {}) as IDataObject;
  const name = String(ctx.getNodeParameter('contactName', i, '') ?? '').trim();
  return {
    ...mapContactFields(ctx, i, { ...additional, name: name || additional.name }),
    phone_number: phone,
  };
}

async function upsert(this: IExecuteFunctions, i: number): Promise<IDataObject> {
  const body = buildCreateBody(this, i);
  const baseUrl = await getBaseUrl.call(this);

  let response: { statusCode: number; body: IDataObject };
  try {
    response = (await this.helpers.httpRequestWithAuthentication.call(this, 'whaapyApi', {
      method: 'POST',
      url: `${baseUrl}/contacts/v1`,
      body,
      json: true,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
    })) as { statusCode: number; body: IDataObject };
  } catch (error) {
    throw toWhaapyApiError(this, error, i);
  }

  if (response.statusCode < 300) return { action: 'created', ...response.body };

  const existingId = response.body?.existing_contact_id;
  if (response.statusCode !== 409 || typeof existingId !== 'string') {
    throw toWhaapyApiError(this, { httpCode: response.statusCode, response: { body: response.body } }, i);
  }

  const { phone_number: _phone, source: _source, ...updates } = body;
  if (Object.keys(updates).length === 0) {
    const current = await whaapyApiRequest.call(this, 'GET', `/contacts/v1/${existingId}`, undefined, undefined, i);
    return { action: 'unchanged', ...current };
  }
  const updated = await whaapyApiRequest.call(this, 'PATCH', `/contacts/v1/${existingId}`, updates, undefined, i);
  return { action: 'updated', ...updated };
}

async function resolveContactIdForGet(ctx: IExecuteFunctions, i: number): Promise<string> {
  if (ctx.getNodeParameter('contactLookupBy', i, 'id') !== 'phone') {
    return ctx.getNodeParameter('contactId', i) as string;
  }
  const phone = ctx.getNodeParameter('contactPhone_lookup', i) as string;
  const check = await whaapyApiRequest.call(ctx, 'GET', '/contacts/check-phone', undefined, { phone }, i);
  if (!check?.exists || !check?.contact?.id) {
    throw new NodeOperationError(ctx.getNode(), `No contact found with phone number: ${phone}`, { itemIndex: i });
  }
  return check.contact.id;
}

function normalizeBulkContact(entry: unknown): unknown {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
  const { phoneNumber, customFields, funnelStageId, dealValue, ...rest } = entry as IDataObject;
  return compactObject({
    ...rest,
    phone_number: rest.phone_number ?? phoneNumber,
    custom_fields: rest.custom_fields ?? customFields,
    funnel_stage_id: rest.funnel_stage_id ?? funnelStageId,
    deal_value: rest.deal_value ?? dealValue,
  });
}

async function bulk(this: IExecuteFunctions, i: number): Promise<IDataObject> {
  const selected = this.getNodeParameter('bulkOperation', i) as string;
  const operation = BULK_OPERATION_MAP[selected] ?? selected;

  if (operation === 'create' || operation === 'update') {
    const contacts = parseJsonParam<unknown[]>(this, this.getNodeParameter('bulkContacts', i, '[]'), 'Contacts Data', i, []);
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new NodeOperationError(this.getNode(), 'Contacts Data must be a non-empty JSON array', { itemIndex: i });
    }
    return whaapyApiRequest.call(
      this,
      'POST',
      '/contacts/v1/bulk',
      { operation, contacts: contacts.map(normalizeBulkContact) as IDataObject[] },
      undefined,
      i,
    );
  }

  const legacyData = isV1_1(this)
    ? {}
    : parseJsonParam<IDataObject>(this, this.getNodeParameter('bulkData', i, '{}'), 'Operation Data', i, {});

  let contactIds = parseIdList(this.getNodeParameter('bulkContactIds', i, ''));
  if (contactIds.length === 0 && !isV1_1(this)) {
    const legacyContacts = parseJsonParam(this, this.getNodeParameter('bulkContacts', i, '[]'), 'Contacts Data', i, []);
    contactIds = parseIdList(legacyContacts);
  }
  if (contactIds.length === 0) contactIds = parseIdList(legacyData.contact_ids ?? legacyData.contactIds);
  if (contactIds.length === 0) {
    throw new NodeOperationError(this.getNode(), 'Provide at least one Contact ID', { itemIndex: i });
  }

  const body: IDataObject = { operation, contact_ids: contactIds };

  if (operation === 'add_tags' || operation === 'remove_tags') {
    let tags = parseTags(this.getNodeParameter('bulkTags', i, ''));
    if (tags.length === 0) tags = parseTags(legacyData.tags);
    if (tags.length === 0) {
      throw new NodeOperationError(this.getNode(), 'Provide at least one tag', { itemIndex: i });
    }
    body.tags = tags;
  }

  if (operation === 'set_funnel_stage') {
    body.funnel_stage_id = this.getNodeParameter('bulkFunnelStageId', i) as string;
  }

  return whaapyApiRequest.call(this, 'POST', '/contacts/v1/bulk', body, undefined, i);
}

async function createLead(this: IExecuteFunctions, i: number): Promise<IDataObject> {
  const fields = this.getNodeParameter('leadFields', i, {}) as IDataObject;
  const body: IDataObject = compactObject({
    phone: String(this.getNodeParameter('leadPhone', i)).trim(),
    name: fields.name,
    email: fields.email,
    source: fields.source,
    externalId: fields.externalId,
    templateId: fields.templateId,
  });
  const tags = parseTags(fields.tags);
  if (tags.length > 0) body.tags = tags;
  if (fields.customFields) body.customFields = parseJsonParam(this, fields.customFields, 'Custom Fields', i, {});
  if (fields.templateVariables) {
    const variables = parseJsonParam<IDataObject>(this, fields.templateVariables, 'Template Variables', i, {});
    if (Object.keys(variables).length > 0) {
      body.templateVariables = Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, String(value)]));
    }
  }
  return whaapyApiRequest.call(this, 'POST', '/inbound/leads', body, undefined, i);
}

export async function contactHandler(this: IExecuteFunctions, i: number, operation: string): Promise<OperationResult> {
  switch (operation) {
    case 'list': {
      const filters = this.getNodeParameter('contactFilters', i, {}) as IDataObject;
      const keyMap: Record<string, string> = {
        sortBy: 'sort_by',
        sortOrder: 'sort_order',
        funnelStageId: 'funnel_stage_id',
      };
      const qs: IDataObject = {};
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') qs[keyMap[key] ?? key] = value;
      }
      return runListV1Paginated(this, {
        endpoint: '/contacts/v1',
        qs,
        returnAll: this.getNodeParameter('returnAll', i, false) as boolean,
        limit: this.getNodeParameter('limit', i, 20) as number,
        itemIndex: i,
      });
    }
    case 'get': {
      const contactId = await resolveContactIdForGet(this, i);
      return whaapyApiRequest.call(this, 'GET', `/contacts/v1/${encodeURIComponent(contactId)}`, undefined, undefined, i);
    }
    case 'create':
      return whaapyApiRequest.call(this, 'POST', '/contacts/v1', buildCreateBody(this, i), undefined, i);
    case 'upsert':
      return upsert.call(this, i);
    case 'update': {
      const contactId = encodeURIComponent(this.getNodeParameter('contactId', i) as string);
      const fields = this.getNodeParameter('contactUpdateFields', i, {}) as IDataObject;
      const body = mapContactFields(this, i, fields);
      if (Object.keys(body).length === 0) {
        throw new NodeOperationError(this.getNode(), 'Add at least one field to update', { itemIndex: i });
      }
      return whaapyApiRequest.call(this, 'PATCH', `/contacts/v1/${contactId}`, body, undefined, i);
    }
    case 'delete': {
      const contactId = encodeURIComponent(this.getNodeParameter('contactId', i) as string);
      return whaapyApiRequest.call(this, 'DELETE', `/contacts/v1/${contactId}`, undefined, undefined, i);
    }
    case 'search': {
      const search = String(this.getNodeParameter('searchQuery', i, '') ?? '').trim();
      const options = this.getNodeParameter('searchOptions', i, {}) as IDataObject;
      const body: IDataObject = {};
      if (search) body.search = search;
      if (options.filters) {
        const filters = parseJsonParam<IDataObject>(this, options.filters, 'Filters', i, {});
        if (Object.keys(filters).length > 0) body.filters = filters;
      }
      return runListV1Paginated(this, {
        method: 'POST',
        endpoint: '/contacts/v1/search',
        body,
        returnAll: this.getNodeParameter('returnAll', i, false) as boolean,
        limit: this.getNodeParameter('limit', i, 20) as number,
        itemIndex: i,
      });
    }
    case 'bulk':
      return bulk.call(this, i);
    case 'merge': {
      const contactId = encodeURIComponent(this.getNodeParameter('contactId', i) as string);
      const sourceContactId = this.getNodeParameter('mergeWithId', i) as string;
      return whaapyApiRequest.call(
        this,
        'POST',
        `/contacts/v1/${contactId}/merge`,
        { source_contact_id: sourceContactId },
        undefined,
        i,
      );
    }
    case 'getTags':
      return whaapyApiRequest.call(this, 'GET', '/contacts/v1/tags', undefined, undefined, i);
    case 'getFields':
      return whaapyApiRequest.call(this, 'GET', '/contacts/v1/fields', undefined, undefined, i);
    case 'addNote': {
      const contactId = encodeURIComponent(this.getNodeParameter('contactId', i) as string);
      const note = String(this.getNodeParameter('noteBody', i)).trim();
      if (!note) throw new NodeOperationError(this.getNode(), 'Note is required', { itemIndex: i });
      return whaapyApiRequest.call(this, 'POST', `/contacts/${contactId}/notes`, { body: note }, undefined, i);
    }
    case 'createLead':
      return createLead.call(this, i);
    default:
      return unsupportedOperation(this, 'contact', operation, i);
  }
}
