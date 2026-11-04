const KINDRED_WEB_ORIGINS = new Set([
  "https://findkindredpeople.com",
  "https://www.findkindredpeople.com",
  "https://findkindredpeople.github.io"
]);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin && !KINDRED_WEB_ORIGINS.has(origin)) {
      return json({ ok: false, error: "Origin not allowed" }, 403);
    }
    let response;
    if (request.method === "OPTIONS") {
      const method = request.headers.get("Access-Control-Request-Method");
      const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") || "")
        .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
      if (!origin || !["GET", "POST"].includes(method) ||
          requestedHeaders.some(value => !["authorization", "content-type"].includes(value))) {
        response = json({ ok: false, error: "Invalid preflight request" }, 400);
      } else {
        response = new Response(null, { status: 204, headers: {
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400"
        } });
      }
    } else {
      response = await handlePushRequest(request, env);
    }
    const headers = new Headers(response.headers);
    headers.set("Vary", "Origin");
    if (origin) headers.set("Access-Control-Allow-Origin", origin);
    return new Response(response.body, { status: response.status, headers });
  },
  async scheduled(controller, env, context) {
    context.waitUntil(env.KINDRED_PUSH_QUEUE ? env.KINDRED_PUSH_QUEUE.send({kind:"discovery_scan",pageToken:""},{contentType:"json"}) : sendDiscoveryAlerts(env));
  },
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await processPushQueueMessage(message, env);
        message.ack();
      } catch (error) {
        const reason = String(error?.message || "Delivery deferred").split(":")[0].slice(0, 80);
        console.error("Kindred push delivery deferred", { attempts: message.attempts, reason });
        message.retry({ delaySeconds: Math.min(3600, 120 * Math.pow(2, Math.min(5, (message.attempts || 1) - 1))) });
      }
    }
  }
};

