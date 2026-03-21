import type { CascadeFlightRect } from './CascadeFlightOverlay';

type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

export function measureNodeInWindow(
  node: Measurable | null | undefined,
  fallback: CascadeFlightRect
): Promise<CascadeFlightRect> {
  return new Promise((resolve) => {
    if (!node || typeof node.measureInWindow !== 'function') {
      resolve(fallback);
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      resolve({ x, y, w: w > 0 ? w : fallback.w, h: h > 0 ? h : fallback.h });
    });
  });
}
