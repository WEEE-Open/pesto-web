FROM node:latest

ARG DEVELOPMENT

# Expose environment variables
ENV DEVELOPMENT=${DEVELOPMENT}

# Working directory
WORKDIR /usr/src/app

# I know this is supposed to be after npm install but for whatever reason vite doesn't get installed if I do that

# Copy package.json and package-lock.json
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

RUN if [ "$DEVELOPMENT" != "true" ]; \
	then npm run frontend:prod; \
fi

# Expose ports
EXPOSE 3000
EXPOSE 5173

# Run the server
CMD if [ "$DEVELOPMENT" = "true" ]; \
	then npm run dev; \
else \
	npm run backend:prod; \
fi