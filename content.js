(() => {
    const THEATER_MODE_BUTTON = 'div[title="Toggle theater mode"]';
    const ACTIVE_ATTRIBUTE = 'data-rumble-resize-active';
    const AUTO_THEATER_SETTING = 'autoTheater';

    const handledVideos = new WeakSet();
    let autoTheater = false;
    let pendingVideo = null;
    let controlsObserver;

    function isFullscreen() {
        return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    }

    function isTheaterMode() {
        return document.body.classList.contains('theater-mode');
    }

    function syncLayout() {
        document.documentElement.toggleAttribute(
            ACTIVE_ATTRIBUTE,
            isTheaterMode() && !isFullscreen()
        );
    }

    function stopWaitingForControls() {
        pendingVideo = null;
        controlsObserver.disconnect();
    }

    function requestTheaterMode() {
        if (!pendingVideo) {
            return;
        }

        if (pendingVideo.paused || pendingVideo.ended) {
            stopWaitingForControls();
            return;
        }

        if (isFullscreen()) {
            return;
        }

        if (isTheaterMode()) {
            handledVideos.add(pendingVideo);
            stopWaitingForControls();
            return;
        }

        const button = document.querySelector(THEATER_MODE_BUTTON);
        if (!button) {
            return;
        }

        const video = pendingVideo;
        handledVideos.add(video);
        stopWaitingForControls();
        button.click();
    }

    function waitForTheaterControls(video) {
        pendingVideo = video;
        requestTheaterMode();

        if (pendingVideo && !isFullscreen()) {
            controlsObserver.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }
    }

    function handlePlaying(event) {
        const video = event.target;
        if (!(video instanceof HTMLVideoElement)) {
            return;
        }

        if (!autoTheater || handledVideos.has(video)) {
            return;
        }

        waitForTheaterControls(video);
    }

    function getPlayingVideo() {
        return Array.from(document.querySelectorAll('video')).find(
            (video) => !video.paused && !video.ended
        );
    }

    function applyAutoTheaterSetting(enabled) {
        autoTheater = enabled;

        if (!autoTheater) {
            stopWaitingForControls();
            return;
        }

        const playingVideo = getPlayingVideo();
        if (playingVideo && !handledVideos.has(playingVideo)) {
            waitForTheaterControls(playingVideo);
        }
    }

    function handleFullscreenChange() {
        syncLayout();
        controlsObserver.disconnect();

        if (pendingVideo && !isFullscreen()) {
            waitForTheaterControls(pendingVideo);
        }
    }

    function handleTheaterStateChange() {
        syncLayout();
        requestTheaterMode();
    }

    document.addEventListener('playing', handlePlaying, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    new MutationObserver(handleTheaterStateChange).observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
    });

    // Rumble creates and replaces player controls dynamically. This observer is
    // connected only while a playing video is waiting for its native control.
    controlsObserver = new MutationObserver(requestTheaterMode);

    chrome.storage.sync.get({ [AUTO_THEATER_SETTING]: true }, (settings) => {
        applyAutoTheaterSetting(settings[AUTO_THEATER_SETTING]);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') {
            return;
        }

        if (changes[AUTO_THEATER_SETTING]) {
            applyAutoTheaterSetting(changes[AUTO_THEATER_SETTING].newValue);
        }

    });

    syncLayout();
})();