async function handlePushRequest(request, env) {
    try {
      if (request.method === "GET") {
        return json({
          ok: true,
          service: "Kindred Push",
          version: "1.0.28-community-1",
          queueConfigured: Boolean(env.KINDRED_PUSH_QUEUE),
          status: "running"
        });
      }

      if (request.method !== "POST") {
        return json({ ok: false, error: "Method not allowed" }, 405);
      }

      if (!env.FIREBASE_SERVICE_ACCOUNT) {
        return json({
          ok: false,
          error: "FIREBASE_SERVICE_ACCOUNT secret is missing"
        }, 500);
      }

      let serviceAccount;

      try {
        serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
      } catch {
        return json({
          ok: false,
          error: "Invalid FIREBASE_SERVICE_ACCOUNT JSON"
        }, 500);
      }

      const authHeader = request.headers.get("Authorization") || "";

      if (!authHeader.startsWith("Bearer ")) {
        return json({
          ok: false,
          error: "Missing Authorization header"
        }, 401);
      }

      const firebaseIdToken = authHeader.substring(7).trim();

      const verifiedUser = await verifyFirebaseIdToken(
        firebaseIdToken,
        serviceAccount.project_id
      );

      if (!verifiedUser?.uid) {
        return json({
          ok: false,
          error: "Invalid Firebase ID token"
        }, 401);
      }

      let body;

      try {
        body = await request.json();
      } catch {
        return json({
          ok: false,
          error: "Invalid JSON body"
        }, 400);
      }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ ok: false, error: "JSON object is required" }, 400);
      }
      const type = body.type === undefined ? "chat_message" : body.type;
      if (type === "register_device" || type === "unregister_device") {
        return await managePushDevice(body, verifiedUser.uid, serviceAccount);
      }
      const requiredIds = {
        test_notification: ["messageId"],
        forum_reply: ["postId", "replyId"],
        meeting_poll: ["pollId"],
        meeting_vote: ["pollId"],
        chat_message: ["connectionId", "messageId"],
        mark_read: ["connectionId", "messageId"],
        group_mark_read: ["groupId", "messageId"],
        group_invite: ["groupId", "recipientId"],
        group_message: ["groupId", "messageId"],
        meetup_interest: ["meetupId"],
        meetup_message: ["meetupId", "messageId"],
        meetup_cancelled: ["meetupId"],
        friend_request: ["connectionId"],
        friend_invite: ["connectionId"],
        connection_request: ["connectionId"],
        game_invite: ["roomId"]
      };
      if (typeof type !== "string" || !Object.hasOwn(requiredIds, type)) {
        return json({ ok: false, error: "Unknown notification type" }, 400);
      }
      if (requiredIds[type].some(key => typeof body[key] !== "string" ||
          !/^[A-Za-z0-9_-]{1,256}$/.test(body[key]))) {
        return json({ ok: false, error: "Invalid document reference" }, 400);
      }

      if (type === "test_notification") {
        const token = await getGoogleAccessToken(serviceAccount);
        const result = await sendPushToUsers(serviceAccount.project_id, token, [verifiedUser.uid],
          { title:"Kindred", body:"Your Kindred notifications are working." },
          { type, recipientId:verifiedUser.uid, eventId:"test_"+body.messageId });
        return json({ ok:true, ...result });
      }
      if (["forum_reply","meeting_poll","meeting_vote"].includes(type) && !env.KINDRED_PUSH_QUEUE) {
        const token = await getGoogleAccessToken(serviceAccount);
        const plan = await makePushPlan({...body,type}, verifiedUser.uid, serviceAccount, token);
        if (plan instanceof Response) return plan;
        const result = await sendPushToUsers(serviceAccount.project_id, token, plan.recipients,
          plan.notification, plan.data);
        return json({ok:true,...result});
      }
      if (env.KINDRED_PUSH_QUEUE && !["mark_read", "group_mark_read"].includes(type)) {
        return await enqueuePushEvent({ ...body, type }, verifiedUser.uid, serviceAccount, env);
      }

      if (["friend_request", "friend_invite", "connection_request", "game_invite"].includes(type)) {
        return await handleInvitationPush(body, verifiedUser.uid, serviceAccount);
      }

      // =========================================================
      // READ RECEIPTS (service account writes; Firestore rules stay unchanged)
      // =========================================================

      if (type === "mark_read") {
        const connectionId = String(body.connectionId || "").trim();
        const messageId = String(body.messageId || "").trim();
        if (!connectionId || !messageId) {
          return json({ ok: false, error: "connectionId and messageId are required" }, 400);
        }

        const accessToken = await getGoogleAccessToken(serviceAccount);
        const connectionDocument = await getFirestoreDocument(
          serviceAccount.project_id, `connections/${connectionId}`, accessToken
        );
        if (!connectionDocument) return json({ ok: false, error: "Connection not found" }, 404);

        const connectionFields = connectionDocument.fields || {};
        const participants = getArrayStrings(connectionFields.participants);
        if (!participants.includes(verifiedUser.uid) || getString(connectionFields.status) !== "accepted") {
          return json({ ok: false, error: "Not an accepted connection participant" }, 403);
        }

        const messagePath = `connections/${connectionId}/messages/${messageId}`;
        const messageDocument = await getFirestoreDocument(serviceAccount.project_id, messagePath, accessToken);
        if (!messageDocument) return json({ ok: false, error: "Message not found" }, 404);
        if (getString((messageDocument.fields || {}).senderId) === verifiedUser.uid) {
          return json({ ok: false, error: "Sender cannot mark own message as read" }, 403);
        }

        await appendStringToArrayField(
          serviceAccount.project_id, messagePath, "readBy", verifiedUser.uid, accessToken
        );
        return json({ ok: true, type: "mark_read", marked: true });
      }

      if (type === "group_mark_read") {
        const groupId = String(body.groupId || "").trim();
        const messageId = String(body.messageId || "").trim();
        if (!groupId || !messageId) {
          return json({ ok: false, error: "groupId and messageId are required" }, 400);
        }

        const accessToken = await getGoogleAccessToken(serviceAccount);
        const groupDocument = await getFirestoreDocument(
          serviceAccount.project_id, `groups/${groupId}`, accessToken
        );
        if (!groupDocument) return json({ ok: false, error: "Group not found" }, 404);
        if (!getArrayStrings((groupDocument.fields || {}).memberIds).includes(verifiedUser.uid)) {
          return json({ ok: false, error: "Not a group member" }, 403);
        }

        const messagePath = `groups/${groupId}/messages/${messageId}`;
        const messageDocument = await getFirestoreDocument(serviceAccount.project_id, messagePath, accessToken);
        if (!messageDocument) return json({ ok: false, error: "Message not found" }, 404);
        if (getString((messageDocument.fields || {}).senderId) === verifiedUser.uid) {
          return json({ ok: false, error: "Sender cannot mark own message as read" }, 403);
        }

        await appendStringToArrayField(
          serviceAccount.project_id, messagePath, "readBy", verifiedUser.uid, accessToken
        );
        return json({ ok: true, type: "group_mark_read", marked: true });
      }

      // =========================================================
      // GROUP INVITATION PUSH
      // =========================================================

      if (type === "group_invite") {
        const groupId = String(body.groupId || "").trim();
        const recipientId = String(body.recipientId || "").trim();

        if (!groupId || !recipientId) {
          return json({
            ok: false,
            error: "groupId and recipientId are required"
          }, 400);
        }

        if (recipientId === verifiedUser.uid) {
          return json({
            ok: false,
            error: "You cannot invite yourself"
          }, 400);
        }

        const accessToken = await getGoogleAccessToken(serviceAccount);

        const groupDocument = await getFirestoreDocument(
          serviceAccount.project_id,
          `groups/${groupId}`,
          accessToken
        );

        if (!groupDocument) {
          return json({
            ok: false,
            error: "Group not found"
          }, 404);
        }

        const groupFields = groupDocument.fields || {};

        const ownerId = getString(groupFields.ownerId);
        const groupName =
          getString(groupFields.name) ||
          "Kindred group";

        const memberIds = getArrayStrings(groupFields.memberIds);
        const invitedIds = getArrayStrings(groupFields.invitedIds);

        if (ownerId !== verifiedUser.uid) {
          return json({
            ok: false,
            error: "Only group owner can send invitations"
          }, 403);
        }

        if (memberIds.includes(recipientId)) {
          return json({
            ok: true,
            sent: false,
            type: "group_invite",
            reason: "Recipient is already a group member"
          });
        }

        if (!invitedIds.includes(recipientId)) {
          return json({
            ok: false,
            error: "Invitation is not stored in Firestore"
          }, 403);
        }

        if (await usersAreBlocked(serviceAccount.project_id, verifiedUser.uid, recipientId, accessToken)) {
          return json({ ok: true, sent: false, type, reason: "Invitation notifications unavailable" });
        }

        const recipientDocument = await getFirestoreDocument(
          serviceAccount.project_id,
          `users/${recipientId}`,
          accessToken
        );

        const recipientTokens = getUserTokens(recipientDocument?.fields);

        if (recipientTokens.length === 0) {
          return json({
            ok: true,
            sent: false,
            type: "group_invite",
            reason: "Recipient has no FCM token"
          });
        }

        const fcmResults = await Promise.all(recipientTokens.map(token =>
          sendFcmMessage(
            serviceAccount.project_id,
            accessToken,
            token,
            {
              title: "Kindred",
              body: `💜 Вас пригласили в группу «${groupName}»`
            },
            {
              type: "group_invite",
              groupId: groupId,
              recipientId,
              senderId: verifiedUser.uid
            }
          )
        ));
        const sentCount = fcmResults.filter(result => result.ok).length;

        if (sentCount === 0) {
          return json({
            ok: false,
            type: "group_invite",
            error: "FCM send failed",
            details: fcmResults.map(result => result.body)
          }, 502);
        }

        return json({
          ok: true,
          sent: true,
          type: "group_invite",
          sentCount,
          tokenCount: recipientTokens.length
        });
      }

      // =========================================================
      // GROUP MESSAGE PUSH
      // =========================================================

      if (type === "group_message") {
        const groupId = String(body.groupId || "").trim();
        const messageId = String(body.messageId || "").trim();

        if (!groupId || !messageId) {
          return json({
            ok: false,
            error: "groupId and messageId are required"
          }, 400);
        }

        const accessToken = await getGoogleAccessToken(serviceAccount);

        const groupDocument = await getFirestoreDocument(
          serviceAccount.project_id,
          `groups/${groupId}`,
          accessToken
        );

        if (!groupDocument) {
          return json({ ok: false, error: "Group not found" }, 404);
        }

        const groupFields = groupDocument.fields || {};
        const groupName = getString(groupFields.name) || "Kindred group";
        const memberIds = getArrayStrings(groupFields.memberIds);

        if (!memberIds.includes(verifiedUser.uid)) {
          return json({
            ok: false,
            error: "Sender is not a group member"
          }, 403);
        }

        const messageDocument = await getFirestoreDocument(
          serviceAccount.project_id,
          `groups/${groupId}/messages/${messageId}`,
          accessToken
        );

        if (!messageDocument) {
          return json({ ok: false, error: "Message not found" }, 404);
        }

        const messageFields = messageDocument.fields || {};
        const senderId = getString(messageFields.senderId);
        const senderName =
          getString(messageFields.senderName) || "Kindred member";
        let messageText = getString(messageFields.text) || "Новое сообщение";

        if (senderId !== verifiedUser.uid) {
          return json({
            ok: false,
            error: "Message sender mismatch"
          }, 403);
        }

        if (messageText.length > 160) {
          messageText = messageText.substring(0, 157) + "...";
        }

        const recipientIds = [...new Set(memberIds)].filter(
          uid => uid && uid !== verifiedUser.uid
        );

        if (recipientIds.length === 0) {
          return json({
            ok: true,
            sent: false,
            type: "group_message",
            reason: "No other group members"
          });
        }

        const recipientDocs = await Promise.all(
          recipientIds.map(uid =>
            getFirestoreDocument(
              serviceAccount.project_id,
              `users/${uid}`,
              accessToken
            ).then(document => ({
              uid,
              tokens: getUserTokens(document?.fields)
            }))
          )
        );

        const deliveryTargets = recipientDocs.flatMap(item =>
          item.tokens.map(token => ({ uid: item.uid, token }))
        );

        if (deliveryTargets.length === 0) {
          return json({
            ok: true,
            sent: false,
            type: "group_message",
            reason: "No recipients have FCM tokens"
          });
        }

        const results = await Promise.all(
          deliveryTargets.map(item =>
            sendFcmMessage(
              serviceAccount.project_id,
              accessToken,
              item.token,
              {
                title: groupName,
                body: `${senderName}: ${messageText}`
              },
              {
                type: "group_message",
                groupId: groupId,
                recipientId: item.uid,
                messageId: messageId,
                senderId: verifiedUser.uid
              }
            ).then(result => ({ uid: item.uid, ...result }))
          )
        );

        const sentCount = results.filter(result => result.ok).length;
        const failed = results
          .filter(result => !result.ok)
          .map(result => ({
            uid: result.uid,
            status: result.status
          }));

        return json({
          ok: sentCount > 0,
          sent: sentCount > 0,
          type: "group_message",
          sentCount,
          recipientCount: recipientIds.length,
          tokenCount: deliveryTargets.length,
          failed
        }, sentCount > 0 ? 200 : 502);
      }

      // =========================================================
      // WEB MEETUP PUSH
      // =========================================================

      if (type === "meetup_interest" || type === "meetup_message" || type === "meetup_cancelled") {
        const meetupId = String(body.meetupId || "").trim();
        if (!meetupId) return json({ ok: false, error: "meetupId is required" }, 400);

        const accessToken = await getGoogleAccessToken(serviceAccount);
        const meetupDocument = await getFirestoreDocument(
          serviceAccount.project_id, `meetups/${meetupId}`, accessToken
        );
        if (!meetupDocument) return json({ ok: false, error: "Meetup not found" }, 404);

        const mf = meetupDocument.fields || {};
        const creatorId = getString(mf.creatorId);
        const city = getString(mf.city) || "Kindred";
        const activity = getString(mf.type) || "Meetup";

        if (type === "meetup_interest") {
          const interestDocument = await getFirestoreDocument(
            serviceAccount.project_id,
            `meetups/${meetupId}/interested/${verifiedUser.uid}`,
            accessToken
          );
          if (!interestDocument) return json({ ok:false, error:"Interest is not stored in Firestore" }, 403);
          if (!creatorId || creatorId === verifiedUser.uid) {
            return json({ ok:true, sent:false, type, reason:"No organizer notification needed" });
          }
          const senderName = getString((interestDocument.fields || {}).userName) || "Kindred member";
          const result = await sendPushToUsers(
            serviceAccount.project_id, accessToken, [creatorId],
            { title: "Kindred Meetup", body: `${senderName} is interested in your ${activity} meetup in ${city}.` },
            { type, meetupId, senderId: verifiedUser.uid }
          );
          return pushDeliveryResponse(type, result);
        }

        if (type === "meetup_message") {
          const messageId = String(body.messageId || "").trim();
          if (!messageId) return json({ ok:false, error:"messageId is required" }, 400);
          const messageDocument = await getFirestoreDocument(
            serviceAccount.project_id, `meetups/${meetupId}/messages/${messageId}`, accessToken
          );
          if (!messageDocument) return json({ ok:false, error:"Message not found" }, 404);
          const msg = messageDocument.fields || {};
          if (getString(msg.authorId) !== verifiedUser.uid) {
            return json({ ok:false, error:"Message author mismatch" }, 403);
          }
          const interested = await listFirestoreDocuments(
            serviceAccount.project_id, `meetups/${meetupId}/interested`, accessToken
          );
          const recipientIds = [...new Set([creatorId, ...interested.map(d => getString((d.fields||{}).userId))])]
            .filter(uid => uid && uid !== verifiedUser.uid);
          let messageText = getString(msg.text) || "New meetup message";
          if (messageText.length > 160) messageText = messageText.slice(0,157) + "...";
          const senderName = getString(msg.authorName) || "Kindred member";
          const result = await sendPushToUsers(
            serviceAccount.project_id, accessToken, recipientIds,
            { title: `${activity} · ${city}`, body: `${senderName}: ${messageText}` },
            { type, meetupId, messageId, senderId: verifiedUser.uid }
          );
          return pushDeliveryResponse(type, result);
        }

        if (type === "meetup_cancelled") {
          if (creatorId !== verifiedUser.uid) return json({ ok:false, error:"Only organizer can send cancellation" }, 403);
          if (getString(mf.status) !== "cancelled") return json({ ok:false, error:"Meetup is not cancelled in Firestore" }, 403);
          const interested = await listFirestoreDocuments(
            serviceAccount.project_id, `meetups/${meetupId}/interested`, accessToken
          );
          const recipientIds = [...new Set(interested.map(d => getString((d.fields||{}).userId)))]
            .filter(uid => uid && uid !== verifiedUser.uid);
          const result = await sendPushToUsers(
            serviceAccount.project_id, accessToken, recipientIds,
            { title: "Kindred Meetup cancelled", body: `The ${activity} meetup in ${city} has been cancelled.` },
            { type, meetupId, senderId: verifiedUser.uid }
          );
          return pushDeliveryResponse(type, result);
        }
      }

      // =========================================================
      // PERSONAL CHAT PUSH
      // =========================================================

      const connectionId = String(body.connectionId || "").trim();
      const messageId = String(body.messageId || "").trim();

      if (!connectionId || !messageId) {
        return json({
          ok: false,
          error: "connectionId and messageId are required"
        }, 400);
      }

      const accessToken = await getGoogleAccessToken(serviceAccount);

      const connectionDocument = await getFirestoreDocument(
        serviceAccount.project_id,
        `connections/${connectionId}`,
        accessToken
      );

      if (!connectionDocument) {
        return json({
          ok: false,
          error: "Connection not found"
        }, 404);
      }

      const connectionFields = connectionDocument.fields || {};

      const participants = getArrayStrings(
        connectionFields.participants
      );

      const connectionStatus = getString(
        connectionFields.status
      );

      if (!participants.includes(verifiedUser.uid)) {
        return json({
          ok: false,
          error: "Sender is not a participant"
        }, 403);
      }

      if (connectionStatus !== "accepted") {
        return json({
          ok: false,
          error: "Connection is not accepted"
        }, 403);
      }

      const recipientId = participants.find(
        uid => uid !== verifiedUser.uid
      );

      if (!recipientId) {
        return json({
          ok: false,
          error: "Recipient not found"
        }, 400);
      }

      if (await usersAreBlocked(serviceAccount.project_id, verifiedUser.uid, recipientId, accessToken)) {
        return json({ ok: true, sent: false, reason: "Message notifications unavailable" });
      }

      const messageDocument = await getFirestoreDocument(
        serviceAccount.project_id,
        `connections/${connectionId}/messages/${messageId}`,
        accessToken
      );

      if (!messageDocument) {
        return json({
          ok: false,
          error: "Message not found"
        }, 404);
      }

      const messageFields = messageDocument.fields || {};

      const senderId = getString(messageFields.senderId);

      if (senderId !== verifiedUser.uid) {
        return json({
          ok: false,
          error: "Message sender mismatch"
        }, 403);
      }

      const recipientDocument = await getFirestoreDocument(
        serviceAccount.project_id,
        `users/${recipientId}`,
        accessToken
      );

      const recipientTokens = getUserTokens(recipientDocument?.fields);

      if (recipientTokens.length === 0) {
        return json({
          ok: true,
          sent: false,
          reason: "Recipient has no FCM token"
        });
      }

      const messageType =
        getString(messageFields.type) || "text";

      const messageText =
        getString(messageFields.text) || "";

      let notificationBody = "Новое сообщение";

      if (messageType === "audio" || getString(messageFields.audioData)) {
        notificationBody = "🎤 Голосовое сообщение";
      } else if (messageText.trim()) {
        notificationBody = messageText.trim();
      }

      if (messageFields.call?.mapValue && getString(messageFields.call.mapValue.fields?.status) !== "ringing") {
        return json({ok:true, sent:false, reason:"Call is no longer ringing"});
      }
      if (messageFields.plan?.mapValue || messageFields.call?.mapValue) notificationBody = privatePushPreview(messageFields);
      if (notificationBody.length > 180) {
        notificationBody =
          notificationBody.substring(0, 177) + "...";
      }

      const fcmResults = await Promise.all(recipientTokens.map(token =>
        sendFcmMessage(
          serviceAccount.project_id,
          accessToken,
          token,
          {
            title: "Kindred",
            body: notificationBody
          },
          {
            type: "chat_message",
            connectionId: connectionId,
            recipientId,
            messageId: messageId,
            senderId: verifiedUser.uid
          }
        )
      ));
      const sentCount = fcmResults.filter(result => result.ok).length;

      if (sentCount === 0) {
        return json({
          ok: false,
          error: "FCM send failed",
          details: fcmResults.map(result => result.body)
        }, 502);
      }

      return json({
        ok: true,
        sent: true,
        sentCount,
        tokenCount: recipientTokens.length
      });

    } catch (error) {
      console.error("Kindred Worker error:", error);

      return json({
        ok: false,
        error: error?.message || String(error)
      }, 500);
    }
}


