export interface CursorPageRequest {
  after?: number;
  before?: number;
  take: number;
}

export interface CursorPageResult<T> {
  data: T[];
  nextCursor: number | null;
  prevCursor: number | null;
  hasNext: boolean;
  hasPrev: boolean;
}
