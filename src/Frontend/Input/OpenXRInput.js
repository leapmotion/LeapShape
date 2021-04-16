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
        this.lastMainHand = null;

        //if (this.isActive()) { this.initialize(); }
    }

    initialize() {
        // Initialize Model Factories
        this.controllerModelFactory = new XRControllerModelFactory();
        let modelPath = (typeof ESBUILD !== 'undefined') ? './models/' : "../../../models/";
        this.handModelFactory = new XRHandModelFactory().setPath(modelPath);
        
        // Controllers
        this.controller1 = this.world.renderer.xr.getController(0);
        this.controller2 = this.world.renderer.xr.getController(1);
        this.controller1.inputState = { pinching: false }; this.controller1.visible = false;
        this.controller2.inputState = { pinching: false }; this.controller2.visible = false;
        this.controller1.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.controller2.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.world.scene.add(this.controller1); this.world.scene.add(this.controller2);
        this.controllerGrip1 = this.world.renderer.xr.getControllerGrip(0);
        this.controllerGrip2 = this.world.renderer.xr.getControllerGrip(1);
        this.controllerGrip1.add(this.controllerModelFactory.createControllerModel(this.controllerGrip1));
        this.controllerGrip2.add(this.controllerModelFactory.createControllerModel(this.controllerGrip2));
        this.controllerGrip1.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.controllerGrip2.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.world.scene.add(this.controllerGrip1); this.world.scene.add(this.controllerGrip2);
    
        // Controller Interaction
        this.controller1.addEventListener('selectstart', (e) => { this.controller1.inputState.pinching = true ; });
        this.controller1.addEventListener('selectend'  , (e) => { this.controller1.inputState.pinching = false; });
        this.controller2.addEventListener('selectstart', (e) => { this.controller2.inputState.pinching = true ; });
        this.controller2.addEventListener('selectend'  , (e) => { this.controller2.inputState.pinching = false; });
    
        // Hands
        this.hand1 = this.world.renderer.xr.getHand(0);
        this.hand2 = this.world.renderer.xr.getHand(1);
        this.hand1.inputState = { pinching: false };
        this.hand2.inputState = { pinching: false };
        this.handModel1 = this.handModelFactory.createHandModel(this.hand1, 'boxes');
        this.handModel2 = this.handModelFactory.createHandModel(this.hand2, 'boxes');
        this.hand1.add (this.handModel1);  this.hand2.add (this.handModel2);
        this.world.scene.add(this.hand1);  this.world.scene.add(this.hand2);
        this.hand1.layers.set(1); this.handModel1.layers.set(1); this.handModel1.frustumCulled = false;
        this.hand2.layers.set(1); this.handModel2.layers.set(1); this.handModel2.frustumCulled = false;
        this.hand1.traverse((element) => { if(element.layers){ element.layers.set(1); }});
        this.hand2.traverse((element) => { if(element.layers){ element.layers.set(1); }});
    
        // Controller Interaction
        this.hand1.addEventListener('pinchstart', (e) => { this.hand1.inputState.pinching = true ; });
        this.hand1.addEventListener('pinchend'  , (e) => { this.hand1.inputState.pinching = false; });
        this.hand2.addEventListener('pinchstart', (e) => { this.hand2.inputState.pinching = true ; });
        this.hand2.addEventListener('pinchend'  , (e) => { this.hand2.inputState.pinching = false; });

        // Pointer
        let lineGeometry = new THREE.BufferGeometry().setFromPoints(
            [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        let line = new THREE.Line(lineGeometry);
        line.material.color.setRGB(0, 0, 0);
        line.name = 'line';
        line.scale.z = 5;
        line.layers.set(1);
        line.frustumCulled = false;
        this.controller1.add( line.clone() );
        this.controller2.add( line.clone() );
        this.hand1Line = line.clone();
        this.hand1.add(this.hand1Line); //.joints['index-finger-tip']
        this.hand2line = line.clone()
        this.hand2.add(this.hand2line); //.joints['index-finger-tip']
        this.initialized = true;
    }

    /** Updates visuals and regenerates the input ray */
    update() {
        if (this.isActive()) {
            if (!this.initialized) { this.initialize(); }

            // Set Ray Origin and Input Direction
            if (this.mainHand && !this.mainHand.visible) { this.mainHand = null; }
            if (!this.mainHand && this.controller2.visible) { this.mainHand = this.controller2; }
            if (!this.mainHand && this.controller1.visible) { this.mainHand = this.controller1; }
            //if ((this.mainHand != this.hand1) && this.hand2.visible) { this.mainHand = this.hand2; }
            //if ((this.mainHand != this.hand2) && this.hand1.visible) { this.mainHand = this.hand1; }
            if (this.mainHand) {
                this.ray.ray.direction.copy(this.vec.set(0, 0, -1).applyQuaternion(this.mainHand.quaternion));
                this.ray.ray.origin.copy(this.ray.ray.direction).multiplyScalar(0.05).add(this.mainHand.position);
            }
            this.lastMainHand = this.mainHand;

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
        }
    }

    /** Does this input want to take control? */
    isActive() { return (this.world.inVR && this.world.mobile) || /(Oculus)/g.test(navigator.userAgent); }

}

export { OpenXRInput };
