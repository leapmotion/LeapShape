import { LeapShapeRenderer } from './Frontend/main.js';
import { LeapShapeEngine } from './Backend/main.js';

/**
 * This is the main entrypoint for LeapShape, unifying both 
 * the visualization frontend and CAD construction backend. */
class LeapShape {
    constructor() {
        this.engine   = new LeapShapeEngine  ();
        this.renderer = new LeapShapeRenderer(this.engine);
    }
}

window.mainApplication = new LeapShape();
