(async () => {
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        jidNormalizedUser,
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
    const figlet = require("figlet");
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

    function createTmpFolder() {
        const folderName = "tmp";
        const folderPath = path.join(__dirname, folderName);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
        } else {
           // Ga tau
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
    
    function showBanner() {
        console.clear();
        // const title = figlet.textSync("Welcome UI", {
            // font: "Standard",
            // horizontalLayout: "default",
            // verticalLayout: "default"
        // });
        
        const art = `
${chalk.yellowBright("       ʚɞ")}   ${chalk.gray.italic("// flutter flutter...")}

${chalk.whiteBright("   /\\_/\\")}         ${chalk.cyanBright.bold("“Huh? A butterfly!”")}
${chalk.whiteBright("  ( •.• )")}        ${chalk.magenta.italic("*blinks curiously*")}
${chalk.whiteBright("  > ^ <")}          ${chalk.gray("~ meow ~")}
        `;
        
        let message = '';
        message += `${art}\n`;
        message += `${chalk.green.bold("☘️ Welcome to the Dashboard")}\n`;
        message += `${chalk.white("Thank you for using this script.")}\n`;
        message += `${chalk.white("Your support inspires us to keep improving!")}\n\n`;
        
        message += `${chalk.yellow("📁 Initialize the modulel:")}\n`;
        message += `${chalk.cyan("- Baileys API Has Been Loaded")}\n`;
        message += `${chalk.cyan("- File System Ready to Use")}\n`;
        message += `${chalk.cyan("- The tmp folder has been successfully created")}\n`;
        message += `${chalk.cyan("- Database Has Been Initialized")}\n\n`;
        
        message += `${chalk.blue("🤖 Info Bot")}\n`;
        message += `${chalk.white(" | GitHub:")} ${chalk.cyan("https://github.com/swndyy")}\n`;
        message += `${chalk.white(" | Developer:")} ${chalk.green("SennaYaaa")}\n`;
        message += `${chalk.white(" | Server Status:")} ${chalk.green("Online")}\n`;
        message += `${chalk.white(" | Version:")} ${chalk.magenta(pkg.version)}\n`;
        message += `${chalk.white(" | Version Node.js:")} ${chalk.magenta(process.version)}\n\n`;
        
        message += `${chalk.blue("🔁 Running index.js...")}`;
    
        // console.log(title);
    
        console.log(message);
    }
    
    createTmpFolder()
    showBanner()

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
                    "- Please enter your WhatsApp number, for example +628xxxx",
                ),
            );
            const phoneNumber = await question(chalk.green.bold(`– Your Number: `));
            const code = await sock.requestPairingCode(phoneNumber);
            setTimeout(() => {
                console.log(chalk.white.bold("- Your Pairing Code: " + code));
            }, 3000);
        }

        //=====[ Connection Update Handler ]=====
        sock.ev.on("connection.update", async (update) => {
          const { connection, lastDisconnect } = update;
        
          if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        
            switch (reason) {
              case DisconnectReason.badSession:
                console.log(chalk.red.bold("[!] Invalid session file. Please delete the session and scan again. Trying Reconnecting..."));
                system();
                break;
              case DisconnectReason.connectionClosed:
                console.log(chalk.yellow.bold("[!] Connection closed. Reconnecting..."));
                system();
                break;
              case DisconnectReason.connectionLost:
                console.log(chalk.yellow.bold("[!] Connection lost. Attempting to reconnect..."));
                system();
                break;
              case DisconnectReason.connectionReplaced:
                console.log(chalk.red.bold("[!] Connection replaced. Another session has been opened."));
                await sock.logout();
                break;
              case DisconnectReason.loggedOut:
                console.log(chalk.red.bold("[!] Device logged out. Please scan again to continue."));
                await sock.logout();
                break;
              case DisconnectReason.restartRequired:
                console.log(chalk.green.bold("[!] Restart required. Rebooting..."));
                system();
                break;
              case DisconnectReason.timedOut:
                console.log(chalk.yellow.bold("[!] Connection timed out. Trying to reconnect..."));
                system();
                break;
              default:
                console.log(chalk.red.bold(`[!] Unknown disconnect reason: ${lastDisconnect?.error || "Unknown error"}`));
                break;
            }
        
          } else if (connection === "connecting") {
            console.log(chalk.blue.bold("[~] Connecting to WhatsApp..."));
        
          } else if (connection === "open") {
            console.log(chalk.green.bold("[+] Successfully connected to WhatsApp."));
        
            const currentTime = moment().tz("Asia/Jakarta");
            const pingSpeed = new Date() - currentTime;
            const formattedPingSpeed = pingSpeed < 0 ? "N/A" : `${pingSpeed}ms`;
        
            const infoMsg = "*Connection Report*\n\n" +
              "Your device has successfully connected to WhatsApp. Below is the current session information:\n\n" +
              "*─── System Information ───*\n" +
              `> *User ID*: ${sock.user.id}\n` +
              `> *Username*: ${sock.user.name}\n` +
              `> *Ping*: ${formattedPingSpeed}\n` +
              `> *Date*: ${currentTime.format("dddd, MMMM Do YYYY")}\n` +
              `> *Time*: ${currentTime.format("HH:mm:ss")}\n` +
              `> *Time Zone*: ${currentTime.format("z")}\n\n` +
              "*Status*: ✅ Connection is stable and operational.";
            for (let owner of config.owner) {
                await sock.sendMessage(
                  owner + "@s.whatsapp.net",
                  {
                    text: infoMsg,
                    mentions: [],
                  },
                  { quoted: null }
                );
            }
          }
        });

        //=====[ After Connection Update ]========//
        sock.ev.on("creds.update", saveCreds);

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
                        let promoteMessage = `Congratulations to @${participant.split("@")[0]} !!\n\n> You have been promoted to Group Admin.`;

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

                        let demoteMessage = `Thank You @${participant.split("@")[0]} !!\n\n> Thank you for being an admin in this group.`;

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