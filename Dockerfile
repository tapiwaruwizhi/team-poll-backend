FROM node:16

WORKDIR /app

# Install netcat (nc)
RUN apt-get update && apt-get install -y netcat

COPY package*.json ./
RUN npm install

COPY . .

COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

EXPOSE 3000

CMD ["/wait-for-it.sh", "mysql", "--", "node", "index.js"]
