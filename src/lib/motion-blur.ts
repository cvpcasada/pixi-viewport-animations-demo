import {
  deprecation,
  Filter,
  GlProgram,
  GpuProgram,
  ObservablePoint,
  PointData,
} from "pixi.js";

import { wgslVertex, vertex } from "pixi-filters/defaults";

const fragment =
  "precision highp float;\nin vec2 vTextureCoord;\nout vec4 finalColor;\n\nuniform sampler2D uTexture;\nuniform vec2 uVelocity;\nuniform int uKernelSize;\nuniform float uOffset;\n\nuniform vec4 uInputSize;\n\nconst int MAX_KERNEL_SIZE = 2048;\n\n// Notice:\n// the perfect way:\n//    int kernelSize = min(uKernelSize, MAX_KERNELSIZE);\n// BUT in real use-case , uKernelSize < MAX_KERNELSIZE almost always.\n// So use uKernelSize directly.\n\nvoid main(void)\n{\n    vec4 color = texture(uTexture, vTextureCoord);\n\n    if (uKernelSize == 0)\n    {\n        finalColor = color;\n        return;\n    }\n\n    vec2 velocity = uVelocity / uInputSize.xy;\n    float offset = -uOffset / length(uVelocity) - 0.5;\n    int k = uKernelSize - 1;\n\n    for(int i = 0; i < MAX_KERNEL_SIZE - 1; i++) {\n        if (i == k) {\n            break;\n        }\n        vec2 bias = velocity * (float(i) / float(k) + offset);\n        color += texture(uTexture, vTextureCoord + bias);\n    }\n    finalColor = color / float(uKernelSize);\n}\n";
const source =
  "struct MotionBlurUniforms {\n  uVelocity: vec2<f32>,\n  uKernelSize: f32,\n  uOffset: f32,\n};\n\nstruct GlobalFilterUniforms {\n  uInputSize:vec4<f32>,\n  uInputPixel:vec4<f32>,\n  uInputClamp:vec4<f32>,\n  uOutputFrame:vec4<f32>,\n  uGlobalFrame:vec4<f32>,\n  uOutputTexture:vec4<f32>,\n};\n\n@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;\n\n@group(0) @binding(1) var uTexture: texture_2d<f32>; \n@group(0) @binding(2) var uSampler: sampler;\n@group(1) @binding(0) var<uniform> motionBlurUniforms : MotionBlurUniforms;\n\n@fragment\nfn mainFragment(\n  @builtin(position) position: vec4<f32>,\n  @location(0) uv : vec2<f32>\n) -> @location(0) vec4<f32> {\n  let uVelocity = motionBlurUniforms.uVelocity;\n  let uKernelSize = motionBlurUniforms.uKernelSize;\n  let uOffset = motionBlurUniforms.uOffset;\n\n  let velocity: vec2<f32> = uVelocity / gfu.uInputSize.xy;\n  let offset: f32 = -uOffset / length(uVelocity) - 0.5;\n  let k: i32 = i32(min(uKernelSize - 1, MAX_KERNEL_SIZE - 1));\n\n  var color: vec4<f32> = textureSample(uTexture, uSampler, uv);\n\n  for(var i: i32 = 0; i < k; i += 1) {\n    let bias: vec2<f32> = velocity * (f32(i) / f32(k) + offset);\n    color += textureSample(uTexture, uSampler, uv + bias);\n  }\n  \n  return select(color / f32(uKernelSize), textureSample(uTexture, uSampler, uv), uKernelSize == 0);\n}\n\nconst MAX_KERNEL_SIZE: f32 = 2048;";

/** Options for the MotionBlurFilter constructor. */
export interface MotionBlurFilterOptions {
  /**
   * Sets the velocity of the motion for blur effect
   * This should be a size 2 array or an object containing `x` and `y` values, you cannot change types
   * once defined in the constructor
   * @default {x:0,y:0}
   */
  velocity?: PointData | number[];
  /**
   * The kernelSize of the blur filter. Must be odd number >= 5
   * @default 5
   */
  kernelSize?: number;
  /**
   * The offset of the blur filter
   * @default 0
   */
  offset?: number;
}

/**
 * The MotionBlurFilter applies a Motion blur to an object.<br>
 * ![original](../screenshots/original.png)![filter](../screenshots/motion-blur.png)
 *
 * @class
 * @extends Filter
 */
