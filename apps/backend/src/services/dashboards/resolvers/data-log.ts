import type { DataBlockType } from '@poelens/shared';

/** The part of a request logger that answering needs. */
export interface DataLog {
    error: (details: object, message: string) => void;
}

/** Records why blocks of a type have no data: the request still answers, so the log is the only trace. */
export function logDataFailure(log: DataLog | undefined, error: unknown, type: DataBlockType): void {
    log?.error({ err: error, type }, 'Dashboard blocks could not be priced: ' + type);
}
