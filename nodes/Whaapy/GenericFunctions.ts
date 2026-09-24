import type {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  IWebhookFunctions,
  JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export type WhaapyContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

export const DEFAULT_BASE_URL = 'https://api.whaapy.com';

export async function getBaseUrl(this: WhaapyContext): Promise<string> {
  const credentials = await this.getCredentials('whaapyApi');
  const raw = typeof credentials.baseUrl === 'string' && credentials.baseUrl.trim() ? credentials.baseUrl : DEFAULT_BASE_URL;
  return raw.trim().replace(/\/+$/, '');
}

function extractErrorBody(error: any): any {
  return (
    error?.response?.body ??
    error?.response?.data ??
    error?.cause?.response?.data ??
    error?.cause?.response?.body ??
    error?.cause?.error ??
    error?.error ??
    error?.context?.data
  );
}

function extractErrorStatus(error: any): number | undefined {
  const candidates = [
    error?.httpCode,
    error?.statusCode,
    error?.response?.status,
    error?.response?.statusCode,
    error?.cause?.response?.status,
    error?.cause?.status,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isInteger(value) && value >= 100) return value;
  }
  return undefined;
}

function stringifyDetails(details: unknown): string | undefined {
  if (details == null) return undefined;
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details);
  } catch {
    return undefined;
  }
}

export function toWhaapyApiError(ctx: WhaapyContext, error: unknown, itemIndex?: number): NodeApiError {
  const body = extractErrorBody(error);
  const status = extractErrorStatus(error);
  const parsedBody = typeof body === 'string' ? safeJsonParse(body) ?? body : body;

  let message = 'Whaapy API request failed';
  let description: string | undefined;

  if (parsedBody && typeof parsedBody === 'object') {
    const backendMessage = parsedBody.message || parsedBody.error;
    if (backendMessage) message = String(backendMessage);
    description = stringifyDetails(parsedBody.details ?? parsedBody.errors);
  } else if (typeof parsedBody === 'string' && parsedBody.trim()) {
    message = parsedBody.trim();
  } else if (error instanceof Error && error.message) {
    message = error.message;
  }

  if (status === 403 && parsedBody && typeof parsedBody === 'object' && String(parsedBody.message || '').startsWith('Missing required scopes')) {
    const scopes = String(parsedBody.message).replace('Missing required scopes:', '').trim();
    message = `Your Whaapy API key is missing the scope: ${scopes}`;
    description = 'Edit the API key in app.whaapy.com → Settings → API Keys and add the scope. You do not need to recreate the n8n credential.';
  }

  if (status === 401) {
    description = description ?? 'Check that the API key in the Whaapy credential is valid and active.';
  }

  return new NodeApiError(ctx.getNode(), (parsedBody && typeof parsedBody === 'object' ? parsedBody : { message }) as JsonObject, {
    message: status ? `${message} (HTTP ${status})` : message,
    description,
    httpCode: status ? String(status) : undefined,
    itemIndex,
  });
}

export async function whaapyApiRequest(
  this: WhaapyContext,
  method: IHttpRequestMethods,
  endpoint: string,
  body?: IDataObject,
  qs?: IDataObject,
  itemIndex?: number,
): Promise<any> {
  const baseUrl = await getBaseUrl.call(this);
  const options: IHttpRequestOptions = {
    method,
    url: `${baseUrl}${endpoint}`,
    json: true,
  };
  if (body !== undefined) options.body = body;
  if (qs && Object.keys(qs).length > 0) options.qs = qs;

  try {
    return await this.helpers.httpRequestWithAuthentication.call(this, 'whaapyApi', options);
  } catch (error) {
    throw toWhaapyApiError(this, error, itemIndex);
  }
}

