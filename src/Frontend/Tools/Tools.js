import { Menu } from './Menu.js';
import { SphereTool } from './SphereTool.js';

/** This class controls all of the Tool and Menu State Machines */
class Tools {
    
    constructor(world) {
        this.world = world;

        this.tools = [
            new SphereTool(this)
        ];

        // Create the menu system, which will 
        // be populated from the List of Tools
        this.menu = new Menu(this);
    }

    /** Update the Tool and Menu State Machines
     * @param {THREE.Ray} ray The Current Input Ray */
    update(ray) {
        // Check the menus for interactions first
        this.menu.update(ray);

        for (let i = 0; i < this.tools.length; i++){
            this.tools[i].update(ray);
        }

    }

}

export { Tools };
