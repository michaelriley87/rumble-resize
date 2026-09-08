const AUTO_THEATER_SETTING = 'autoTheater';
const autoTheater = document.getElementById('auto-theater');

chrome.storage.sync.get({ [AUTO_THEATER_SETTING]: true }, (settings) => {
    autoTheater.checked = settings[AUTO_THEATER_SETTING];
});

autoTheater.addEventListener('change', () => {
    chrome.storage.sync.set({ [AUTO_THEATER_SETTING]: autoTheater.checked });
});
