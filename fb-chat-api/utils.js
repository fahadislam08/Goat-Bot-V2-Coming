/* eslint-disable no-prototype-builtins */
"use strict";

let request = promisifyPromise(require("request").defaults({ jar: true, proxy: process.env.FB_PROXY }));
const stream = require("stream");
const log = require("npmlog");
const querystring = require("querystring");
const url = require("url");

// Updated to match your index.js UA version
const CHROME_VERSION = "147";

class CustomError extends Error {
	constructor(obj) {
		if (typeof obj === 'string')
			obj = { message: obj };
		if (typeof obj !== 'object' || obj === null)
			throw new TypeError('Object required');
		obj.message ? super(obj.message) : super();
		Object.assign(this, obj);
	}
}

function callbackToPromise(func) {
	return function (...args) {
		return new Promise((resolve, reject) => {
			func(...args, (err, data) => {
				if (err)
					reject(err);
				else
					resolve(data);
			});
		});
	};
}

function isHasCallback(func) {
	if (typeof func !== "function")
		return false;
	return func.toString().split("\n")[0].match(/(callback|cb)\s*\)/) !== null;
}

function promisifyPromise(promise) {
	const keys = Object.keys(promise);
	let promise_;
	if (
		typeof promise === "function"
		&& isHasCallback(promise)
	)
		promise_ = callbackToPromise(promise);
	else
		promise_ = promise;

	for (const key of keys) {
		if (!promise[key]?.toString)
			continue;

		if (
			typeof promise[key] === "function"
			&& isHasCallback(promise[key])
		) {
			promise_[key] = callbackToPromise(promise[key]);
		}
		else {
			promise_[key] = promise[key];
		}
	}

	return promise_;
}

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function tryPromise(tryFunc) {
	return new Promise((resolve, reject) => {
		try {
			resolve(tryFunc());
		} catch (error) {
			reject(error);
		}
	});
}

function setProxy(url) {
	if (typeof url == "undefined")
		return request = promisifyPromise(require("request").defaults({
			jar: true
		}));
	return request = promisifyPromise(require("request").defaults({
		jar: true,
		proxy: url
	}));
}

function getHeaders(url, options, ctx, customHeader) {
	const headers = {
		"Content-Type": "application/x-www-form-urlencoded",
		Referer: "https://www.facebook.com/",
		Host: url.replace("https://", "").split("/")[0],
		Origin: "https://www.facebook.com",
		"User-Agent": options.userAgent,
		Connection: "keep-alive",
		"sec-fetch-site": "same-origin",
		"sec-fetch-mode": "cors",
		"sec-fetch-dest": "empty",
        // Synchronized with Chrome 147 (2026)
		"sec-ch-ua": `"Google Chrome";v="${CHROME_VERSION}", "Chromium";v="${CHROME_VERSION}", "Not(A:Brand";v="8"`,
		"sec-ch-ua-mobile": "?0",
		"sec-ch-ua-platform": '"Windows"',
		"Accept": "*/*",
		"Accept-Language": "en-US,en;q=0.9",
		"Accept-Encoding": "gzip, deflate, br",
	};
	if (customHeader) {
		Object.assign(headers, customHeader);
	}
	if (ctx && ctx.region) {
		headers["X-MSGR-Region"] = ctx.region;
	}

	return headers;
}

function isReadableStream(obj) {
	return (
		obj instanceof stream.Stream &&
		(getType(obj._read) === "Function" ||
			getType(obj._read) === "AsyncFunction") &&
		getType(obj._readableState) === "Object"
	);
}

function get(url, jar, qs, options, ctx) {
	if (getType(qs) === "Object") {
		for (const prop in qs) {
			if (qs.hasOwnProperty(prop) && getType(qs[prop]) === "Object") {
				qs[prop] = JSON.stringify(qs[prop]);
			}
		}
	}
	const op = {
		headers: getHeaders(url, options, ctx),
		timeout: 60000,
		qs: qs,
		url: url,
		method: "GET",
		jar: jar,
		gzip: true
	};

	return request(op).then(function (res) {
		return Array.isArray(res) ? res[0] : res;
	});
}

