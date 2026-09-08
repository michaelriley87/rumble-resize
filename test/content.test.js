const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const contentScript = readFileSync(require.resolve('../content.js'), 'utf8');
const popupHtml = readFileSync(require.resolve('../popup.html'), 'utf8');
const popupScript = readFileSync(require.resolve('../popup.js'), 'utf8');

function createBrowserState({
    autoTheater = true,
    buttonAvailable = true,
    playing = false
} = {}) {
    const listeners = new Map();
    const observers = [];
    const storageListeners = [];
    const attributes = new Set();
    const bodyClasses = new Set();

    class HTMLVideoElement {}

    const video = Object.assign(new HTMLVideoElement(), {
        paused: !playing,
        ended: false
    });

    const button = {
        clicks: 0,
        click() {
            this.clicks += 1;
            bodyClasses.add('theater-mode');
            observers[0].callback();
        }
    };

    const document = {
        body: {
            classList: {
                contains(name) {
                    return bodyClasses.has(name);
                }
            }
        },
        documentElement: {
            toggleAttribute(name, force) {
                if (force) {
                    attributes.add(name);
                } else {
                    attributes.delete(name);
                }
            }
        },
        fullscreenElement: null,
        webkitFullscreenElement: null,
        addEventListener(type, listener) {
            const handlers = listeners.get(type) || [];
            handlers.push(listener);
            listeners.set(type, handlers);
        },
        querySelector(selector) {
            if (selector.includes('Toggle theater mode')) {
                return state.buttonAvailable ? button : null;
            }
            return null;
        },
        querySelectorAll(selector) {
            return selector === 'video' ? [video] : [];
        }
    };

    class MutationObserver {
        constructor(callback) {
            this.callback = callback;
            observers.push(this);
        }

        observe() {}

        disconnect() {}
    }

    const state = {
        attributes,
        bodyClasses,
        button,
        buttonAvailable,
        document,
        observers,
        video,
        dispatch(type, target = document) {
            for (const listener of listeners.get(type) || []) {
                listener({ target });
            }
        },
        setAutoTheater(enabled) {
            for (const listener of storageListeners) {
                listener({ autoTheater: { newValue: enabled } }, 'sync');
            }
        }
    };

    vm.runInNewContext(contentScript, {
        Array,
        Boolean,
        HTMLVideoElement,
        MutationObserver,
        WeakSet,
        chrome: {
            storage: {
                sync: {
                    get(defaults, callback) {
                        callback({ ...defaults, autoTheater });
                    }
                },
                onChanged: {
                    addListener(listener) {
                        storageListeners.push(listener);
                    }
                }
            }
        },
        document
    });

    return state;
}

test('derives layout from theater and fullscreen state', () => {
    const state = createBrowserState();

    state.video.paused = false;
    state.dispatch('playing', state.video);

    assert.equal(state.button.clicks, 1);
    assert.equal(state.attributes.has('data-rumble-resize-active'), true);

    state.document.fullscreenElement = {};
    state.dispatch('fullscreenchange');
    assert.equal(state.attributes.has('data-rumble-resize-active'), false);

    state.document.fullscreenElement = null;
    state.dispatch('fullscreenchange');
    assert.equal(state.attributes.has('data-rumble-resize-active'), true);

    state.bodyClasses.delete('theater-mode');
    state.observers[0].callback();
    assert.equal(state.attributes.has('data-rumble-resize-active'), false);
    assert.equal(state.button.clicks, 1);
});

test('waits reactively when Rumble creates the control after playback starts', () => {
    const state = createBrowserState({ buttonAvailable: false });

    state.video.paused = false;
    state.dispatch('playing', state.video);
    assert.equal(state.button.clicks, 0);

    state.buttonAvailable = true;
    state.observers[1].callback();
    assert.equal(state.button.clicks, 1);
});

test('handles a video that was already autoplaying', () => {
    const state = createBrowserState({ playing: true });

    assert.equal(state.button.clicks, 1);
    assert.equal(state.attributes.has('data-rumble-resize-active'), true);
});

test('keeps automatic theater mode off when disabled while still syncing manual use', () => {
    const state = createBrowserState({ autoTheater: false });

    state.video.paused = false;
    state.dispatch('playing', state.video);
    assert.equal(state.button.clicks, 0);

    state.bodyClasses.add('theater-mode');
    state.observers[0].callback();
    assert.equal(state.attributes.has('data-rumble-resize-active'), true);
});

test('applies the popup preference to a video that is already playing', () => {
    const state = createBrowserState({ autoTheater: false, playing: true });

    assert.equal(state.button.clicks, 0);
    state.setAutoTheater(true);
    assert.equal(state.button.clicks, 1);
});

test('popup loads and saves the automatic theater preference', () => {
    const changeListeners = new Map();
    const savedValues = {};
    const checkboxes = new Map(['auto-theater'].map((id) => [id, {
        checked: false,
        addEventListener(type, listener) {
            assert.equal(type, 'change');
            changeListeners.set(id, listener);
        }
    }]));

    vm.runInNewContext(popupScript, {
        chrome: {
            storage: {
                sync: {
                    get(defaults, callback) {
                        callback({
                            ...defaults,
                            autoTheater: true
                        });
                    },
                    set(value) {
                        Object.assign(savedValues, value);
                    }
                }
            }
        },
        document: {
            getElementById(id) {
                return checkboxes.get(id);
            }
        }
    });

    assert.equal(checkboxes.get('auto-theater').checked, true);

    checkboxes.get('auto-theater').checked = false;
    changeListeners.get('auto-theater')();

    assert.equal(savedValues.autoTheater, false);
});

test('popup includes safe tip and website links', () => {
    assert.match(popupHtml, /href="https:\/\/ko-fi\.com\/michaelriley87"/);
    assert.match(popupHtml, /href="https:\/\/michaelriley\.au\/"/);
    assert.match(popupHtml, />Leave a tip<\/a>/);
    assert.match(popupHtml, />Website<\/a>/);
    assert.equal((popupHtml.match(/target="_blank"/g) || []).length, 2);
    assert.equal((popupHtml.match(/rel="noopener noreferrer"/g) || []).length, 2);
});
