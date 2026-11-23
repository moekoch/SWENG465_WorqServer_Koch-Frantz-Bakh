// Comfort and privacy preferences. Same keys and defaults as the web app's Settings page.
const WHO_OPTIONS = ['friends', 'everyone', 'nobody'];

const DEFAULT_SETTINGS = {
    reducedMotion: false,
    ambientAudio: false,
    textSize: 'standard',
    focusMinutes: 25,
    tankVisitors: 'friends',
    directMessages: 'friends',
    onlineStatus: 'friends',
    showFocusStatus: true,
    chatNotifications: 'mentions',
};

// what each setting is allowed to be
const RULES = {
    reducedMotion: (value) => typeof value === 'boolean',
    ambientAudio: (value) => typeof value === 'boolean',
    showFocusStatus: (value) => typeof value === 'boolean',
    textSize: (value) => ['standard', 'large', 'larger'].includes(value),
    focusMinutes: (value) => [15, 25, 45].includes(value),
    tankVisitors: (value) => WHO_OPTIONS.includes(value),
    directMessages: (value) => WHO_OPTIONS.includes(value),
    onlineStatus: (value) => WHO_OPTIONS.includes(value),
    chatNotifications: (value) => ['mentions', 'all', 'none'].includes(value),
};

// check a (partial) settings object: { settings } if fine, { error } if not
function validateSettings(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { error: 'Send the settings as an object.' };
    }
    const settings = {};
    for (const [key, value] of Object.entries(input)) {
        if (!RULES[key]) return { error: `Unknown setting: ${key}.` };
        if (!RULES[key](value)) return { error: `Invalid value for ${key}.` };
        settings[key] = value;
    }
    if (Object.keys(settings).length === 0) return { error: 'At least one setting must be provided.' };
    return { settings };
}

// a user's settings with defaults filled in
function settingsOf(user) {
    return { ...DEFAULT_SETTINGS, ...(user?.settings ?? {}) };
}

module.exports = { DEFAULT_SETTINGS, WHO_OPTIONS, validateSettings, settingsOf };