/** Offset-paginated endpoints (`/broadcasts`, `/broadcasts/:id/recipients`) return `{ data, meta: { hasMore } }`. */
export async function whaapyApiRequestOffset(
  this: IExecuteFunctions,
  endpoint: string,
  qs: IDataObject,
  returnAll: boolean,
  limit: number,
  itemIndex: number,
): Promise<IDataObject[]> {
  const pageSize = returnAll ? 100 : limit;
  const results: IDataObject[] = [];
  let offset = 0;

  for (let page = 0; page < 200; page++) {
    const response = await whaapyApiRequest.call(this, 'GET', endpoint, undefined, { ...qs, limit: pageSize, offset }, itemIndex);
    const data = extractItems(response, ['data', 'recipients']);
    results.push(...data);
    const hasMore = response?.meta?.hasMore ?? response?.pagination?.has_more ?? data.length === pageSize;
    if (!returnAll || !hasMore || data.length === 0) break;
    offset += data.length;
  }

  return returnAll ? results : results.slice(0, limit);
}

export function safeJsonParse(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** Parses JSON parameters that may come as objects (expressions) or strings. Empty values return `fallback`. */
export function parseJsonParam<T = any>(
  ctx: IExecuteFunctions,
  value: unknown,
  fieldName: string,
  itemIndex: number,
  fallback?: T,
): T {
  if (value === undefined || value === null) return fallback as T;
  if (typeof value !== 'string') return value as T;
  const trimmed = value.trim();
  if (!trimmed) return fallback as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    throw new NodeOperationError(ctx.getNode(), `"${fieldName}" is not valid JSON`, {
      itemIndex,
      description: (error as Error).message,
    });
  }
}

/** Accepts arrays, JSON arrays or comma/newline separated strings. */
export function parseIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry && typeof entry === 'object' ? (entry as IDataObject).id : entry))
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    const parsed = safeJsonParse(trimmed);
    if (Array.isArray(parsed)) return parseIdList(parsed);
  }
  return trimmed
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function compactObject(input: IDataObject): IDataObject {
  const output: IDataObject = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === '') continue;
    output[key] = value;
  }
  return output;
}

// ============================================================================
// PAGINATION HELPER
// ----------------------------------------------------------------------------
// Centraliza el llamado a endpoints `/v1` que devuelven el envelope
// `{ data: [...], pagination: { next_cursor, has_more, ... } }`.
//
// Si `returnAll = true`, usa la opción nativa `pagination` de
// `httpRequestWithAuthentication`: n8n itera automáticamente leyendo
// `next_cursor` de la respuesta y reinyectándolo como query param
// hasta que el servidor devuelva `has_more = false` (o `next_cursor = null`).
//
// Si `returnAll = false`, sólo trae una página con el `limit` indicado.
//
// Devuelve siempre un array PLANO de items (concatenando páginas), listo
// para mapearse a `INodeExecutionData[]` (1 item de n8n por elemento).
// ============================================================================
export async function runListV1Paginated(
  ctx: IExecuteFunctions,
  opts: {
    method?: IHttpRequestMethods;
    /** Path relative to the credential base URL, e.g. `/contacts/v1`. */
    endpoint: string;
    qs?: Record<string, any>;
    body?: Record<string, any>;
    returnAll: boolean;
    limit: number;
    /** Index del item de entrada (n8n necesita esto para `requestWithAuthenticationPaginated`). */
    itemIndex?: number;
    /** Claves a buscar en la respuesta para extraer los items (en orden de prioridad). */
    dataKeys?: string[];
    /** Cap de seguridad de páginas para `returnAll`. Default 200. */
    maxPages?: number;
  },
): Promise<any[]> {
  try {
    return await runListV1PaginatedUnsafe(ctx, opts);
  } catch (error) {
    if (error instanceof NodeApiError) throw error;
    throw toWhaapyApiError(ctx, error, opts.itemIndex);
  }
}

