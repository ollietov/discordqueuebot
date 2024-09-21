# Discord Queue Bot

<p align="center">
  <img src="botcatnoneck.png" alt="Discord Queue Bot Logo" width="200"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/discord-bot-blue.svg" alt="discord bot">
  <img src="https://img.shields.io/badge/cloudflare-workers-orange.svg" alt="cloudflare">
</p>
A Discord bot that creates and manages game queues for different roles, built with Javascript and hosted on Cloudflare workers.

## Overview

This bot allows Discord server members to create and manage game queues for specific game roles. It runs on Cloudflares workers and the queues are stored using Cloudflare KV.

## Features

- Create game queues for specific roles
- Join, leave or mark as a maybe in queues
- Silent ping option
- Automatically clean up inactive queues
