// Netlify auto-invokes a function literally named "submission-created" on the
// Netlify Forms "submission-created" event (no config needed — this is the
// default functions directory). It forwards the submission to the ILO portal
// CRM, which upserts a Lead (deduped by email/phone, idempotent by submission
// id). One lead capture path for the whole marketing site.
//
// Required site env vars (set by the orchestrator on the infinity-living-options
// Netlify site):
//   PORTAL_URL     e.g. https://infinityliving.netlify.app   (no trailing slash)
//   CONNECT_TOKEN  the SAME token value as the portal's CONNECT_TOKEN
//
// This ALWAYS returns 200, even when the portal is unreachable: Netlify retries
// non-2xx responses, which would create duplicate leads. The portal dedupes by
// submission id as the real safety net, so we never rely on retries here.

export default async (event) => {
    let payload
    try {
        payload = JSON.parse(event.body).payload
    } catch {
        console.error('submission-created: could not parse event body')
        return new Response('ok', { status: 200 })
    }

    const portalUrl = process.env.PORTAL_URL
    const token = process.env.CONNECT_TOKEN
    if (!portalUrl || !token) {
        console.error('submission-created: PORTAL_URL or CONNECT_TOKEN not configured — skipping')
        return new Response('ok', { status: 200 })
    }
    if (!payload) {
        console.error('submission-created: event had no payload')
        return new Response('ok', { status: 200 })
    }

    try {
        const res = await fetch(`${portalUrl.replace(/\/$/, '')}/api/connect/crm/lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                form_name: payload.form_name,
                data: payload.data,
                submissionId: payload.id,
            }),
        })
        const text = await res.text()
        console.log(`submission-created: ${payload.form_name} → portal ${res.status} ${text.slice(0, 300)}`)
    } catch (err) {
        // Swallow — the portal's replay-by-submission-id is the safety net, and a
        // non-2xx here would make Netlify retry and risk duplicates.
        console.error('submission-created: portal POST failed', err)
    }

    return new Response('ok', { status: 200 })
}
