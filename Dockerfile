FROM node:12

WORKDIR /public/app

COPY package.json ./

COPY package-lock.json ./

RUN npm install

COPY ./ ./

# Add bash
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]