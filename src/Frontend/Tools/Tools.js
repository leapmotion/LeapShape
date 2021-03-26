import { LeapShapeEngine } from '../../Backend/main.js';
import { Menu } from './Menu.js';
import { World } from '../World/World.js';

import { DefaultTool } from './DefaultTool.js';
import { SphereTool } from './SphereTool.js';
import { CylinderTool } from './CylinderTool.js';
import { BoxTool } from './BoxTool.js';

/** This class controls all of the Tool and Menu State Machines */
class Tools {
    
    /** Initialize the Main-Thread App Context
     * @param {World} world
     * @param {LeapShapeEngine} engine */
    constructor(world, engine) {
        this.world = world; this.engine = engine;

        this.tools = [
            new DefaultTool (this),
            new BoxTool     (this),
            new SphereTool  (this),
            new CylinderTool(this)
        ];

        this.activeTool = null;
        this.gridPitch = 5.0;
    }

    /** Update the Tool and Menu State Machines
     * @param {THREE.Ray} ray The Current Input Ray */
    update(ray) {
        if (this.menu) {
            // Let the user/menus set the activeTool
            this.menu.update(ray);
        } else if(this.engine.started) {
            // Create the menu system, which will 
            // be populated from the List of Tools
            this.menu = new Menu(this);
            this.world.dirty = true; // Update the rendered view
        }

        if (!this.activeTool) {
            this.tools[0].activate();
        }
        this.activeTool.update(ray);

    }

}

export { Tools };
