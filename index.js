(async () => {
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        jidNormalizedUser,
        fetchLatestBaileysVersion,
        Browsers,
        proto,
        makeInMemoryStore,
        DisconnectReason,
        delay,
        generateWAMessage,
        getAggregateVotesInPollMessage,
        areJidsSameUser,
    } = require("baileys");
    const pino = require("pino");
    const {
        Boom
    } = require("@hapi/boom");
    const chalk = require("chalk");
    const readline = require("node:readline");
    const simple = require("./app/simple.js");
    const fs = require("node:fs");
    const path = require('path');
    const pkg = require("./package.json");
    const NodeCache = require("node-cache");
    const moment = require("moment-timezone");
    const Queque = require("./app/queque.js");
    const messageQueue = new Queque();
    const Database = require("./app/database.js");
    const append = require("./app/append");
    const serialize = require("./app/serialize.js");
    const config = require("./settings.js");
    const MAX_RESTART_ATTEMPTS = 5;
    let restartAttempts = 0;

    function createTmpFolder() {
        const folderName = "tmp"; // Nama folder yang akan dibuat
        const folderPath = path.join(__dirname, folderName); // Path folder

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
            console.log(chalk.cyan.bold(`- Folder '${folderName}' berhasil dibuat.`));
        } else {
            console.log(chalk.cyan.bold(`- Folder '${folderName}' sudah ada.`));
        }
    }


    async function restartBot() {
        if (restartAttempts < MAX_RESTART_ATTEMPTS) {
            restartAttempts++;
            console.log(chalk.yellow.bold(`🔄 Mencoba untuk merestart bot... (Attempt: ${restartAttempts})`));
            await delay(5000);
            system();
        } else {
            console.log(chalk.red.bold("❌ Gagal merestart bot setelah beberapa kali percobaan. Silakan periksa log untuk detail lebih lanjut."));
        }
    }
    const appenTextMessage = async (m, sock, text, chatUpdate) => {
        let messages = await generateWAMessage(
            m.key.remoteJid, {
                text: text,
            }, {
                quoted: m.quoted,
            },
        );
        messages.key.fromMe = areJidsSameUser(m.sender, sock.user.id);
        messages.key.id = m.key.id;
        messages.pushName = m.pushName;
        if (m.isGroup) messages.participant = m.sender;
        let msg = {
            ...chatUpdate,
            messages: [proto.WebMessageInfo.fromObject(messages)],
            type: "append",
        };
        return sock.ev.emit("messages.upsert", msg);
    };

    const question = (text) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        return new Promise((resolve) => {
            rl.question(text, resolve);
        });
    };
    global.db = new Database(config.database + ".json");
    await db.init();
    setInterval(async () => {
        await db.save();
    }, 2000);

    const store = makeInMemoryStore({
        logger: pino().child({
            level: "silent",
            stream: "store",
        }),
    });

    console.log(chalk.green.bold(`
 --------------------------------------
  ☘️ Welcome to the Dashboard  
  Thank you for using this script.
  Your support inspires us to keep improving!  
 --------------------------------------
 `));

    console.log(chalk.yellow.bold("📁 Inisialisasi modul..."));
    console.log(chalk.cyan.bold("- API Baileys Telah Dimuat"));
    console.log(chalk.cyan.bold("- Sistem File Siap Digunakan"));
    console.log(chalk.cyan.bold("- Database Telah Diinisialisasi"));
    createTmpFolder();

    console.log(chalk.blue.bold("\n🤖 Info Bot:"));
    console.log(chalk.white.bold(" | GitHub: ") + chalk.cyan.bold("https://github.com/swndyy"));
    console.log(chalk.white.bold(" | Developer: ") + chalk.green.bold("SennaYaaa"));
    console.log(chalk.white.bold(" | Status Server: ") + chalk.green.bold("Online"));
    console.log(chalk.white.bold(" | Versi: ") + chalk.magenta.bold(pkg.version));
    console.log(chalk.white.bold(" | Versi Node.js: ") + chalk.magenta.bold(process.version));

    console.log(chalk.blue.bold("\n🔁 Menjalankan index.js..."))

    async function system() {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState(config.sessions);
        const groupCache = new NodeCache({
            stdTTL: 5 * 60,
            useClones: false
        });

        const sock = simple({
                logger: pino({
                    level: "silent"
                }),
                printQRInTerminal: false,
                auth: state,
                cachedGroupMetadata: async (jid) => groupCache.get(jid),
                version: [2, 3000, 1019441105],
                browser: Browsers.ubuntu("Edge"),
            },
            store,
        );
        store.bind(sock.ev);
        if (!sock.authState.creds.registered) {
            console.log(
                chalk.white.bold(
                    "- Silakan masukkan nomor WhatsApp Anda, misalnya +628xxxx",
                ),
            );
            const phoneNumber = await question(chalk.green.bold(`– Nomor Anda: `));
            const code = await sock.requestPairingCode(phoneNumber);
            setTimeout(() => {
                console.log(chalk.white.bold("- Kode Pairing Anda: " + code));
            }, 3000);
        }

        //=====[ Pembaruan Koneksi ]======
        sock.ev.on("connection.update", async (update) => {
            const {
                connection,
                lastDisconnect
            } = update;
            if (connection === "close") {
                const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                console.log(chalk.red.bold(`Koneksi ditutup: ${reason}`));
                await restartBot(); // Panggil fungsi restart
            } else if (connection === "connecting") {
                console.log(chalk.blue.bold("Menghubungkan ke WhatsApp..."));
            } else if (connection === "open") {
                console.log(chalk.green.bold("Bot berhasil terhubung."));
                restartAttempts = 0; // Reset attempts saat berhasil terhubung
            }
        });

        //=====[ Setelah Pembaruan Koneksi ]========//
        sock.ev.on("creds.update", async (creds) => {
            await saveCreds(creds);
        });

        sock.ev.on("contacts.update", (update) => {
            for (let contact of update) {
                let id = jidNormalizedUser(contact.id);
                if (store && store.contacts)
                    store.contacts[id] = {
                        ...(store.contacts?.[id] || {}),
                        ...(contact || {}),
                    };
            }
        });

        sock.ev.on("contacts.upsert", (update) => {
            for (let contact of update) {
                let id = jidNormalizedUser(contact.id);
                if (store && store.contacts)
                    store.contacts[id] = {
                        ...(contact || {}),
                        isContact: true
                    };
            }
        });

        sock.ev.on("groups.update", async (updates) => {
            for (const update of updates) {
                const id = update.id;
                const metadata = await sock.groupMetadata(id);
                groupCache.set(id, metadata)
                if (store.groupMetadata[id]) {
                    store.groupMetadata[id] = {
                        ...(store.groupMetadata[id] || {}),
                        ...(update || {}),
                    };
                }
            }
        });

        sock.ev.on("group-participants.update", async (groupUpdate) => {
            try {
                let groupMetadata = await sock.groupMetadata(groupUpdate.id);
                let participants = groupUpdate.participants;
                let totalMembers = groupMetadata.participants.length;
                let {
                    sLeft,
                    sWlcm
                } = db.list().group[groupUpdate.id]?.event;
                for (let participant of participants) {
                    try {
                        userProfilePicture = await sock.profilePictureUrl(
                            participant,
                            "image",
                        );
                    } catch (err) {
                        userProfilePicture =
                            "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png?q=60";
                    }

                    try {
                        groupProfilePicture = await sock.profilePictureUrl(
                            groupUpdate.id,
                            "image",
                        );
                    } catch (err) {
                        groupProfilePicture =
                            "https://i.ibb.co/RBx5SQC/avatar-group-large-v2.png?q=60";
                    }
                    
                    if (groupUpdate.action === "add" && db.list().group[groupUpdate.id]?.event.welcome) {
                      let tag_user_wlcm = `@${participant.split("@")[0]}`
                        let welcomeTxT = sWlcm
                        .replace("@USER", tag_user_wlcm)
                            .replace("@user", tag_user_wlcm)
                            .replace("@GROUP", groupMetadata.subject)
                            .replace("@group", groupMetadata.subject)
                            .replace("@DESC", groupMetadata.desc)
                            .replace("@desc", groupMetadata.desc);
                        sock.sendMessage(
                            groupUpdate.id, {
                                text: welcomeTxT,
                                contextInfo: {
                                  mentionedJid: [participant],                                
                                    externalAdReply: {
                                        showAdAttribution: true,
                                        title: 'W E L C O M E',
                                        body: 'To ' + groupMetadata.subject,
                                        thumbnailUrl: userProfilePicture,
                                        sourceUrl: null,
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                    } else if (
                        groupUpdate.action === "remove" &&
                        db.list().group[groupUpdate.id]?.event.left
                    ) {
                      let tag_user_left = `@${participant.split("@")[0]}`
                        let goodayTxT = sLeft
                        .replace("@USER", tag_user_left)
                            .replace("@user", tag_user_left)
                            .replace("@GROUP", groupMetadata.subject)
                            .replace("@group", groupMetadata.subject)
                            .replace("@DESC", groupMetadata.desc)
                            .replace("@desc", groupMetadata.desc);
                        sock.sendMessage(
                            groupUpdate.id, {
                                text: goodayTxT,
                                contextInfo: {
                                  mentionedJid: [participant],                                
                                    externalAdReply: {
                                        showAdAttribution: true,
                                        title: 'S E E    Y O U',
                                        body: groupMetadata.subject,
                                        thumbnailUrl: userProfilePicture,
                                        sourceUrl: null,
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            });
                    } else if (groupUpdate.action === "promote") {
                        let promoteMessage = `Selamat @${participant.split("@")[0]} !!\n\n> Anda telah dipromosikan menjadi Admin Group.`;

                        sock.sendMessage(
                            groupUpdate.id, {
                                text: promoteMessage,
                                contextInfo: {
                                  mentionedJid: [participant],                                
                                    externalAdReply: {
                                        showAdAttribution: true,
                                        title: 'P R O M O T E',
                                        body: "Congratulation new admin",
                                        thumbnailUrl: userProfilePicture,
                                        sourceUrl: null,
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            }
                        ); 
 
                    } else if (groupUpdate.action === "demote") {

                        let demoteMessage = `Terimakasih @${participant.split("@")[0]} !!\n\n> Termakasih telah menjadi bagian admin di group ini.`;

                        sock.sendMessage(
                            groupUpdate.id, {
                                text: demoteMessage,
                                contextInfo: {
                                  mentionedJid: [participant],                                
                                    externalAdReply: {
                                        showAdAttribution: true,
                                        title: 'D E M O T E',
                                        body: "Your position is down",
                                        thumbnailUrl: userProfilePicture,
                                        sourceUrl: null,
                                        mediaType: 1,
                                        renderLargerThumbnail: false
                                    }
                                }
                            }
                        );                            
                    }
                }
            } catch (err) {
                console.log(err);
            }
        });

        async function getMessage(key) {
            if (store) {
                const msg = await store.loadMessage(key.remoteJid, key.id);
                return msg;
            }
            return {
                conversation: "SennaNetwork",
            };
        }

        sock.ev.on("messages.upsert", async (cht) => {
            if (cht.messages.length === 0) return;
            const chatUpdate = cht.messages[0];
            if (!chatUpdate.message) return;
            const userId = chatUpdate.key.id;
            global.m = await serialize(chatUpdate, sock, store);
            if (m.isBot) return;
            require("./app/logger.js")(m);
            if (!m.isOwner && db.list().settings.self) return;
            await require("./cmd.js")(m, sock, store);
        });

        sock.ev.on("messages.update", async (chatUpdate) => {
            for (const {
                    key,
                    update
                }
                of chatUpdate) {
                if (update.pollUpdates && key.fromMe) {
                    const pollCreation = await getMessage(key);
                    if (pollCreation) {
                        let pollUpdate = await getAggregateVotesInPollMessage({
                            message: pollCreation?.message,
                            pollUpdates: update.pollUpdates,
                        });
                        let toCmd = pollUpdate.filter((v) => v.voters.length !== 0)[0]
                            ?.name;
                        console.log(toCmd);
                        await appenTextMessage(m, sock, toCmd, pollCreation);
                        await sock.sendMessage(m.cht, {
                            delete: key
                        });
                    } else return false;
                    return;
                }
            }
        });

        return sock;
    }
    system();

    let file = require.resolve(__filename);
    fs.watchFile(file, () => {
        fs.unwatchFile(file);
        delete require.cache[file];
    });

})();