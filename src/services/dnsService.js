/**
 * DNS automation helper for Hostinger hPanel DNS API in Neurolinks Control.
 */

const dnsService = {
  async deleteDnsRecords(records) {
    let token = process.env.HOSTINGER_API_TOKEN;
    let domain = process.env.HOSTINGER_DOMAIN || "clientesneurolinks.com";

    // Clean quotes if present
    if (token) token = token.replace(/^"(.*)"$/, "$1");
    if (domain) domain = domain.replace(/^"(.*)"$/, "$1");

    if (!token || token === "PLACEHOLDER_TOKEN") {
      console.warn(`[DNS] ⚠️ Hostinger API Token is not configured. Skipping DNS records deletion.`);
      return false;
    }

    if (!records || records.length === 0) return true;

    try {
      console.log(`[DNS] Deleting ${records.length} record(s):`, JSON.stringify(records));
      const deleteUrl = `https://developers.hostinger.com/api/dns/v1/zones/${domain}`;
      const delRes = await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ filters: records })
      });

      if (!delRes.ok) {
        const text = await delRes.text();
        throw new Error(`Hostinger DELETE API returned HTTP ${delRes.status}: ${text}`);
      }

      const delData = await delRes.json();
      console.log(`[DNS] ✅ Deleted records successfully. Response:`, delData);
      return true;
    } catch (error) {
      console.error(`[DNS] ❌ Error deleting DNS records:`, error.message);
      return false;
    }
  }
};

module.exports = dnsService;