// =============================================================
// FCM
// =============================================================

// Invitation recipients and text are derived from the saved document, never from caller input.
async function handleInvitationPush(body, senderId, serviceAccount) {
  const isGame = body.type === "game_invite";
  const type = isGame ? "game_invite" : "friend_request";
  const id = String(isGame ? body.roomId || "" : body.connectionId || "").trim();
  const collection = isGame ? String(body.roomCollection || "") : "connections";
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(id) ||
      (isGame && !["gameRooms", "arcadeRooms"].includes(collection))) {
    return json({ ok: false, error: "Invalid invitation reference" }, 400);
  }

  const projectId = serviceAccount.project_id;
  const accessToken = await getGoogleAccessToken(serviceAccount);
  const document = await getFirestoreDocument(projectId, `${collection}/${id}`, accessToken);
  if (!document) return json({ ok: false, error: "Invitation not found" }, 404);
  const fields = document.fields || {};
  const participants = getArrayStrings(fields.participants);
  const recipientId = getString(isGame ? fields.player2Id : fields.recipientId);
  const ownerId = getString(isGame ? fields.player1Id : fields.requestedBy);
  if (ownerId !== senderId || !recipientId || recipientId === senderId ||
      participants.length !== 2 || !participants.includes(senderId) || !participants.includes(recipientId)) {
    return json({ ok: false, error: "Not the invitation sender" }, 403);
  }
  if (getString(fields.status) !== (isGame ? "invited" : "pending") ||
      (isGame && getString(fields.mode) !== "invite")) {
    return json({ ok: true, sent: false, reason: "Invitation is no longer pending" });
  }

  const [senderProfile, recipient, blockedBySender, blockedByRecipient] = await Promise.all([
    getFirestoreDocument(projectId, `profiles/${senderId}`, accessToken),
    getFirestoreDocument(projectId, `users/${recipientId}`, accessToken),
    getFirestoreDocument(projectId, `blocks/${senderId}_${recipientId}`, accessToken),
    getFirestoreDocument(projectId, `blocks/${recipientId}_${senderId}`, accessToken)
  ]);
  if (blockedBySender || blockedByRecipient) return json({ ok: true, sent: false, reason: "Invitation notifications unavailable" });
  const tokens = getUserTokens(recipient?.fields);
  if (!tokens.length) return json({ ok: true, sent: false, reason: "Recipient has no FCM token" });
  const senderName = (getString(senderProfile?.fields?.displayName) || getString(fields.player1Name) || "A Kindred member").slice(0, 80);
  const language = getString(recipient?.fields?.notificationLanguage) || "en";
  const russian = language.startsWith("ru");
  const title = isGame ? (russian ? "Kindred · Приглашение в игру" : "Kindred · Game invitation")
    : (russian ? "Kindred · Приглашение в друзья" : "Kindred · Friend request");
  const gameNames = russian
    ? { durak: "Дурак", tic_tac_toe: "Крестики-нолики", connect_four: "Четыре в ряд", memory: "Память" }
    : { durak: "Durak", tic_tac_toe: "Tic-tac-toe", connect_four: "Connect Four", memory: "Memory" };
  const game = collection === "gameRooms" ? "durak" : getString(fields.gameType);
  const text = isGame
    ? (russian ? `${senderName} приглашает вас в игру «${gameNames[game] || "Kindred"}».` : `${senderName} invites you to play ${gameNames[game] || "a game"}.`)
    : (russian ? `${senderName} хочет добавить вас в друзья.` : `${senderName} wants to connect with you.`);
  const generation = fields.createdAt?.timestampValue || document.createTime || "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${collection}/${id}/${generation}`));
  const eventId = `invite_${Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("")}`;
  const data = { type, recipientId, senderId, eventId,
    ...(isGame ? { roomId: id, roomCollection: collection } : { connectionId: id }) };

  // A create-only receipt prevents repeated button presses/replayed requests from ringing again.
  const receiptUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/pushInvitationDeliveries/${eventId}`;
  const receipt = await fetch(`${receiptUrl}?currentDocument.exists=false`, {
    method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { createdAt: { timestampValue: new Date().toISOString() } } })
  });
  if (receipt.status === 409 || receipt.status === 412) return json({ ok: true, sent: false, duplicate: true });
  if (!receipt.ok) throw new Error(`Invitation receipt failed: ${receipt.status}`);
  let results;
  try {
    results = await Promise.all(tokens.map(token => sendFcmMessage(projectId, accessToken, token, { title, body: text }, data)
      .catch(() => ({ ok: false, status: 503 }))));
    if (!results.some(result => result.ok)) {
      await fetch(receiptUrl, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    }
  } catch (error) {
    await fetch(receiptUrl, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    throw error;
  }
  const sentCount = results.filter(result => result.ok).length;
  return json({ ok: sentCount > 0, sent: sentCount > 0, type, sentCount,
    failed: results.filter(result => !result.ok).map(result => ({ status: result.status })) }, sentCount ? 200 : 502);
}

async function sendFcmMessage(
  projectId,
  accessToken,
  token,
  notification,
  data,
  options = {}
) {
  const url =
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  try {
  if (!options.preferencesChecked && data?.recipientId) {
    const recipient = await getFirestoreDocument(projectId, `users/${data.recipientId}`, accessToken);
    if (!notificationAllowed(recipient?.fields,data.type)) return {ok:true,status:204,body:"Notifications paused by recipient"};
  }
  if (!options.ownerChecked && data?.recipientId) {
    const owner = await getFirestoreDocument(projectId, `pushDeviceOwners/${await pushHash(token)}`, accessToken);
    if (owner && getString(owner.fields?.uid) !== data.recipientId) return { ok: false, status: 410, body: "Device is not bound to recipient" };
    options = { ...options, dataOnly: getString(owner?.fields?.mode) === "data" };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      message: {
        token: token,

        ...(!options.dataOnly ? { notification: {
          title: String(notification.title || "Kindred"),
          body: String(notification.body || "")
        } } : {}),

        data: stringifyData(options.dataOnly ? { ...data, title: notification.title || "Kindred", body: notification.body || "" } : data),

        android: {
          priority: "HIGH",
          ...(!options.dataOnly ? { notification: {
            sound: "default",
            notification_priority: "PRIORITY_HIGH",
            default_vibrate_timings: true,
            channel_id: data?.type === "game_invite" ? "kindred_game_invitations"
              : ["friend_request", "friend_invite", "connection_request"].includes(data?.type)
                ? "kindred_friend_invitations" : ["forum_reply","meeting_poll","meeting_vote","discovery_match","test_notification"].includes(data?.type) ? "kindred_community" : "kindred_messages",
            ...(data?.eventId ? { tag: String(data.eventId) } : {})
          } } : {})
        }
      }
    })
  });

  const responseText = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body: responseText
  };
  } catch {
    // A single unreachable device must not discard other successful deliveries.
    return { ok: false, status: 503, body: "FCM request failed" };
  }
}


function stringifyData(data) {
  const result = {};

  for (const [key, value] of Object.entries(data || {})) {
    result[key] =
      value === null || value === undefined
        ? ""
        : String(value);
  }

  return result;
}


// =============================================================
// FIRESTORE
// =============================================================

async function getFirestoreDocument(
  projectId,
  documentPath,
  accessToken
) {
  const encodedPath = documentPath
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodedPath}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Firestore request failed: ${response.status} ${text}`
    );
  }

  return await response.json();
}

