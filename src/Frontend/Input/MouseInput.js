import { World } from '../World.js';

/** This is the standard mouse (and touchscreen?) input. */
class MouseInput {
    /** Initialize Mouse Capture
     * @param {World} world */
    constructor(world) {
        this.world = world;
        this.ray = null;//new THREE.Ray();
        this.mouse = { x: 0, y: 0 };
        this.world.container.addEventListener( 'mousemove', this._onContainerMouseMove.bind(this) );
    }

    /** Triggered whenever the mouse moves over the application
     * @param {MouseEvent} event */
    _onContainerMouseMove( event ) {
        event.preventDefault();
        this.mouse.x =  ( event.offsetX / event.srcElement.width  ) * 2 - 1;
        this.mouse.y = -( event.offsetY / event.srcElement.height ) * 2 + 1;
    }

    update() {
        if (this.isActive()) {
            this.world.raycaster.setFromCamera(this.mouse, this.world.camera);
            this.ray = this.world.raycaster.ray;
            this.ray.alreadyActivated = false;
        }
    }

    /** Does this input want to take control? */
    isActive() {
        return true;
    }

}

export { MouseInput };
