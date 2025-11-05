"use strict";
/* eslint object-curly-spacing: ["error","always"],
         max-len: ["warn", { "code": 100, "ignoreUrls": true }],
         require-jsdoc: "off" */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinLeagueByCode = exports.createLeague = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
(0, v2_1.setGlobalOptions)({ region: "europe-west1" });
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Simple invite code generator (8 chars)
function makeInviteCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 8; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}
exports.createLeague = (0, https_1.onCall)(async (req) => {
    var _a, _b;
    const uid = (_a = req.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in.");
    }
    const { name, sport } = ((_b = req.data) !== null && _b !== void 0 ? _b : {});
    if (!name || !sport) {
        throw new https_1.HttpsError("invalid-argument", "Missing name or sport.");
    }
    const leagueRef = db.collection("leagues").doc();
    const inviteCode = makeInviteCode();
    const now = admin.firestore.FieldValue.serverTimestamp();
    await db.runTransaction(async (tx) => {
        tx.set(leagueRef, {
            name,
            sport,
            visibility: "private",
            ownerId: uid,
            inviteCode,
            memberCount: 1,
            createdAt: now,
            updatedAt: now,
        });
        tx.set(leagueRef.collection("members").doc(uid), {
            role: "owner",
            joinedAt: now,
        });
    });
    // Optional: keep leagueIds on user for easy "My Leagues"
    await db
        .collection("users")
        .doc(uid)
        .set({ leagueIds: admin.firestore.FieldValue.arrayUnion(leagueRef.id) }, { merge: true });
    return { leagueId: leagueRef.id, inviteCode };
});
exports.joinLeagueByCode = (0, https_1.onCall)(async (req) => {
    var _a, _b;
    const uid = (_a = req.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "You must be signed in.");
    }
    const { inviteCode } = ((_b = req.data) !== null && _b !== void 0 ? _b : {});
    if (!inviteCode) {
        throw new https_1.HttpsError("invalid-argument", "Missing invite code.");
    }
    const snap = await db
        .collection("leagues")
        .where("inviteCode", "==", String(inviteCode).toUpperCase())
        .limit(1)
        .get();
    if (snap.empty) {
        throw new https_1.HttpsError("not-found", "No league found with that code.");
    }
    const leagueDoc = snap.docs[0];
    const leagueRef = leagueDoc.ref;
    const memberRef = leagueRef.collection("members").doc(uid);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const already = await memberRef.get();
    if (already.exists) {
        return { leagueId: leagueRef.id }; // idempotent
    }
    await db.runTransaction(async (tx) => {
        tx.set(memberRef, { role: "player", joinedAt: now });
        tx.update(leagueRef, {
            memberCount: admin.firestore.FieldValue.increment(1),
            updatedAt: now,
        });
    });
    await db
        .collection("users")
        .doc(uid)
        .set({ leagueIds: admin.firestore.FieldValue.arrayUnion(leagueRef.id) }, { merge: true });
    return { leagueId: leagueRef.id };
});
//# sourceMappingURL=index.js.map