async function appendStringToArrayField(
  projectId,
  documentPath,
  fieldName,
  value,
  accessToken
) {
  const documentName =
    `projects/${projectId}/databases/(default)/documents/${documentPath}`;
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:commit`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      writes: [{
        transform: {
          document: documentName,
          fieldTransforms: [{
            fieldPath: fieldName,
            appendMissingElements: {
              values: [{ stringValue: String(value) }]
            }
          }]
        }
      }]
    })
  });
  if (!response.ok) {
    throw new Error(`Firestore read receipt failed: ${response.status} ${await response.text()}`);
  }
}


function getString(field) {
  if (!field) {
    return "";
  }

  if (typeof field.stringValue === "string") {
    return field.stringValue;
  }

  return "";
}


function getArrayStrings(field) {
  if (!field?.arrayValue?.values) {
    return [];
  }

  return field.arrayValue.values
    .map(value => getString(value))
    .filter(Boolean);
}


function getUserTokens(fields) {
  const tokens = getArrayStrings(fields?.fcmTokens);
  const legacyToken = getString(fields?.fcmToken);

  if (legacyToken) {
    tokens.push(legacyToken);
  }

  return [...new Set(tokens.map(token => token.trim()).filter(Boolean))];
}

async function usersAreBlocked(projectId, senderId, recipientId, accessToken) {
  const docs = await Promise.all([
    getFirestoreDocument(projectId, `blocks/${senderId}_${recipientId}`, accessToken),
    getFirestoreDocument(projectId, `blocks/${recipientId}_${senderId}`, accessToken)
  ]);
  return docs.some(Boolean);
}

function pushDeliveryResponse(type, result) {
  const ok = result.sentCount > 0 || result.tokenCount === 0;
  return json({ ok, type, ...result }, ok ? 200 : 502);
}


async function listFirestoreDocuments(projectId, collectionPath, accessToken) {
  const encodedPath = collectionPath.split("/").map(encodeURIComponent).join("/");
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encodedPath}`;
  const documents = [];
  const seen = new Set();
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "200" });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await fetch(`${url}?${query}`, { headers: { "Authorization": `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Firestore list failed: ${response.status} ${await response.text()}`);
    const data = await response.json();
    documents.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
    if (pageToken && seen.has(pageToken)) throw new Error("Repeated Firestore page token");
    if (pageToken) seen.add(pageToken);
  } while (pageToken);
  return documents;
}

async function sendPushToUsers(projectId, accessToken, userIds, notification, data) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  const docs = await Promise.all(uniqueIds.map(async uid => ({
    uid,
    document: await getFirestoreDocument(projectId, `users/${uid}`, accessToken)
  })));
  const targets = docs.filter(x=>notificationAllowed(x.document?.fields,data?.type)).flatMap(x => getUserTokens(x.document?.fields).map(token => ({ uid:x.uid, token })));
  if (!targets.length) return { sent:false, sentCount:0, recipientCount:uniqueIds.length, tokenCount:0, reason:"No recipients have FCM tokens" };
  const results = await Promise.all(targets.map(x =>
    sendFcmMessage(projectId, accessToken, x.token, notification, { ...data, recipientId: x.uid },{preferencesChecked:true}).then(r => ({uid:x.uid,...r}))
  ));
  return {
    sent: results.some(r => r.ok),
    sentCount: results.filter(r => r.ok).length,
    recipientCount: uniqueIds.length,
    tokenCount: targets.length,
    failed: results.filter(r => !r.ok).map(r => ({uid:r.uid,status:r.status}))
  };
}

// =============================================================
// GOOGLE ACCESS TOKEN
// =============================================================

async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope:
      "https://www.googleapis.com/auth/cloud-platform " +
      "https://www.googleapis.com/auth/firebase.messaging " +
      "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const unsignedToken =
    base64UrlEncode(
      new TextEncoder().encode(JSON.stringify(header))
    ) +
    "." +
    base64UrlEncode(
      new TextEncoder().encode(JSON.stringify(payload))
    );

  const privateKey = await importPrivateKey(
    serviceAccount.private_key
  );

  const signature = await crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5"
    },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const assertion =
    unsignedToken +
    "." +
    base64UrlEncode(new Uint8Array(signature));

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: assertion
      })
    }
  );

  const result = await response.json();

  if (!response.ok || !result.access_token) {
    throw new Error(
      "Could not get Google access token: " +
      JSON.stringify(result)
    );
  }

  return result.access_token;
}


