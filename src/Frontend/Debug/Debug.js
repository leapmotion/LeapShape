import { LeapShapeEngine } from '../../Backend/main.js';

/** This class provides Debug Utilities. */
class Debug {

    /** Reroute Console Errors to the Main Screen (for mobile) 
     * @param {LeapShapeEngine} engine */
    constructor(world, engine) {
        this.world = world;

        // Route Worker Errors Here
        engine.registerCallback("error", this.fakeError.bind(this));

        // Intercept Main Window Errors as well
        window.realConsoleError = console.error;
        window.addEventListener('error', (event) => {
            let path = event.filename.split("/");
            this.display((path[path.length - 1] + ":" + event.lineno + " - " + event.message));
        });
        console.error = this.fakeError.bind(this);
        
        // Record whether we're on Safari or Mobile (unused so far)
        this.safari = /(Safari)/g.test( navigator.userAgent ) && ! /(Chrome)/g.test( navigator.userAgent );
        this.mobile = /(Android|iPad|iPhone|iPod)/g.test(navigator.userAgent) || this.safari;
    }

    // Log Errors as <div>s over the main viewport
    fakeError(...args) {
        if (args.length > 0 && args[0]) { this.display(JSON.stringify(args[0])); }
        window.realConsoleError.apply(console, arguments);
    }

    display(text) {
        this.world.parent.tools.alerts.displayError(text);
        if (this.mobile) {
            let errorNode = window.document.createElement("div");
            errorNode.innerHTML = text.fontcolor("red");
            window.document.getElementById("info").appendChild(errorNode);
        }
    }

}

export { Debug };
