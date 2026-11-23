const test = require('node:test'); const assert = require('node:assert');
const { detectCrisis } = require('../js/chat/safety.js');
test('indirect "disappear / be gone" wording is treated as a crisis', () => {
  for (const t of ['i want to disappear', 'i wanna disappear', 'I feel like disappearing', 'no one would notice if I disappeared', 'i want to go away forever', 'i just want to be gone', 'i wish i never existed'])
    assert.ok(detectCrisis(t), t);
});
test('harmless uses of the same words are not', () => {
  for (const t of ['i want to disappear into a book', 'the magician made it vanish', 'my phone is gone', 'i want to go away for the weekend'])
    assert.ok(!detectCrisis(t), t);
});
test('"I don\'t think anyone would notice/miss/care" (not just "no one/nobody") is a crisis', () => {
  for (const t of ['i dont think anyone would even notice if i disappeared', "i don't think anybody would miss me",
                    'i dont think anyone would care if i was gone', 'no one would even care if i just disappeared'])
    assert.ok(detectCrisis(t), t);
});
test('ordinary questions about being noticed are not flagged', () => {
  for (const t of ['does anyone even notice me when i walk in', 'i wonder if anyone noticed my new haircut'])
    assert.ok(!detectCrisis(t), t);
});