async function importPrivateKey(pem) {
  const cleanPem = String(pem)
    .replace(
      "-----BEGIN PRIVATE KEY-----",
      ""
    )
    .replace(
      "-----END PRIVATE KEY-----",
      ""
    )
    .replace(/\s/g, "");

  const binary = Uint8Array.from(
    atob(cleanPem),
    char => char.charCodeAt(0)
  );

  return await crypto.subtle.importKey(
    "pkcs8",
    binary.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
}


// =============================================================
// FIREBASE ID TOKEN VERIFICATION
// =============================================================

async function verifyFirebaseIdToken(
  idToken,
  projectId
) {
  try {
    const parts = idToken.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(
      new TextDecoder().decode(
        base64UrlDecode(parts[0])
      )
    );

    const payload = JSON.parse(
      new TextDecoder().decode(
        base64UrlDecode(parts[1])
      )
    );

    if (!header.kid) {
      return null;
    }

    if (header.alg !== "RS256") {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= now) {
      return null;
    }

    if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat) || payload.iat > now + 300) {
      return null;
    }

    if (
      payload.aud !== projectId
    ) {
      return null;
    }

    const expectedIssuer =
      `https://securetoken.google.com/${projectId}`;

    if (payload.iss !== expectedIssuer) {
      return null;
    }

    if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128 || payload.sub.includes("/")) {
      return null;
    }
    if (payload.auth_time !== undefined &&
        (typeof payload.auth_time !== "number" || !Number.isFinite(payload.auth_time) || payload.auth_time > now + 300)) {
      return null;
    }

    const certificatesResponse = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );

    if (!certificatesResponse.ok) {
      throw new Error(
        "Could not download Firebase public certificates"
      );
    }

    const certificates =
      await certificatesResponse.json();

    const certificatePem =
      certificates[header.kid];

    if (!certificatePem) {
      return null;
    }

    const publicKey =
      await importCertificatePublicKey(
        certificatePem
      );

    const signedData =
      `${parts[0]}.${parts[1]}`;

    const signature =
      base64UrlDecode(parts[2]);

    const valid =
      await crypto.subtle.verify(
        {
          name: "RSASSA-PKCS1-v1_5"
        },
        publicKey,
        signature,
        new TextEncoder().encode(signedData)
      );

    if (!valid) {
      return null;
    }

    return {
      uid: payload.sub,
      email: payload.email || null,
      payload: payload
    };

  } catch (error) {
    console.error(
      "Firebase token verification failed:",
      error
    );

    return null;
  }
}


async function importCertificatePublicKey(
  certificatePem
) {
  const certificateDer =
    pemCertificateToDer(certificatePem);

  const spki =
    extractSubjectPublicKeyInfo(
      certificateDer
    );

  return await crypto.subtle.importKey(
    "spki",
    spki,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );
}


function pemCertificateToDer(pem) {
  const base64 = String(pem)
    .replace(
      "-----BEGIN CERTIFICATE-----",
      ""
    )
    .replace(
      "-----END CERTIFICATE-----",
      ""
    )
    .replace(/\s/g, "");

  return Uint8Array.from(
    atob(base64),
    char => char.charCodeAt(0)
  );
}


function extractSubjectPublicKeyInfo(
  certificateDer
) {
  const bytes =
    certificateDer instanceof Uint8Array
      ? certificateDer
      : new Uint8Array(certificateDer);

  let offset = 0;

  const certificateSequence =
    readAsn1Element(bytes, offset);

  offset =
    certificateSequence.contentStart;

  const tbsCertificate =
    readAsn1Element(bytes, offset);

  let tbsOffset =
    tbsCertificate.contentStart;

  let element =
    readAsn1Element(bytes, tbsOffset);

  if (element.tag === 0xa0) {
    tbsOffset = element.end;
  }

  // serialNumber
  element =
    readAsn1Element(bytes, tbsOffset);
  tbsOffset = element.end;

  // signature
  element =
    readAsn1Element(bytes, tbsOffset);
  tbsOffset = element.end;

  // issuer
  element =
    readAsn1Element(bytes, tbsOffset);
  tbsOffset = element.end;

  // validity
  element =
    readAsn1Element(bytes, tbsOffset);
  tbsOffset = element.end;

  // subject
  element =
    readAsn1Element(bytes, tbsOffset);
  tbsOffset = element.end;

  // subjectPublicKeyInfo
  const spkiElement =
    readAsn1Element(bytes, tbsOffset);

  return bytes
    .slice(
      spkiElement.start,
      spkiElement.end
    )
    .buffer;
}


function readAsn1Element(bytes, start) {
  let offset = start;

  const tag = bytes[offset++];

  let lengthByte = bytes[offset++];

  let length;

  if ((lengthByte & 0x80) === 0) {
    length = lengthByte;
  } else {
    const numberOfLengthBytes =
      lengthByte & 0x7f;

    length = 0;

    for (
      let i = 0;
      i < numberOfLengthBytes;
      i++
    ) {
      length =
        (length << 8) |
        bytes[offset++];
    }
  }

  const contentStart = offset;
  const end = contentStart + length;

  return {
    tag,
    start,
    contentStart,
    end
  };
}


// =============================================================
// BASE64 URL
// =============================================================

