import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { useLayoutEffect, useRef, useState } from "react";
import { animate, AnimationControls } from "motion";
import { Slider } from "@/components/ui/slider";
import { center, follow, lerp } from "@/lib/utils";
import {
  createKeyframe,
  createKeyframesInterpolationFn,
  mockCursorPosition,
  springConfig,
} from "./lib/animation";

import { SpringFrame } from "spring-easing";

import { useControls, button } from "leva";

const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
});

// create viewport
const viewport = new Viewport({
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  worldWidth: window.innerWidth,
  worldHeight: window.innerHeight,

  events: app.renderer.events, // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
});

// add the viewport to the stage
app.stage.addChild(viewport);

PIXI.Assets.load("./bg.jpg").then((texture) => {
  const tilingSprite = new PIXI.TilingSprite(
    texture,
    viewport.worldWidth,
    viewport.worldHeight
  );
  viewport.addChild(tilingSprite);

  for (let i of trail) {
    viewport.addChild(i);
  }
});

const Keyframes = [
  createKeyframe("zoom-in", 0, 2),
  createKeyframe("follow", 2, 4),
  createKeyframe("follow", 4, 6),
  createKeyframe("follow", 6, 8),
  createKeyframe("follow", 8, 10),
  createKeyframe("zoom-out", 10, 12),
];

const trail = [
  mockCursorPosition(20, 50),
  mockCursorPosition(70, 150),
  mockCursorPosition(200, 300),
  mockCursorPosition(400, 340),
  mockCursorPosition(500, 400),
];


function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    el.appendChild(app.view as unknown as Node);

    return () => {
      el.removeChild(app.view as unknown as Node);
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute w-full h-full inset-0 overflow-scroll"
      ></div>
      <AnimationControls />
    </>
  );
}

