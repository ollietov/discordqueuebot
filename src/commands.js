
export const QUEUE_COMMAND = {
  name: 'queue',
  description: 'create a queue for game role',
  options: [
    {
      type: 8,
      name: 'gamerole',
      description: 'choose a game role',
      required: true,
    },
    {
      type: 5,
      name: 'silent',
      description: 'make the ping silent (no notification)',
      required: false,
    },
    {
      type: 7,
      name: 'voice_channel',
      description: 'Select a voice channel to play in',
      required: false,
      channel_types: [2]
    },
  ],

  type: 1,
  integration_types: [0, 1],
  contexts: [0, 2],
};


