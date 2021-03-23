import * as THREE from '../../../node_modules/three/build/three.module.js';
import Stats from      '../../../node_modules/three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from '../../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from '../../../node_modules/three/examples/jsm/loaders/FBXLoader.js';
import { VRButton } from '../../../node_modules/three/examples/jsm/webxr/VRButton.js';

/** The fundamental set up and animation structures for 3D Visualization */
class World {

    /** Create the basic world and scenery */
    constructor(updateFunction) {
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
                                   new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false }));
        this.mesh.rotation.x = - Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.scene.add( this.mesh );
        this.grid = new THREE.GridHelper( 2000, 20, 0x000000, 0x000000 );
        this.grid.material.opacity = 0.4;
        this.grid.material.transparent = true;
        this.grid.position.y = -1;
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
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.target.set( 0, 100, 0 );
        this.controls.update();
        window.addEventListener('resize', this._onWindowResize.bind(this), false);
        this._onWindowResize();
        
        // raycaster
        this.raycaster = new THREE.Raycaster();

        // stats
        //this.stats = new Stats();
        //this.container.appendChild(this.stats.dom);
    }

    /** Update the camera and render the scene 
     * @param {THREE.Ray} ray The Current Input Ray */
    update(ray) {
        this.controls.enabled = !ray.alreadyActivated;
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
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
