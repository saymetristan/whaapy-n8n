# n8n-nodes-whaapy

This is an n8n community node for [Whaapy](https://whaapy.com) - WhatsApp Business API with AI.

Whaapy lets you automate WhatsApp conversations with AI-powered agents, manage contacts, funnels and broadcasts, and integrate with your existing workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Upgrading to 0.5

- Existing credentials and workflows keep working: no reconnection needed.
- Existing Whaapy nodes stay on node version 1 with their current behavior. New nodes are created as version 1.1, which adds template and funnel stage pickers, template variable mapping, multi-event triggers and signature verification.
- To use the 1.1 features in an existing workflow, add a new Whaapy node and copy the fields over.

## Operations

### Messages
- **Send**: Send a WhatsApp message (text, image, video, audio, document, template, interactive, location, contacts, sticker, reaction)
  - Send to a phone number or directly to a conversation ID (for example `data.conversation_id` from the trigger)
  - Media can be sent from a public URL or a **Media ID** returned by **Media → Upload**
  - Audio can be sent as a voice note
  - Text messages support link previews
- **Retry**: Retry a failed message

### Media
- **Upload**: Upload a binary file to WhatsApp and get a Media ID (Meta keeps it for 30 days)

### Conversations
- **List**, **Get**, **Get by Phone**, **Get Messages**
- **Close**, **Archive**, **Mark Read**, **Mark Unread**
- **Set AI**, **Pause AI**, **AI Suggest**

### Agent
- **Toggle**: Enable/disable AI globally
- **Pause**: Pause AI globally for X minutes

### Templates
- **List**, **Get**, **Get Variables**, **Sync**

In node version 1.1 you pick the template from a list, and **Template Variables** shows one field per `{{n}}` body placeholder and per dynamic URL button of the selected template.

If the locale you need is not listed, select **Custom (Enter Manually)** and provide the exact code (for example: `en_AU`).

For advanced template quick-reply tracking, you can optionally enable:
- **Allow Button Payload Override**: sends `allowButtonIdOverride: true`
- **Quick Reply Payload Overrides**: JSON map index -> payload (for example `{"0":"confirm_order","1":"talk_to_agent"}`)

By default, Whaapy keeps button payload IDs from the business template configuration.

### Contacts
- **List**, **Get** (by ID or phone), **Search**
- **Create**, **Create or Update** (by phone number), **Update**, **Delete**, **Merge**
- **Create Lead**: create/update a lead and optionally send a template in one call
- **Add Note**: add a note to the contact timeline
- **Bulk**: create, update, delete, add tags, remove tags or set funnel stage for up to 100 contacts
- **Get Tags**, **Get Fields**

Update tag fields accept comma-separated values:
- **Add Tags** adds tags without removing existing tags
- **Remove Tags** removes only the listed tags
- **Replace Tags** replaces all existing tags

Set **Assigned Agent ID** to `none` to unassign a contact.

### Funnel
- **List Stages**, **Get Stage**, **Create Stage**, **Update Stage**, **Delete Stage**
- **Reorder Stages**: list of stage IDs in the new order
- **Move Contact**: move a contact to a stage

### Broadcasts
- **Create** a draft with an approved template, **Add Recipients** (all contacts, segments or a phone list), **Send**
- **Pause**, **Resume**, **Cancel**, **Retry Failed**, **Delete**
- **Get**, **Get Many**, **Get Summary**, **Get Recipients**

### Team
- **Get Many Members**: agents with availability and assigned conversation count

### Trigger
Version 1.1 lets you select several events:
- Messages: `message.received`, `message.sent`, `message.delivered`, `message.read`, `message.failed`
- Conversations: `conversation.created`, `conversation.assigned`, `conversation.unassigned`, `conversation.closed`, `conversation.reopened`
- Contacts: `contact.created`, `contact.updated`, `contact.deleted`, `contact.merged`, `contact.stage_changed`
- Broadcasts: `broadcast.sent`, `broadcast.completed`, `broadcast.failed`

`conversation.created` fires only when a contact writes for the first time, or when you send the first message to a new number via API. Use `message.received` for per-message triggers.

Trigger options:
- **Verify Signature** (on by default): rejects requests whose `X-Webhook-Signature` does not match the webhook secret
- **Ignore Duplicate Deliveries** (on by default): skips retries of a delivery that already ran
- **Download Media**: downloads inbound media into binary data

Whaapy only delivers webhooks to public HTTPS URLs. For a local n8n, use a tunnel and set `WEBHOOK_URL` to it.

## AI Agent tool

The Whaapy node can be used as a tool by the n8n AI Agent. On self-hosted n8n, set `N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true`.

## Credentials

To use this node, you need a Whaapy API Key. Get yours from [app.whaapy.com](https://app.whaapy.com) → Settings → API Keys.

If an operation fails with "missing the scope", edit the API key in Whaapy and add the scope. You don't need to recreate the credential in n8n.

## Resources

- [Whaapy n8n guide](https://docs.whaapy.com/integrations/n8n)
- [Whaapy Documentation](https://docs.whaapy.com)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
