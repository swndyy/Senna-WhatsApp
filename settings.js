const fs = require("node:fs");

const config = {
    owner: ["628888888888888888888"],
    name: "Senna Network",
    sessions: "auth_info",
    prefix: [".", "?", "!", "/"],
    sticker: {
        packname: "✨ Senna Pack Sticker ✨\n\n",
        author: "\n\n\n\n🐾 IG: Senna Nevertheless 🐾",
    },
    id: {
        newsletter: "xxxxxx@newsletter",
        group: "xxxxxx@g.us"
    },
    token: {
        gmail: "xxxxx@gmail.com",
        tmail: "xxxxx",
        github: ""
    },
    messages: {
        wait: "> ⏳ *Please hold on*... Your request is being processed. Thank you for your patience!",
        owner: "> 🧑‍💻 *This feature is exclusive to the bot owner*... Unfortunately, you do not have access to this functionality.",
        premium: "> 🥇 *Upgrade to Premium* to unlock exclusive features—affordable and fast! Contact the admin for more details.",
        group: "> 👥 *This feature is available in group chats only*... Please ensure you are in a WhatsApp group to access it.",
        admin: "> ⚠️ *This feature is restricted to group admins only*. Make sure you have admin privileges in the group.",
        grootbotbup: "> 🛠️ *Grant admin rights to the bot* in the group to enable this feature. Please ensure the bot has appropriate permissions.",
    },
    database: "senna-db",
    tz: "Asia/Jakarta",
};

module.exports = config;

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    delete require.cache[file];
});