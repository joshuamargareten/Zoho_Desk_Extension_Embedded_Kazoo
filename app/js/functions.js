// functions.js
// Lightweight helpers for Desk + shared parsing, with defensive error handling

const TEKLINKDESK = (function () {
    let orgId = null, contactId = null, accountId = null;
  
    /** Parse ZohoDesk.request() envelope safely */
    function parseDesk(res) {
      // Zoho wraps twice: stringified outer, stringified inner
      try {
        const outer = JSON.parse(res);
        const inner = JSON.parse(outer.response);
        return inner.statusMessage;
      } catch (e) {
        console.error("[parseDesk] Failed to parse response:", e, res);
        return null;
      }
    }
  
    /** Generic Desk GET */
    async function deskGet(url, data = {}) {
      try {
        const r = await ZOHODESK.request({
          url,
          headers: { "Content-Type": "application/json" },
          type: "GET",
          data: { orgId, ...data },
          connectionLinkName: "zohodesk2",
          postBody: {}
        });
        return parseDesk(r);
      } catch (e) {
        console.error(`[deskGet] ${url} failed`, e);
        throw e;
      }
    }
  
    const getOrgId = async () => {
      const res = await ZOHODESK.get("portal.id");
      orgId = res["portal.id"];
    };
  
    const getContactId = async () => {
      const res = await ZOHODESK.get("ticket.contactId");
      contactId = res["ticket.contactId"];
    };
  
    const getAccountId = async () => {
      // get account name from current ticket, then resolve the specific Account ID from the contact’s accounts
      const tn = await ZOHODESK.get("ticket.accountName");
      const accountName = tn["ticket.accountName"] || null;
      if (!contactId || !accountName) { accountId = null; return; }
  
      const msg = await ZOHODESK.request({
        url: `https://desk.zoho.com/api/v1/contacts/${contactId}/accounts`,
        headers: { "Content-Type": "application/json" },
        type: "GET",
        data: { orgId },
        connectionLinkName: "zohodesk2",
        postBody: {}
      });
  
      const parsed = parseDesk(msg);
      const accounts = parsed?.data || [];
      const match = accounts.find(a => a.accountName === accountName);
      accountId = match ? match.id : null;
    };
  
    const init = async () => {
      try {
        await getOrgId();
        await getContactId();
        await getAccountId();
        return TEKLINKDESK;
      } catch (e) {
        console.error("[TEKLINKDESK.init] failed", e);
        throw e;
      }
    };
  
    return {
      init,
      parseDesk, // export for reuse
      deskGet,
  
      /** Fetch current ticket’s Account object (null-safe) */
      fetchAccount: async () => {
        if (!accountId) return null;
        const msg = await deskGet(`https://desk.zoho.com/api/v1/accounts/${accountId}`);
        return msg; // full statusMessage (has data fields)
      },
    };
  })();
  
  // Global handle
  let TEKLINK = null;
  
  ZOHODESK.extension.onload().then((App) => {
    TEKLINKDESK.init()
      .then((helpers) => {
        TEKLINK = helpers;
        TEKLINK.App = App;
        console.log("TEKLINK helpers ready");
        document.dispatchEvent(new Event("TEKLINK_READY"));
      })
      .catch(err => {
        console.error("TEKLINKDESK.init failed:", err);
        ZOHODESK.showpopup({
          title: "Init Error",
          content: "Failed to initialize helpers. Check console for details.",
          type: "error", color: "red", contentType: "html"
        });
      });
  });
  