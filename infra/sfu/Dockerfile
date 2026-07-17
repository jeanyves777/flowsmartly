# Training Room media server (mediasoup SFU).
#
# mediasoup builds a native C++ worker, so this is a two-stage build: compile the
# worker with the toolchain, then ship only the result. Keeps the runtime image
# free of build-essential/python.
FROM node:20-bookworm-slim AS build

# mediasoup's worker needs python3 + a C++ toolchain to build. None of this
# survives into the final image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
# No lockfile is committed for this service — it has 3 deps and lives on its own
# box. `npm install` is fine here; the app's lockfile is a separate concern.
RUN npm install --omit=dev

# ---

FROM node:20-bookworm-slim
WORKDIR /app

# The prebuilt worker binary is dynamically linked against libstdc++.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY package.json server.js ./

ENV NODE_ENV=production
EXPOSE 4443

# The signalling port answers /health — used by the compose healthcheck and pm2.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.SFU_PORT||4443)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
