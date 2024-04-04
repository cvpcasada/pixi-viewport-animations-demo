import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function invlerp(a: number, b: number, v: number) {
  return (v - a) / (b - a);
}

export function transform(
  iMin: number,
  iMax: number,
  oMin: number,
  oMax: number,
  v: number
) {
  return lerp(oMin, oMax, invlerp(iMin, iMax, v));
}

type Container = {
  width: number;
  height: number;
  x?: number;
  y?: number;
  scale?: { x: number; y: number };
}

function dim(viewport: Container) {
  let scale = viewport.scale ?? { x: 1, y: 1 };
  return {
    width: viewport.width / scale.x,
    height: viewport.height / scale.y,
  };
}

function ct(viewport: Container) {
  let vpDim = dim(viewport);
  let scale = viewport.scale ?? { x: 1, y: 1 };
  let [x, y] = [viewport.x ?? 0, viewport.y ?? 0];
  return {
    x: vpDim.width / 2 - x / scale.x,
    y: vpDim.height / 2 - y / scale.y,
  };
}

export function center(
  viewport: {
    width: number;
    height: number;
    scale?: { x: number; y: number };
  },
  cursor: { x: number; y: number },
  scale: number = 1
) {
  let vpDim = dim(viewport);
  const newX = vpDim.width / 2 - cursor.x * scale;
  const newY = vpDim.height / 2 - cursor.y * scale;

  return { x: newX, y: newY };
}

export function follow(
  viewport: Container,
  cursor: { x: number; y: number },
  radius?: number
) {
  let toX = cursor.x;
  let toY = cursor.y;

  if (radius) {
    const center = ct(viewport);
    const distance = Math.sqrt(
      Math.pow(cursor.y - center.y, 2) + Math.pow(cursor.x - center.x, 2)
    );

    if (distance > radius) {
      const angle = Math.atan2(cursor.y - center.y, cursor.x - center.x);

      toX = cursor.x - Math.cos(angle) * radius;
      toY = cursor.y - Math.sin(angle) * radius;
    }
  }

  return { x: toX, y: toY };
}
