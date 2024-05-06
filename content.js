// Utility to wait for an element to appear in the DOM with a 2 minute timeout
function waitForElement(selector, callback, interval = 1000, timeout = 120000) {
    const startTime = new Date().getTime();
    const timer = setInterval(() => {
        if (new Date().getTime() - startTime > timeout) {
            clearInterval(timer);
            console.error('Timeout waiting for element:', selector);
            return;
        }
        const element = document.querySelector(selector);
        if (element) {
            clearInterval(timer);
            callback(element);
        }
    }, interval);
}

// Define CSS to inject when toggling theater mode
const theaterModeCSS = `
main {
    margin-left: 0px;
    margin-top: 0px;
}
.navs {
    display: none;
}
.header {
    display: none;
}
.theater-mode .media-theater-container {
    max-height: 100vh;
}`;

// Function to toggle theater mode styles
function toggleTheaterMode(element) {
    let styleElement = document.getElementById('theater-mode-styles');
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'theater-mode-styles';
        styleElement.textContent = theaterModeCSS;
        document.head.appendChild(styleElement);
    } else {
        styleElement.remove();
    }
}

// Wait for the toggle theater mode button to be available
waitForElement('div[title="Toggle theater mode"]', function(element) {
    element.addEventListener('click', function() {
        toggleTheaterMode(element);
    });
});
