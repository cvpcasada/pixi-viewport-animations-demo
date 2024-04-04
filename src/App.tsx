import * as PIXI from "pixi.js";
import {
    Suspense,
    useLayoutEffect,
    useRef,
    useState,
    createContext,
    useContext,
} from "react";
import { animate, type AnimationControls } from "motion";
import { Slider } from "@/components/ui/slider";
import { center, follow, lerp } from "@/lib/utils";
import {
    createKeyframe,
    createKeyframesInterpolationFn,
    mockCursorPosition,
    springConfig,
} from "./lib/animation";

import { SpringFrame } from "spring-easing";
import { drawSquircle } from "./superellipse";
import { useControls, button } from "leva";
import { suspend } from "suspend-react";
// import GameStats from "gamestats.js";
import mitt from "mitt";
import {
    DropShadowFilter,
    DropShadowFilterOptions,
} from "pixi-filters/drop-shadow";

import {
  MotionBlurFilter,
  MotionBlurFilterOptions,
} from "pixi-filters/motion-blur";


const $ = mitt<{
  blur: number;
  radius: number;
  width: number;
  height: number;
  shadow: DropShadowFilterOptions;
}>();

// let stats = new GameStats();
// document.body.appendChild( stats.dom );

// create viewport
const viewport = new PIXI.Container();

