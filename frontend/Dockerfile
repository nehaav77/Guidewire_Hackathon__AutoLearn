FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Install a simple static server
RUN npm install -g serve

EXPOSE 5173

# Serve the static build with single-page app support (-s)
CMD ["serve", "-s", "dist", "-l", "5173"]
