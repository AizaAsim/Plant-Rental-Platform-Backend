FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

RUN chmod +x scripts/docker-entrypoint.sh

EXPOSE 3002

CMD ["scripts/docker-entrypoint.sh"]