async function runListV1PaginatedUnsafe(
  ctx: IExecuteFunctions,
  opts: Parameters<typeof runListV1Paginated>[1],
): Promise<any[]> {
  const url = `${await getBaseUrl.call(ctx)}${opts.endpoint}`;
  const {
    method = 'GET',
    qs = {},
    body,
    returnAll,
    limit,
    itemIndex = 0,
    dataKeys = ['data', 'contacts', 'conversations', 'messages', 'stages', 'templates'],
    maxPages = 200,
  } = opts;

  const baseQs: Record<string, any> = { ...qs, limit };
  const isPostBody = method === 'POST' && body !== undefined;

  // Construimos `IRequestOptions` (legacy shape): `requestWithAuthenticationPaginated`
  // y `httpRequestWithAuthentication` aceptan ambas el mismo shape básico
  // (uri/url, qs, body, headers, json, method).
  const requestOptions: any = {
    method,
    uri: url,
    url,
    qs: isPostBody ? undefined : baseQs,
    body: isPostBody ? { ...body, limit } : undefined,
    json: true,
  };

  if (!returnAll) {
    const single = await ctx.helpers.httpRequestWithAuthentication.call(
      ctx,
      'whaapyApi',
      requestOptions as IHttpRequestOptions,
    );
    return extractItems(single, dataKeys);
  }

  // Paginación nativa: n8n itera leyendo `next_cursor` del response y reinyectándolo.
  // Para POST search, el cursor va en el body. Para GET, en query string.
  const paginationOptions = {
    continue: '={{ $response.body?.pagination?.has_more === true || (!!$response.body?.pagination?.next_cursor) }}',
    request: isPostBody
      ? {
          body: {
            cursor: '={{ $response.body?.pagination?.next_cursor ?? $response.body?.next_cursor }}',
          },
        }
      : {
          qs: {
            cursor: '={{ $response.body?.pagination?.next_cursor ?? $response.body?.next_cursor }}',
          },
        },
    requestInterval: 100,
    maxRequests: maxPages,
  };

  const pages: any[] = await ctx.helpers.requestWithAuthenticationPaginated.call(
    ctx,
    requestOptions,
    itemIndex,
    paginationOptions,
    'whaapyApi',
  );

  return pages.flatMap((page: any) => extractItems(page, dataKeys));
}

export function extractItems(raw: any, dataKeys: string[]): any[] {
  if (!raw) return [];
  // `requestWithAuthenticationPaginated` puede devolver `{ body, headers, statusCode }`.
  const payload = raw?.body && typeof raw.body === 'object' ? raw.body : raw;
  for (const key of dataKeys) {
    const value = payload?.[key];
    if (Array.isArray(value)) return value;
  }
  if (Array.isArray(payload)) return payload;
  return [];
}