function post(url, jar, form, options, ctx, customHeader) {
	const op = {
		headers: getHeaders(url, options, ctx, customHeader),
		timeout: 60000,
		url: url,
		method: "POST",
		form: form,
		jar: jar,
		gzip: true
	};

	return request(op).then(function (res) {
		return Array.isArray(res) ? res[0] : res;
	});
}

function postFormData(url, jar, form, qs, options, ctx) {
	const headers = getHeaders(url, options, ctx);
	headers["Content-Type"] = "multipart/form-data";
	const op = {
		headers: headers,
		timeout: 60000,
		url: url,
		method: "POST",
		formData: form,
		qs: qs,
		jar: jar,
		gzip: true
	};

	return request(op).then(function (res) {
		return Array.isArray(res) ? res[0] : res;
	});
}

function padZeros(val, len) {
	val = String(val);
	len = len || 2;
	while (val.length < len) val = "0" + val;
	return val;
}

function generateThreadingID(clientID) {
	const k = Date.now();
	const l = Math.floor(Math.random() * 4294967295);
	const m = clientID;
	return "<" + k + ":" + l + "-" + m + "@mail.projektitan.com>";
}

function binaryToDecimal(data) {
	let ret = "";
	while (data !== "0") {
		let end = 0;
		let fullName = "";
		let i = 0;
		for (; i < data.length; i++) {
			end = 2 * end + parseInt(data[i], 10);
			if (end >= 10) {
				fullName += "1";
				end -= 10;
			}
			else {
				fullName += "0";
			}
		}
		ret = end.toString() + ret;
		data = fullName.slice(fullName.indexOf("1"));
	}
	return ret;
}

function generateOfflineThreadingID() {
	const ret = Date.now();
	const value = Math.floor(Math.random() * 4294967295);
	const str = ("0000000000000000000000" + value.toString(2)).slice(-22);
	const msgs = ret.toString(2) + str;
	return binaryToDecimal(msgs);
}

let h;
const i = {};
const j = {
	_: "%", A: "%2", B: "000", C: "%7d", D: "%7b%22", E: "%2c%22", F: "%22%3a", G: "%2c%22ut%22%3a1", H: "%2c%22bls%22%3a", I: "%2c%22n%22%3a%22%", J: "%22%3a%7b%22i%22%3a0%7d", K: "%2c%22pt%22%3a0%2c%22vis%22%3a", L: "%2c%22ch%22%3a%7b%22h%22%3a%22", M: "%7b%22v%22%3a2%2c%22time%22%3a1", N: ".channel%22%2c%22sub%22%3a%5b", O: "%2c%22sb%22%3a1%2c%22t%22%3a%5b", P: "%2c%22ud%22%3a100%2c%22lc%22%3a0", Q: "%5d%2c%22f%22%3anull%2c%22uct%22%3a", R: ".channel%22%2c%22sub%22%3a%5b1%5d", S: "%22%2c%22m%22%3a0%7d%2c%7b%22i%22%3a", T: "%2c%22blc%22%3a1%2c%22snd%22%3a1%2c%22ct%22%3a", U: "%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a", V: "%2c%22blc%22%3a0%2c%22snd%22%3a0%2c%22ct%22%3a", W: "%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a", X: "%2c%22ri%22%3a0%7d%2c%22state%22%3a%7b%22p%22%3a0%2c%22ut%22%3a1", Y: "%2c%22pt%22%3a0%2c%22vis%22%3a1%2c%22bls%22%3a0%2c%22blc%22%3a0%2c%22snd%22%3a1%2c%22ct%22%3a", Z: "%2c%22sb%22%3a1%2c%22t%22%3a%5b%5d%2c%22f%22%3anull%2c%22uct%22%3a0%2c%22s%22%3a0%2c%22blo%22%3a0%7d%2c%22bl%22%3a%7b%22ac%22%3a"
};
(function () {
	const l = [];
	for (const m in j) {
		i[j[m]] = m;
		l.push(j[m]);
	}
	l.reverse();
	h = new RegExp(l.join("|"), "g");
})();

function presenceEncode(str) {
	return encodeURIComponent(str)
		.replace(/([_A-Z])|%../g, function (m, n) {
			return n ? "%" + n.charCodeAt(0).toString(16) : m;
		})
		.toLowerCase()
		.replace(h, function (m) {
			return i[m];
		});
}

