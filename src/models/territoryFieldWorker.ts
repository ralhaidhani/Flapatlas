import {
  bakeTerritoryField3D,
  type TerritoryFieldBakeInput,
  type TerritoryFieldData,
} from './territoryFieldCore';

/**
 * Phase 11b (§3.3) — Dedicated Web Worker for non-blocking 3-D territory field baking.
 * Receives seed clusters + bounds, runs `bakeTerritoryField3D()`, streams progress,
 * and transfers the RGBA8 voxel buffer back with zero-copy semantics.
 */

export interface TerritoryWorkerBakeRequest {
  type: 'bake';
  requestId: number;
  input: TerritoryFieldBakeInput;
}

export type TerritoryWorkerOutboundMessage =
  | {
      type: 'progress';
      requestId: number;
      pct: number;
      label: string;
    }
  | {
      type: 'done';
      requestId: number;
      field: TerritoryFieldData;
    }
  | {
      type: 'error';
      requestId: number;
      message: string;
    };

const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<TerritoryWorkerBakeRequest>) => void) | null;
  postMessage: (msg: TerritoryWorkerOutboundMessage, transfer?: Transferable[]) => void;
};

ctx.onmessage = (ev: MessageEvent<TerritoryWorkerBakeRequest>) => {
  const msg = ev.data;
  if (!msg || msg.type !== 'bake') return;

  try {
    const field = bakeTerritoryField3D(msg.input, (pct, label) => {
      ctx.postMessage({
        type: 'progress',
        requestId: msg.requestId,
        pct,
        label,
      });
    });

    ctx.postMessage(
      {
        type: 'done',
        requestId: msg.requestId,
        field,
      },
      [field.voxels.buffer]
    );
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      requestId: msg.requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
