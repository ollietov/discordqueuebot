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

async function cleanupOldQueues(env) {
  console.log("Starting cleanup of old queues");
  const now = Date.now();
  const twelveHoursAgo = now - (12 * 60 * 60 * 1000);

  try {
    const listResult = await env.QUEUES.list();
    if (!listResult.keys.length) {
      console.log("No queues found");
      return;
    }

    for (const key of listResult.keys) {
      try {
        const queueData = await env.QUEUES.get(key.name, { type: "json" });
        if (!queueData) {
          console.log(`No data found for queue: ${key.name}`);
          continue;
        }

        const lastUpdateTime = queueData.lastUpdated || queueData.createdAt || 0;
        if (lastUpdateTime < twelveHoursAgo) {
          console.log(`Removing old queue: ${key.name}`);
          await env.QUEUES.delete(key.name);
        } else if (!queueData.lastUpdated) {
          queueData.lastUpdated = lastUpdateTime;
          await env.QUEUES.put(key.name, JSON.stringify(queueData));
          console.log(`Updated lastUpdated for queue: ${key.name}`);
        }
      } catch (error) {
        console.error(`Error processing queue ${key.name}:`, error);
      }
    }
    
    console.log("Cleanup of old queues completed");
  } catch (error) {
    console.error("Error during cleanup of old queues:", error);
  }
}

async function getRoleColour(guildId, roleId, env) {
  try {
    if (!guildId || !roleId) {
      console.error('Invalid guildId or roleId:', { guildId, roleId });
      return 0; // Default to black
    }
    
    // console.log("Fetching role colour for:", { guildId, roleId });
    const url = `https://discord.com/api/v10/guilds/${guildId}/roles`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      return 0; // Default to black
    }

    const roles = await response.json();
    //console.log("Fetched roles:", roles);

    const role = roles.find(r => r.id === roleId);
    if (!role) {
      console.error('Role not found:', roleId);
      return 0; // Default to black
    }

    console.log("Found role:", role);
    return role.color || 0; // Return 0 (black) if color is falsy
  } catch (error) {
    console.error('Error in getRoleColour:', error);
    return 0; // Default to black
  }
}

router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post('/', async (request, env) => {

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
  cleanupOldQueues(env);
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;
    console.log("APPLICATION COMMAND");
    if (name === 'queue' && id) {
      // Process the command asynchronously
      const userId = member?.user?.id || user?.id;
      const objectName = data.options[0].value;
      const isSilentOption = data.options.find(opt => opt.name === 'silent');
      const isSilent = isSilentOption ? isSilentOption.value : false;
      const voiceChannelOption = data.options.find(opt => opt.name === 'voice_channel');
      const voiceChannelId = voiceChannelOption ? voiceChannelOption.value : null;
      console.log(`User <@${userId}> created queue for role ${objectName}. Silent: ${isSilent}`);
      const queueId = id;
      const queue = {
        accept: [userId],
        decline: [],
        tentative: [],
        createdAt: Date.now(),
        lastUpdated: Date.now()
      }
      await env.QUEUES.put(queueId, JSON.stringify(queue));
      const roleColour = await getRoleColour(guild_id, objectName, env);

      const messageData = {
        content: `<@&${objectName}>`,
        allowed_mentions:  isSilent
          ? { parse: []}
          : { parse: ["roles"] },
        embeds: [
          {
            title: `Game queue`,
            description: voiceChannelId ? `<@&${objectName}> in <#${voiceChannelId}>` : `<@&${objectName}>`,
            color: roleColour,
            fields: [
              {
                name: "Accept ✅",
                value: queue.accept.length > 0
                  ? queue.accept.map(id => `<@${id}>`).join('\n')
                  : "No one",
                inline: true
              },
              {
                name: "Decline ❌",
                value: queue.decline.length > 0
                  ? queue.decline.map(id => `<@${id}>`).join('\n')
                  : "No one",
                inline: true
              },
              {
                name: "Tentative ❔",
                value: queue.tentative.length > 0
                  ? queue.tentative.map(id => `<@${id}>`).join('\n')
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
                custom_id: `acceptbutton_${queueId}_${objectName}_${roleColour}_${voiceChannelId}`,
                label: 'Accept ✅',
                style: ButtonStyleTypes.SUCCESS,
              },
              {
                type: MessageComponentTypes.BUTTON,
                custom_id: `declinebutton_${queueId}_${objectName}_${roleColour}_${voiceChannelId}`,
                label: 'Decline ❌',
                style: ButtonStyleTypes.DANGER,
              },
              {
                type: MessageComponentTypes.BUTTON,
                custom_id: `tentbutton_${queueId}_${objectName}_${roleColour}_${voiceChannelId}`,
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
    const [action, queueId, roleId, Embedcolor, voiceChannel] = componentId.split('_');
    console.log(action, queueId, roleId, Embedcolor, voiceChannel);
    const queue = await env.QUEUES.get(queueId, 'json');
    if (!queue) {
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
        queue.accept = [...queue.accept.filter(id => id !== userId), userId];
        queue.decline = queue.decline.filter(id => id !== userId);
        queue.tentative = queue.tentative.filter(id => id !== userId);
        break;
      case 'declinebutton':
        console.log(`User <@${userId}> clicked decline`, '');
        queue.decline = [...queue.decline.filter(id => id !== userId), userId];
        queue.accept = queue.accept.filter(id => id !== userId);
        queue.tentative = queue.tentative.filter(id => id !== userId);
        break;
      case 'tentbutton':
        console.log(`User <@${userId}> clicked tentative`, '');
        queue.tentative = [...queue.tentative.filter(id => id !== userId), userId];
        queue.accept = queue.accept.filter(id => id !== userId);
        queue.decline = queue.decline.filter(id => id !== userId);
        break;
    }
    queue.lastUpdated = Date.now();
    await env.QUEUES.put(queueId, JSON.stringify(queue));
    try {
      return new JsonResponse({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: [
            {
              title: `Game queue`,
              description: voiceChannel ? `<@&${roleId}> in <#${voiceChannel}>` : `<@&${roleId}>`,
              color: parseInt(Embedcolor),
              fields: [
                {
                  name: "Accept ✅",
                  value: queue.accept.length > 0
                    ? queue.accept.map(id => `<@${id}>`).join('\n')
                    : "No one",
                  inline: true
                },
                {
                  name: "Decline ❌",
                  value: queue.decline.length > 0
                    ? queue.decline.map(id => `<@${id}>`).join('\n')
                    : "No one",
                  inline: true
                },
                {
                  name: "Tentative ❔",
                  value: queue.tentative.length > 0
                    ? queue.tentative.map(id => `<@${id}>`).join('\n')
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