// Helper function to convert string to slug (for auto-generating IDs)
export function slugify(text: string): string {
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

export function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  return trimmed
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// Build interactive message payload from structured fields
export function buildInteractivePayload(params: {
  interactiveType: string;
  bodyText: string;
  headerType?: string;
  headerText?: string;
  headerMediaUrl?: string;
  headerMediaId?: string;
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
    } else if (['image', 'video', 'document'].includes(params.headerType) && (params.headerMediaId || params.headerMediaUrl)) {
      interactive.header = {
        type: params.headerType,
        [params.headerType]: params.headerMediaId ? { id: params.headerMediaId } : { link: params.headerMediaUrl },
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

export function parseTemplateParameters(rawParameters: unknown): string[] {
  if (rawParameters == null) {
    return [];
  }

  if (Array.isArray(rawParameters)) {
    return rawParameters
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0);
  }

  if (typeof rawParameters === 'string') {
    const trimmedValue = rawParameters.trim();
    if (!trimmedValue) {
      return [];
    }

    // Allow expressions to return JSON arrays: '["Juan","#ORD-123"]'
    if (trimmedValue.startsWith('[') && trimmedValue.endsWith(']')) {
      try {
        const parsedValue = JSON.parse(trimmedValue);
        if (Array.isArray(parsedValue)) {
          return parsedValue
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0);
        }
      } catch {
        // Fallback to comma-separated parsing below
      }
    }

    return trimmedValue
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [String(rawParameters).trim()].filter((value) => value.length > 0);
}

function invalidTemplateJson(fieldName: string, strict: boolean): void {
  if (strict) {
    throw new Error(`"${fieldName}" is not valid JSON`);
  }
}

export function parseTemplateQuickReplyOverrides(rawOverrides: unknown, strict = false): Record<number, string> {
  if (rawOverrides == null || rawOverrides === '') {
    return {};
  }

  let parsed: unknown = rawOverrides;
  if (typeof rawOverrides === 'string') {
    const trimmed = rawOverrides.trim();
    if (!trimmed) return {};

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      invalidTemplateJson('Quick Reply Payload Overrides', strict);
      return {};
    }
  }

  const result: Record<number, string> = {};

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const indexValue = Number((item as any)?.index);
      const payloadValue = (item as any)?.payload;
      if (Number.isInteger(indexValue) && indexValue >= 0 && typeof payloadValue === 'string' && payloadValue.trim()) {
        result[indexValue] = payloadValue.trim();
      }
    }
    return result;
  }

  if (parsed && typeof parsed === 'object') {
    for (const [indexKey, payloadValue] of Object.entries(parsed as Record<string, unknown>)) {
      const indexValue = Number(indexKey);
      if (Number.isInteger(indexValue) && indexValue >= 0 && typeof payloadValue === 'string' && payloadValue.trim()) {
        result[indexValue] = payloadValue.trim();
      }
    }
  }

  return result;
}

export function parseTemplateUrlButtonParameters(
  rawOverrides: unknown,
  strict = false,
): Array<{ index: string; parameters: Array<{ type: 'text'; text: string }> }> {
  if (rawOverrides == null || rawOverrides === '') {
    return [];
  }

  let parsed: unknown = rawOverrides;
  if (typeof rawOverrides === 'string') {
    const trimmed = rawOverrides.trim();
    if (!trimmed) return [];

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      invalidTemplateJson('URL Button Parameters', strict);
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      const indexValue = Number((item as any)?.index);
      const textValue = (item as any)?.text;
      if (!Number.isInteger(indexValue) || indexValue < 0 || typeof textValue !== 'string' || !textValue.trim()) {
        return null;
      }

      return {
        index: String(indexValue),
        parameters: [{ type: 'text' as const, text: textValue.trim() }],
      };
    })
    .filter((item): item is { index: string; parameters: Array<{ type: 'text'; text: string }> } => item !== null);
}

export function parseTemplateComponents(rawComponents: unknown, strict = false): Array<Record<string, any>> {
  if (rawComponents == null || rawComponents === '') {
    return [];
  }

  let parsed: unknown = rawComponents;
  if (typeof rawComponents === 'string') {
    const trimmed = rawComponents.trim();
    if (!trimmed) return [];

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      invalidTemplateJson('Template Components', strict);
      return [];
    }
  }

  return Array.isArray(parsed)
    ? parsed.filter((component): component is Record<string, any> => component != null && typeof component === 'object')
    : [];
}

export function getTemplateComponentKey(component: Record<string, any>): string {
  if (component.type === 'button') {
    return `button:${String(component.sub_type || '')}:${String(component.index || '')}`;
  }

  return String(component.type || '');
}

export function mergeTemplateComponents(
  baseComponents: Array<Record<string, any>>,
  overrideComponents: Array<Record<string, any>>,
): Array<Record<string, any>> {
  const merged = new Map<string, Record<string, any>>();
  const orderedKeys: string[] = [];

  for (const component of [...baseComponents, ...overrideComponents]) {
    const key = getTemplateComponentKey(component);
    if (!merged.has(key)) {
      orderedKeys.push(key);
    }
    merged.set(key, component);
  }

  return orderedKeys
    .map((key) => merged.get(key))
    .filter((component): component is Record<string, any> => component !== undefined);
}
