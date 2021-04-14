import * as THREE from '../../../node_modules/three/build/three.module.js';
import Stats from      '../../../node_modules/three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from '../../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from '../../../node_modules/three/examples/jsm/webxr/VRButton.js';
import { History } from "./History.js";
import { InteractionRay } from "../Input/Input.js";
import { LeapShapeRenderer } from "../main.js";
import { createDitherDepthMaterial } from '../Tools/General/ToolUtils.js';
import { LeapPinchLocomotion } from '../Input/LeapPinchLocomotion.js';

/** The fundamental set up and animation structures for 3D Visualization */
class World {

    /** Create the basic world and scenery 
     * @param {LeapShapeRenderer} parent The Parent LeapShape Renderer
     * @param {function} updateFunction */
    constructor(parent, updateFunction) {
        // sneaky leaky references for dependency inversion...
        this.parent = parent; window.world = this;

        // app container div
        this.container = document.getElementById('appbody');
        document.body.appendChild(this.container);
        
        // camera and world
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xffffff );
        this.scene.fog = new THREE.Fog(0xffffff, 500, 1300);
        this.scene.onBeforeRender = function(renderer, scene, camera) {
            if (camera.cameras && camera.cameras.length) {
                for (let i = 0; i < camera.cameras.length; i++) {
                    camera.cameras[i].layers.enableAll();
                }
            }
        }

        this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
        this.camera.position.set( 100, 200, 300 );
        this.camera.layers.enableAll();
        this.cameraParent = new THREE.Group();
        this.cameraParent.add(this.camera);
        this.scene.add(this.cameraParent);

        // light
        this.light = new THREE.HemisphereLight( 0xffffff, 0x444444 );
        this.light.position.set( 0, 200, 0 );
        this.scene.add( this.light );
        this.light = new THREE.DirectionalLight( 0xffffff );
        this.light.position.set( 0, 200, 100 );
        this.light.castShadow = true;
        this.light.shadow.camera.top = 180;
        this.light.shadow.camera.bottom = - 100;
        this.light.shadow.camera.left = - 120;
        this.light.shadow.camera.right = 120;
        this.scene.add( this.light );
        // scene.add( new CameraHelper( light.shadow.camera ) );

        // ground
        this.mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000, 2000),
                                   new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false, opacity: 0 }));
        this.mesh.rotation.x = - Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.scene.add( this.mesh );
        this.grid = new THREE.GridHelper( 2000, 20, 0x000000, 0x000000 );
        this.grid.material.opacity = 0.4;
        this.grid.material.transparent = true;
        this.grid.layers.set(2);
        this.scene.add(this.grid);
        
        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
                if (supported) {
                    this.container.appendChild(VRButton.createButton(this.renderer));
                    this.renderer.xr.enabled = true;
                }
            });
        }
        this.renderer.setAnimationLoop( updateFunction );
        
        // orbit controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.10;
        this.controls.screenSpacePanning = true;
        this.controls.target.set( 0, 100, 0 );
        this.controls.update();
        window.addEventListener('resize', this._onWindowResize.bind(this), false);
        window.addEventListener('orientationchange', this._onWindowResize.bind(this), false);
        this._onWindowResize();

        // pinch controls (initialize at runtime; see LeapHandInput.js)
        this.leftPinch = null, this.rightPinch = null, this.locomotion = null;
        
        // raycaster
        this.raycaster = new THREE.Raycaster();
        this.raycaster.layers.set(0);
        this.raycaster.params.Line.threshold = 3;

        // stats
        //this.stats = new Stats();
        //this.container.appendChild(this.stats.dom);

        // Contains both the Undo History, and the set of active shapes
        this.history = new History(this);

        // Record browser metadata for power saving features...
        this.safari = /(Safari)/g.test( navigator.userAgent ) && ! /(Chrome)/g.test( navigator.userAgent );
        this.mobile = /(Android|iPad|iPhone|iPod)/g.test(navigator.userAgent) || this.safari;
        this.lastTimeInteractedWith = performance.now();
        this.dirty = false;

        // Materials for the Scene
        this.shapeMaterial = new THREE.MeshPhongMaterial({
            wireframe: false,
            polygonOffset: true, // Push the mesh material back for line drawing
            polygonOffsetFactor: 2.0,
            polygonOffsetUnits: 1.0
        });
        this.shapeMaterial.roughnessMap = null;
        this.shapeMaterial.metalnessMap = null;
        this.shapeMaterial.roughness = 1.0;
        this.shapeMaterial.metalness = 0.0;
        this.shapeMaterial.color.setRGB(0.5, 0.5, 0.5);
        this.selectedMaterial = this.shapeMaterial.clone();
        this.selectedMaterial.emissive.setRGB(0.0, 0.25, 0.25);
        this.previewMaterial = createDitherDepthMaterial(this);
        this.noDepthPreviewMaterial = this.selectedMaterial.clone();
        this.basicMaterial = new THREE.MeshBasicMaterial();
        this.lineMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff, linewidth: 1.5, vertexColors: true  });
        this.selectedLineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff, linewidth: 1.5, vertexColors: false });
    }

    /** Update the camera and render the scene 
     * @param {InteractionRay} ray The Current Input Ray */
    update(ray) {
        // Conserve Power, don't rerender unless the view is dirty
        if (ray.active || this.dirty) {
            this.lastTimeInteractedWith = performance.now();
        }

        // If the scene is dirty, it's been a while, or we're in VR...
        if (performance.now() - this.lastTimeInteractedWith < 2000 ||
            (this.renderer.xr && this.renderer.xr.enabled)) {
            // Manage Camera Control Schemes
            let cameraControl = !ray.alreadyActivated;
            if (this.handsAreTracking) {
                if (!this.locomotion) { this.locomotion = new LeapPinchLocomotion(this, this.leftPinch, this.rightPinch); }
                if (cameraControl) { this.locomotion.update(); }
            }
            this.controls.enabled = cameraControl && !this.handsAreTracking;
            if (this.controls.enabled) { this.controls.update(); }

            // Render the scene
            this.renderer.render(this.scene, this.camera);
            this.dirty = false;
            //this.stats.update();
        } else if (performance.now() - this.lastTimeInteractedWith > 3000) {
            this.lastTimeInteractedWith += 1020; // Otherwise Update once per ~second...
        }

    }

    /** **INTERNAL**: This function recalculates the viewport based on the new window size. */
    _onWindowResize() {
        let rect = this.container.getBoundingClientRect();
        let width = rect.width, height = window.innerHeight - rect.y;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.dirty = true;
    }

}

export { World };
