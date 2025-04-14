const config = require("./settings.js");
const Func = require("./app/function.js");
const Uploader = require("./app/uploader.js");
const pkg = require(process.cwd() + "/package.json");
const {
    writeExif
} = require(process.cwd() + "/app/sticker");
// Core Modules (Bawaan Node.js)
const {
    exec,
    spawn,
    execSync
} = require("child_process")
const crypto = require('crypto');
const fs = require("node:fs");
const os = require('node:os');
const path = require('node:path');
const util = require('util');
// Third-Party Modules (Library Eksternal)
const axios = require('axios');
const chalk = require('chalk');
const cheerio = require('cheerio');
const cron = require('node-cron');
const fetch = require('node-fetch');
const FormData = require('form-data');
const moment = require("moment-timezone");
const schedule = require('node-schedule');

const timeZone = 'Asia/Jakarta';

module.exports = async (m, sock, store) => {
    try {
        await db.main(m);
        if (m.isBot) return;

        if (Object.keys(store.groupMetadata).length === 0) {
            store.groupMetadata = await sock.groupFetchAllParticipating();
        }

        const isPrems = db.list().user[m.sender].premium.status;
        const isBanned = db.list().user[m.sender].banned.status;
        const isSenna = m.isOwner;
        const isAdmin = m.isAdmin;
        const botAdmin = m.isBotAdmin;
        const body = (m && typeof m.text === 'string') ? m.text : '';
        const arrayPrefix = config.prefix.includes(m.prefix);
        const text = m.text;
        const usedPrefix = m.prefix && arrayPrefix;
        const isCmd = usedPrefix && m.command;

        const checkGroupsStatus = async (sock) => {
            const currentTime = moment().tz(timeZone).format('HH:mm');

            for (const chatId of Object.keys(db.list().group)) {
                const chat = db.list().group[chatId];
                if (!chat.autoGc) continue;

                const {
                    closeTime,
                    openTime
                } = chat.autoGc;
                const currentHour = moment().tz(timeZone).hour();

                if (currentHour === closeTime && chat.groupStatus !== 'closed') {
                    await sock.groupSettingUpdate(chatId, 'announcement');
                    await sock.sendMessage(chatId, {
                        text: `📢 *[ PEMBERITAHUAN ]*  \nGrup akan dibuka pada pukul *${openTime}:00 WIB* . Mohon tetap tenang dan tertib sementara menunggu. Terima kasih atas pengertiannya! 😊`
                    });
                    chat.groupStatus = 'closed';
                }

                if (currentHour === openTime && chat.groupStatus !== 'opened') {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, {
                        text: `📢 *[ PEMBERITAHUAN ]*\nGrup akan ditutup pada pukul *${closeTime}:00 WIB* sesuai jadwal. Terima kasih atas pengertiannya! 😊`
                    });
                    chat.groupStatus = 'opened';
                }
            }
        };

        schedule.scheduleJob('* * * * *', () => {
            checkGroupsStatus(sock);
        });

        if (db.list().group[m.cht]?.event?.banchat) {
            if (!m.isOwner) {
                return;
            }
        }

        if (db.list().group[m.cht]?.event?.mute) {
            if (!isAdmin && !m.isOwner) {
                return;
            }
        }

        if (isCmd) {
            switch (m.command) {
                // Group Tools
                case 'dor':
                case 'kick': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    let who = m.quoted ?
                        m.quoted.sender :
                        m.mentions.length > 0 ?
                        m.mentions[0] :
                        false;

                    if (!who) {
                        throw `*⚠️ Perintah Tidak Lengkap!*\n\n> *Gunakan salah satu cara berikut:*\n  • Tag anggota dengan: @username\n  • Balas pesan anggota yang ingin dikeluarkan.\n\n📌 _Pastikan kamu memiliki hak sebagai admin grup._`;
                    }

                    let user = await sock.onWhatsApp(who);
                    if (!user[0].exists) {
                        throw `*❌ Anggota Tidak Ditemukan!*\n\n> Akun WhatsApp ini tidak terdaftar atau sudah tidak aktif.`;
                    }

                    await sock
                        .groupParticipantsUpdate(m.cht, [who], "remove")
                        .then(() => {
                            m.reply(
                                `*✅ Berhasil!* 🥾\n\n> @${who.split("@")[0]} telah dikeluarkan dari grup.\n\n📌 _Gunakan fitur ini untuk menjaga kenyamanan grup._`,
                            );
                        })
                        .catch((err) => {
                            m.reply(
                                `*❌ Gagal!*\n\n> Tidak dapat mengeluarkan @${who.split("@")[0]} dari grup.\n📌 _Pastikan bot memiliki hak admin untuk melakukan perubahan ini._`,
                            );
                        });
                }
                break
                case 'hidetag':
                case 'ht':
                case 'h': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    const fkontak = {
                        key: {
                            participants: "0@s.whatsapp.net",
                            remoteJid: "status@broadcast",
                            fromMe: false,
                            id: "Halo"
                        },
                        message: {
                            contactMessage: {
                                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:y\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                            }
                        },
                        participant: "0@s.whatsapp.net"
                    };
                    const groupMetadata = m.isGroup ? await sock.groupMetadata(m.cht).catch(e => {}) : {};
                    const participants = m.isGroup ? await groupMetadata.participants || [] : [];

                    sock.sendMessage(m.cht, {
                        text: m.text ? m.text : '',
                        mentions: participants.map(a => a.id)
                    }, {
                        quoted: fkontak
                    });
                }
                break
                case 'event': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    const eventCategories = [
                        "welcome",
                        "left",
                    ];
                    let args = text.split(" ");
                    let chat = db.list().group[m.cht].event;
                    if (!text) return m.reply(`⚠️ *Format Salah!* 
Harap masukkan perintah dengan format berikut: 
*${m.prefix + m.command} enable* atau *disable <category>* 

📝 *Contoh:* 
*${m.prefix + m.command} enable welcome* 

> *– 乂 Kategori Tersedia:* 
${eventCategories.join("\n> ")}`)
                    if (args[0] === 'enable') {
                        if (args.length < 2) return m.reply(`⚠️ *Format Salah!*\nGunakan: \`${m.prefix + m.command} enable [category]\`\n📝 *Contoh:* \`${m.prefix + m.command} enable welcome\``);
                        if (args[1] === 'welcome') {
                            chat.welcome = true
                            m.reply(`✅ *Welcome berhasil diaktifkan!*\nWelcome akan menggunakan ucapan default.\nUntuk mengubah ucapan, gunakan perintah: \`${m.prefix}setwelcome\``)
                        } else if (args[1] === 'left') {
                            chat.left = true
                            m.reply(`✅ *Left berhasil diaktifkan!*\nLeft akan menggunakan ucapan default.\nUntuk mengubah ucapan, gunakan perintah: \`${m.prefix}setleft\``)
                        }
                    } else if (args[0] === 'disable') {
                        if (args[1] === 'welcome') {
                            chat.welcome = false
                            m.reply(`✅ *Welcome berhasil dinonaktifkan!*\nSekarang, Shizuku tidak akan lagi mengirim ucapan selamat datang kepada member baru. `)
                        } else if (args[1] === 'left') {
                            chat.left = false
                            m.reply(`✅ *Left berhasil dinonaktifkan!*\nSekarang, Shizuku tidak akan lagi mengirim ucapan selamat tinggal kepada member yang keluar. `)
                        }
                    }
                }
                break
                case 'group':
                case 'gc': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    if (!text)
                        throw `*– 乂 Cara Penggunaan:*\n
> *🔓* Gunakan \`open\` untuk membuka grup. Member dapat mengirim pesan dan berinteraksi dengan bebas.\n
> *🔒* Gunakan \`close\` untuk menutup grup. Hanya admin yang dapat mengirim pesan, member akan dibatasi.\n\n
*– 乂 Contoh Penggunaan:*\n
> *-* *${m.prefix + m.command} open* - Untuk membuka grup\n
> *-* *${m.prefix + m.command} close* - Untuk menutup grup\n\n
*– 乂 Penting!*\n
> *📌* Jika grup dibuka, semua member dapat berinteraksi.\n
> *📌* Jika grup ditutup, hanya admin yang dapat mengirim pesan.`;

                    await sock
                        .groupSettingUpdate(
                            m.cht,
                            text === "open" ? "not_announcement" : "announcement",
                        )
                        .then(() =>
                            m.reply(
                                `> ✅ *Berhasil ${text === "open" ? "membuka" : "menutup"} grup!* ${text === "open" ? "Sekarang member bisa mengirim pesan." : "Hanya admin yang dapat mengirim pesan sekarang."}`,
                            ),
                        );
                }
                break
                case 'linkgc':
                case 'linkgroup':
                case 'gclink': {
                    try {
                        let link =
                            "https://chat.whatsapp.com/" + (await sock.groupInviteCode(m.cht));
                        let caption = `*– 乂 Informasi Tautan Grup*\n\n`;
                        caption += `> *- Nama Grup :* ${m.metadata.subject}\n`;
                        caption += `> *- Tautan :* ${link}\n\n`;
                        caption += `📌 _Gunakan tautan ini dengan bijak untuk menjaga keamanan grup._`;

                        m.reply(caption);
                    } catch (error) {
                        m.reply(
                            `*❌ Gagal Mendapatkan Link!*\n\n> Pastikan bot memiliki hak admin untuk membuat tautan grup.`,
                        );
                    }
                }
                break
                case 'promote': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    let who = m.quoted ?
                        m.quoted.sender :
                        m.mentions.length > 0 ?
                        m.mentions[0] :
                        false;

                    if (!who)
                        throw `*🚫 Perintah Gagal!*\n\n> Tag atau balas pesan member yang ingin dijadikan admin.`;

                    let user = await sock.onWhatsApp(who);
                    if (!user[0].exists)
                        throw `*❌ Error!*\n\n> Nomor tersebut tidak terdaftar di WhatsApp.`;

                    await sock
                        .groupParticipantsUpdate(m.cht, [who], "promote")
                        .then(() => {
                            let name = who.split("@")[0];
                            m.reply(
                                `*✅ Promosi Berhasil!*\n\n> 🎉 Selamat kepada *@${name}* karena telah menjadi admin grup!\n\n📌 _Gunakan jabatan ini dengan bijak._`, {
                                    mentions: [who]
                                },
                            );
                        })
                        .catch(() => {
                            m.reply(
                                `*❌ Gagal Memproses!*\n\n> Pastikan bot memiliki hak admin untuk melakukan perubahan ini.`,
                            );
                        });
                }
                break
                case 'demote': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    let who = m.quoted ?
                        m.quoted.sender :
                        m.mentions.length > 0 ?
                        m.mentions[0] :
                        false;

                    if (!who) {
                        throw `*⚠️ Perintah Tidak Lengkap!*\n\n> *Gunakan salah satu cara berikut:*\n  • Tag member dengan: @username\n  • Balas pesan member yang ingin diturunkan.\n\n📌 _Pastikan kamu memiliki hak sebagai admin grup._`;
                    }

                    let user = await sock.onWhatsApp(who);
                    if (!user[0].exists) {
                        throw `*❌ Member Tidak Ditemukan!*\n\n> Akun WhatsApp ini tidak terdaftar atau sudah tidak aktif.`;
                    }

                    await sock
                        .groupParticipantsUpdate(m.cht, [who], "demote")
                        .then(() => {
                            m.reply(
                                `*✅ Berhasil!* 🎉\n\n> Jabatan @${who.split("@")[0]} telah diturunkan menjadi anggota biasa.\n\n📌 _Gunakan perintah ini dengan bijak untuk menjaga keharmonisan grup._`,
                            );
                        })
                        .catch((err) => {
                            m.reply(
                                `*❌ Gagal!*\n\n> Tidak dapat menurunkan jabatan admin untuk @${who.split("@")[0]}.\n📌 _Pastikan bot memiliki hak admin untuk melakukan perubahan ini._`,
                            );
                        });
                }
                break
                case 'security': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    let args = text.split(" ");
                    let chat = db.list().group[m.cht];
                    if (!text) return m.reply(`⚠️ *Format Salah!* ⚠️  
Pastikan kamu menggunakan format yang benar untuk mengaktifkan fitur keamanan:  

✅ *Aktifkan Security:*  
Gunakan \`${ m.prefix + m.command } enable jam_tutup|jam_buka\`  
🔹 *Contoh:* \`${ m.prefix + m.command } enable 21|5\`  

❌ *Nonaktifkan Security:*  
Gunakan \`!security disable\``)
                    if (args[0] === 'enable') {
                        if (args.length < 2) return m.reply(`Format salah! Gunakan ${ m.prefix + m.command } enable jam tutup|jam buka\nContoh: ${ m.prefix + m.command } enable 21|5`);
                        let [closeTime, openTime] = args[1].split('|').map(Number);
                        if (isNaN(closeTime) || isNaN(openTime)) return m.reply('Jam tutup dan buka harus berupa angka!');
                        chat.autoGc = {
                            closeTime,
                            openTime
                        };
                        m.reply(`✅ *Auto Close/Open Diaktifkan!*\nGrup akan otomatis tutup pukul \`${closeTime}:00\` dan buka pukul \`${openTime}:00\` sesuai jadwal yang telah di buat oleh Admin Group.`);
                    } else if (args[0] === 'disable') {
                        delete chat.autoGc;
                        m.reply('Auto group close/open dinonaktifkan.');
                    }
                }
                break
                case 'setwelcome': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    if (!text) {
                        return m.reply(`⚠️ *Harap Masukkan Format yang Tepat!*\n\n📋 *Contoh Penggunaan:* 
*${m.prefix + m.command} Hi @user, Selamat datang di @group. Jangan lupa untuk membaca rules. @desc*\n\n📚 *Penjelasan:* 
- 🧑‍💻 *@user* : Untuk menyebut atau mention pengguna yang baru masuk grup. 
- 🏠 *@group* : Menampilkan nama grup ini. 
- 📖 *@desc* : Menampilkan deskripsi yang tertera di grup.\n\n✨ Pastikan menggunakan format dengan benar untuk menciptakan sambutan yang ramah dan informatif bagi member baru!`);
                    }

                    let chat = db.list().group[m.cht].event;
                    chat.sWlcm = text;
                    m.reply(`✅ *Ucapan selamat datang telah diperbarui!*\nSekarang, sambutan untuk member baru telah diperbarui dengan format terbaru. 🎉 \n\nJika ingin melihat atau mengubahnya kembali, gunakan perintah: \`${m.prefix}setwelcome\`.`);
                }
                break
                case 'setleft': {
                    if (!isAdmin) return m.reply(config.messages.admin)
                    if (!text) {
                        return m.reply(`⚠️ *Harap Masukkan Format yang Tepat!*\n\n📋 *Contoh Penggunaan:* 
*${m.prefix + m.command} Sampai jumpa lagi @user. Jangan lupa untuk mengingat member @group ya.*\n\n📚 *Penjelasan:* 
- 🧑‍💻 *@user* : Untuk menyebut atau mention pengguna yang baru masuk grup. 
- 🏠 *@group* : Menampilkan nama grup ini. 
- 📖 *@desc* : Menampilkan deskripsi yang tertera di grup.\n\n✨ Pastikan menggunakan format dengan benar untuk menciptakan ucapan yang ramah dan informatif bagi member yang pergi!`);
                    }

                    let chat = db.list().group[m.cht].event;
                    chat.sWlcm = text;
                    m.reply(`✅ *Ucapan selamat tinggal telah diperbarui!*\nKini pesan perpisahan untuk member yang keluar telah diperbarui dengan format terbaru.\n\nJika ingin mengubahnya kembali, gunakan perintah: \`${m.prefix}setleft\`. `);
                }
                break
                // Maker
                case 'brat': {
                    let input = m.isQuoted ? m.quoted.body : text;
                    if (!input) return m.reply("> Reply/Masukan pesan");

                    if (m.text.includes("--animated")) {
                        let txt = input.replace("--animated", "").trim().split(" ");
                        let array = [];
                        let tmpDirBase = path.resolve(`./tmp/brat_${Date.now()}`);

                        fs.mkdirSync(tmpDirBase, {
                            recursive: true
                        })
                        for (let i = 0; i < txt.length; i++) {
                            let word = txt.slice(0, i + 1).join(" ");
                            let media = (await axios.get(`https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(word)}`, {
                                responseType: 'arraybuffer'
                            })).data;
                            let tmpDir = path.resolve(`${tmpDirBase}/brat_${i}.mp4`);
                            fs.writeFileSync(tmpDir, media);
                            array.push(tmpDir);
                        }

                        let fileTxt = path.resolve(`${tmpDirBase}/cmd.txt`);
                        let content = "";
                        for (let i = 0; i < array.length; i++) {
                            content += `file '${array[i]}'\n`;
                            content += `duration 0.5\n`;
                        }
                        content += `file '${array[array.length - 1]}'\n`;
                        content += `duration 3\n`;
                        fs.writeFileSync(fileTxt, content);

                        let output = path.resolve(`${tmpDirBase}/output.mp4`);
                        execSync(`ffmpeg -y -f concat -safe 0 -i ${fileTxt} -vf "fps=30" -c:v libx264 -preset veryfast -pix_fmt yuv420p -t 00:00:10 ${output}`);
                        let sticker = await writeExif({
                            mimetype: "video",
                            data: fs.readFileSync(output)
                        }, {
                            packName: config.sticker.packname,
                            packPublish: config.sticker.author
                        });
                        fs.rmSync(tmpDirBase, {
                            recursive: true,
                            force: true
                        });
                        await m.reply({
                            sticker
                        });
                    } else {
                        let media = (await axios.get(`https://aqul-brat.hf.space/api/brat?text=${encodeURIComponent(input)}`, {
                            responseType: 'arraybuffer'
                        })).data;
                        let sticker = await writeExif({
                            mimetype: "image",
                            data: media
                        }, {
                            packName: config.sticker.packname,
                            packPublish: config.sticker.author
                        });
                        await m.reply({
                            sticker
                        });
                    }
                }
                break
                case 'qc': {
                    const q = m.quoted ? m.quoted : m;
                    let input = m.isQuoted ? m.quoted.body : text;
                    if (!input) return m.reply("> Reply/Masukan pesan");
                    let reply;
                        if (!m.quoted) {
                           reply = {};
                        } else if (!q.sender === q.sender) {
                          reply = {
                             name: q.name,
                              text: q.text || "",
                              chatId: q.cht.split("@")[0],
                          };
                    }

                    const img = await q.download?.();
                    const pp = await sock
                        .profilePictureUrl(q.sender, "image")
                        .catch((_) => "https://telegra.ph/file/320b066dc81928b782c7b.png")
                        .then(async (a) => await Func.fetchBuffer(a));
                    const obj = {
                        type: "quote",
                        format: "png",
                        backgroundColor: "#161616",
                        width: 512,
                        height: 768,
                        scale: 2,
                        messages: [{
                            entities: [],
                            avatar: true,
                            from: {
                                id: m.key.remoteJid.split("@")[0],
                                name: q.pushName,
                                photo: {
                                    url: await Uploader.catbox(pp),
                                },
                            },
                            text: text || "",
                            replyMessage: reply,
                        }, ],
                    };

                    const json = await axios.post(
                        "https://bot.lyo.su/quote/generate",
                        obj, {
                            headers: {
                                "Content-Type": "application/json",
                            },
                        },
                    );
                    const buffer = Buffer.from(json.data.result.image, "base64");
                    const sticker = await writeExif({
                        mimetype: "image",
                        data: buffer,
                    }, {
                        packName: config.sticker.packname,
                        packPublish: config.sticker.author,
                    }, );
                    m.reply({
                        sticker,
                    });

                }
                break
                case 's':
                case 'sticker':
                case 'stiker': {
                    const quoted = m.isQuoted ? m.quoted : m;
                    if (/image|video|webp/.test(quoted.msg.mimetype)) {
                        let media = await quoted.download();
                        if (quoted.msg?.seconds > 10)
                            throw "> *⚠️ Video lebih dari 10 detik tidak dapat dijadikan sticker*.";

                        let exif;
                        if (text) {
                            let [packname, author] = text.split(/[,|\-+&]/);
                            exif = {
                                packName: packname ? packname : "",
                                packPublish: author ? author : "",
                            };
                        } else {
                            exif = {
                                packName: config.sticker.packname,
                                packPublish: config.sticker.author,
                            };
                        }

                        let sticker = await writeExif({
                            mimetype: quoted.msg.mimetype,
                            data: media
                        }, exif);

                        await m.reply({
                            sticker
                        });
                    } else if (m.mentions.length !== 0) {
                        for (let id of m.mentions) {
                            try {
                                var urlPic = await sock.profilePictureUrl(id, 'image');
                            } catch (err) {
                                var urlPic = 'https://telegra.ph/file/6880771a42bad09dd6087.jpg';
                            }
                            let penyitas = (await axios.get(urlPic, {
                                responseType: 'arraybuffer'
                            })).data;
                            let sticker = await writeExif({
                                mimetype: "image",
                                data: penyitas
                            }, {
                                packName: config.sticker.packname,
                                packPublish: config.sticker.author
                            });
                            await m.reply({
                                sticker
                            });
                        }
                    } else if (
                        /(https?:\/\/.*\.(?:png|jpg|jpeg|webp|mov|mp4|webm|gif))/i.test(
                            text,
                        )
                    ) {
                        for (let url of Func.isUrl(text)) {
                            await m.reply(url);
                        }
                    } else {
                        m.reply("> 📸 Balas dengan foto atau video untuk dijadikan sticker.");
                    }
                }
                break
                case 'smeme': {
                    const quoted = m.isQuoted ? m.quoted : m;

                    // Validasi tipe media yang didukung
                    if (!quoted || !/image|webp/.test(quoted.msg.mimetype)) {
                        return m.reply(
                            `📌 Reply foto atau sticker untuk ditambahkan teks meme.\n📝 Format: \`${m.prefix + m.command} [text atas] | [text bawah]\`.`
                        );
                    }

                    try {
                        let DLmedia = await quoted.download();

                        // Ambil teks atas dan bawah dari input
                        const atas = text.split('|')[0] ? text.split('|')[0] : '-';
                        const bawah = text.split('|')[1] ? text.split('|')[1] : '-';

                        // Upload media dan dapatkan URL
                        let uploadedURL = await Uploader.tmpfiles(DLmedia);

                        // Ambil meme dari API
                        let media = (await axios.get(`https://api.memegen.link/images/custom/${encodeURIComponent(bawah)}/${encodeURIComponent(atas)}.png?background=${encodeURIComponent(uploadedURL)}`, {
                            responseType: 'arraybuffer'
                        })).data;
                        let sticker = await writeExif({
                            mimetype: "image",
                            data: media
                        }, {
                            packName: config.sticker.packname,
                            packPublish: config.sticker.author
                        });
                        await m.reply({
                            sticker
                        });
                    } catch (error) {
                        console.error("Error saat membuat sticker:", error.message);
                        m.reply("❌ Terjadi kesalahan saat memproses sticker. Coba lagi.");
                    }
                }
                break
                // Downloader 
                case 'dl':
                case 'download':
                case 'tt':
                case 'tiktok':
                case 'ig':
                case 'igdl':
                case 'instagram': {
                    let input = m.isQuoted ? m.quoted.body : text;
                    const regex = /(https:\/\/(vt\.tiktok\.com\/[a-zA-Z0-9._-]+\/|vm\.tiktok\.com\/[a-zA-Z0-9._-]+\/|www\.tiktok\.com\/@[\w._-]+\/video\/\d+|www\.instagram\.com\/reel\/[a-zA-Z0-9._-]+\/))/g;
                    const matches = input.match(regex);


                    if (!matches || matches.length === 0) {
                        return m.reply("🚩 URL tidak valid atau tidak didukung. Masukkan URL TikTok atau Instagram Reels.");
                    }

                    const url = matches[0];

                    if (url.startsWith("https://vt.tiktok.com/") ||
                        url.startsWith("https://www.tiktok.com/") ||
                        url.startsWith("https://t.tiktok.com/") ||
                        url.startsWith("https://vm.tiktok.com/")) {
                        try {
                            const dataTiktok = await Func.fetchJson(`https://www.archive-ui.biz.id/download/tiktok?url=${url}`);
                            if (dataTiktok && dataTiktok.result && dataTiktok.result.no_wm) {
                                await m.reply({
                                    video: {
                                        url: dataTiktok.result.no_wm
                                    },
                                    caption: dataTiktok.result.title
                                });
                            } else {
                                m.reply("🚩 Gagal mendapatkan data video TikTok. Pastikan URL valid.");
                            }
                        } catch (error) {
                            console.error("🚩 Error TikTok Downloader:", error.message);
                            m.reply("🚩 Terjadi kesalahan saat mencoba mengunduh video TikTok.");
                        }
                    }

                    if (url.startsWith("https://www.instagram.com/") || url.startsWith("https://www.instagram.com/reel/")) {
                        try {
                            const dataInstagram = await Func.fetchJson(`https://www.archive-ui.biz.id/download/instagram?url=${url}`);
                            if (dataInstagram && dataInstagram.result && dataInstagram.result.url.length > 0) {
                                for (const videoUrl of dataInstagram.result.url) {
                                    await sock.sendFile(m.cht, videoUrl, null, "", m);
                                }
                            } else {
                                m.reply("🚩 Gagal mendapatkan data video Instagram. Pastikan URL valid.");
                            }
                        } catch (error) {
                            console.error("🚩 Error Instagram Downloader:", error.message);
                            m.reply("🚩 Terjadi kesalahan saat mencoba mengunduh video Instagram.");
                        }
                    }
                }
                break;
                case 'music':
                case 'play': {
                    if (!text) {
                        return m.reply(`Masukan Judulnya\n\nExample: ${m.prefix + m.command} Ku Tak Bisa - Adista Band`);
                    }
                    try {
                        async function downloadSoundCloudTrack(trackUrl) {
                            try {
                                const config = {
                                    method: "post",
                                    url: "https://api.downloadsound.cloud/track",
                                    headers: {
                                        Accept: "application/json, text/plain, */*",
                                        "Content-Type": "application/json;charset=utf-8",
                                    },
                                    data: {
                                        url: trackUrl,
                                    },
                                };

                                const response = await axios(config);
                                return response.data;
                            } catch (error) {
                                console.error("Error saat mengunduh track:", error.message);
                                throw error; // Lempar error agar dapat ditangani oleh caller
                            }
                        }

                        const searchMusicResults = await Func.fetchJson(`https://www.archive-ui.biz.id/search/soundcloud?q=${text}`);
                        m.reply('Loading...');
                        const MusicallyRs = searchMusicResults.result[0].url;
                        const scdl = await downloadSoundCloudTrack(MusicallyRs)
                        m.reply({
                            audio: {
                                url: scdl.url
                            },
                            mimetype: 'audio/mpeg',
                            ptt: false,
                            contextInfo: {
                                externalAdReply: {
                                    mediaUrl: scdl.imageURL,
                                    mediaType: 2,
                                    title: scdl.title,
                                    body: "Sound Cloud",
                                    thumbnailUrl: scdl.imageURL,
                                    sourceUrl: MusicallyRs,
                                    renderLargerThumbnail: true,
                                },
                            }
                        })

                    } catch (error) {
                        console.error('Error:', error);
                        return m.reply('Terjadi kesalahan saat memproses permintaan.');
                    }
                }
                break;
                // information
                case 'banchat': {
                    if (!isSenna) return m.reply(config.messages.owner)
                    let args = text.split(" ");
                    let status = db.list().group[m.cht].event
                    if (args[0] === "true") {
                        if (status.banchat) return m.reply('Group ini sudah dalam status: Banned!');
                        status.banchat = true
                        await m.react('🔇');
                    } else if (args[0] === "false") {
                        if (!status.banchat) return m.reply('Group ini sudah dalam status: Unbanned');
                        status.banchat = false
                        await m.react('✅');
                    } else {
                        await m.reply(`Please Type The Option\n\nExample: ${m.prefix + m.command} true/false`);
                    }
                }
                break
                case 'ai': {
                    if (!text) {
                        return m.reply(`⚠️ *Harap Masukkan Format yang Tepat!*\n\n📋 *Contoh Penggunaan:* 
${m.prefix + m.command} Halo apa itu Skizofrenia?`);
                    }
                    let data = await Func.fetchJson(`https://www.archive-ui.biz.id/ai/luminai?text=${text}`)
                    m.reply(data.result)
                }
                break
                case 'owner': {
                    let list_staff = [];
                    let staff_domp = config.owner;
                    for (let i of staff_domp) {
                        list_staff.push({
                            displayName: "anonymous",
                            vcard: `BEGIN:VCARD\nVERSION:3.0\nN:anonymous\nFN:anonymous\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:📞 Contact Owners\nitem2.EMAIL;type=INTERNET:📧 sennanetwork@gmail.com\nitem2.X-ABLabel:📩 Email\nitem3.URL:https://www.archive-ui.biz.id\nitem3.X-ABLabel:🌍 GitHub & Website\nitem4.ADR:;;🇮🇩 Indonesia;;;;\nitem4.X-ABLabel:📍 Region\nEND:VCARD`
                        });
                    }

                    await sock.sendMessage(m.cht, {
                        contacts: {
                            displayName: `${list_staff.length} Contact`,
                            contacts: list_staff
                        }
                    }, {
                        quoted: m
                    });
                }
                break
                case 'ping': {
                    if (!isSenna) return m.reply(config.messages.owner)
                    let start = performance.now(),
                        node = process.memoryUsage(),
                        info = await fetch("https://ipwho.is").then((a) => a.json()),
                        cap = `📊 *Bot Information*
- Running on: ${process.env.username === "root" ? "VPS" : process.env.username === "container" ? "HOSTING (PANEL)" : process.env.username}
- Uptime: ${Func.toDate(process.uptime() * 1000)}
- Home Directory: ${os.homedir}
- Directory Tmp: ${os.tmpdir()} (${fs.readdirSync(process.cwd() + os.tmpdir).length} berkas)
- Hostname: ${os.hostname()}
- Node Version: ${process.version}
- CWD Location: ${process.cwd()}

🌐 *Provider Information*
- ISP: ${info.connection.isp}
- Organization: ${info.connection.org}
- Country: ${info.country}
- City: ${info.city}
- Time Zone: ${info.timezone.id}

🖥️ *Server Information*
- Speed: ${(performance.now() - start).toFixed(3)} ms
- Uptime: ${Func.toDate(os.uptime() * 1000)}
- Memori Total: ${Func.formatSize(os.totalmem() - os.freemem())} / ${Func.formatSize(os.totalmem())}
- CPU: ${os.cpus()[0].model} (${os.cpus().length} core)
- Release OS: ${os.release()}
- Type OS: ${os.type()}

💾 *Node.js Memory Usage*
${Object.entries(node)
 .map(([a, b]) => `- ${a.capitalize()}: ${Func.formatSize(b)}`)
 .join("\n")}
`;

                    m.reply(cap);
                }
                break
                case 'script':
                case 'sc': {
                    let data = await axios
                        .get("https://api.github.com/repos/swndyy/Senna-WhatsApp")
                        .then((a) => a.data);

                    let cap = "*ㅡ> Informasi Script Bot*\n\n";
                    cap += `> 🧩 *Nama:* ${data.name}\n`;
                    cap += `> 👤 *Pemilik:* ${data.owner.login}\n`;
                    cap += `> ⭐ *Star:* ${data.stargazers_count}\n`;
                    cap += `> 🍴 *Forks:* ${data.forks}\n`;
                    cap += `> 📅 *Dibuat sejak:* ${Func.ago(data.created_at)}\n`;
                    cap += `> 🔄 *Terakhir Update:* ${Func.ago(data.updated_at)}\n`;
                    cap += `> 🔄 *Terakhir Publish:* ${Func.ago(data.pushed_at)}\n`;
                    cap += `> 🔗 *Link Repository:* ${data.html_url}\n\n`;
                    cap +=
                        "🔧 *Fitur Utama Script Bot:*\n" +
                        "> ✅ *Only Case*\n" +
                        "> ✅ *Ukuran Script Ringan*\n" +
                        "> ✅ *100% Kosongan*\n" +
                        "> ✅ *Respon Edit & Button*\n" +
                        "> ✅ *Support Run Di Mana Saja*\n\n";
                    cap +=
                        "Script ini gratis, boleh kalian recode dan jual asal jangan hapus credit original dari kami!";

                    m.reply(cap);
                }
                break
                case 'tourl': {
                    let target = m.quoted ? m.quoted : m;
                    if (!target.msg.mimetype)
                        throw "⚠️ *Oops!* Harap kirim atau balas media (gambar/video) yang ingin diubah menjadi tautan.";

                    let buffer = await target.download();
                    let url = await Uploader.catbox(buffer);

                    let caption = `✨ *Media to URL Uploader* ✨\n\n`;
                    caption += `📂 *Ukuran media:* ${Func.formatSize(buffer.length)}\n`;
                    caption += `🔗 *Tautan hasil:* ${url}\n\n`;
                    caption += `💡 *Tips:* Gunakan fitur ini untuk berbagi media dengan lebih mudah tanpa perlu mengunggah ulang.`;

                    m.reply(caption);
                };

                break
                case 'menu': {
                    const totalCmd = () => {
                        var mytext = fs.readFileSync("./cmd.js").toString();
                        var numUpper = (mytext.match(/case '/g) || []).length;
                        return numUpper;
                    };
                    const limit = db.list().user[m.sender].limit

                    const Categories = [{
                            name: "⭐ Group Tools",
                            commands: ["dor", "demote", "event", "group", "hidetag", "promote", "security", "setwelcome", "setleft"]
                        },
                        {
                            name: "📥 Downloader Tools",
                            commands: ["tiktok", "instagram"]
                        },
                        {
                            name: "🎨 Maker Tools",
                            commands: ["brat", "sticker", "smeme", "qc"]
                        },
                        {
                            name: "🍀 Special Tools",
                            commands: ["ai", "script", "tourl"]
                        },
                        {
                            name: "🎧 Music",
                            commands: ["play"]
                        },
                        {
                            name: "👨‍💻 Owner Tools",
                            commands: ["banchat", "ping", "owner"]
                        }
                    ];

                    let currentNumber = 1;

                    const formattedCategories = Categories.map(category => {
                        const commandsWithNumbers = category.commands.map(command => `> \`\`\`${currentNumber++}. ${command}\`\`\``);
                        return `*${category.name} (${category.commands.length})*\n` + commandsWithNumbers.join("\n");
                    }).join("\n\n");

                    let cap = `ㅡㅈ ׁ _HOLLA USERS!_ `;
                    cap += `\n─ִ──۫┈ ⏝꯭︶ ִ ♡ ׄ ┈─۪─`;
                    cap += `\n👋 Hai! Saya Senna Network, asisten bot WhatsApp siap bantu dengan berbagai fitur keren! 🚀`;
                    cap += `\n─────────────────────────`;
                    cap += `\n  *User Information* : `;
                    cap += `\n> data from ${m.pushName} account..`;
                    cap += `\n ֺ ⤿ @${m.sender.split("@")[0]}`;
                    cap += `\n ۫ ִ—🎖️ Status : ${m.isOwner ? "Developer" : isPrems ? "Premium" : "Free"}`;
                    cap += `\n ۫ ִ—⚖️ Limit : ${m.isOwner ? "Unlimited" : limit}\n`;
                    cap += `\n  *Bot Information* : `;
                    cap += `\n> status data from bot.`;
                    cap += `\n ֺ ⤿ *${pkg.name}*`;
                    cap += `\n ۫ ִ—🔢 Version : v${pkg.version}`;
                    cap += `\n ۫ ִ—🕰️ Uptime : ${Func.toDate(process.uptime() * 1000)}`;
                    cap += `\n ۫ ִ—🔑 Prefix : [ ${m.prefix} ]`;
                    cap += `\n ۫ ִ—⚡ Total Commands : ${totalCmd()}`;
                    cap += `\n─────────────────────────`;
                    cap += `\n${formattedCategories}`;
                    cap += `\n─────────────────────────`;
                    cap += `\n🌟 *Support the Project!*`;
                    cap += `\n\`\`\`Your feedback and support mean the world to us!\`\`\``;
                    cap += `\n\`\`\`If you enjoy using this bot, consider giving a ⭐ to the project on GitHub.\`\`\``;
                    cap += `\n\`\`\`Visit: github.com/swndyy/Senna-WhatsApp\`\`\``;
                    cap += `\n─────────────────────────`;                    
                    let keyword = await sock.sendMessage(m.cht, {
                        video: {
                            url: "https://files.catbox.moe/pxdic5.mp4"
                        },
                        caption: cap,
                        gifPlayback: true,
                        contextInfo: {
                            mentionedJid: [m.sender]
                        }
                    }, {
                        quoted: m
                    })

                    await sock.sendMessage(m.cht, {
                        audio: {
                            url: "https://files.catbox.moe/e90xls.mp4"
                        },
                        mimetype: 'audio/mpeg',
                        ptt: true
                    }, {
                        quoted: keyword
                    })
                }
                break
                default:
            }
        }
        if (
            [">", "eval", "=>"].some((a) => m.command.toLowerCase().startsWith(a)) &&
            isSenna
        ) {
            let evalCmd = "";
            try {
                evalCmd = /await/i.test(m.text) ?
                    eval("(async() => { " + m.text + " })()") :
                    eval(m.text);
            } catch (e) {
                evalCmd = e;
            }
            new Promise((resolve, reject) => {
                    try {
                        resolve(evalCmd);
                    } catch (err) {
                        reject(err);
                    }
                })
                ?.then((res) => m.reply(util.format(res)))
                ?.catch((err) => m.reply(util.format(err)));
        }
        if (
            ["$", "exec"].some((a) => m.command.toLowerCase().startsWith(a)) &&
            isSenna
        ) {
            try {
                exec(m.text, async (err, stdout) => {
                    if (err) return m.reply(util.format(err));
                    if (stdout) return m.reply(util.format(stdout));
                });
            } catch (e) {
                await m.reply(util.format(e));
            }

        }
    } catch (error) {
        m.reply('Error: ' + error.message)
    }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    delete require.cache[file];
});