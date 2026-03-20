export interface BookDragPayload {
  type: "book";
  workId: string;
  fromShelfId: string;
}

export interface ShelfDragPayload {
  type: "shelf";
  shelfId: string;
}

export type ShelfDragPayloadUnion = BookDragPayload | ShelfDragPayload;

let active: ShelfDragPayloadUnion | null = null;

export function setShelfDragPayload(p: ShelfDragPayloadUnion | null) {
  active = p;
}

export function getShelfDragPayload(): ShelfDragPayloadUnion | null {
  return active;
}
