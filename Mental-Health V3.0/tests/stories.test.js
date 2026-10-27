// Real stories + videos: theme detection, safe video choice in crisis, all 9 supplied videos present, and no stray links.
const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/stories.js');

const YOURS = ['ZebSXPUCPFc', 'YuNLNeIorJw', 'TLKxdTmk-zc', '0cwtNOq_k4w', 'zzfREEPbUsA', 'fRc3OD_bxZ8', '41Zjh3AirjU', 'kxclCPpc4vE', '1DkTSscTq0s'];

test('all nine supplied videos are included; extra talks are public https links', () => {
    const ids = S.SUPPORT_VIDEOS.filter(v => v.id).map(v => v.id);
    assert.deepStrictEqual(ids.sort(), [...YOURS].sort());
    ids.forEach(id => assert.match(id, /^[\w-]{11}$/));
    S.SUPPORT_VIDEOS.filter(v => !v.id).forEach(v => assert.match(v.url, /^https:\/\/(www\.ted\.com|jamesclear\.com|inktalks\.com)\//));
    assert.ok(S.SUPPORT_VIDEOS.length >= 12);
});

test('themes are recognised', () => {
    assert.strictEqual(S.supportTheme('my girlfriend left me, heartbroken'), 'breakup');
    assert.strictEqual(S.supportTheme('I got fired today'), 'job');
    assert.strictEqual(S.supportTheme('nobody cares about me'), 'nobody');
    assert.strictEqual(S.supportTheme('my father passed away'), 'grief');
    assert.strictEqual(S.supportTheme('I am so unlucky'), 'luck');
    assert.strictEqual(S.supportTheme('I feel bad'), 'pain');
});

test('distress detection is for real struggling, not small talk', () => {
    assert.ok(S.detectDistress("I'm hopeless and worthless"));
    assert.ok(S.detectDistress('I was fired'));
    assert.ok(!S.detectDistress('what a lovely day, tell me a joke'));
});

test('someone in crisis only gets the gentle videos, three of them, all different', () => {
    S.resetSupport();
    for (const theme of ['pain', 'job', 'failure', 'breakup', 'nobody', 'grief', 'luck']) {
        const vids = S.pickSupportVideos(theme, 3, true);
        assert.strictEqual(vids.length, 3);
        assert.strictEqual(new Set(vids.map(v => v.id)).size, 3);
        vids.forEach(v => assert.ok(v.gentle, `${theme}: ${v.title} is not gentle`));
    }
});

test('grief gets the grief video first; job loss can get high-energy ones when not in crisis', () => {
    S.resetSupport();
    assert.strictEqual(S.pickSupportVideos('grief', 1, true)[0].id, '1DkTSscTq0s');
    assert.ok(S.pickSupportVideos('job', 3, false).some(v => !v.gentle));
});

test('stories: every named person present, "matter" story validates feelings, themes map to a story', () => {
    const who = S.SUPPORT_STORIES.map(s => s.who).join('|');
    for (const n of ['Kohli', 'Stallone', 'Murthy', 'Yash', 'Jobs', 'Adele', 'Kalam', 'Rowling', 'Jordan', 'Jack Ma', 'Sinha', 'Hawking', 'Rajinikanth', 'Ambani', 'Mary Kom']) assert.match(who, new RegExp(n));
    assert.match(S.SUPPORT_STORIES.find(s => s.id === 'matter').text, /Your pain is real/);
    for (const theme of ['pain', 'job', 'failure', 'breakup', 'nobody', 'grief', 'luck']) assert.ok(S.pickSupportStory(theme).text.length > 40);
});

test('cards are rare for distress, allowed after crisis, and every language has text', () => {
    S.resetSupport();
    assert.ok(S.supportAllowed(false));
    S._state().count = 1; S._state().lastTurn = S._state().turn;
    assert.ok(!S.supportAllowed(false));
    assert.ok(!S.supportAllowed(true));
    S.supportNextTurn(); S.supportNextTurn();
    assert.ok(S.supportAllowed(true));
    for (const l of ['en','hi','kn','ta','te','bn','mr','es','fr','de','pt','ar','zh','ja']) {
        const t = S.SUPPORT_TEXT[l];
        assert.ok(t && t.sTitle && t.sLead && t.sWatch && t.sNote, l);
    }
});
