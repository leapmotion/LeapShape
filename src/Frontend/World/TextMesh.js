/**
 * Copyright 2021 Ultraleap, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 import * as THREE from '../../../node_modules/three/build/three.module.js';

class TextMesh extends THREE.Mesh {
 
	constructor(text) {
 
		let texture = new TextTexture(text);
		let geometry = new THREE.PlaneGeometry(1, 1);
		let material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true, depthTest: false });
 
		super(geometry, material);
		 
		this.texture = texture;
		this.vec = new THREE.Vector3();
		this.canonicalPosition = new THREE.Vector3();
		this.text = '';
 
	}
 
	update(text, r = 0, g = 0, b = 0) {
		this.texture.update(text, r, g, b);
		this.text = text;
		this.scale   .set(this.texture.image.width  * 0.0003,
						  this.texture.image.height * 0.0003);
		this.position.set(this.texture.image.width  * 0.00016,
						  this.texture.image.height * 0.00016, 0);
		this.canonicalPosition.copy(this.position);
	}

}

class TextTexture extends THREE.CanvasTexture {

	constructor(text) {

		let canvas = document.createElement('canvas');
		let context = canvas.getContext('2d'/*, { alpha: false }*/);
		
		super(canvas);

		this.canvas = canvas;
		this.canvas.width  = 404;
		this.canvas.height = 150;
		this.context = context;
		
		this.text = text;

		this.anisotropy = 16;
		this.encoding = THREE.sRGBEncoding;
		this.minFilter = THREE.LinearFilter;
		this.magFilter = THREE.LinearFilter;

	}

	update(string = '', r, g, b) {
		if (string !== this.text) {
			let font = '8.25em Lato, "Helvetica Neue", Helvetica, Arial, sans-serif';
			// Set the Canvas Width/Height
			if (this.context.font !== font) { this.context.font = font; }
			let rect = this.context.measureText(string);

			let newWidth  = rect.width;
			let newHeight = rect.actualBoundingBoxDescent - rect.actualBoundingBoxAscent;

			if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
				this.canvas.width  = Math.max(this.canvas.width , newWidth );
				this.canvas.height = Math.max(this.canvas.height, newHeight);
			}
			this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

			// Set the Text Style, Clear the Canvas, and Render the Text
			this.context.font = font;
			this.context.textBaseline = 'bottom';
			this.context.fillStyle = "rgba(" + r + ", " + g + ", " + b + ", 0.8)";
			this.context.fillText(string, 0, this.canvas.height);
		}

		this.image = this.canvas;
		this.needsUpdate = true;
		this.text = string;

	}

}

export { TextMesh, TextTexture };
