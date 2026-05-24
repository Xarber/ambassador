# Hack Club's Stardance Ambassador
Oooh yeah! Next.js 16 website for the [2026 Stardance ambassador program](https://ambassador.hackclub.com).

# Translations
Want to translate the posters into your region's language? See [this document.](https://github.com/hackclub/ambassador/wiki/Translations).

# Help me set this up
The following instructions are for a development environment. It is recommended that you set it up with the `Dockerfile.app` and `Dockerfile.qreader` profiles for production, especially on Coolify, so that you have rolling deploys!

## Environment variables
Required:
- `JWT_SECRET`: Set it to anything you want. Preferably a secure string.
- `CURRENT_DOMAIN, HCA_CLIENT_ID, HCA_CLIENT_SECRET, HCA_ISSUER` so login works. You might have to remove the address scope which can break things.
- Everything else is optional! Check .env.example for other options. 

## Setup
Once you've set the environment variables, it's very simple-- you just need Docker and Docker compose installed. Run this command:
```
docker compose --profile app up
```

And you should be ready to go! Make sure ports `7171`, `7172` and `4445` are free for the application, qr service and postgres instance respectively.