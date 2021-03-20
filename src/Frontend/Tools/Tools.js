import { LeapShapeEngine } from '../../Backend/main.js';
import { Menu } from './Menu.js';
import { World } from '../World/World.js';

import { SphereTool } from './SphereTool.js';
import { CylinderTool } from './CylinderTool.js';
import { BoxTool } from './BoxTool.js';

/** This class controls all of the Tool and Menu State Machines */
class Tools {
    
    /** Initialize the Main-Thread App Context
     * @param {World} world
     * @param {LeapShapeEngine} engine */
    constructor(world, engine) {
        this.world = world;
        this.engine = engine;

        this.tools = [
            new SphereTool(this),
            new CylinderTool(this),
            new BoxTool(this)
        ];

        this.activeTool = null;
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
        }

        if (this.activeTool) {
            this.activeTool.update(ray);
        } else {
            // Update the selection tool?
        }

    }

}

export { Tools };