function generatePresence(userID) {
	const time = Date.now();
	return (
		"E" +
		presenceEncode(
			JSON.stringify({
				v: 3,
				time: parseInt(time / 1000, 10),
				user: userID,
				state: {
					ut: 0,
					t2: [],
					lm2: null,
					uct2: time,
					tr: null,
					tw: Math.floor(Math.random() * 4294967295) + 1,
					at: time
				},
				ch: {
					["p_" + userID]: 0
				}
			})
		)
	);
}

function generateAccessiblityCookie() {
	const time = Date.now();
	return encodeURIComponent(
		JSON.stringify({
			sr: 0, "sr-ts": time, jk: 0, "jk-ts": time, kb: 0, "kb-ts": time, hcm: 0, "hcm-ts": time
		})
	);
}

function getGUID() {
	let sectionLength = Date.now();
	const id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = Math.floor((sectionLength + Math.random() * 16) % 16);
		sectionLength = Math.floor(sectionLength / 16);
		const _guid = (c == "x" ? r : (r & 7) | 8).toString(16);
		return _guid;
	});
	return id;
}

function getExtension(original_extension, fullFileName = "") {
	if (original_extension) return original_extension;
	const extension = fullFileName.split(".").pop();
	return extension === fullFileName ? "" : extension;
}

function _formatAttachment(attachment1, attachment2) {
	const fullFileName = attachment1.filename;
	const fileSize = Number(attachment1.fileSize || 0);
	const durationVideo = attachment1.genericMetadata ? Number(attachment1.genericMetadata.videoLength) : undefined;
	const durationAudio = attachment1.genericMetadata ? Number(attachment1.genericMetadata.duration) : undefined;
	const mimeType = attachment1.mimeType;

	attachment2 = attachment2 || { id: "", image_data: {} };
	attachment1 = attachment1.mercury || attachment1;
	let blob = attachment1.blob_attachment || attachment1.sticker_attachment;
	let type = blob && blob.__typename ? blob.__typename : attachment1.attach_type;
    
	if (!type && attachment1.sticker_attachment) {
		type = "StickerAttachment";
		blob = attachment1.sticker_attachment;
	} else if (!type && attachment1.extensible_attachment) {
		if (attachment1.extensible_attachment.story_attachment && attachment1.extensible_attachment.story_attachment.target && attachment1.extensible_attachment.story_attachment.target.__typename === "MessageLocation") {
			type = "MessageLocation";
		} else {
			type = "ExtensibleAttachment";
		}
		blob = attachment1.extensible_attachment;
	}

	switch (type) {
		case "sticker":
		case "Sticker":
			return {
				type: "sticker", ID: (attachment1.metadata?.stickerID || blob?.id).toString(), url: attachment1.url || blob?.url,
				packID: (attachment1.metadata?.packID || blob?.pack?.id || "").toString(),
				width: attachment1.metadata?.width || blob?.width, height: attachment1.metadata?.height || blob?.height,
				caption: attachment2.caption || blob?.label
			};
		case "file":
		case "MessageFile":
			return {
				type: "file", ID: (attachment2.id || blob?.message_file_fbid).toString(), fullFileName: fullFileName, filename: attachment1.name || blob?.filename, fileSize: fileSize, mimeType: mimeType || blob?.mimetype, url: attachment1.url || blob?.url
			};
		case "photo":
		case "MessageImage":
			return {
				type: "photo", ID: (attachment1.metadata?.fbid || blob?.legacy_attachment_id).toString(), filename: attachment1.fileName || blob?.filename, fullFileName: fullFileName, fileSize: fileSize, url: attachment1.metadata?.url || blob?.large_preview?.uri
			};
		case "video":
		case "MessageVideo":
			return {
				type: "video", ID: (attachment1.metadata?.fbid || blob?.legacy_attachment_id).toString(), filename: attachment1.name || blob?.filename, duration: durationVideo, url: attachment1.url || blob?.playable_url
			};
		case "audio":
		case "MessageAudio":
			return {
				type: "audio", ID: blob?.url_shimhash, filename: blob?.filename, duration: durationAudio, url: blob?.playable_url
			};
		case "share":
		case "ExtensibleAttachment":
			return {
				type: "share", ID: (attachment1.share?.share_id || blob?.legacy_attachment_id || "").toString(), url: attachment2.href || blob?.story_attachment?.url, title: attachment1.share?.title || blob?.story_attachment?.title_with_entities?.text
			};
		default:
			return { type: "error", attachment1: attachment1, attachment2: attachment2 };
	}
}

