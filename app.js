import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';
import { DiscordRequest, getRandomEmoji, getRoleColour } from './utils.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
const queues = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;
  client.user.set

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }
  if (type === InteractionType.aci)

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: `hello world :P ${getRandomEmoji()}`,
        },
      });
    }
    if (name === 'new') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: `wagwan ladies`,
          embeds: [{
            "title": "embed test :)",
            "description": "embed description :)"
          }]
        },
      });
    }
    if (name === 'queue' && id) {
      // Retrieve the selected game role from the command options
      const context = req.body.context;
      // User ID is in user field for (G)DMs, and member for servers
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
      // User's object choice (ROLE ID)
      const objectName = req.body.data.options[0].value;
      console.log(`User <@${userId}> created message`);
      const queueId = id;
      if (!queues[queueId]) {
        queues[queueId] = {
          accept: [userId],
          decline: [],
          tentative: [],
        };
      }
      const guildId = req.body.guild_id;
      const roleColour = await getRoleColour(guildId, objectName)
      // Respond with the selected game role
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `<@&${objectName}>`,
          allowed_mentions: {
            parse: ["roles"]
          },
          embeds: [
            {
              title: `Game queue`,
              description: `<@&${objectName}>`,
              color: roleColour,
              fields: [
                {
                  name: "Accept ✅",
                  value: queues[queueId].accept.length > 0
                  ? queues[queueId].accept.map(id => `<@${id}>`).join('\n')
                  : "No one",
                  inline: true
                },
                {
                  name: "Decline ❌",
                  value: queues[queueId].accept.length > 0
                  ? queues[queueId].decline.map(id => `<@${id}>`).join('\n')
                  : "No one",
                  inline: true
                },
                {
                  name: "Tentative ❔",
                  value: queues[queueId].accept.length > 0
                  ? queues[queueId].tentative.map(id => `<@${id}>`).join('\n')
                  : "No one",
                  inline: true
                }
              ]
            }
          ],
        
        components: [
          {
            type: MessageComponentTypes.ACTION_ROW,
            components: [
              {
                type: MessageComponentTypes.BUTTON,
                custom_id: `acceptbutton_${queueId}_${objectName}_${roleColour}`,
                label: 'Accept ✅',
                style: ButtonStyleTypes.SUCCESS,
              },
              {
                type: MessageComponentTypes.BUTTON,
                custom_id: `declinebutton_${queueId}_${objectName}_${roleColour}`,
                label: 'Decline ❌',
                style: ButtonStyleTypes.DANGER,
              },
              {
                type: MessageComponentTypes.BUTTON,
                custom_id: `tentbutton_${queueId}_${objectName}_${roleColour}`,
                label: 'Tentative ❔',
                style: ButtonStyleTypes.SECONDARY,
              },
            ],
          },
        ],
      },
      });
    }

console.error(`unknown command: ${name}`);
return res.status(400).json({ error: 'unknown command' });
  }
if (type === InteractionType.MESSAGE_COMPONENT) {
  const componentId = data.custom_id;

  const userId = req.body.member?.user?.id || req.body.user?.id;
  const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
  // end point for patching/editing currrent message
  const [action, queueId, roleId, Embedcolor] = componentId.split('_');
  console.log(action, queueId, roleId, Embedcolor);
  if (!queues[queueId]) { //does queue exist?
    return res.status(400).send({ error: 'Queue not found' });
  }
  switch (action)
  {
    case 'acceptbutton':
      console.log(`User <@${userId}> clicked accept`);
      queues[queueId].accept = [...queues[queueId].accept.filter(id => id !== userId), userId];
      queues[queueId].decline = queues[queueId].decline.filter(id => id !== userId);
      queues[queueId].tentative = queues[queueId].tentative.filter(id => id !== userId);
      break;
    case 'declinebutton':
      console.log(`User <@${userId}> clicked decline`,'');
      queues[queueId].decline = [...queues[queueId].decline.filter(id => id !== userId), userId];
      queues[queueId].accept = queues[queueId].accept.filter(id => id !== userId);
      queues[queueId].tentative = queues[queueId].tentative.filter(id => id !== userId);
      break;
    case 'tentbutton':
      console.log(`User <@${userId}> clicked tentative`,'');
      queues[queueId].tentative = [...queues[queueId].tentative.filter(id => id !== userId), userId];
      queues[queueId].accept = queues[queueId].accept.filter(id => id !== userId);
      queues[queueId].decline = queues[queueId].decline.filter(id => id !== userId);
      break;
  }
  console.log(queues[queueId]);
  try {
    return res.send({
      type: InteractionResponseType.UPDATE_MESSAGE,
      content: queues[queueId],
      data: {
        embeds: [
          {
            title: `Game queue`,
            description: `<@&${roleId}>`,
            color: Embedcolor,
            fields: [
              {
                name: "Accept ✅",
                value: queues[queueId].accept.length > 0
                ? queues[queueId].accept.map(id => `<@${id}>`).join('\n')
                : "",
                inline: true
              },
              {
                name: "Decline ❌",
                value: queues[queueId].decline.length > 0
                ? queues[queueId].decline.map(id => `<@${id}>`).join('\n')
                : "",
                inline: true
              },
              {
                name: "Tentative ❔",
                value: queues[queueId].tentative.length > 0
                ? queues[queueId].tentative.map(id => `<@${id}>`).join('\n')
                : "",
                inline: true
              }
            ]
          }
        ],
      }
    })
  } catch (err) {
    console.error(err);
  }

  

  
}

console.error('unknown interaction type', type);
return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
