import * as THREE from '../../../node_modules/three/build/three.module.js';
import Stats from      '../../../node_modules/three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from '../../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from '../../../node_modules/three/examples/jsm/loaders/FBXLoader.js';
import { VRButton } from '../../../node_modules/three/examples/jsm/webxr/VRButton.js';
import { History } from "./History.js";
import { LeapShapeRenderer } from "../main.js";

/** The fundamental set up and animation structures for 3D Visualization */
class World {

    /** Create the basic world and scenery 
     * @param {LeapShapeRenderer} parent The Parent LeapShape Renderer
     * @param {function} updateFunction */
    constructor(parent, updateFunction) {
        // Sneaky Leaky Reference for flow inversion...
        this.parent = parent;

        // app container div
        this.container = document.getElementById('appbody');
        document.body.appendChild(this.container);
        
        // camera and world
        this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
        this.camera.position.set( 100, 200, 300 );
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xffffff );
        this.scene.fog = new THREE.Fog(0xffffff, 200, 1000);
        
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
        this.grid.position.y = -0.5;
        this.scene.add(this.grid);
        
        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        this.container.appendChild(VRButton.createButton(this.renderer));
        this.renderer.xr.enabled = true;
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
        
        // raycaster
        this.raycaster = new THREE.Raycaster();

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
    }

    /** Update the camera and render the scene 
     * @param {THREE.Ray} ray The Current Input Ray */
    update(ray) {
        // Conserve Power, don't rerender unless the view is dirty
        if (!this.mobile || ray.active || this.dirty) {
            this.lastTimeInteractedWith = performance.now();
            this.dirty = false;
        }
        if (performance.now() - this.lastTimeInteractedWith < 2000) {
            this.controls.enabled = !ray.alreadyActivated;
            if (this.controls.enabled) { this.controls.update(); }
            this.renderer.render(this.scene, this.camera);
        }
    }

    /** **INTERNAL**: This function recalculates the viewport 
     * based on the new window size. */
    _onWindowResize() {
        let rect = this.container.getBoundingClientRect();
        let width = rect.width, height = window.innerHeight - rect.y;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( width, height );
    }

}

export { World };