function base64UrlEncode(value) {
  const bytes =
    value instanceof Uint8Array
      ? value
      : new Uint8Array(value);

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function base64UrlDecode(value) {
  let normalized = String(value)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (normalized.length % 4) {
    normalized += "=";
  }

  return Uint8Array.from(
    atob(normalized),
    char => char.charCodeAt(0)
  );
}


// =============================================================
// RESPONSE
// =============================================================

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

// Durable fan-out: the HTTP request validates the event; each queue delivery handles one user.
const PUSH_TOKEN_PAGE_SIZE = 6;

async function pushHash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

function pushReference(body) {
  return Object.fromEntries(["type", "connectionId", "groupId", "meetupId", "messageId", "roomId", "roomCollection", "recipientId", "pollId", "postId", "replyId"]
    .filter(key => typeof body[key] === "string").map(key => [key, body[key]]));
}

async function makePushPlan(body, senderId, account, accessToken) {
  const project = account.project_id;
  const originalType = body.type || "chat_message";
  const type = ["friend_request", "friend_invite", "connection_request"].includes(originalType) ? "friend_request" : originalType;
  const get = path => getFirestoreDocument(project, path, accessToken);
  const fail = (error, status = 403) => json({ ok: false, error }, status);
  const silent = reason => json({ ok: true, sent: false, reason });
  let document, notification, localized, recipients, interestedPath;
  let data = { type, senderId };
  if (type === "discovery_match") {
    if(senderId!=="kindred_system")return fail("Only scheduled discovery can create this notification");
    document=await get(`discoveryPushEvents/${body.messageId}`);
    if(!document)return fail("Discovery event not found",404);
    const uid=getString(document.fields?.userId),alert=uid?await get(`discoveryAlerts/${uid}`):null;
    if(!uid||alert?.fields?.enabled?.booleanValue!==true||document.fields?.alertCreatedAt?.timestampValue!==alert.fields?.createdAt?.timestampValue)return silent("Discovery alerts are disabled or changed");
    recipients=[uid];notification={title:"Kindred · New people",body:"New people match your saved search. Open Kindred to meet them."};
    localized={en:notification,ru:{title:"Kindred · Новые люди",body:"Появились люди по твоему поиску. Открой Kindred, чтобы познакомиться."}};
    data={...data,messageId:body.messageId};
  } else if (type === "forum_reply") {
    const post = await get(`forumPosts/${body.postId}`);
    document = await get(`forumPosts/${body.postId}/replies/${body.replyId}`);
    if (!post || !document) return fail("Reply not found",404);
    if (getString(document.fields?.authorId)!==senderId) return fail("Reply author mismatch");
    if (getString(post.fields?.status)!=="visible" || getString(document.fields?.status)!=="visible") return silent("Reply is hidden");
    recipients=[getString(post.fields?.authorId)].filter(uid=>uid && uid!==senderId);
    notification={title:"Kindred · Community reply",body:"Someone replied to your community post."};
    data={...data,postId:body.postId,replyId:body.replyId};
  } else if (type === "meeting_poll" || type === "meeting_vote") {
    const poll=await get(`meetingPolls/${body.pollId}`);
    if (!poll) return fail("Meeting poll not found",404);
    const f=poll.fields||{}, connectionId=getString(f.connectionId), c=await get(`connections/${connectionId}`);
    const members=getArrayStrings(f.participants);
    if(members.length!==2 || !members.includes(senderId) || !c || getString(c.fields?.status)!=="accepted" ||
      JSON.stringify([...members].sort())!==JSON.stringify(getArrayStrings(c.fields?.participants).sort())) return fail("Not a meeting participant");
    if(type==="meeting_vote"){
      document=await get(`meetingPolls/${body.pollId}/votes/${senderId}`);
      if(!document || getString(document.fields?.userId)!==senderId || getString(f.status)!=="open") return fail("Vote not found");
    } else {
      if(getString(f.creatorId)!==senderId) return fail("Not the meeting creator");
      document=poll;
    }
    recipients=members.filter(uid=>uid!==senderId);
    notification={title:"Kindred · Meeting",body:type==="meeting_vote"?"Your friend updated their available times.":
      getString(f.status)==="confirmed"?"You both agreed on a meeting time. Add it to your calendar.":getString(f.status)==="cancelled"?"Your meeting plan was cancelled.":"Your friend suggested dates for a meeting."};
    data={...data,pollId:body.pollId,connectionId};
  } else if (type === "friend_request" || type === "game_invite") {
    const game = type === "game_invite";
    const collection = game ? body.roomCollection : "connections";
    const id = game ? body.roomId : body.connectionId;
    if (game && !["gameRooms", "arcadeRooms"].includes(collection)) return fail("Invalid room collection", 400);
    document = await get(`${collection}/${id}`);
    if (!document) return fail("Invitation not found", 404);
    const f = document.fields || {};
    const recipient = getString(game ? f.player2Id : f.recipientId);
    const owner = getString(game ? f.player1Id : f.requestedBy);
    const participants = getArrayStrings(f.participants);
    if (owner !== senderId || !recipient || recipient === senderId || participants.length !== 2 ||
        !participants.includes(senderId) || !participants.includes(recipient)) return fail("Not the invitation sender");
    if (getString(f.status) !== (game ? "invited" : "pending") || (game && getString(f.mode) !== "invite")) {
      return silent("Invitation is no longer pending");
    }
    const profile = await get(`profiles/${senderId}`);
    const name = (getString(profile?.fields?.displayName) || getString(f.player1Name) || "A Kindred member").slice(0, 80);
    const games = { durak: ["Durak", "Дурак"], tic_tac_toe: ["Tic-tac-toe", "Крестики-нолики"],
      connect_four: ["Connect Four", "Четыре в ряд"], memory: ["Memory", "Память"] };
    const gameName = games[collection === "gameRooms" ? "durak" : getString(f.gameType)] || ["Kindred", "Kindred"];
    localized = {
      en: { title: game ? "Kindred · Game invitation" : "Kindred · Friend request",
        body: game ? `${name} invites you to play ${gameName[0]}.` : `${name} wants to connect with you.` },
      ru: { title: game ? "Kindred · Приглашение в игру" : "Kindred · Приглашение в друзья",
        body: game ? `${name} приглашает вас в игру «${gameName[1]}».` : `${name} хочет добавить вас в друзья.` }
    };
    recipients = [recipient];
    data = { ...data, ...(game ? { roomId: id, roomCollection: collection } : { connectionId: id }) };
  } else if (type === "chat_message") {
    const connection = await get(`connections/${body.connectionId}`);
    if (!connection) return fail("Connection not found", 404);
    const members = [...new Set(getArrayStrings(connection.fields?.participants))];
    if (members.length !== 2 || !members.includes(senderId) || getString(connection.fields?.status) !== "accepted") {
      return fail("Not an accepted connection participant");
    }
    document = await get(`connections/${body.connectionId}/messages/${body.messageId}`);
    if (!document) return fail("Message not found", 404);
    const f = document.fields || {};
    if (getString(f.senderId) !== senderId) return fail("Message sender mismatch");
    if (f.call?.mapValue && getString(f.call.mapValue.fields?.status) !== "ringing") return silent("Call is no longer ringing");
    const text = privatePushPreview(f);
    notification = { title: "Kindred", body: text };
    recipients = members.filter(uid => uid !== senderId);
    data = { ...data, connectionId: body.connectionId, messageId: body.messageId };
  } else if (type === "group_invite" || type === "group_message") {
    const group = await get(`groups/${body.groupId}`);
    if (!group) return fail("Group not found", 404);
    const f = group.fields || {};
    if (f.deleting?.booleanValue === true) return silent("Group is being removed");
    const members = [...new Set(getArrayStrings(f.memberIds))];
    const groupName = getString(f.name) || "Kindred group";
    if (type === "group_invite") {
      if (getString(f.ownerId) !== senderId) return fail("Only group owner can send invitations");
      if (members.includes(body.recipientId)) return silent("Already a group member");
      if (!getArrayStrings(f.invitedIds).includes(body.recipientId)) return fail("Invitation is not stored");
      document = group;
      recipients = [body.recipientId];
      notification = { title: "Kindred", body: `💜 Вас пригласили в группу «${groupName}»` };
    } else {
      if (!members.includes(senderId)) return fail("Sender is not a group member");
      document = await get(`groups/${body.groupId}/messages/${body.messageId}`);
      if (!document) return fail("Message not found", 404);
      const message = document.fields || {};
      if (getString(message.senderId) !== senderId) return fail("Message sender mismatch");
      let text = getString(message.text) || "Новое сообщение";
      if (text.length > 160) text = text.slice(0, 157) + "...";
      notification = { title: groupName, body: `${getString(message.senderName) || "Kindred member"}: ${text}` };
      recipients = members.filter(uid => uid !== senderId);
    }
    data = { ...data, groupId: body.groupId, ...(body.messageId ? { messageId: body.messageId } : {}) };
  } else if (["meetup_interest", "meetup_message", "meetup_cancelled"].includes(type)) {
    const meetup = await get(`meetups/${body.meetupId}`);
    if (!meetup) return fail("Meetup not found", 404);
    const f = meetup.fields || {};
    const creator = getString(f.creatorId);
    const activity = getString(f.type) || "Meetup", city = getString(f.city) || "Kindred";
    if (type === "meetup_interest") {
      document = await get(`meetups/${body.meetupId}/interested/${senderId}`);
      if (!document) return fail("Interest is not stored");
      if (getString(f.status) === "cancelled" || !creator || creator === senderId) return silent("No organizer notification needed");
      recipients = [creator];
      notification = { title: "Kindred Meetup", body: `${getString(document.fields?.userName) || "Kindred member"} is interested in your ${activity} meetup in ${city}.` };
    } else if (type === "meetup_message") {
      document = await get(`meetups/${body.meetupId}/messages/${body.messageId}`);
      if (!document) return fail("Message not found", 404);
      if (getString(document.fields?.authorId) !== senderId) return fail("Message author mismatch");
      if (creator !== senderId && !await get(`meetups/${body.meetupId}/interested/${senderId}`)) return fail("Not a meetup participant");
      let text = getString(document.fields?.text) || "New meetup message";
      if (text.length > 160) text = text.slice(0, 157) + "...";
      notification = { title: `${activity} · ${city}`, body: `${getString(document.fields?.authorName) || "Kindred member"}: ${text}` };
      recipients = creator && creator !== senderId ? [creator] : [];
      interestedPath = `meetups/${body.meetupId}/interested`;
    } else {
      if (creator !== senderId) return fail("Only organizer can send cancellation");
      if (getString(f.status) !== "cancelled") return fail("Meetup is not cancelled");
      document = meetup;
      recipients = [];
      interestedPath = `meetups/${body.meetupId}/interested`;
      notification = { title: "Kindred Meetup cancelled", body: `The ${activity} meetup in ${city} has been cancelled.` };
    }
    data = { ...data, meetupId: body.meetupId, ...(body.messageId ? { messageId: body.messageId } : {}) };
  } else return fail("Unsupported push type", 400);
  const f = document.fields || {};
  const generation = ["group_invite","meeting_poll","meeting_vote"].includes(type) ? document.updateTime || document.createTime || ""
    : f.createdAt?.timestampValue || document.createTime || "";
  const eventId = "push_" + await pushHash(JSON.stringify([type, data.connectionId, data.groupId,
    data.meetupId, data.roomId, data.roomCollection, data.messageId, data.pollId, data.postId, data.replyId, type === "group_invite" ? body.recipientId : "", generation]));
  return { type, notification, localized, recipients, interestedPath, eventId, data: { ...data, eventId } };
}

async function enqueuePushEvent(body, uid, account, env) {
  const token = await getGoogleAccessToken(account);
  const plan = await makePushPlan(body, uid, account, token);
  if (plan instanceof Response) return plan;
  const base = { kind: "expand", ref: pushReference(body), senderId: uid,
    eventId: plan.eventId, createdAt: new Date().toISOString() };
  if (plan.interestedPath) {
    await env.KINDRED_PUSH_QUEUE.send({ ...base, recipients: plan.recipients }, { contentType: "json" });
  } else {
    for (let offset = 0; offset < plan.recipients.length; offset += 100) {
      await env.KINDRED_PUSH_QUEUE.send({ ...base, recipients: plan.recipients.slice(offset, offset + 100) }, { contentType: "json" });
    }
  }
  return json({ ok: true, queued: true, sent: false, type: plan.type, eventId: plan.eventId }, 202);
}

async function writePushFields(project, path, fields, token, precondition = "") {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/` +
    path.split("/").map(encodeURIComponent).join("/");
  return fetch(url + precondition, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }) });
}

async function managePushDevice(body, uid, account) {
  if (typeof body.token !== "string" || body.token.length < 10 || body.token.length > 4096 || /\s/.test(body.token)) {
    return json({ ok: false, error: "Invalid device token" }, 400);
  }
  const token = await getGoogleAccessToken(account), project = account.project_id;
  const ownerPath = `pushDeviceOwners/${await pushHash(body.token)}`;
  const owner = await getFirestoreDocument(project, ownerPath, token);
  const register = body.type === "register_device";
  if (!register && getString(owner?.fields?.uid) !== uid) return json({ ok: true, unregistered: true });
  const user = !register ? await getFirestoreDocument(project, `users/${uid}`, token) : null;
  const name = path => `projects/${project}/databases/(default)/documents/${path}`;
  const writes = [{ update: { name: name(ownerPath), fields: {
    uid: { stringValue: register ? uid : "" }, mode: { stringValue: "data" },
    updatedAt: { timestampValue: new Date().toISOString() }
  } }, ...(!register && owner.updateTime ? { currentDocument: { updateTime: owner.updateTime } } : {}) }];
  if (register) {
    writes.push({ update: { name: name(`users/${uid}`), fields: { fcmToken: { stringValue: body.token } } },
      updateMask: { fieldPaths: ["fcmToken"] }, updateTransforms: [
        { fieldPath: "fcmTokens", appendMissingElements: { values: [{ stringValue: body.token }] } },
        { fieldPath: "fcmTokenUpdatedAt", setToServerValue: "REQUEST_TIME" }
      ] });
  } else if (user) {
    if (getString(user.fields?.fcmToken) === body.token) writes.push({ update: { name: name(`users/${uid}`), fields: {} },
      updateMask: { fieldPaths: ["fcmToken"] }, ...(user.updateTime ? { currentDocument: { updateTime: user.updateTime } } : {}) });
    writes.push({ transform: { document: name(`users/${uid}`), fieldTransforms: [
      { fieldPath: "fcmTokens", removeAllFromArray: { values: [{ stringValue: body.token }] } }
    ] } });
  }
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents:commit`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ writes })
  });
  if (!response.ok) throw new Error(`Device registration failed: ${response.status}`);
  return json({ ok: true, registered: register, unregistered: !register });
}

