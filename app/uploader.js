const fetch = require("node-fetch");
const crypto = require("crypto");
const FormData = require("form-data");
const { fromBuffer } = require("file-type");
const axios = require("axios");
const fakeUserAgent = require("fake-useragent");
const cheerio = require("cheerio");
const uloadUrlRegexStr = /url: "([^"]+)"/;
const randomBytes = crypto.randomBytes(5).toString("hex");

const createFormData = (content, fieldName, ext) => {
  const { mime } = fromBuffer(content) || {};
  const formData = new FormData();
  formData.append(fieldName, content, `${randomBytes}.${ext}`);
  return formData;
};

module.exports = {
  tmpfiles: async (content) => {
    try {
      const { ext, mime } = (await fromBuffer(content)) || {};
      const formData = await createFormData(content, "file", ext);
      const response = await axios.post(
        "https://tmpfiles.org/api/v1/upload",
        formData,
        {
          headers: {
            "User-Agent": fakeUserAgent(),
          },
        },
      );
      const result = response.data;
      const match = /https?:\/\/tmpfiles.org\/(.*)/.exec(result.data.url);
      return `https://tmpfiles.org/dl/${match[1]}`;
    } catch (error) {
      throw false;
    }
  },
  Uguu: async (content) => {
    try {
      const { ext, mime } = (await fromBuffer(content)) || {};
      const formData = createFormData(content, "files[]", ext);
      const response = await axios.post(
        "https://uguu.se/upload.php",
        formData,
        {
          headers: {
            "User-Agent": fakeUserAgent(),
          },
        },
      );
      const files = response.data;
      return files.files[0].url;
    } catch (error) {
      throw false;
    }
  },
  catbox: async (content) => {
    try {
      const { ext, mime } = (await fromBuffer(content)) || {};
      const formData = createFormData(content, "fileToUpload", ext);
      formData.append("reqtype", "fileupload");
      const response = await axios.post(
        "https://catbox.moe/user/api.php",
        formData,
        {
          headers: {
            "User-Agent": fakeUserAgent(),
          },
        },
      );
      return await response.data;
    } catch (error) {
      throw error;
    }
  },
  media: async (buffer) => {
    try {
      const { ext, mime } = (await fromBuffer(buffer)) || {};
      const formData = await createFormData(buffer, "files[]", ext),
        response = await axios.post(
          "https://media-upload.net/php/ajax_upload_file.php",
          formData,
          {
            headers: {
              "User-Agent": fakeUserAgent(),
            },
          },
        );
      const files = response.data;
      return files.files[0]?.fileUrl;
    } catch (error) {
      throw error;
    }
  },
  caliph: async (buffer) => {
    try {
      const { ext, mime } = (await fromBuffer(buffer)) || {};
      const formData = new FormData();
      formData.append("file", buffer, {
        filename: Date.now() + "." + ext,
      });
      let response = await axios.request(
        "https://filezone-api.caliph.dev/upload",
        {
          method: "POST",
          data: formData.getBuffer(),
          headers: {
            ...formData.getHeaders(),
          },
        },
      );

      return response.data.result.url_file;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error(String(error));
    }
  },
  picu: async (buffer) => {
    try {
      const response = await fetch("https://put.icu/upload/", {
        method: "PUT",
        body: buffer,
        headers: {
          "User-Agent": fakeUserAgent(),
          Accept: "application/json",
        },
      });
      const files = await response.json();
      return files.direct_url;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error(String(error));
    }
  },
};

let fs = require("fs");
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  delete require.cache[file];
  require(file);
});
