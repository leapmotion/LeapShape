/** This class provides Debug Utilities. */
class Debug {

    /** Reroute Console Errors to the Main Screen (for mobile) */
    constructor() {
        this.realConsoleError = console.error;
        window.onerror = (msg, url, lineNo, columnNo, error) => {
            this.fakeError.apply(console, arguments);
        }
        console.error = this.fakeError.bind(this);

        console.error("Mobile Debugging Enabled");
    }

    fakeError(...args) {
        let errorNode = window.document.createElement("div");
        errorNode.innerHTML = args[0].fontcolor("red");;
        window.document.getElementById("info").appendChild(errorNode);
        this.realConsoleError.apply(console, arguments);
    }

}

export { Debug };