async function expandPushJob(job, plan, account, token, env) {
  const ids = [...new Set((job.recipients || []).filter(uid => uid && uid !== job.senderId))];
  const jobs = ids.map(uid => ({ body: { kind: "deliver", ref: job.ref, senderId: job.senderId,
    recipientId: uid, eventId: job.eventId, createdAt: job.createdAt, tokenOffset: 0 }, contentType: "json" }));
  for (let offset = 0; offset < jobs.length; offset += 100) await env.KINDRED_PUSH_QUEUE.sendBatch(jobs.slice(offset, offset + 100));
  if (!plan.interestedPath) return;
  const path = plan.interestedPath.split("/").map(encodeURIComponent).join("/");
  const params = new URLSearchParams({ pageSize: "100" });
  if (job.pageToken) params.set("pageToken", job.pageToken);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/databases/(default)/documents/${path}?${params}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Meetup audience failed: ${response.status}`);
  const page = await response.json();
  const recipients = [...new Set((page.documents || []).map(document => getString(document.fields?.userId) || document.name?.split("/").pop()))]
    .filter(uid => uid && uid !== job.senderId);
  if (recipients.length) await env.KINDRED_PUSH_QUEUE.sendBatch(recipients.map(uid => ({ body: {
    kind: "deliver", ref: job.ref, senderId: job.senderId, recipientId: uid, eventId: job.eventId, createdAt: job.createdAt, tokenOffset: 0
  }, contentType: "json" })));
  if (page.nextPageToken) {
    if (page.nextPageToken === job.pageToken) throw new Error("Repeated audience page token");
    await env.KINDRED_PUSH_QUEUE.send({ ...job, recipients: [], pageToken: page.nextPageToken }, { contentType: "json" });
  }
}

async function deliverPushJob(job, plan, account, token, env) {
  const project = account.project_id, uid = job.recipientId;
  if (!uid || uid === job.senderId) return;
  if (!plan.recipients.includes(uid)) {
    if (!plan.interestedPath || !await getFirestoreDocument(project, `${plan.interestedPath}/${uid}`, token)) return;
  }
  if (await usersAreBlocked(project, job.senderId, uid, token)) return;
  const user = await getFirestoreDocument(project, `users/${uid}`, token);
  if (!notificationAllowed(user?.fields, plan.type)) return;
  const tokens = getUserTokens(user?.fields);
  const start = Math.max(0, Math.trunc(Number(job.tokenOffset) || 0));
  const language = getString(user?.fields?.notificationLanguage).startsWith("ru") ? "ru" : "en";
  const notification = plan.localized?.[language] || plan.notification;
  // Schedule the remaining devices before processing this page. A failed device/receipt
  // must not hold back healthy devices on later pages. Repeated continuation jobs are
  // safe because each successful device delivery has its own receipt.
  if (start + PUSH_TOKEN_PAGE_SIZE < tokens.length) await env.KINDRED_PUSH_QUEUE.send({ ...job,
    tokenOffset: start + PUSH_TOKEN_PAGE_SIZE }, { contentType: "json" });
  let retry = false;
  for (const deviceToken of tokens.slice(start, start + PUSH_TOKEN_PAGE_SIZE)) {
    const hash = await pushHash(deviceToken);
    const owner = await getFirestoreDocument(project, `pushDeviceOwners/${hash}`, token);
    if (owner && getString(owner.fields?.uid) !== uid) continue;
    const receiptPath = `pushNotificationDeliveries/${await pushHash(job.eventId + ":" + hash)}`;
    const previous = await getFirestoreDocument(project, receiptPath, token);
    if (getString(previous?.fields?.status) === "sent" || getString(previous?.fields?.status) === "rejected") continue;
    const now = Date.now();
    if (previous && Date.parse(getString(previous.fields?.leaseUntil)) > now) { retry = true; continue; }
    const condition = previous?.updateTime ? `?currentDocument.updateTime=${encodeURIComponent(previous.updateTime)}` : "?currentDocument.exists=false";
    const acquired = await writePushFields(project, receiptPath, { status: { stringValue: "pending" },
      leaseUntil: { stringValue: new Date(now + 120000).toISOString() }, recipientId: { stringValue: uid } }, token, condition);
    if (acquired.status === 409 || acquired.status === 412) { retry = true; continue; }
    if (!acquired.ok) throw new Error(`Delivery receipt failed: ${acquired.status}`);
    const lease = await acquired.json();
    const result = await sendFcmMessage(project, token, deviceToken, notification, { ...plan.data, recipientId: uid },
      { ownerChecked: true, preferencesChecked:true, dataOnly: getString(owner?.fields?.mode) === "data" });
    let fcmError;
    try { fcmError = JSON.parse(result.body)?.error?.details?.find(item => item.errorCode)?.errorCode; } catch {}
    if (!result.ok && fcmError !== "UNREGISTERED") {
      // Leave an expiring lease so a crashed/ambiguous send can safely be retried later.
      retry = true; continue;
    }
    const finished = await writePushFields(project, receiptPath, { status: { stringValue: result.ok ? "sent" : "rejected" },
      recipientId: { stringValue: uid }, fcmStatus: { integerValue: String(result.status) },
      finishedAt: { timestampValue: new Date().toISOString() } }, token,
      lease.updateTime ? `?currentDocument.updateTime=${encodeURIComponent(lease.updateTime)}` : "");
    if (!finished.ok) throw new Error(`Delivery receipt update failed: ${finished.status}`);
  }
  if (retry) throw new Error("Delivery needs retry");
}

async function processPushQueueMessage(message, env) {
  const job = message.body;
  if(job && ["discovery_scan","discovery_user"].includes(job.kind)) {
    const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT||"null");
    if(!account?.project_id)throw new Error("Firebase account is not configured");
    const token=await getGoogleAccessToken(account);
    await processDiscoveryJob(job,account,token,env);return;
  }
  if (!job || !["expand", "deliver"].includes(job.kind) || !job.ref || !job.senderId || !job.eventId) {
    throw new Error("Invalid queue job");
  }
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || "null");
  if (!account?.project_id) throw new Error("Firebase account is not configured");
  const token = await getGoogleAccessToken(account);
  const plan = await makePushPlan(job.ref, job.senderId, account, token);
  if (plan instanceof Response) {
    if (plan.status >= 500) throw new Error("Event validation unavailable");
    return;
  }
  // Revalidate saved status, author and generation so an old job cannot ring for a replaced invitation.
  if (plan.type !== "group_invite" && plan.eventId !== job.eventId) return;
  // Other invites/membership edits change a group's updateTime while this invitation remains valid.
  if (plan.type === "group_invite") { plan.eventId = job.eventId; plan.data.eventId = job.eventId; }
  if (job.kind === "expand") await expandPushJob(job, plan, account, token, env);
  else await deliverPushJob(job, plan, account, token, env);
}

// Text is derived only from the saved message, including website meeting/call cards.
function privatePushPreview(fields) {
  if (getString(fields.type) === "audio" || getString(fields.audioData)) return "🎤 Голосовое сообщение";
  if (fields.call?.mapValue) return "📹 Приглашение на видеозвонок";
  if (fields.plan?.mapValue) return "🗓️ Предложение о встрече";
  const text = getString(fields.text) || "Новое сообщение";
  return text.length > 180 ? text.slice(0,177) + "..." : text;
}

function notificationAllowed(fields={},type,now=new Date()) {
  if(type==="test_notification")return true;
  const f=fields?.notificationPreferences?.mapValue?.fields||{};
  const category=["friend_request","friend_invite","connection_request"].includes(type)?"friends":type==="game_invite"?"games":["chat_message","group_message"].includes(type)?"messages":"community";
  if(f[category]?.booleanValue===false)return false;
  if(f.quietEnabled?.booleanValue!==true)return true;
  const start=getString(f.quietStart),end=getString(f.quietEnd);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start===end)return true;
  let clock;try{clock=new Intl.DateTimeFormat("en-GB",{timeZone:getString(f.timeZone)||"UTC",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now);}catch{return true;}
  return !(start<end?clock>=start&&clock<end:clock>=start||clock<end);
}
async function sendDiscoveryAlerts(env) {
  const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT||"null");if(!account?.project_id)return;
  const token=await getGoogleAccessToken(account),project=account.project_id;
  const alerts=await listFirestoreDocuments(project,"discoveryAlerts",token);
  if(!alerts.some(a=>a.fields?.enabled?.booleanValue===true))return;
  const profiles=await listFirestoreDocuments(project,"profiles",token);
  const lower=v=>String(v||"").trim().toLowerCase();
  for(const a of alerts){
    const f=a.fields||{},uid=getString(f.userId);if(!uid||f.enabled?.booleanValue!==true)continue;
    const seen=new Set(getArrayStrings(f.seenIds)),created=f.createdAt?.timestampValue||a.createTime;
    const matches=profiles.filter(p=>{const x=p.fields||{},id=p.name.split("/").pop();return id!==uid&&!seen.has(id)&&x.active?.booleanValue===true&&x.adultConfirmed?.booleanValue===true&&
      (x.updatedAt?.timestampValue||p.updateTime)>created&&(!lower(getString(f.city))||lower(getString(x.city)).includes(lower(getString(f.city))))&&
      (!lower(getString(f.language))||getArrayStrings(x.languages).some(v=>lower(v).includes(lower(getString(f.language)))))&&
      (!lower(getString(f.interest))||getArrayStrings(x.interests).some(v=>lower(v).includes(lower(getString(f.interest)))));});
    const eligible=[];for(const p of matches){const id=p.name.split("/").pop();if(!await usersAreBlocked(project,uid,id,token))eligible.push(id);}
    if(!eligible.length)continue;
    const eventId="discovery_"+await pushHash(uid+":"+created+":"+eligible.sort().join(","));
    const result=await sendPushToUsers(project,token,[uid],{title:"Kindred · New people",body:"New people match your saved search. Open Kindred to meet them."},{type:"discovery_match",eventId,recipientId:uid});
    if(result.sent){await writePushFields(project,"discoveryAlerts/"+uid,{seenIds:{arrayValue:{values:[...seen,...eligible].slice(-250).map(stringValue=>({stringValue}))}},updatedAt:{timestampValue:new Date().toISOString()}},token,discoverySeenQuery(a.updateTime));}
  }
}

async function discoveryPage(project,path,token,pageToken="",pageSize=20) {
  const q=new URLSearchParams({pageSize:String(pageSize)});if(pageToken)q.set("pageToken",pageToken);
  const encoded=path.split("/").map(encodeURIComponent).join("/");
  const response=await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/${encoded}?${q}`,{headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok)throw new Error(`Discovery page failed: ${response.status}`);
  return response.json();
}
async function processDiscoveryJob(job,account,token,env) {
  const project=account.project_id;
  if(typeof(job.pageToken||"")!=="string"||(job.pageToken||"").length>4096)throw new Error("Invalid discovery cursor");
  if(job.kind==="discovery_scan") {
    const page=await discoveryPage(project,"discoveryAlerts",token,job.pageToken,100);
    const tasks=(page.documents||[]).filter(d=>d.fields?.enabled?.booleanValue===true).map(d=>({body:{kind:"discovery_user",uid:d.name.split("/").pop(),pageToken:""},contentType:"json"}));
    if(tasks.length)await env.KINDRED_PUSH_QUEUE.sendBatch(tasks);
    if(page.nextPageToken)await env.KINDRED_PUSH_QUEUE.send({kind:"discovery_scan",pageToken:page.nextPageToken},{contentType:"json"});
    return;
  }
  const uid=job.uid;if(typeof uid!=="string"||!uid||uid.includes("/")||uid.length>128)throw new Error("Invalid discovery recipient");
  const a=await getFirestoreDocument(project,`discoveryAlerts/${uid}`,token);
  if(!a||a.fields?.enabled?.booleanValue!==true)return;
  const f=a.fields||{},seen=new Set(getArrayStrings(f.seenIds)),created=f.createdAt?.timestampValue||a.createTime;
  const page=await discoveryPage(project,"profiles",token,job.pageToken,20),lower=v=>String(v||"").trim().toLowerCase(),eligible=[];
  for(const p of page.documents||[]){
    const x=p.fields||{},id=p.name.split("/").pop();
    if(id===uid||seen.has(id)||x.active?.booleanValue!==true||x.adultConfirmed?.booleanValue!==true||(x.updatedAt?.timestampValue||p.updateTime)<=created)continue;
    if(lower(getString(f.city))&&!lower(getString(x.city)).includes(lower(getString(f.city))))continue;
    if(lower(getString(f.language))&&!getArrayStrings(x.languages).some(v=>lower(v).includes(lower(getString(f.language)))))continue;
    if(lower(getString(f.interest))&&!getArrayStrings(x.interests).some(v=>lower(v).includes(lower(getString(f.interest)))))continue;
    if(!await usersAreBlocked(project,uid,id,token))eligible.push(id);
  }
  if(eligible.length){
    const id="discovery_"+await pushHash(uid+":"+created+":"+eligible.sort().join(","));
    const eventPath="discoveryPushEvents/"+id;
    const saved=await writePushFields(project,eventPath,{userId:{stringValue:uid},alertCreatedAt:{timestampValue:created},createdAt:{timestampValue:new Date().toISOString()}},token,"?currentDocument.exists=false");
    if(!saved.ok&&![409,412].includes(saved.status))throw new Error("Could not save discovery event");
    const ref={type:"discovery_match",messageId:id},plan=await makePushPlan(ref,"kindred_system",account,token);
    if(!(plan instanceof Response))await env.KINDRED_PUSH_QUEUE.send({kind:"expand",senderId:"kindred_system",eventId:plan.eventId,recipients:plan.recipients,createdAt:Date.now(),ref},{contentType:"json"});
    const updated=await writePushFields(project,`discoveryAlerts/${uid}`,{seenIds:{arrayValue:{values:[...seen,...eligible].slice(-250).map(stringValue=>({stringValue}))}},updatedAt:{timestampValue:new Date().toISOString()}},token,discoverySeenQuery(a.updateTime));
    if(!updated.ok&&![409,412].includes(updated.status))throw new Error("Could not update discovery alert");
  }
  if(page.nextPageToken)await env.KINDRED_PUSH_QUEUE.send({kind:"discovery_user",uid,pageToken:page.nextPageToken},{contentType:"json"});
}

function discoverySeenQuery(updateTime){return "?updateMask.fieldPaths=seenIds&updateMask.fieldPaths=updatedAt"+(updateTime?"&currentDocument.updateTime="+encodeURIComponent(updateTime):"");}