async function initApp(app: PIXI.Application) {
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    autoStart: false,
    backgroundColor: 0xff00ff,
    // antialias: true,
    // antialias: true,
    // autoDensity: true,
  });

  // let point = center(viewport, {
  //   x: viewport.width / 2,
  //   y: viewport.height / 2,
  // });

  // add the viewport to the stage
  app.stage.addChild(viewport);

  const bgTexture = await PIXI.Assets.load("./texture.jpg");

  class BackgroundImage extends PIXI.Sprite {
    $ = $;
    filter: PIXI.BlurFilter;
    templateSprite: PIXI.Sprite;
    template: PIXI.Container;

    readonly MAX_BLUR = 25;

    // Create a mask to define the area where the blur will be applied
    constructor(texture: PIXI.Texture) {
      let filter = new PIXI.BlurFilter({
        strength: 0,
        quality: 10,
        resolution: window.devicePixelRatio ?? 1,
      });

      let templateSprite = new PIXI.Sprite({
        texture,
      });

      templateSprite.filters = [filter];

      let mask = new PIXI.Graphics()
        .rect(0, 0, texture.width, texture.height)
        .fill(0xffffff);

      let template = new PIXI.Container();
      template.addChild(mask);
      template.addChild(templateSprite);
      template.mask = mask;

      super(createRenderTexture(template, app.renderer));

      this.templateSprite = templateSprite;
      this.template = template;
      this.filter = filter;

      this.$.on("blur", (val) => {
        this.blur = val;

        app.render();
      });
    }

    // range: [0, 1]
    set blur(val: number) {
      let blur = this.MAX_BLUR * val;
      let offset = (this.MAX_BLUR / 100) * val;

      this.filter.blur = blur;

      this.templateSprite.x = -(this.templateSprite.texture.width * offset) / 2;
      this.templateSprite.y =
        -(this.templateSprite.texture.height * offset) / 2;
      this.templateSprite.scale.set(1 + offset);

      // destroy previous texture
      this.texture.destroy();

      this.texture = createRenderTexture(this.template, app.renderer);
    }
  }

  const tilingSprite = new BackgroundImage(bgTexture);

  let g = drawSuperEllipse();

  type SquircleOptions = {
    radius: number;
    cornerSmoothing?: number;
    width: number;
    height: number;
  };

  class SquircleShape extends PIXI.Sprite {
    #width: number;
    #height: number;
    #radius: number;
    #cornerSmoothing?: number;

    constructor(options: SquircleOptions) {
      let template = drawSuperEllipse(
        options.radius,
        options.cornerSmoothing,
        options.width,
        options.height
      );

      super(createRenderTexture(template, app.renderer));

      this.#width = options.width;
      this.#height = options.height;
      this.#radius = options.radius;
      this.#cornerSmoothing = options.cornerSmoothing;
    }

    get radius() {
      return this.#radius;
    }

    set radius(val: number) {
      this.#radius = val;
      this.render();
    }

    set width(val: number) {
      this.#width = val;
      this.render();
    }

    get width() {
      return super.width;
    }

    set height(val: number) {
      this.#height = val;
      this.render();
    }

    get height() {
      return super.height;
    }

    render() {
      let template = drawSuperEllipse(
        this.#radius,
        this.#cornerSmoothing,
        this.#width,
        this.#height
      );
      this.texture.destroy();
      this.texture = createRenderTexture(template, app.renderer);
      super.width = this.texture.width;
      super.height = this.texture.height;
    }
  }

  class ContentContainer extends PIXI.Container {
    readonly SHADOW_PADDING = 50;
    maskShape = new SquircleShape({
      radius: 50,
      cornerSmoothing: 0.8,
      width: 16 * 25,
      height: 9 * 25,
    });

    backdrop: PIXI.Sprite;
    inner = new PIXI.Container();
    #shadowOpts = {
      ...DropShadowFilter.DEFAULT_OPTIONS,
      offset: { x: 0, y: 0 },
      // blur: 10,
      quality: 10,
      alpha: 0.8,
      shadowOnly: true,
      padding: this.SHADOW_PADDING,
    };

    constructor() {
      super();
      this.backdrop = new PIXI.Sprite(
        createRenderTexture(
          withShadowFilter(this.maskShape.texture, this.#shadowOpts),
          app.renderer
        )
      );

      // this.maskShape.position.set(this.SHADOW_PADDING);
      super.addChild(this.backdrop);

      this.inner.position.set(this.SHADOW_PADDING);
      this.inner.mask = this.maskShape;

      this.inner.addChild(this.maskShape);
      super.addChild(this.inner);

      $.on("radius", (val) => {
        this.radius = val;
        app.render();
      });

      $.on("width", (val) => {
        this.width = val;
        app.render();
      });

      $.on("height", (val) => {
        this.height = val;
        app.render();
      });

      $.on("shadow", (val) => {
        this.shadow(val);
        app.render();
      });

      // this.mask = this.template;
    }

    set width(val: number) {
      this.shapeWidth = Math.max(val, 1);
      this.inner.children.forEach((c) => (c.width = Math.max(val, 1)));
    }

    get width() {
      return super.width - this.SHADOW_PADDING * 2;
    }

    set height(val: number) {
      this.shapeHeight = Math.max(val, 1);
      this.inner.children.forEach((c) => (c.height = Math.max(val, 1)));
    }

    get height() {
      return super.height - this.SHADOW_PADDING * 2;
    }

    get layoutWidth() {
      return super.width;
    }

    get layoutHeight() {
      return super.height;
    }

    set shapeWidth(val: number) {
      let lastX = this.position.x;
      let delta = val - this.maskShape.width;

      this.maskShape.width = val;
      this.#renderBackdrop();

      this.position.x = lastX - delta / 2;
    }

    set shapeHeight(val: number) {
      let lastY = this.position.y;
      let delta = val - this.maskShape.height;

      this.maskShape.height = val;
      this.#renderBackdrop();

      this.position.y = lastY - delta / 2;
    }

    set radius(val: number) {
      this.maskShape.radius = val;
      this.#renderBackdrop();
    }

    shadow(opts: DropShadowFilterOptions) {
      this.#shadowOpts = Object.assign(this.#shadowOpts, opts);
      this.#renderBackdrop();
    }

    addChild<U extends PIXI.ContainerChild[]>(...children: U): U[0] {
      if (this.inner.children.length > 1 || children.length > 1) {
        throw new Error("Only one child is allowed");
      }

      let maxW = children[0].width;
      let maxH = children[0].height;
      let inner = this.inner.addChild(children[0]);

      this.shapeWidth = maxW;
      this.shapeHeight = maxH;

      return inner;
    }

    #renderBackdrop() {
      this.backdrop.texture.destroy();
      this.backdrop.texture = createRenderTexture(
        withShadowFilter(this.maskShape.texture, this.#shadowOpts),
        app.renderer
      );
    }
  }

  let squircle = new SquircleShape({
    radius: 50,
    cornerSmoothing: 0.8,
    width: 16 * 25,
    height: 9 * 25,
  });

  squircle.label = "squircle";

  let content = new ContentContainer();
  content.addChild(new PIXI.Sprite(bgTexture));
  let point = center(
    { width: window.innerWidth, height: window.innerHeight },
    {
      x: content.layoutWidth / 2,
      y: content.layoutHeight / 2,
    }
  );

  content.position.set(point.x, point.y);

  viewport.addChild(tilingSprite, content, ...trail);
}

function createRenderTexture(
  template: PIXI.Container,
  renderer: PIXI.Renderer
) {
  let { maxX, maxY } = template.getBounds(true);
  // Draw the circle to the RenderTexture
  let renderTexture = PIXI.RenderTexture.create({
    width: Math.floor(maxX),
    height: Math.floor(maxY),
    antialias: true,
    resolution: window.devicePixelRatio ?? 1,
  });

  // With the existing renderer, render texture
  // make sure to apply a transform Matrix
  renderer.render({
    target: renderTexture,
    container: template,
  });

  return renderTexture;
}

function drawSuperEllipse(
  radius = 50,
  cornerSmoothing = 0.8,
  width = 16 * 25,
  height = 9 * 25
) {
  // Create a graphics object to draw the superellipse
  let graphics = new PIXI.Graphics();
  graphics.label = "super-ellipse";

  return drawSquircle(graphics, {
    cornerRadius: radius,
    width,
    height,
    cornerSmoothing,
  }).fill(0xffffff);
}

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

