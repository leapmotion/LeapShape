import * as THREE from '../../../node_modules/three/build/three.module.js';
import { World } from '../World/World.js';
import { InteractionRay } from './Input.js';
import { XRControllerModelFactory } from '../../../node_modules/three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from '../../../node_modules/three/examples/jsm/webxr/XRHandModelFactory.js';

/** This manages all OpenXR-based input */
class OpenXRInput {
    /** Initialize OpenXR Controller and Hand Tracking
     * @param {World} world */
    constructor(world) {
        this.world = world;

        this.vec  = new THREE.Vector3();    this.vec2  = new THREE.Vector3();   this.vec3 = new THREE.Vector3();
        this.quat = new THREE.Quaternion(); this.quat2 = new THREE.Quaternion();
        this.mat1 = new THREE.Matrix4();    this.mat2  = new THREE.Matrix4();

        this.ray = new InteractionRay(new THREE.Ray());
        this.lastTimestep = performance.now();
        this.activeTime = 0; this.prevActive = false;
        this.mainHand = null; this.initialized = false;
    }

    /** Updates visuals and regenerates the input ray */
    update() {
        //if (this.isActive()) {
            if (!this.initialized) {
                // Initialize Model Factories
                this.controllerModelFactory = new XRControllerModelFactory();
                //let modelPath = (typeof ESBUILD !== 'undefined') ? './textures/Box.png' : '../../../textures/Box.png'
                this.handModelFactory = new XRHandModelFactory();//.setPath("./models/fbx/");
                
                // Controllers
                this.controller1 = this.world.renderer.xr.getController(0);
                this.controller2 = this.world.renderer.xr.getController(1);
                this.world.scene.add(this.controller1); this.world.scene.add(this.controller2);
                this.controllerGrip1 = this.world.renderer.xr.getControllerGrip(0);
                this.controllerGrip2 = this.world.renderer.xr.getControllerGrip(1);
                this.controllerGrip1.add(this.controllerModelFactory.createControllerModel(this.controllerGrip1));
                this.controllerGrip2.add(this.controllerModelFactory.createControllerModel(this.controllerGrip2));
                this.world.scene.add(this.controllerGrip1); this.world.scene.add(this.controllerGrip2);

                // Hands
                this.hand1 = this.world.renderer.xr.getHand(0);
                this.hand2 = this.world.renderer.xr.getHand(1);
                this.handModel1 = this.handModelFactory.createHandModel(this.hand1);
                this.handModel2 = this.handModelFactory.createHandModel(this.hand2);
                this.hand1.add (this.handModel1);  this.hand2.add (this.handModel2);
                this.world.scene.add(this.hand1);  this.world.scene.add(this.hand2);
                this.hand1.layers.set(1); this.handModel1.layers.set(1); this.handModel1.frustumCulled = false;
                this.hand2.layers.set(1); this.handModel2.layers.set(1); this.handModel2.frustumCulled = false;

                // Pointer
                let lineGeometry = new THREE.BufferGeometry().setFromPoints(
                    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
                let line = new THREE.Line( lineGeometry );
                line.name = 'line';
                line.scale.z = 5;
                line.layers.set(1);
                line.frustumCulled = false;
                this.controller1.add( line.clone() );
                this.controller2.add( line.clone() );
                
                this.initialized = true;
            }

            // Set Ray Origin and Input Direction
            if(this.hand1.visible == false && this.hand2.visible == false) { this.mainHand = null; }
            if (!this.mainHand && this.hand1.visible) { this.mainHand = this.hand1; }
            if (!this.mainHand && this.hand2.visible) { this.mainHand = this.hand2; }
            if (this.mainHand) {
                this.ray.ray.origin.copy(this.mainHand.position)
                this.ray.ray.direction.copy(this.vec.set(0, 0, -1).applyQuaternion(this.mainHand.quaternion));
            }

            // Add Extra Fields for the active state
            this.ray.justActivated = false; this.ray.justDeactivated = false;
            this.ray.active = this.mainHand !== null && this.mainHand.inputState.pinching;
            if ( this.ray.active && !this.prevActive) { this.ray.justActivated   = true; this.activeTime = 0; }
            if (!this.ray.active &&  this.prevActive) { this.ray.justDeactivated = true; }
            this.ray.alreadyActivated = false;
            this.prevActive = this.ray.active;
            if (this.ray.active) { this.activeTime += performance.now() - this.lastTimestep; }
            this.ray.activeMS = this.activeTime;
            this.lastTimestep = performance.now();
        //}

    }

    /** Does this input want to take control? */
    isActive() { return this.world.inVR && this.world.mobile; }

}

export { OpenXRInput };