export class MotionBlurFilter extends Filter {
  /** Default values for options. */
  public static readonly DEFAULT_OPTIONS: MotionBlurFilterOptions = {
    velocity: { x: 0, y: 0 },
    kernelSize: 5,
    offset: 0,
  };

  public uniforms: {
    uVelocity: PointData;
    uKernelSize: number;
    uOffset: number;
  };

  private _kernelSize!: number;

  /**
   * @param options - Options for the MotionBlurFilter constructor.
   */
  constructor(options?: MotionBlurFilterOptions);
  /**
   * @deprecated since 8.0.0
   *
   * @param {PIXI.ObservablePoint|PIXI.PointData|number[]} [velocity=[0, 0]] - Sets the velocity of the motion for blur effect.
   * @param {number} [kernelSize=5] - The kernelSize of the blur filter. Must be odd number >= 5
   * @param {number} [offset=0] - The offset of the blur filter.
   */
  constructor(
    velocity?: number[] | PointData | ObservablePoint,
    kernelSize?: number,
    offset?: number
  );
  /** @ignore */
  constructor(
    ...args:
      | [MotionBlurFilterOptions?]
      | [(number[] | PointData | ObservablePoint)?, number?, number?]
  ) {
    let options = args[0] ?? {};

    if (
      Array.isArray(options) ||
      ("x" in options && "y" in options) ||
      options instanceof ObservablePoint
    ) {
      // eslint-disable-next-line max-len
      deprecation(
        "6.0.0",
        "MotionBlurFilter constructor params are now options object. See params: { velocity, kernelSize, offset }"
      );

      const x = "x" in options ? options.x : options[0];
      const y = "y" in options ? options.y : options[1];

      options = { velocity: { x, y } };

      if (args[1] !== undefined) options.kernelSize = args[1];
      if (args[2] !== undefined) options.offset = args[2];
    }

    options = { ...MotionBlurFilter.DEFAULT_OPTIONS, ...options };

    const gpuProgram = GpuProgram.from({
      vertex: {
        source: wgslVertex,
        entryPoint: "mainVertex",
      },
      fragment: {
        source,
        entryPoint: "mainFragment",
      },
    });

    const glProgram = GlProgram.from({
      vertex,
      fragment,
      name: "motion-blur-filter",
    });

    super({
      gpuProgram,
      glProgram,
      resources: {
        motionBlurUniforms: {
          uVelocity: { value: options.velocity, type: "vec2<f32>" },
          uKernelSize: {
            value: Math.trunc(options.kernelSize ?? 5),
            type: "f32",
          },
          uOffset: { value: options.offset, type: "f32" },
        },
      },
    });

    this.uniforms = this.resources.motionBlurUniforms.uniforms;

    Object.assign(this, options);
  }

  /**
   * Sets the velocity of the motion for blur effect
   * This should be a size 2 array or an object containing `x` and `y` values, you cannot change types
   * once defined in the constructor
   * @default {x:0,y:0}
   */
  get velocity(): PointData {
    return this.uniforms.uVelocity;
  }
  set velocity(value: PointData | number[]) {
    if (Array.isArray(value)) {
      value = { x: value[0], y: value[1] };
    }

    this.uniforms.uVelocity = value;
    this._updateDirty();
  }

  /**
   * Sets the velocity of the motion for blur effect on the `x` axis
   * @default 0
   */
  get velocityX(): number {
    return this.velocity.x;
  }
  set velocityX(value: number) {
    this.velocity.x = value;
    this._updateDirty();
  }

  /**
   * Sets the velocity of the motion for blur effect on the `x` axis
   * @default 0
   */
  get velocityY(): number {
    return this.velocity.y;
  }
  set velocityY(value: number) {
    this.velocity.y = value;
    this._updateDirty();
  }

  /**
   * The kernelSize of the blur filter. Must be odd number >= 5
   * @default 5
   */
  get kernelSize(): number {
    return this._kernelSize;
  }
  set kernelSize(value: number) {
    this._kernelSize = value;
    this._updateDirty();
  }

  /**
   * The offset of the blur filter
   * @default 0
   */
  get offset(): number {
    return this.uniforms.uOffset;
  }
  set offset(value: number) {
    this.uniforms.uOffset = value;
  }

  private _updateDirty() {
    // The padding will be increased as the velocity and intern the blur size is changed
    this.padding =
      (Math.max(Math.abs(this.velocityX), Math.abs(this.velocityY)) >> 0) + 1;
    this.uniforms.uKernelSize =
      this.velocityX !== 0 || this.velocityY !== 0 ? this._kernelSize : 0;
  }
}
