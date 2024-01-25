import { type ClassValue, clsx } from "clsx";
import { Viewport } from "pixi-viewport";
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

export function center(
  viewport: Viewport,
  cursor: { x: number; y: number },
  scale: number = 1
) {
  const newX = viewport.worldWidth / 2 - cursor.x * scale;
  const newY = viewport.worldHeight / 2 - cursor.y * scale;

  return { x: newX, y: newY };
}

export function follow(
  viewport: Viewport,
  cursor: { x: number; y: number },
  radius?: number
) {
  let toX = cursor.x;
  let toY = cursor.y;

  if (radius) {
    const center = viewport.center;
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
