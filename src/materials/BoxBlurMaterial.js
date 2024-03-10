import { NoBlending, PerspectiveCamera, ShaderMaterial, Uniform, Vector2 } from "three";
import { orthographicDepthToViewZ } from "../utils/orthographicDepthToViewZ.js";
import { viewZToOrthographicDepth } from "../utils/viewZToOrthographicDepth.js";

import fragmentShader from "./glsl/convolution.box.frag";
import vertexShader from "./glsl/convolution.box.vert";

/**
 * A fast box blur material that supports depth-based bilateral filtering.
 *
 * @implements {Resizable}
 */

export class BoxBlurMaterial extends ShaderMaterial {

	/**
	 * Constructs a new box blur material.
	 *
	 * @param {Object} [options] - The options.
	 * @param {Number} [options.bilateral=false] - Enables or disables bilateral blurring.
	 * @param {Number} [options.kernelSize=5] - The kernel size.
	 */

	constructor({ bilateral = false, kernelSize = 5 } = {}) {

		super({
			name: "BoxBlurMaterial",
			defines: {
				DEPTH_PACKING: "0",
				DISTANCE_THRESHOLD: "0.1"
			},
			uniforms: {
				inputBuffer: new Uniform(null),
				depthBuffer: new Uniform(null),
				normalDepthBuffer: new Uniform(null),
				texelSize: new Uniform(new Vector2()),
				cameraNearFar: new Uniform(new Vector2()),
				scale: new Uniform(1.0)
			},
			blending: NoBlending,
			toneMapped: false,
			depthWrite: false,
			depthTest: false,
			fragmentShader,
			vertexShader
		});

		this.bilateral = bilateral;
		this.kernelSize = kernelSize;
		this.maxVaryingVectors = 8;

	}

	/**
	 * The maximum amount of varying vectors.
	 *
	 * Should be synced with `renderer.capabilities.maxVaryings`. Default is 8.
	 *
	 * @type {Number}
	 */

	set maxVaryingVectors(value) {

		this.defines.MAX_VARYING_VECTORS = value.toFixed(0);

	}

	/**
	 * The kernel size.
	 *
	 * - Must be an odd number
	 * - Kernel size 3 and 5 use optimized code paths
	 * - Default is 5
	 *
	 * @type {Number}
	 */

	get kernelSize() {

		return Number(this.defines.KERNEL_SIZE);

	}

	set kernelSize(value) {

		if(value % 2 === 0) {

			throw new Error("The kernel size must be an odd number");

		}

		this.defines.KERNEL_SIZE = value.toFixed(0);
		this.defines.KERNEL_SIZE_HALF = Math.floor(value / 2).toFixed(0);
		this.defines.KERNEL_SIZE_SQ = (value ** 2).toFixed(0);
		this.defines.KERNEL_SIZE_SQ_HALF = Math.floor(value ** 2 / 2).toFixed(0);
		this.defines.INV_KERNEL_SIZE_SQ = (1 / value ** 2).toFixed(6);
		this.needsUpdate = true;

	}

	/**
	 * The blur scale.
	 *
	 * @type {Number}
	 */

	get scale() {

		return this.uniforms.scale.value;

	}

	set scale(value) {

		this.uniforms.scale.value = value;

	}

	/**
	 * The current near plane setting.
	 *
	 * @type {Number}
	 * @private
	 */

	get near() {

		return this.uniforms.cameraNearFar.value.x;

	}

	/**
	 * The current far plane setting.
	 *
	 * @type {Number}
	 * @private
	 */

	get far() {

		return this.uniforms.cameraNearFar.value.y;

	}

	/**
	 * The input buffer.
	 *
	 * @type {Texture}
	 */

	set inputBuffer(value) {

		this.uniforms.inputBuffer.value = value;

	}

	/**
	 * The depth buffer.
	 *
	 * @type {Texture}
	 */

	set depthBuffer(value) {

		this.uniforms.depthBuffer.value = value;

	}

	/**
	 * A combined normal-depth buffer. Overrides {@link depthBuffer} if set.
	 *
	 * @type {Texture}
	 */

	set normalDepthBuffer(value) {

		this.uniforms.normalDepthBuffer.value = value;

		if(value !== null) {

			this.defines.NORMAL_DEPTH = "1";

		} else {

			delete this.defines.NORMAL_DEPTH;

		}

		this.needsUpdate = true;

	}

	/**
	 * The depth packing strategy.
	 *
	 * @type {DepthPackingStrategies}
	 */

	set depthPacking(value) {

		this.defines.DEPTH_PACKING = value.toFixed(0);
		this.needsUpdate = true;

	}

	/**
	 * Indicates whether bilateral filtering is enabled.
	 *
	 * @type {Boolean}
	 */

	get bilateral() {

		return (this.defines.BILATERAL !== undefined);

	}

	set bilateral(value) {

		if(value !== null) {

			this.defines.BILATERAL = "1";

		} else {

			delete this.defines.BILATERAL;

		}

		this.needsUpdate = true;

	}

	/**
	 * The bilateral filter distance threshold in world units.
	 *
	 * @type {Number}
	 */

	get worldDistanceThreshold() {

		return -orthographicDepthToViewZ(Number(this.defines.DISTANCE_THRESHOLD), this.near, this.far);

	}

	set worldDistanceThreshold(value) {

		const threshold = viewZToOrthographicDepth(-value, this.near, this.far);
		this.defines.DISTANCE_THRESHOLD = threshold.toFixed(12);
		this.needsUpdate = true;

	}

	/**
	 * Copies the settings of the given camera.
	 *
	 * @param {Camera} camera - A camera.
	 */

	copyCameraSettings(camera) {

		if(camera) {

			this.uniforms.cameraNearFar.value.set(camera.near, camera.far);

			if(camera instanceof PerspectiveCamera) {

				this.defines.PERSPECTIVE_CAMERA = "1";

			} else {

				delete this.defines.PERSPECTIVE_CAMERA;

			}

			this.needsUpdate = true;

		}

	}

	/**
	 * Sets the size of this object.
	 *
	 * @param {Number} width - The width.
	 * @param {Number} height - The height.
	 */

	setSize(width, height) {

		this.uniforms.texelSize.value.set(1.0 / width, 1.0 / height);

	}

}
