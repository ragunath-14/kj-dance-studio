// WhatsApp group invite links, one per class. They are added to the welcome message so a new student
// can join their class group straight away. To change a link, edit it here (or set the env variable
// GROUP_LINK_<CLASS>, e.g. GROUP_LINK_KARATE) — no WhatsApp template change is needed.
const LINKS = {
  'Karate Class':      process.env.GROUP_LINK_KARATE   || 'https://chat.whatsapp.com/Bcpoq6CxodK8blwdQ9FS3o',
  'Zumba Class':       process.env.GROUP_LINK_ZUMBA    || 'https://chat.whatsapp.com/KrSaMAfrTOT8ulC4zM4zKq',
  'Silambam Class':    process.env.GROUP_LINK_SILAMBAM || 'https://chat.whatsapp.com/JXcZmiSn7cC2RqNNNBGs4h',
  'Art & Craft Class': process.env.GROUP_LINK_ART      || 'https://chat.whatsapp.com/KVBcH5NPqv7L5VT7GKNiro'
};

const groupLinkFor = (classType) => LINKS[String(classType || '').trim()] || '';

/**
 * "Karate Class + Regular Class" ->
 * "Karate Class (join your class WhatsApp group: https://chat.whatsapp.com/...) + Regular Class"
 * Classes without a group link are left as they are. The result is a single line (WhatsApp does not
 * allow line breaks inside a template variable).
 */
const withGroupLinks = (classNames) =>
  String(classNames || '').split(/\s*\+\s*/).filter(Boolean).map((name) => {
    const link = groupLinkFor(name);
    return link ? `${name} (join your class WhatsApp group: ${link})` : name;
  }).join(' + ');

module.exports = { LINKS, groupLinkFor, withGroupLinks };