let _app = new PIXI.Application();
let AppCtx = createContext<PIXI.Application>(_app);

function PixiCanvasContainer() {
  let app = useContext(AppCtx);
  const containerRef = useRef<HTMLDivElement>(null);

  suspend(() => initApp(app), [app]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.appendChild(app.canvas as unknown as Node);

    return () => {
      el.removeChild(app.canvas as unknown as Node);
    };
  }, [app]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full overflow-scroll"
    />
  );
}

function App() {
  return (
    <Suspense>
      <PixiCanvasContainer />
      <AnimationControls />
    </Suspense>
  );
}

function withShadowFilter(
  texture: PIXI.Texture,
  options: DropShadowFilterOptions & {
    padding?: number;
  }
) {
  let { padding = 50, ...shadowOpts } = options;
  let shape = new PIXI.Sprite(texture);

  let container = new PIXI.Container();
  let bounds = new PIXI.Graphics()
    .rect(0, 0, shape.width + padding * 2, shape.height + padding * 2)
    .fill(0xffffff);
  bounds.alpha = 0;

  // let shadowFilter = new DropShadowFilter(shadowOpts);
  let shadowFilter = new MotionBlurFilter({
    kernelSize: 15,
    offset: shadowOpts.blur ?? 0,

  });

  shape.position.set(padding);
  shape.filters = [shadowFilter];

  container.addChild(bounds);
  container.addChild(shape);

  return container;
}

function AnimationControls() {
  let app = useContext(AppCtx);
  let ref = useRef<AnimationControls | null>(null);
  let [sliderVal, setVal] = useState(0);
  let playbackDuration = Keyframes[Keyframes.length - 1].end;

  let SpringConfigRef = useRef({
    zoomIn: {
      mass: 1,
      stiffness: 170,
      damping: 26,
    },
    follow: {
      mass: 1,
      stiffness: 170,
      damping: 26,
    },
    zoomOut: {
      mass: 1,
      stiffness: 170,
      damping: 26,
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

  useControls("Settings", {
    bg_filter: {
      min: 0,
      max: 1,
      value: 0.2,
      step: 0.01,
      onChange(val) {
        $.emit("blur", val);
      },
    },
    sq_radius: {
      min: 0,
      max: 1,
      value: 0.1,
      onChange(val) {
        $.emit("radius", val * 100);
      },
    },

    sq_width: {
      min: 16 * 10,
      value: 16 * 25,
      onChange(val) {
        $.emit("width", val);
      },
    },

    sq_height: {
      min: 9 * 10,
      value: 9 * 25,
      step: 1,
      onChange(val) {
        $.emit("height", val);
      },
    },
  });

  useControls("Shadow", {
    blur: {
      min: 0,
      value: DropShadowFilter.DEFAULT_OPTIONS.blur!,
      max: 10,
      step: 0.1,
      // height: 9 * 25,
      onChange(val) {
        $.emit("shadow", { blur: val });
      },
    },

    color: {
      value: {
        r: 0,
        g: 0,
        b: 0,
      },
      onChange(val: { r: number; g: number; b: number }) {
        $.emit("shadow", { color: rgbToHex(val.r, val.g, val.b) });
      },
    },

    opacity: {
      min: 0,
      value: DropShadowFilter.DEFAULT_OPTIONS.alpha!,
      max: 1,
      step: 0.01,
      // height: 9 * 25,
      onChange(val) {
        $.emit("shadow", { alpha: val });
      },
    },

    resolution: {
      min: 0,
      value: 1,
      max: 2,
      step: 0.5,
      // height: 9 * 25,
      onChange(val) {
        $.emit("shadow", { resolution: val });
      },
    },

    quality: {
      min: 1,
      max: 10,
      step: 0.1,
      value: 10,
      onChange(val) {
        $.emit("shadow", { quality: val });
      },
    },

    offset: {
      value: { x: 0, y: 0 },
      step: 1,
      onChange(val) {
        $.emit("shadow", { offset: val });
      },
    },

    px_size: {
      value: DropShadowFilter.DEFAULT_OPTIONS.pixelSize as {
        x: number;
        y: number;
      },
      min: 1,
      step: 1,
      onChange(val) {
        $.emit("shadow", { pixelSize: val });
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
        // stats.begin();

        let interpolated = interpolationFn(t);

        // update viewport position
        // viewport.x = interpolated.x;
        // viewport.y = interpolated.y;
        viewport.position.set(interpolated.x, interpolated.y);

        // update viewport scale
        viewport.scale.y = viewport.scale.x = interpolated.scale;

        // viewport.plugins.reset();

        // update Slider ui
        setVal(animation.currentTime ?? 0);

        app.render();

        // stats.end();
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
    <div className="absolute bottom-4 flex w-full gap-4 px-10">
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

function rgbToHex(r: number, g: number, b: number) {
  return (r << 16) | (g << 8) | b;
}

export default App;
