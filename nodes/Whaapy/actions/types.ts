import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export type OperationResult = IDataObject | IDataObject[];

export type ResourceHandler = (this: IExecuteFunctions, itemIndex: number, operation: string) => Promise<OperationResult>;

export function isV1_1(ctx: IExecuteFunctions): boolean {
  return ctx.getNode().typeVersion >= 1.1;
}

/** Reads string and resourceLocator parameters alike (v1 stores plain strings, v1.1 locators). */
export function getIdParameter(ctx: IExecuteFunctions, name: string, itemIndex: number): string {
  const value = ctx.getNodeParameter(name, itemIndex, '', { extractValue: true }) as string;
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    throw new NodeOperationError(ctx.getNode(), `Parameter "${name}" is required`, { itemIndex });
  }
  return trimmed;
}

export function unsupportedOperation(ctx: IExecuteFunctions, resource: string, operation: string, itemIndex: number): never {
  throw new NodeOperationError(ctx.getNode(), `The operation "${operation}" is not supported for "${resource}"`, {
    itemIndex,
  });
}