function formatAttachment(attachments, attachmentIds, attachmentMap, shareMap) {
	attachmentMap = shareMap || attachmentMap;
	return attachments ? attachments.map((val, i) => (!attachmentMap || !attachmentIds || !attachmentMap[attachmentIds[i]]) ? _formatAttachment(val) : _formatAttachment(val, attachmentMap[attachmentIds[i]])) : [];
}

function formatDeltaMessage(m) {
	const md = m.delta.messageMetadata;
	const mdata = m.delta.data === undefined ? [] : m.delta.data.prng === undefined ? [] : JSON.parse(m.delta.data.prng);
	const mentions = {};
	mdata.forEach(u => { mentions[u.i] = m.delta.body.substring(u.o, u.o + u.l); });
    
	return {
		type: "message", senderID: formatID(md.actorFbId.toString()), body: m.delta.body || "", threadID: formatID((md.threadKey.threadFbId || md.threadKey.otherUserFbId).toString()), messageID: md.messageId, attachments: (m.delta.attachments || []).map(v => _formatAttachment(v)), mentions: mentions, timestamp: md.timestamp, isGroup: !!md.threadKey.threadFbId
	};
}

function formatID(id) {
	return id ? id.replace(/(fb)?id[:.]/, "") : id;
}

function formatMessage(m) {
	const originalMessage = m.message ? m.message : m;
	const obj = {
		type: "message", senderName: originalMessage.sender_name, senderID: formatID(originalMessage.sender_fbid.toString()), body: originalMessage.body || "", threadID: formatID((originalMessage.thread_fbid || originalMessage.other_user_fbid).toString()), messageID: originalMessage.mid ? originalMessage.mid.toString() : originalMessage.message_id, attachments: formatAttachment(originalMessage.attachments, originalMessage.attachmentIds, originalMessage.attachment_map, originalMessage.share_map), timestamp: originalMessage.timestamp
	};
	if (m.type === "pages_messaging") obj.pageID = m.realtime_viewer_fbid.toString();
	obj.isGroup = (originalMessage.group_thread_info) ? true : false;
	return obj;
}

function getAdminTextMessageType(type) {
	switch (type) {
		case "change_thread_theme": return "log:thread-color";
		case "change_thread_icon":
		case "change_thread_quick_reaction": return "log:thread-icon";
		case "change_thread_nickname": return "log:user-nickname";
		case "change_thread_admins": return "log:thread-admins";
		case "group_poll": return "log:thread-poll";
		case "messenger_call_log": return "log:thread-call";
		default: return type;
	}
}

function formatTyp(event) {
	return {
		isTyping: !!event.st, from: event.from.toString(), threadID: formatID((event.to || event.thread_fbid || event.from).toString()), type: "typ"
	};
}

function getFrom(str, startToken, endToken) {
	const start = str.indexOf(startToken) + startToken.length;
	if (start < startToken.length) return "";
	const lastHalf = str.substring(start);
	const end = lastHalf.indexOf(endToken);
	if (end === -1) throw new Error("Could not find endTime `" + endToken + "` in string.");
	return lastHalf.substring(0, end);
}

function makeParsable(html) {
	const withoutForLoop = html.replace(/for\s*\(\s*;\s*;\s*\)\s*;\s*/, "");
	const maybeMultipleObjects = withoutForLoop.split(/\}\r\n *\{/);
	if (maybeMultipleObjects.length === 1) return maybeMultipleObjects[0];
	return "[" + maybeMultipleObjects.join("},{") + "]";
}

function arrToForm(form) {
	return form.reduce((acc, val) => { acc[val.name] = val.val; return acc; }, {});
}

