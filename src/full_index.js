import { Router } from 'itty-router';
import {
  InteractionType,
  InteractionResponseType,
  verifyKey,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';

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

const router = Router();
const queues = {};

async function getRoleColour(guildId, roleId) {
  // Implement this function to fetch role color from Discord API
  // For now, returning a default color
  return 0x00ff00;
}

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post('/', async (request, env) => {
  const { isValid, interaction } = await verifyDiscordRequest(request, env);
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const { name, options } = interaction.data;

    if (name === 'queue') {
      const userId = interaction.member.user.id;
      const objectName = options[0].value;
      const queueId = interaction.id;
      if (!queues[queueId]) {
        queues[queueId] = {
          accept: [userId],
          decline: [],
          tentative: [],
        };
      }
      const roleColour = await getRoleColour(interaction.guild_id, objectName);

      return new JsonResponse({
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
        },
      });
    }
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = interaction.data.custom_id;
    const userId = interaction.member.user.id;
    const [action, queueId, roleId, Embedcolor] = componentId.split('_');

    if (!queues[queueId]) {
      return new JsonResponse({ error: 'Queue not found' }, { status: 400 });
    }

    switch (action) {
      case 'acceptbutton':
        queues[queueId].accept = [...queues[queueId].accept.filter(id => id !== userId), userId];
        queues[queueId].decline = queues[queueId].decline.filter(id => id !== userId);
        queues[queueId].tentative = queues[queueId].tentative.filter(id => id !== userId);
        break;
      case 'declinebutton':
        queues[queueId].decline = [...queues[queueId].decline.filter(id => id !== userId), userId];
        queues[queueId].accept = queues[queueId].accept.filter(id => id !== userId);
        queues[queueId].tentative = queues[queueId].tentative.filter(id => id !== userId);
        break;
      case 'tentbutton':
        queues[queueId].tentative = [...queues[queueId].tentative.filter(id => id !== userId), userId];
        queues[queueId].accept = queues[queueId].accept.filter(id => id !== userId);
        queues[queueId].decline = queues[queueId].decline.filter(id => id !== userId);
        break;
    }

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
            ]
          }
        ],
      }
    });
  }

  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});

router.all('*', () => new Response('Not Found.', { status: 404 }));

export default {
  fetch: request => router.handle(request)
};