function AnimationControls() {
  let ref = useRef<AnimationControls | null>(null);
  let [sliderVal, setVal] = useState(0);
  let playbackDuration = Keyframes[Keyframes.length - 1].end;

  let SpringConfigRef = useRef({
    zoomIn: {
      mass: 1,
      stiffness: 1,
      damping: 1,
    },
    follow: {
      mass: 1,
      stiffness: 1,
      damping: 1,
    },
    zoomOut: {
      mass: 1,
      stiffness: 1,
      damping: 1,
    },
  });

  useControls({
    "Play/Pause": button(() => {
      if (!ref.current) return;
      const animation = ref.current;

      if (
        animation.playState === "finished" ||
        animation.playState === "idle"
      ) {
        animation.play();
        animation.currentTime = 0;
        return;
      }

      if (animation.playState !== "paused") {
        animation.pause();
      } else {
        animation.play();
      }
    }),
  });

  useControls("Zoom In", {
    mass: {
      value: 1,
      min: 1,
      max: 20,
      onChange: (val) => {
        SpringConfigRef.current.zoomIn.mass = val;
      },
    },
    stiffness: {
      value: 170,
      min: 1,
      max: 500,
      onChange: (val) => {
        SpringConfigRef.current.zoomIn.stiffness = val;
      },
    },
    damping: {
      value: 26,
      min: 1,
      max: 180,
      onChange: (val) => {
        SpringConfigRef.current.zoomIn.damping = val;
      },
    },
  });

  useControls("Follow", {
    mass: {
      value: 1,
      min: 1,
      max: 20,
      onChange: (val) => {
        SpringConfigRef.current.follow.mass = val;
      },
    },
    stiffness: {
      value: 210,
      min: 1,
      max: 500,
      onChange: (val) => {
        SpringConfigRef.current.follow.stiffness = val;
      },
    },
    damping: {
      value: 20,
      min: 1,
      max: 180,
      onChange: (val) => {
        SpringConfigRef.current.follow.damping = val;
      },
    },
  });

  useControls("Zoom Out", {
    mass: {
      value: 1,
      min: 1,
      max: 20,
      onChange: (val) => {
        SpringConfigRef.current.zoomOut.mass = val;
      },
    },
    stiffness: {
      value: 170,
      min: 1,
      max: 500,
      onChange: (val) => {
        SpringConfigRef.current.zoomOut.stiffness = val;
      },
    },
    damping: {
      value: 26,
      min: 1,
      max: 180,
      onChange: (val) => {
        SpringConfigRef.current.zoomOut.damping = val;
      },
    },
  });

  useLayoutEffect(() => {
    if (ref.current) return;

    // Animation Block logic
    // 3 parts: zoom-in , follow, zoom-out ( total animation duration == size of zoom block )
    // with springs easings, duration is provided by the ease function output ( not configurable )
    // note: duration === speed in the canvid schema

    let interpolationFn = createKeyframesInterpolationFn({
      keyframes: Keyframes,
      from: {
        x: 0,
        y: 0,
        scale: 1,
      },
      to: ({ index }) => {
        // mock cursor position during follow timestamp
        // replace with cursorPositionAt(t)

        let cursorSprite = trail?.[index] ?? trail[trail.length - 1];
        return {
          x: cursorSprite.width / 2 + cursorSprite.position.x,
          y: cursorSprite.height / 2 + cursorSprite.position.y,
          scale: 4,
        };
      },
      duration: playbackDuration,
      interpolationFn: ({ from, to, t, keyframe }) => {
        if (String(keyframe.id).startsWith("zoom-in")) {
          let fT = SpringFrame(
            t,
            springConfig(
              SpringConfigRef.current.zoomIn.mass,
              SpringConfigRef.current.zoomIn.stiffness,
              SpringConfigRef.current.zoomIn.damping
            ),
            (keyframe.end - keyframe.start) * 1000
          );
          let viewportCenter = center(viewport, to, to.scale);

          return {
            x: lerp(0, viewportCenter.x, fT),
            y: lerp(0, viewportCenter.y, fT),
            scale: lerp(1, to.scale, fT),
          };
        }

        if (String(keyframe.id).startsWith("zoom-out")) {
          let fT = SpringFrame(
            t,
            springConfig(
              SpringConfigRef.current.zoomOut.mass,
              SpringConfigRef.current.zoomOut.stiffness,
              SpringConfigRef.current.zoomOut.damping
            ),
            (keyframe.end - keyframe.start) * 1000
          );

          return {
            x: lerp(from.x, 0, fT),
            y: lerp(from.y, 0, fT),
            scale: lerp(from.scale, 1, fT),
          };
        }

        if (String(keyframe.id).startsWith("follow")) {
          let fT = SpringFrame(
            t,
            springConfig(
              SpringConfigRef.current.follow.mass,
              SpringConfigRef.current.follow.stiffness,
              SpringConfigRef.current.follow.damping
            ),
            (keyframe.end - keyframe.start) * 1000
          );
          let cursor = center(viewport, follow(viewport, to), to.scale);

          return {
            x: lerp(from.x, cursor.x, fT),
            y: lerp(from.y, cursor.y, fT),
            scale: from.scale,
          };
        }

        return from;
      },
    });

    const animation = (ref.current = animate(
      (t: number) => {
        viewport.dirty = false;

        let interpolated = interpolationFn(t);

        // update viewport position
        viewport.position.set(interpolated.x, interpolated.y);

        // update viewport scale
        viewport.scale.y = viewport.scale.x = interpolated.scale;

        // viewport.plugins.reset();
        viewport.dirty = true;

        // update Slider ui
        setVal(animation.currentTime ?? 0);
      },
      { autoplay: false, duration: playbackDuration, easing: "linear" }
    ));

    return () => {
      if (animation) {
        animation.stop();
        ref.current = null;
      }
    };
  }, []);

  return (
    <div className="flex gap-4 absolute bottom-4 w-full px-10">
      <Slider
        className="grow"
        value={[sliderVal]}
        onValueChange={([val]) => {
          if (!ref.current) return;
          const animation = ref.current;
          if (
            animation.playState === "finished" ||
            animation.playState === "idle"
          ) {
            animation.play();
            animation.pause();
            animation.currentTime = 0;
          } else if (animation.playState !== "paused") {
            animation.pause();
          }

          animation.currentTime = val;
          setVal(val);
        }}
        max={playbackDuration}
        step={1 / (1000 * 1000)}
      />
    </div>
  );
}

export default App;