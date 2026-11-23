// Finds a script by its bare name (e.g. 'tts') inside js/<group>/, so tests do not care which folder it lives in.
const fs = require('fs'), path = require('path');
const JS = path.join(__dirname, '..', 'js');
function jsFile(name) {
    for (const dir of fs.readdirSync(JS)) {
        const p = path.join(JS, dir, name.replace(/\.js$/, '') + '.js');
        if (fs.existsSync(p)) return p;
    }
    throw new Error('no script named ' + name);
}
module.exports = { jsFile, JS };
