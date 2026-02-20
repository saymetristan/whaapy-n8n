# n8n-nodes-whaapy

This is an n8n community node for [Whaapy](https://whaapy.com) - WhatsApp Business API with AI.

Whaapy lets you automate WhatsApp conversations with AI-powered agents, manage contacts, send messages, and integrate with your existing workflows.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

### Messages
- **Send**: Send a WhatsApp message (text, image, video, audio, document, template, interactive, location, contacts, sticker, reaction)
- **Retry**: Retry a failed message

### Media
- **Upload**: Upload media to WhatsApp CDN

### Conversations
- **List**: Get all conversations
- **Get**: Get a specific conversation
- **Get by Phone**: Find conversation by phone number
- **Get Messages**: Get message history
- **Close**: Close a conversation
- **Archive**: Archive a conversation
- **Mark Read**: Mark as read
- **Set AI**: Enable/disable AI for conversation
- **Pause AI**: Pause AI temporarily
- **AI Suggest**: Get AI suggestion without sending

### Agent
- **Toggle**: Enable/disable AI globally
- **Pause**: Pause AI globally for X minutes

### Templates
- **List**: Get all WhatsApp templates
- **Get**: Get a specific template
- **Get Variables**: Get available template variables
- **Sync**: Sync templates from Meta

When sending `template` messages, the `Language` field includes a broad set of Meta-compatible locale codes.  
If the locale you need is not listed, select **Custom (Enter manually)** and provide the exact code (for example: `en_AU`).

For advanced template quick-reply tracking, you can optionally enable:
- **Allow Button Payload Override**: sends `allowButtonIdOverride: true`
- **Quick Reply Payload Overrides**: JSON map index -> payload (for example `{"0":"confirm_order","1":"talk_to_agent"}`)

By default, Whaapy keeps button payload IDs from the business template configuration.

### Contacts
- **List**: Get all contacts
- **Get**: Get a specific contact
- **Create**: Create a new contact
- **Update**: Update a contact
- **Delete**: Delete a contact
- **Search**: Advanced search
- **Bulk**: Bulk operations
- **Merge**: Merge two contacts
- **Get Tags**: Get all tags
- **Get Fields**: Get custom fields

### Funnel
- **List Stages**: Get all funnel stages
- **Get Stage**: Get a specific stage
- **Create Stage**: Create a new stage
- **Update Stage**: Update a stage
- **Delete Stage**: Delete a stage
- **Reorder Stages**: Reorder stages
- **Move Contact**: Move contact to stage

### Trigger
Listen for webhook events:
- `message.received` - Incoming message
- `message.sent` - Message sent
- `message.delivered` - Message delivered
- `message.read` - Message read
- `message.failed` - Message failed
- `conversation.created` - New conversation (fires only when a contact writes for the first time, or when you send the first message to a new number via API; use `message.received` for per-message triggers)
- `conversation.updated` - Conversation updated
- `conversation.handoff` - Handoff to human

## Credentials

To use this node, you need a Whaapy API Key. Get yours from [app.whaapy.com](https://app.whaapy.com) → Settings → API Keys.

## Resources

- [Whaapy Documentation](https://docs.whaapy.com)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE)