function makeDefaults(html, userID, ctx) {
	let reqCounter = 1;
	const fb_dtsg = getFrom(html, 'name="fb_dtsg" value="', '"');
	let ttstamp = "2";
	for (let i = 0; i < fb_dtsg.length; i++) { ttstamp += fb_dtsg.charCodeAt(i); }
	const revision = getFrom(html, 'revision":', ",");

	function mergeWithDefaults(obj) {
		const newObj = {
			__user: userID, __req: (reqCounter++).toString(36), __rev: revision, __a: 1, fb_dtsg: ctx.fb_dtsg ? ctx.fb_dtsg : fb_dtsg, jazoest: ctx.ttstamp ? ctx.ttstamp : ttstamp
		};
		if (!obj) return newObj;
		for (const prop in obj) { if (obj.hasOwnProperty(prop)) { if (!newObj[prop]) newObj[prop] = obj[prop]; } }
		return newObj;
	}

	return {
		get: (url, jar, qs, ctxx) => get(url, jar, mergeWithDefaults(qs), ctx.globalOptions, ctxx || ctx),
		post: (url, jar, form, ctxx) => post(url, jar, mergeWithDefaults(form), ctx.globalOptions, ctxx || ctx),
		postFormData: (url, jar, form, qs, ctxx) => postFormData(url, jar, mergeWithDefaults(form), mergeWithDefaults(qs), ctx.globalOptions, ctxx || ctx)
	};
}

function parseAndCheckLogin(ctx, defaultFuncs, retryCount) {
	if (retryCount == undefined) retryCount = 0;
	return function (data) {
		return tryPromise(function () {
			if (data.statusCode >= 500 && data.statusCode < 600 && retryCount < 5) {
				retryCount++;
				return delay(Math.floor(Math.random() * 5000)).then(() => defaultFuncs.post(data.request.uri.href, ctx.jar, data.request.formData)).then(parseAndCheckLogin(ctx, defaultFuncs, retryCount));
			}
			if (data.statusCode !== 200) throw new CustomError({ message: "Status code: " + data.statusCode, statusCode: data.statusCode });

			let res = null;
			try { res = JSON.parse(makeParsable(data.body)); } catch (e) { throw new CustomError({ message: "JSON parse error", detail: e, res: data.body }); }

			if (res.redirect && data.request.method === "GET") return defaultFuncs.get(res.redirect, ctx.jar).then(parseAndCheckLogin(ctx, defaultFuncs));

            // Token Mutation Update for 2026
			if (res.jsmods && Array.isArray(res.jsmods.require)) {
				const arr = res.jsmods.require;
				for (const i in arr) {
					if (arr[i][0] === "DTSG" && arr[i][1] === "setToken") {
						ctx.fb_dtsg = arr[i][3][0];
						ctx.ttstamp = "2";
						for (let j = 0; j < ctx.fb_dtsg.length; j++) { ctx.ttstamp += ctx.fb_dtsg.charCodeAt(j); }
					}
				}
			}

			if (res.error === 1357001) throw new CustomError({ error: "Not logged in.", res: res });
			return res;
		});
	};
}

function saveCookies(jar) {
	return function (res) {
		const cookies = res.headers["set-cookie"] || [];
		cookies.forEach(c => {
			if (c.indexOf(".facebook.com") > -1) jar.setCookie(c, "https://www.facebook.com");
			jar.setCookie(c.replace(/domain=\.facebook\.com/, "domain=.messenger.com"), "https://www.messenger.com");
		});
		return res;
	};
}

function formatCookie(arr, url) {
	return arr[0] + "=" + arr[1] + "; Path=" + arr[3] + "; Domain=" + url + ".com";
}

function getAppState(jar) {
	return jar.getCookies("https://www.facebook.com").concat(jar.getCookies("https://facebook.com")).concat(jar.getCookies("https://www.messenger.com"));
}

function getType(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

module.exports = {
	CustomError, isReadableStream, get, post, postFormData, generateThreadingID, generateOfflineThreadingID, getGUID, getFrom, makeParsable, arrToForm, getSignatureID, getJar: request.jar, makeDefaults, parseAndCheckLogin, saveCookies, getType, _formatAttachment, formatID, formatMessage, formatDeltaMessage, formatTyp, formatCookie, generatePresence, generateAccessiblityCookie, getAppState, getAdminTextMessageType, setProxy
};
