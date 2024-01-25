import { invlerp } from "./utils";
import * as PIXI from "pixi.js";
import gud from "gud";

window.global ||= window;

export type ViewportTransform = {
  x: number;
  y: number;
  scale: number;
};

export type Keyframe = {
  id: string | number;
  animation: "zoom-in" | "zoom-out" | "follow";
  start: number;
  end: number;
};

export function createKeyframe(
  animation: "zoom-in" | "zoom-out" | "follow",
  start: number,
  end: number
): Keyframe {
  return {
    id: `${animation}-${gud()}`,
    animation,
    start,
    end,
  };
}

/// mock stuff:
export function mockCursorPosition(
  arg0: number | { x: number; y: number },
  arg1?: number
) {
  const sprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  sprite.tint = 0xff0000;
  sprite.width = sprite.height = 15;

  if (typeof arg0 === "object") {
    sprite.position.set(arg0.x, arg0.y);
  } else {
    sprite.position.set(arg0, arg1);
  }

  return sprite;
}

export const SpringPreset = {
  Default: springConfig(1, 170, 26, 0),
  Gentle: springConfig(1, 90, 14, 0),
  Wobbly: springConfig(1, 180, 12, 0),
  Stiff: springConfig(1, 400, 35, 0),
  Slow: springConfig(1, 20, 50, 0),
  Molasses: springConfig(1, 6, 5, 0),
};

export function springConfig(
  mass: number,
  stiffness: number,
  damping: number,
  velocity: number = 0
) {
  return [mass, stiffness, damping, velocity];
}

type KeyframeInterpolationConfig<T> = {
  keyframes: Keyframe[];
  from: T;
  to: (args: { keyframe: Keyframe; keyframes: Keyframe[]; index: number }) => T;
  duration: number;
  interpolationFn: (args: {
    from: T;
    to: T;
    t: number;
    index: number;
    keyframe: Keyframe;
    keyframes: Keyframe[];
  }) => T;
};

/**
 * Creates a keyframes interpolation function based on the provided configuration.
 *
 * @param config - The configuration for keyframe interpolation
 * @return The interpolation function that takes a time parameter and returns the interpolated value
 */
export function createKeyframesInterpolationFn<T>(
  config: KeyframeInterpolationConfig<T>
): (t: number) => T {
  return (t: number) => {
    let index = config.keyframes.findIndex((i) => i.end >= t * config.duration);

    if (index === -1) return config.from;
    let currentKeyframe = config.keyframes[index];

    let current = config.from;

    for (let i = 0; i <= index; i++) {
      current = config.interpolationFn({
        from: current,
        to: config.to({
          keyframe: config.keyframes[i],
          keyframes: config.keyframes,
          index: i,
        }),
        t:
          i === index
            ? invlerp(
                currentKeyframe.start,
                currentKeyframe.end,
                t * config.duration
              )
            : 1,
        index: i,
        keyframe: config.keyframes[i],
        keyframes: config.keyframes,
      });
    }

    return current;
  };
}
