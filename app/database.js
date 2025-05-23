const fs = require("node:fs");
const path = require("node:path");

class Database {
  #data;
  constructor(filename) {
    this.databaseFile = path.join(".", filename);
    this.#data = {};
  }
  default = () => {
    return {
      user: {},
      group: {},
      changelog: {},
      settings: {
        self: false,
        online: true,
        anticall: false,
        blockcmd: [],
        max_upload: "50MB",
        resetlimit: "02:00",
      },
    };
  };
  init = async () => {
    const data = await this.read();
    this.#data = { ...this.#data, ...data };
    return this.#data;
  };
  read = async () => {
    if (fs.existsSync(this.databaseFile)) {
      const data = fs.readFileSync(this.databaseFile);
      return JSON.parse(data);
    } else {
      return this.default();
    }
  };

  save = async () => {
    const jsonData = JSON.stringify(this.#data, null, 2);
    fs.writeFileSync(this.databaseFile, jsonData);
  };
  add = async (type, id, newData) => {
    if (!this.#data[type]) return `- Tipe data ${type} tidak ditemukan!`;
    if (!this.#data[type][id]) {
      this.#data[type][id] = newData;
    }
    await this.save();
    return this.#data[type][id];
  };
  delete = async (type, id) => {
    if (this.#data[type] && this.#data[type][id]) {
      delete this.#data[type][id];
      await this.save();
      return `- ${type} dengan ID ${id} telah dihapus.`;
    } else {
      return `- ${type} dengan ID ${id} tidak ditemukan!`;
    }
  };
  get = (type, id) => {
    if (this.#data[type] && this.#data[type][id]) {
      return this.#data[type][id];
    } else {
      return `- ${type} dengan ID ${id} tidak ditemukan!`;
    }
  };
  main = async (m) => {
    await this.read();
    if (m.isGroup) {
      await this.add("group", m.cht, {
        announcement: {
          senna: 0,
          arip: 0,
          abay: 0,
        },
        message: 0,
        sewa: {
          status: false,
          expired: 0,
        },
        event: {
          antilinkgc: false,
          welcome: false,
          left: false,
          sWlcm: "Halo @user 👋\nSelamat datang di @group 🎉\nSemoga kamu betah dan menikmati suasana di sini ya! 😊✨",
          sLeft: "Selamat tinggal, @user 👋\nTerima kasih sudah menjadi bagian dari @group. Semoga sukses di mana pun kamu berada! 🍀✨",
        },
        status: {
          banchat: true,
          mute: false,
        },
      });
    }
    await this.add("user", m.sender, {
      name: "Not Registered",
      age: 0,
      limit: 20,
      register: false,
      rpg: {
          money: 0,
          exp: 0,
          level: 1,
          bank: 0,
          coin: 0,  
      },
      premium: {
        status: false,
        expired: 0,
      },
      banned: {
        status: false,
        expired: 0,
      },
    });
    await this.save();
    return this.list();
  };
  list = () => {
    return this.#data;
  };
}

module.exports = Database;
