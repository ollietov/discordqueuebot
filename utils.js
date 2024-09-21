import 'dotenv/config';

export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

export async function getRoleColour(guildId, roleId) {
  try {
    if (!guildId || !roleId) {
      throw new Error('Invalid guildId or roleId');
    }
    const response = await DiscordRequest(`guilds/${guildId}/roles`, { method: 'GET' });
    const roles = await response.json();
    const role = roles.find(r => r.id === roleId);
    return role ? role.color : 0;
  } catch (error) {
    console.error('Error fetching role color:', error);
    return 0; // Default color if there's an error
  }
}


export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
