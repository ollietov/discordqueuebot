import { AutoRouter } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';
import { QUEUE_COMMAND } from './commands.js';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

const router = AutoRouter();
const queues = {};

function cleanupOldQueues() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour in milliseconds
  for (const [queueId, queue] of Object.entries(queues)) {
    if (queue.createdAt < oneHourAgo) {
      delete queues[queueId];
      console.log(`Deleted old queue: ${queueId}`);
    }
  }
}


async function getRoleColour(guildId, roleId, env) {
  try {
    if (!guildId || !roleId) {
      throw new Error('Invalid guildId or roleId');
    }
    console.log("GETTING ROLE COLOUR");
    const url = `https://discord.com/api/v10/guilds/${guildId}/roles`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const roles = await response.json();
    const role = roles.find(r => r.id === roleId);
    return role ? role.color : 0;
  } catch (error) {
    console.error('Error fetching role color:', error);
    return 0; // Default color if there's an error
  }
}

router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post('/', async (request, env) => {
  cleanupOldQueues();
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  const { type, data, id, member, user, guild_id, token } = interaction;

  if (type === InteractionType.PING) {
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    console.log("APPLICATION COMMAND");
    if (name === 'queue' && id) {
      // Respond immediately to avoid timeout
      console.log("QUEUE COMMAND");
      // Process the command asynchronously
      const userId = member?.user?.id || user?.id;
      const objectName = data.options[0].value;
      const isSilent = data.options[1]?.value ?? false;
      console.log(`User <@${userId}> created queue for role ${objectName}. Silent: ${isSilent}`);
      const queueId = id;
      console.log("QUEUE ID", queueId);
      console.log("Created at", Date.now());
      if (!queues[queueId]) {
        queues[queueId] = {
          accept: [userId],
          decline: [],
          tentative: [],
          createdAt: Date.now()
        };
      }
      console.log("QUEUE ID", queueId);
      console.log("GUILD ID", guild_id);
      console.log("OBJECT NAME", objectName);
      const roleColour = await getRoleColour(guild_id, objectName);

      const messageData = {
        content: `<@&${objectName}>`,
        allowed_mentions:  isSilent
          ? { parse: []}
          : { parse: ["roles"] },
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
                value: queues[queueId].decline.length > 0
                  ? queues[queueId].decline.map(id => `<@${id}>`).join('\n')
                  : "No one",
                inline: true
              },
              {
                name: "Tentative ❔",
                value: queues[queueId].tentative.length > 0
                  ? queues[queueId].tentative.map(id => `<@${id}>`).join('\n')
                  : "No one",
                inline: true
              }
            ],
            footer: {
              text: "Join the queue by clicking the buttons below!"
            },
            timestamp: new Date().toISOString()
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
      };
      return new JsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: messageData.content,
          allowed_mentions: messageData.allowed_mentions,
          embeds: messageData.embeds,
          components: messageData.components,
        },
      });
    }

  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = data.custom_id;
    const userId = member?.user?.id || user?.id;
    const [action, queueId, roleId, Embedcolor] = componentId.split('_');
    console.log(action, queueId, roleId, Embedcolor);
    if (!queues[queueId]) {
      return new JsonResponse({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "This queue has expired. Please create a new one.",
          flags: 64 // Ephemeral flag
        }
      });
    }
    switch (action) {
      case 'acceptbutton':
        console.log(`User <@${userId}> clicked accept`);
        queues[queueId].accept = [...queues[queueId].accept.filter(id => id !== userId), userId];
        queues[queueId].decline = queues[queueId].decline.filter(id => id !== userId);
        queues[queueId].tentative = queues[queueId].tentative.filter(id => id !== userId);
        break;
      case 'declinebutton':
        console.log(`User <@${userId}> clicked decline`, '');
        queues[queueId].decline = [...queues[queueId].decline.filter(id => id !== userId), userId];
        queues[queueId].accept = queues[queueId].accept.filter(id => id !== userId);
        queues[queueId].tentative = queues[queueId].tentative.filter(id => id !== userId);
        break;
      case 'tentbutton':
        console.log(`User <@${userId}> clicked tentative`, '');
        queues[queueId].tentative = [...queues[queueId].tentative.filter(id => id !== userId), userId];
        queues[queueId].accept = queues[queueId].accept.filter(id => id !== userId);
        queues[queueId].decline = queues[queueId].decline.filter(id => id !== userId);
        break;
    }
    console.log(queues[queueId]);
    try {
      return new JsonResponse({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: [
            {
              title: `Game queue`,
              description: `<@&${roleId}>`,
              color: parseInt(Embedcolor),
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
                  value: queues[queueId].decline.length > 0
                    ? queues[queueId].decline.map(id => `<@${id}>`).join('\n')
                    : "No one",
                  inline: true
                },
                {
                  name: "Tentative ❔",
                  value: queues[queueId].tentative.length > 0
                    ? queues[queueId].tentative.map(id => `<@${id}>`).join('\n')
                    : "No one",
                  inline: true
                }
              ],
              footer: {
                text: "Join the queue by clicking the buttons below!"
              },
              timestamp: new Date().toISOString()
            }
          ],
        }
      });
    } catch (err) {
      console.error(err);
      return new JsonResponse({ error: 'An error occurred' }, { status: 500 });
    }
  }

  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default server;